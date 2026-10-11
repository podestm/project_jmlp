from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from ...database import get_db
from ... import models, schemas, auth
from ...utils import fix_encoding, category_display_sql, get_category_snapshot_for_birth_year
from ...services.slcr_links import MemberLinks

router = APIRouter(tags=["admin-racers"])


def _racer_columns(racer_data: schemas.RacerCreate, db: Session) -> dict:
    """Přeloží pole formuláře na sloupce modelu.

    Schéma používá historické názvy z frontendu (firstName, birthYear, ...),
    model má jiné. Bez tohohle překladu zakládání padalo na TypeError a úprava
    tiše zapsala jen oddíl - SQLAlchemy nenamapovaný atribut do UPDATE nedá,
    ale odpověď ho vrátila, takže to vypadalo jako úspěch.

    Kategorie se dopočítává tady, protože závisí na ročníku i pohlaví: závodník
    bez kategorie by nespadl do žádné startovky.
    """
    category_id, _, _ = get_category_snapshot_for_birth_year(
        racer_data.birthYear, racer_data.sex, db
    )
    return {
        "name": racer_data.firstName,
        "surname": racer_data.lastName,
        "sex": racer_data.sex,
        "year": racer_data.birthYear,
        "slcr_id": racer_data.idSlcr,
        "club_id": racer_data.club_id,
        "category_id": category_id,
    }


def _ensure_unique(columns: dict, db: Session, exclude_id: int | None = None) -> None:
    """Závodník se stejným jménem, příjmením, ročníkem a pohlavím už existuje?

    Registr to hlídá unikátním klíčem (jméno + příjmení + ročník + pohlaví je
    identita závodníka). Bez téhle kontroly úprava, která se trefí do jiného
    závodníka - typicky přejmenování "Viki" na "Viktorie", když se dítě
    přihlásilo dvakrát - skončila "Interní chybou serveru". Dotaz jde přes
    MySQL, takže porovnává stejně jako klíč (velikost písmen, mezery na konci).
    """
    existing = db.execute(text("""
        SELECT r.id, c.name AS club FROM fuj_jmlp_racer r
        LEFT JOIN fuj_jmlp_club c ON c.id = r.club_id
        WHERE r.name = :name AND r.surname = :surname AND r.year = :year AND r.sex = :sex
          AND (:exclude IS NULL OR r.id <> :exclude)
        LIMIT 1
    """), {**{k: columns[k] for k in ("name", "surname", "year", "sex")}, "exclude": exclude_id}).first()
    if existing:
        raise HTTPException(status_code=409, detail=_duplicate_message(columns, existing.id, existing.club))


def _duplicate_message(columns: dict, other_id, club) -> str:
    who = f"{columns['surname']} {columns['name']} ({columns['year']})"
    where = f", {fix_encoding(club)}" if club else ""
    ref = f" (ID {other_id}{where})" if other_id else ""
    return (f"Závodník {who} už v registru je{ref}. Jde nejspíš o stejného člověka "
            "zapsaného dvakrát - upravte nebo smažte jeden ze záznamů.")


@router.get("/racers", response_model=List[schemas.Racer])
def get_racers(
    skip: int = 0, 
    limit: int = 10000,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all racers for admin management."""
    # Use raw SQL to get racer with club name and category
    query = """
        SELECT r.id, r.name as firstName, r.surname as lastName, r.sex, r.year as birthYear, 
               r.club_id, r.slcr_id as idSlcr, r.category_id,
               CONVERT(CONVERT(c.name USING binary) USING utf8mb4) as club_name,
               {category_display} as category_name
        FROM fuj_jmlp_racer r 
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        LEFT JOIN fuj_jmlp_category cat ON r.category_id = cat.id
        ORDER BY r.surname, r.name
        LIMIT :limit OFFSET :skip
    """.format(category_display=category_display_sql("cat"))
    
    result = db.execute(text(query), {"limit": limit, "skip": skip}).fetchall()
    
    links = MemberLinks(db)
    racers = []
    for row in result:
        # Fix encoding for names
        first_name = fix_encoding(row.firstName) if row.firstName else None
        last_name = fix_encoding(row.lastName) if row.lastName else None
        club_name = fix_encoding(row.club_name) if row.club_name else None
        category_name = row.category_name or None  # display_name je čisté utf8mb4
        
        racer_data = {
            "id": row.id,
            "firstName": first_name,
            "lastName": last_name,
            "sex": row.sex,
            "birthYear": row.birthYear,
            "club_id": row.club_id,
            "idSlcr": row.idSlcr,
            "club_name": club_name,
            "category_id": row.category_id,
            "category_name": category_name,
            # Also include base fields for compatibility
            "name": first_name,
            "surname": last_name,
            "year": row.birthYear,
            "slcr_id": row.idSlcr,
            # Odkaz na kartu člena v evidenci SLČR, je-li závodník propojený.
            "slcr_url": links.url_for(last_name, first_name, row.birthYear, row.idSlcr),
        }
        racers.append(racer_data)
    
    return racers


@router.post("/racers", response_model=schemas.Racer)
def create_racer(
    racer_data: schemas.RacerCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new racer."""
    # Check if club exists
    if racer_data.club_id:
        club = db.query(models.Club).filter(models.Club.id == racer_data.club_id).first()
        if not club:
            raise HTTPException(status_code=400, detail="Klub neexistuje")
    
    columns = _racer_columns(racer_data, db)
    _ensure_unique(columns, db)
    db_racer = models.Racer(**columns)
    db.add(db_racer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_duplicate_message(columns, None, None))
    db.refresh(db_racer)
    
    # Fix encoding in the returned racer data
    if db_racer.name:
        db_racer.name = fix_encoding(db_racer.name)
    if db_racer.surname:
        db_racer.surname = fix_encoding(db_racer.surname)
    
    return db_racer


@router.put("/racers/{racer_id}", response_model=schemas.Racer)
def update_racer(
    racer_id: int,
    racer_data: schemas.RacerCreate,  # Using RacerCreate as update schema
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Update an existing racer."""
    db_racer = db.query(models.Racer).filter(models.Racer.id == racer_id).first()
    if not db_racer:
        raise HTTPException(status_code=404, detail="Závodník nenalezen")
    
    # Check if club exists when updating club_id
    if racer_data.club_id:
        club = db.query(models.Club).filter(models.Club.id == racer_data.club_id).first()
        if not club:
            raise HTTPException(status_code=400, detail="Klub neexistuje")
    
    columns = _racer_columns(racer_data, db)
    _ensure_unique(columns, db, exclude_id=racer_id)
    for field, value in columns.items():
        setattr(db_racer, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_duplicate_message(columns, None, None))
    db.refresh(db_racer)
    
    # Fix encoding in the returned racer data
    if db_racer.name:
        db_racer.name = fix_encoding(db_racer.name)
    if db_racer.surname:
        db_racer.surname = fix_encoding(db_racer.surname)
    
    return db_racer


@router.delete("/racers/{racer_id}")
def delete_racer(
    racer_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a racer."""
    db_racer = db.query(models.Racer).filter(models.Racer.id == racer_id).first()
    if not db_racer:
        raise HTTPException(status_code=404, detail="Závodník nenalezen")
    
    # Check if racer has any registrations
    registrations = db.query(models.Registration).filter(
        models.Registration.racer_id == racer_id
    ).first()
    if registrations:
        raise HTTPException(
            status_code=400, 
            detail="Nelze smazat závodníka s existujícími registracemi"
        )
    
    db.delete(db_racer)
    db.commit()
    return {"message": "Závodník úspěšně smazán"}