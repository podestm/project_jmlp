from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from ...database import get_db
from ... import models, schemas, auth
from ...models import AttachmentOwner, AttachmentRole
from ...services import attachments as attachment_service
from ...utils import fix_encoding, convert_utf8_field

router = APIRouter(prefix="/clubs", tags=["admin-clubs"])


@router.get("/", response_model=List[schemas.Club])
def list_clubs(
    current_admin: models.AdminUser = Depends(auth.get_current_admin), db: Session = Depends(get_db)
):
    """Všechny platné kluby (pro dropdown při vyřizování žádostí)."""
    return (
        db.query(models.Club)
        .filter(models.Club.valid == True)
        .order_by(models.Club.name.asc())
        .all()
    )


@router.get("/overview")
def clubs_overview(
    current_admin: models.AdminUser = Depends(auth.get_current_admin), db: Session = Depends(get_db)
):
    """Kluby se závodníky, počtem pořádaných závodů a logem.

    Logo se používá v hlavičce výsledkové listiny závodu, který klub pořádá.
    """
    clubs = db.query(models.Club).order_by(models.Club.name.asc()).all()

    racer_counts = dict(
        db.execute(
            text(
                "SELECT club_id, COUNT(*) FROM fuj_jmlp_racer WHERE club_id IS NOT NULL GROUP BY club_id"
            )
        ).all()
    )
    organized_counts = dict(
        db.execute(
            text(
                "SELECT organizer_id, COUNT(*) FROM fuj_jmlp_race WHERE organizer_id IS NOT NULL GROUP BY organizer_id"
            )
        ).all()
    )

    logos = {
        row.owner_id: row.file_id
        for row in db.query(models.Attachment)
        .filter(
            models.Attachment.owner_type == AttachmentOwner.club.value,
            models.Attachment.role == AttachmentRole.logo.value,
        )
        .all()
    }

    return [
        {
            "id": club.id,
            "name": fix_encoding(club.name),
            "valid": bool(club.valid),
            "racers_count": racer_counts.get(club.id, 0),
            "organized_races_count": organized_counts.get(club.id, 0),
            "has_logo": club.id in logos,
        }
        for club in clubs
    ]


@router.delete("/{club_id}")
def delete_club(
    club_id: int,
    reassign_to: int | None = None,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Smaže klub a jeho závodníky i pořádané závody převede na jiný klub.

    Tabulky jsou MyISAM bez cizích klíčů, takže samotné smazání řádku by
    závodníkům nechalo club_id ukazující na neexistující klub - v přehledech by
    pak měli prázdnou příslušnost a nikde by to nebylo vidět. Proto se u klubu,
    na kterém něco visí, cílový klub vyžaduje.

    Logo se jen odpojí; soubor zůstává v knihovně dokumentů, stejně jako když
    se maže závod nebo příspěvek.
    """
    club = db.query(models.Club).filter(models.Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="Klub nenalezen")
    nazev = fix_encoding(club.name)

    zavodniku = (
        db.execute(
            text("SELECT COUNT(*) FROM fuj_jmlp_racer WHERE club_id = :id"), {"id": club_id}
        ).scalar()
        or 0
    )
    zavodu = (
        db.execute(
            text("SELECT COUNT(*) FROM fuj_jmlp_race WHERE organizer_id = :id"), {"id": club_id}
        ).scalar()
        or 0
    )

    cil = None
    cil_nazev = None
    if zavodniku or zavodu:
        if not reassign_to:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Na klubu {nazev} visí {zavodniku} závodníků "
                    f"a {zavodu} pořádaných závodů. Vyberte klub, na který se převedou."
                ),
            )
        if reassign_to == club_id:
            raise HTTPException(status_code=400, detail="Klub nelze převést sám na sebe")

        cil = db.query(models.Club).filter(models.Club.id == reassign_to).first()
        if not cil:
            raise HTTPException(status_code=404, detail="Cílový klub nenalezen")
        cil_nazev = fix_encoding(cil.name)

        db.execute(
            text("UPDATE fuj_jmlp_racer SET club_id = :novy WHERE club_id = :stary"),
            {"novy": cil.id, "stary": club_id},
        )
        db.execute(
            text("UPDATE fuj_jmlp_race SET organizer_id = :novy WHERE organizer_id = :stary"),
            {"novy": cil.id, "stary": club_id},
        )
        db.commit()

    odpojeno = attachment_service.detach_owner(db, AttachmentOwner.club.value, club_id)

    db.execute(text("DELETE FROM fuj_jmlp_club WHERE id = :id"), {"id": club_id})
    db.commit()

    return {
        "deleted_id": club_id,
        "name": nazev,
        "moved_racers": zavodniku if cil else 0,
        "moved_races": zavodu if cil else 0,
        "reassigned_to": cil.id if cil else None,
        "reassigned_to_name": cil_nazev if cil else None,
        "detached_logo": odpojeno > 0,
    }


@router.get("/requests/count")
def get_pending_count(
    current_admin: models.AdminUser = Depends(auth.get_current_admin), db: Session = Depends(get_db)
):
    """Počet nevyřízených žádostí o přiřazení klubu."""
    count = db.execute(
        text("SELECT COUNT(*) FROM fuj_jmlp_race_registration WHERE club_request_note IS NOT NULL")
    ).scalar()
    return {"count": count or 0}


@router.get("/requests", response_model=List[schemas.ClubRequestItem])
def list_pending_requests(
    current_admin: models.AdminUser = Depends(auth.get_current_admin), db: Session = Depends(get_db)
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
        result.append(
            schemas.ClubRequestItem(
                registration_id=row.registration_id,
                race_id=row.race_id,
                race_name=row.race_name or f"Závod #{row.race_id}",
                racer_id=row.racer_id,
                racer_name=f"{first} {last}".strip(),
                registered_at=row.registered_at,
                club_request_note=row.club_request_note,
                current_club_name=fix_encoding(row.current_club_name)
                if row.current_club_name
                else None,
            )
        )
    return result


@router.post("/requests/{registration_id}/resolve")
def resolve_club_request(
    registration_id: int,
    payload: schemas.ResolveClubRequest,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Vyřídí žádost o přiřazení klubu — přiřadí závodníkovi klub a smaže poznámku."""
    reg = (
        db.query(models.Registration)
        .filter(
            models.Registration.id == registration_id,
            models.Registration.club_request_note.isnot(None),
        )
        .first()
    )
    if not reg:
        raise HTTPException(status_code=404, detail="Žádost nenalezena nebo již vyřízena")

    if payload.club_id:
        club = (
            db.query(models.Club)
            .filter(models.Club.id == payload.club_id, models.Club.valid == True)
            .first()
        )
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
