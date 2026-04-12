from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from ...database import get_db
from ... import models, schemas, auth
from ...utils import fix_encoding, convert_utf8_field

router = APIRouter(prefix="/clubs", tags=["admin-clubs"])


@router.get("/", response_model=List[schemas.Club])
def list_clubs(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Všechny platné kluby (pro dropdown při vyřizování žádostí)."""
    return db.query(models.Club).filter(models.Club.valid == True).order_by(models.Club.name.asc()).all()


@router.get("/requests/count")
def get_pending_count(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Počet nevyřízených žádostí o přiřazení klubu."""
    count = db.execute(text(
        "SELECT COUNT(*) FROM fuj_jmlp_race_registration WHERE club_request_note IS NOT NULL"
    )).scalar()
    return {"count": count or 0}


@router.get("/requests", response_model=List[schemas.ClubRequestItem])
def list_pending_requests(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Seznam nevyřízených žádostí o přiřazení klubu."""
    query = text(f"""
        SELECT rr.id AS registration_id,
               rr.race_id,
               rr.racer_id,
               rr.registered_at,
               rr.club_request_note,
               {convert_utf8_field('rac.name')} AS racer_first_name,
               {convert_utf8_field('rac.surname')} AS racer_last_name,
               {convert_utf8_field('rc.race_nr')} AS race_name,
               {convert_utf8_field('c.name')} AS current_club_name
        FROM fuj_jmlp_race_registration rr
        JOIN fuj_jmlp_racer rac ON rac.id = rr.racer_id
        JOIN fuj_jmlp_race rc ON rc.id = rr.race_id
        LEFT JOIN fuj_jmlp_club c ON c.id = rac.club_id
        WHERE rr.club_request_note IS NOT NULL
        ORDER BY rr.registered_at DESC
    """)
    rows = db.execute(query).fetchall()

    result = []
    for row in rows:
        first = fix_encoding(row.racer_first_name).strip() if row.racer_first_name else ""
        last = fix_encoding(row.racer_last_name).strip() if row.racer_last_name else ""
        result.append(schemas.ClubRequestItem(
            registration_id=row.registration_id,
            race_id=row.race_id,
            race_name=row.race_name or f"Závod #{row.race_id}",
            racer_id=row.racer_id,
            racer_name=f"{first} {last}".strip(),
            registered_at=row.registered_at,
            club_request_note=row.club_request_note,
            current_club_name=fix_encoding(row.current_club_name) if row.current_club_name else None,
        ))
    return result


@router.post("/requests/{registration_id}/resolve")
def resolve_club_request(
    registration_id: int,
    payload: schemas.ResolveClubRequest,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Vyřídí žádost o přiřazení klubu — přiřadí závodníkovi klub a smaže poznámku."""
    reg = db.query(models.Registration).filter(
        models.Registration.id == registration_id,
        models.Registration.club_request_note.isnot(None)
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Žádost nenalezena nebo již vyřízena")

    if payload.club_id:
        club = db.query(models.Club).filter(models.Club.id == payload.club_id, models.Club.valid == True).first()
        if not club:
            raise HTTPException(status_code=404, detail="Klub nenalezen")
    else:
        name = payload.new_club_name.strip()
        club = db.query(models.Club).filter(models.Club.name == name).first()
        if not club:
            club = models.Club(name=name, valid=True)
            db.add(club)
            db.flush()

    racer = db.query(models.Racer).filter(models.Racer.id == reg.racer_id).first()
    if not racer:
        raise HTTPException(status_code=404, detail="Závodník nenalezen")

    racer.club_id = club.id
    reg.club_request_note = None
    db.commit()

    return {"ok": True, "club_id": club.id, "club_name": club.name}
