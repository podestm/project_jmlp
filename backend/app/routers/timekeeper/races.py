"""Timekeeper race listing - shows races with registration data."""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from ...database import get_db
from ... import models, schemas, auth
from ...models import AttachmentOwner, AttachmentRole
from ...services import attachments as attachment_service
from ...utils import fix_encoding, convert_utf8_field, to_roman

router = APIRouter(prefix="/races", tags=["timekeeper-races"])


@router.get("")
def get_races_for_timekeeper(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get all races with registration counts, ordered by date desc."""
    query = text(f"""
        SELECT r.id, r.race_nr, r.datum, r.closed, r.registration, r.season_id, r.is_live,
               {convert_utf8_field('a.name')} as areal_name,
               (SELECT COUNT(*) FROM fuj_jmlp_race_registration rr WHERE rr.race_id = r.id) as reg_count,
               (SELECT COUNT(*) FROM fuj_jmlp_race_start_list sl WHERE sl.race_id = r.id) as start_list_count
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        ORDER BY r.datum DESC
    """)
    rows = db.execute(query).fetchall()

    return [{
        "id": row.id,
        "race_nr": row.race_nr,
        "datum": row.datum.isoformat() if row.datum else None,
        "closed": bool(row.closed),
        "registration": bool(row.registration),
        "season_id": row.season_id,
        "is_live": bool(row.is_live),
        "areal_name": fix_encoding(row.areal_name) if row.areal_name else None,
        "reg_count": row.reg_count,
        "start_list_count": row.start_list_count,
    } for row in rows]


@router.put("/{race_id}/live")
def toggle_race_live(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Toggle live status for a race. Only one race can be live at a time."""
    current = db.execute(
        text("SELECT is_live FROM fuj_jmlp_race WHERE id = :id"),
        {"id": race_id}
    ).fetchone()

    if not current:
        raise HTTPException(status_code=404, detail="Race not found")

    new_val = 0 if bool(current.is_live) else 1

    # Unset all live races first
    db.execute(text("UPDATE fuj_jmlp_race SET is_live = 0"))
    if new_val:
        db.execute(text("UPDATE fuj_jmlp_race SET is_live = 1 WHERE id = :id"), {"id": race_id})
    db.commit()

    return {"is_live": bool(new_val), "race_id": race_id}


# ============================================================================
# HLAVIČKOVÉ ÚDAJE ZÁVODU
#
# Vyplňuje je časoměřič před závodem a tisknou se v hlavičce výsledkové
# listiny. GET se ukládá do IndexedDB, takže hlavička je dostupná i offline.
# ============================================================================

def _race_detail_payload(race: models.Race, db: Session) -> Dict[str, Any]:
    areal_name = None
    if race.areal_id:
        row = db.execute(text(f"""
            SELECT {convert_utf8_field('name')} as name
            FROM fuj_jmlp_areal WHERE id = :areal_id
        """), {"areal_id": race.areal_id}).first()
        areal_name = fix_encoding(row.name) if row else None

    organizer_name = None
    organizer_logo_url = None
    if race.organizer_id:
        club = db.query(models.Club).filter(models.Club.id == race.organizer_id).first()
        organizer_name = fix_encoding(club.name) if club else None
        logo = attachment_service.first_for_owner(
            db, AttachmentOwner.club.value, race.organizer_id, AttachmentRole.logo.value
        )
        organizer_logo_url = logo["download_url"] if logo else None

    # Pruh s logy sponzorů pod výsledkovou listinou (Admin → Závody → Sponzoři).
    sponsors = attachment_service.first_for_owner(
        db, AttachmentOwner.race.value, race.id, AttachmentRole.sponzori.value
    )

    season = db.query(models.Season).filter(models.Season.year_start == race.season_id).first()

    runs = db.query(models.RaceRun).filter(
        models.RaceRun.race_id == race.id
    ).order_by(models.RaceRun.run_number).all()

    return {
        "race_id": race.id,
        "race_nr": race.race_nr,
        # V listině se tiskne bez prefixu: "JMLP2025-05" -> "2025-05"
        "race_number_label": (race.race_nr or "").replace("JMLP", "") or None,
        "datum": race.datum,
        "areal_name": areal_name,
        "organizer_id": race.organizer_id,
        "organizer_name": organizer_name,
        "organizer_logo_url": organizer_logo_url,
        "sponsors_url": sponsors["download_url"] if sponsors else None,
        "season_id": race.season_id,
        "season_name": season.name if season else None,
        "edition": season.edition if season else None,
        "edition_label": f"{to_roman(season.edition)}." if season and season.edition else None,
        "race_director": race.race_director,
        "technical_delegate": race.technical_delegate,
        "chief_timekeeper": race.chief_timekeeper,
        # Počet kol se závodu nenastavuje: každá kategorie může jet jiný počet
        # kol, takže listina se řídí naměřenými daty (viz resultsPdf.js).
        "runs": [{
            "run_number": run.run_number,
            "course_setter": run.course_setter,
            "gates_count": run.gates_count,
            "conditions": run.conditions,
            "start_time": run.start_time,
            "course_length_m": run.course_length_m,
        } for run in runs],
    }


@router.get("/{race_id}/detail", response_model=schemas.RaceDetail)
def get_race_detail(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Hlavičkové údaje závodu."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    return _race_detail_payload(race, db)


@router.put("/{race_id}/detail", response_model=schemas.RaceDetail)
def update_race_detail(
    race_id: int,
    payload: schemas.RaceDetailUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Uloží hlavičkové údaje a údaje o jednotlivých kolech."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")

    data = payload.dict(exclude_unset=True)
    runs = data.pop("runs", None)

    for field, value in data.items():
        setattr(race, field, value)
    db.commit()

    if runs is not None:
        for run_data in runs:
            run_number = int(run_data["run_number"])
            existing = db.query(models.RaceRun).filter(
                models.RaceRun.race_id == race_id,
                models.RaceRun.run_number == run_number,
            ).first()
            if existing:
                for field, value in run_data.items():
                    if field != "run_number":
                        setattr(existing, field, value)
            else:
                db.add(models.RaceRun(race_id=race_id, **run_data))
        db.commit()

    db.refresh(race)
    return _race_detail_payload(race, db)
