"""Start list management - generate and manage start lists from registrations."""
import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from ...database import get_db
from ... import models, auth
from ...utils import (
    fix_encoding,
    convert_utf8_field,
    StandardExceptions,
    get_category_snapshot_for_birth_year,
)

router = APIRouter(tags=["timekeeper-start-list"])


def _clean_string(value: Any) -> str | None:
    if value is None:
        return None
    text_value = str(value).strip()
    return text_value or None


def _get_default_category_order(db: Session) -> list[int]:
    query = text("""
        SELECT id
        FROM fuj_jmlp_category
        WHERE active = 1
        ORDER BY min_birth_year DESC, sex DESC
    """)
    return [int(row.id) for row in db.execute(query).fetchall()]


def _get_effective_category_order(race: models.Race, db: Session) -> list[int]:
    if race.timekeeper_category_order:
        try:
            stored = json.loads(race.timekeeper_category_order)
            if isinstance(stored, list):
                normalized = []
                for item in stored:
                    try:
                        normalized.append(int(item))
                    except (TypeError, ValueError):
                        continue
                if normalized:
                    default_order = _get_default_category_order(db)
                    missing_defaults = [cat_id for cat_id in default_order if cat_id not in normalized]
                    return normalized + missing_defaults
        except json.JSONDecodeError:
            pass

    return _get_default_category_order(db)


def _get_category_rank_map(race: models.Race, db: Session) -> dict[int, int]:
    return {cat_id: idx for idx, cat_id in enumerate(_get_effective_category_order(race, db))}


def _get_racer_source_snapshot(racer_id: int, db: Session) -> Dict[str, Any]:
    query = text(f"""
        SELECT r.id,
               {convert_utf8_field('r.name')} as racer_name,
               {convert_utf8_field('r.surname')} as racer_surname,
               r.year as racer_year,
               r.sex as racer_sex,
               {convert_utf8_field('c.name')} as club_name
        FROM fuj_jmlp_racer r
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE r.id = :racer_id
    """)
    row = db.execute(query, {"racer_id": racer_id}).first()
    if not row:
        raise StandardExceptions.racer_not_found()

    return {
        "racer_id": row.id,
        "racer_name": fix_encoding(row.racer_name).strip() if row.racer_name else None,
        "racer_surname": fix_encoding(row.racer_surname).strip() if row.racer_surname else None,
        "racer_year": row.racer_year,
        "racer_sex": row.racer_sex,
        "club_name": fix_encoding(row.club_name) if row.club_name else None,
    }


def _find_or_create_club(club_name: str, db: Session) -> models.Club:
    club = db.query(models.Club).filter(models.Club.name == club_name).first()
    if club:
        return club

    club = models.Club(name=club_name, valid=True)
    db.add(club)
    db.flush()
    return club


def _get_or_create_manual_racer(data: Dict[str, Any], db: Session) -> tuple[models.Racer, dict[str, Any], bool]:
    racer_id = data.get("racer_id")
    racer_slcr_id = _clean_string(data.get("racer_slcr_id"))
    racer_telefon = _clean_string(data.get("racer_telefon"))
    racer_email = _clean_string(data.get("racer_email"))
    if racer_slcr_id and len(racer_slcr_id) > 10:
        raise StandardExceptions.bad_request("SLČR ID může mít maximálně 10 znaků")

    if racer_id not in (None, "", 0, "0"):
        racer = db.query(models.Racer).filter(models.Racer.id == int(racer_id)).first()
        if not racer:
            raise StandardExceptions.not_found("Závodník nenalezen")
        if racer_slcr_id:
            racer.slcr_id = racer_slcr_id
        if racer_telefon:
            racer.telefon = racer_telefon
        if racer_email:
            racer.email = racer_email
        return racer, _get_racer_source_snapshot(racer.id, db), False

    racer_name = _clean_string(data.get("racer_name", data.get("name_override")))
    racer_surname = _clean_string(data.get("racer_surname", data.get("surname_override")))
    year_value = data.get("racer_year", data.get("year_override"))
    racer_sex = data.get("racer_sex")
    club_name = _clean_string(data.get("club_name"))

    if not racer_name or not racer_surname or year_value in ("", None) or racer_sex in ("", None) or not club_name:
        raise StandardExceptions.bad_request(
            "Pro nového závodníka vyplňte jméno, příjmení, rok narození, pohlaví a oddíl"
        )

    racer_year = int(year_value)
    racer_sex = int(racer_sex)

    existing_racer = db.query(models.Racer).filter(
        models.Racer.name == racer_name,
        models.Racer.surname == racer_surname,
        models.Racer.year == racer_year,
        models.Racer.sex == racer_sex,
    ).first()

    if existing_racer:
        racer = existing_racer
        if racer_slcr_id:
            racer.slcr_id = racer_slcr_id
        if racer_telefon:
            racer.telefon = racer_telefon
        if racer_email:
            racer.email = racer_email
        source_snapshot = _get_racer_source_snapshot(racer.id, db)
        return racer, source_snapshot, False

    category_id = get_category_snapshot_for_birth_year(racer_year, racer_sex, db)[0]
    club = _find_or_create_club(club_name, db)

    racer = models.Racer(
        name=racer_name,
        surname=racer_surname,
        sex=racer_sex,
        year=racer_year,
        telefon=racer_telefon,
        email=racer_email,
        slcr_id=racer_slcr_id,
        club_id=club.id,
        category_id=category_id,
    )
    db.add(racer)
    db.flush()

    source_snapshot = _get_racer_source_snapshot(racer.id, db)
    return racer, source_snapshot, True


def _get_race_number_by_display(display_number: int, db: Session, require_active: bool = True) -> models.RaceNumber:
    race_number = db.query(models.RaceNumber).filter(
        models.RaceNumber.display_number == display_number
    ).first()
    if not race_number:
        raise StandardExceptions.bad_request(f"Systémové číslo {display_number} neexistuje")
    if require_active and not race_number.is_active:
        raise StandardExceptions.bad_request(f"Systémové číslo {display_number} je deaktivované")
    return race_number


def _get_race_number_by_id(race_number_id: int, db: Session, require_active: bool = True) -> models.RaceNumber:
    race_number = db.query(models.RaceNumber).filter(
        models.RaceNumber.id == race_number_id
    ).first()
    if not race_number:
        raise StandardExceptions.bad_request("Závodní číslo neexistuje")
    if require_active and not race_number.is_active:
        raise StandardExceptions.bad_request(f"Systémové číslo {race_number.display_number} je deaktivované")
    return race_number


def _resolve_race_number_for_assignment(data: Dict[str, Any], db: Session) -> tuple[bool, models.RaceNumber | None]:
    if "race_number_display" in data:
        display_number = data.get("race_number_display")
        if display_number in ("", None):
            return True, None
        return True, _get_race_number_by_display(int(display_number), db, require_active=True)

    if "race_number_id" in data:
        race_number_id = data.get("race_number_id")
        if race_number_id in ("", None):
            return True, None
        return True, _get_race_number_by_id(int(race_number_id), db, require_active=True)

    return False, None


def _get_next_available_race_number_for_race(race_id: int, db: Session) -> models.RaceNumber | None:
    max_display = db.query(func.max(models.StartListEntry.race_number_display)).filter(
        models.StartListEntry.race_id == race_id,
        models.StartListEntry.race_number_display.isnot(None)
    ).scalar()

    if max_display is None:
        return db.query(models.RaceNumber).filter(
            models.RaceNumber.is_active.is_(True)
        ).order_by(models.RaceNumber.display_number).first()

    return db.query(models.RaceNumber).filter(
        models.RaceNumber.is_active.is_(True),
        models.RaceNumber.display_number == int(max_display) + 1
    ).first()


def _get_next_available_start_number_for_race(race_id: int, db: Session) -> int:
    max_start_number = db.query(func.max(models.StartListEntry.start_number)).filter(
        models.StartListEntry.race_id == race_id,
        models.StartListEntry.start_number.isnot(None)
    ).scalar()
    return (int(max_start_number) + 1) if max_start_number is not None else 1


def _compact_start_numbers_for_race(race_id: int, db: Session) -> None:
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        return

    category_rank_map = _get_category_rank_map(race, db)
    entries = db.query(models.StartListEntry).filter(
        models.StartListEntry.race_id == race_id
    ).all()

    entries.sort(key=lambda item: (
        category_rank_map.get(item.category_id, 10**9),
        item.start_number if item.start_number is not None else 10**9,
        item.id,
    ))

    for index, item in enumerate(entries, start=1):
        item.start_number = index


def _validate_race_number_assignment(
    db: Session,
    race_id: int,
    race_number_id: int | None,
    exclude_entry_id: int | None = None,
) -> None:
    if race_number_id is None:
        return

    query = db.query(models.StartListEntry).filter(
        models.StartListEntry.race_id == race_id,
        models.StartListEntry.race_number_id == race_number_id,
    )
    if exclude_entry_id is not None:
        query = query.filter(models.StartListEntry.id != exclude_entry_id)

    conflict = query.first()
    if conflict:
        conflict_name = " ".join(
            part.strip()
            for part in [conflict.racer_surname, conflict.racer_name]
            if part and str(part).strip()
        ).strip()
        label = conflict_name or f"ID {conflict.id}"
        raise StandardExceptions.bad_request(
            f"Systémové číslo {conflict.race_number_display} je již přiřazeno závodníkovi {label}"
        )


def _apply_category_snapshot(entry: models.StartListEntry, db: Session) -> None:
    if entry.racer_year is None or entry.racer_sex is None:
        entry.category_id = None
        entry.category_name = None
        entry.category_sex = None
        return

    category_id, category_name, category_sex = get_category_snapshot_for_birth_year(
        entry.racer_year,
        entry.racer_sex,
        db,
    )
    entry.category_id = category_id
    entry.category_name = category_name
    entry.category_sex = category_sex


def _apply_race_number_snapshot(entry: models.StartListEntry, race_number: models.RaceNumber | None) -> None:
    if race_number is None:
        entry.race_number_id = None
        entry.race_number_actual = None
        entry.race_number_display = None
        return

    entry.race_number_id = race_number.id
    entry.race_number_actual = race_number.actual_number
    entry.race_number_display = race_number.display_number


def _serialize_start_list_row(row: Any, category_rank_map: dict[int, int] | None = None) -> Dict[str, Any]:
    category_rank = None
    if category_rank_map is not None:
        category_rank = category_rank_map.get(row.category_id, len(category_rank_map))

    return {
        "id": row.id,
        "race_id": row.race_id,
        "racer_id": row.racer_id,
        "category_id": row.category_id,
        "category_rank": category_rank,
        "start_number": row.start_number,
        "race_number_id": row.race_number_id,
        "time1": float(row.time1) if row.time1 is not None else None,
        "time2": float(row.time2) if row.time2 is not None else None,
        "time_sum": float(row.time_sum) if row.time_sum is not None else None,
        "dnf": bool(row.dnf),
        "dns": bool(row.dns),
        "dsq": bool(row.dsq),
        "points": row.points,
        "racer_name": fix_encoding(row.racer_name).strip() if row.racer_name else "",
        "racer_surname": fix_encoding(row.racer_surname).strip() if row.racer_surname else "",
        "racer_year": row.racer_year,
        "racer_sex": row.racer_sex,
        "club_name": fix_encoding(row.club_name) if row.club_name else None,
        "category_name": fix_encoding(row.category_name) if row.category_name else None,
        "category_sex": row.category_sex,
        "race_number_actual": row.race_number_actual,
        "race_number_display": row.race_number_display,
        "set_color": row.set_color or "rose",
        "display_number": row.race_number_display,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "has_override": False,
    }


def _sort_start_list_rows(rows: list[Any], category_rank_map: dict[int, int]) -> list[Any]:
    default_rank = len(category_rank_map)
    return sorted(
        rows,
        key=lambda row: (
            category_rank_map.get(row.category_id, default_rank),
            row.start_number if row.start_number is not None else 10**9,
            row.id,
        ),
    )


def _get_start_list_rows(race_id: int, db: Session) -> list[Any]:
    query = text("""
        SELECT sl.id, sl.race_id, sl.racer_id, sl.category_id,
               sl.start_number, sl.race_number_id,
               sl.racer_name, sl.racer_surname, sl.racer_year, sl.racer_sex,
               sl.club_name, sl.category_name, sl.category_sex,
               sl.race_number_actual, sl.race_number_display,
               rn.set_color,
               sl.time1, sl.time2, sl.time_sum, sl.dnf, sl.dns, sl.dsq, sl.points,
               sl.updated_at
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_race_numbers rn ON rn.id = sl.race_number_id
        WHERE sl.race_id = :race_id
    """)
    return db.execute(query, {"race_id": race_id}).fetchall()


def _get_start_list_entry_payload(entry_id: int, db: Session) -> Dict[str, Any]:
    query = text("""
        SELECT sl.id, sl.race_id, sl.racer_id, sl.category_id,
               sl.start_number, sl.race_number_id,
               sl.racer_name, sl.racer_surname, sl.racer_year, sl.racer_sex,
               sl.club_name, sl.category_name, sl.category_sex,
               sl.race_number_actual, sl.race_number_display,
               rn.set_color,
               sl.time1, sl.time2, sl.time_sum, sl.dnf, sl.dns, sl.dsq, sl.points,
               sl.updated_at
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_race_numbers rn ON rn.id = sl.race_number_id
        WHERE sl.id = :entry_id
    """)
    row = db.execute(query, {"entry_id": entry_id}).first()
    if not row:
        raise StandardExceptions.not_found("Záznam na startovní listině nenalezen")
    race = db.query(models.Race).filter(models.Race.id == row.race_id).first()
    category_rank_map = _get_category_rank_map(race, db) if race else {}
    return _serialize_start_list_row(row, category_rank_map)


@router.get("/start-list/{entry_id}")
def get_single_start_list_entry(
    entry_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get a single start list entry snapshot for conflict comparison."""
    return _get_start_list_entry_payload(entry_id, db)


@router.get("/categories")
def get_categories_for_ordering(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get active categories in default order (youngest first, women before men).
    
    Default order: U8 ženy, U8 muži, U10 ženy, U10 muži, ... OPEN ženy, OPEN muži
    (highest min_birth_year first = youngest, women sex=2 before men sex=1)
    """
    query = text(f"""
        SELECT id, {convert_utf8_field('name')} as name, 
               min_birth_year, max_birth_year, sex, active
        FROM fuj_jmlp_category
        WHERE active = 1
        ORDER BY min_birth_year DESC, sex DESC
    """)
    rows = db.execute(query).fetchall()
    
    return [{
        "id": row.id,
        "name": fix_encoding(row.name) if row.name else "",
        "min_birth_year": row.min_birth_year,
        "max_birth_year": row.max_birth_year,
        "sex": row.sex,
        "sex_label": "Ženy" if row.sex == 2 else ("Muži" if row.sex == 1 else "Mix"),
    } for row in rows]


@router.get("/races/{race_id}/start-list")
def get_start_list(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get start list for a specific race using snapshot fields stored in start_list."""
    # Verify race exists
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()

    category_rank_map = _get_category_rank_map(race, db)
    rows = _sort_start_list_rows(_get_start_list_rows(race_id, db), category_rank_map)
    return [_serialize_start_list_row(row, category_rank_map) for row in rows]


@router.post("/races/{race_id}/start-list/generate")
def generate_start_list(
    race_id: int,
    data: Dict[str, Any] = Body(default={}),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate start list from registered racers.
    
    Body (optional):
    {
        "category_order": [11, 10, 8, 7, ...]  // category IDs in desired start order
    }
    
    Creates start list entries for all registered racers who don't have one yet.
    Assigns sequential start numbers and race numbers automatically from lowest
    available across all sets (set 1 first, then set 2, etc.).
    Racers are grouped by categories in the given order.
    """
    # Verify race exists
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    
    category_order = data.get("category_order", None) if data else None
    if category_order and len(category_order) > 0:
        normalized_order = []
        for cat_id in category_order:
            try:
                normalized_order.append(int(cat_id))
            except (TypeError, ValueError):
                continue
        if normalized_order:
            race.timekeeper_category_order = json.dumps(normalized_order)
            category_order = normalized_order
    else:
        category_order = _get_effective_category_order(race, db)
    
    # Get registrations that don't have a start list entry yet and build fresh snapshot data
    new_racers_query = text(f"""
        SELECT rr.racer_id,
               {convert_utf8_field('rac.name')} as racer_name,
               {convert_utf8_field('rac.surname')} as racer_surname,
               rac.year as racer_year,
               rac.sex as racer_sex,
               {convert_utf8_field('c.name')} as club_name
        FROM fuj_jmlp_race_registration rr
        JOIN fuj_jmlp_racer rac ON rr.racer_id = rac.id
        LEFT JOIN fuj_jmlp_club c ON rac.club_id = c.id
        WHERE rr.race_id = :race_id
        AND rr.racer_id NOT IN (
            SELECT sl.racer_id FROM fuj_jmlp_race_start_list sl WHERE sl.race_id = :race_id
        )
    """)
    new_racers_raw = db.execute(new_racers_query, {"race_id": race_id}).fetchall()
    
    if not new_racers_raw:
        if data and data.get("category_order"):
            db.commit()
        return {"message": "Všichni registrovaní závodníci jsou již na startovní listině", "added": 0}
    
    new_racers = []
    for row in new_racers_raw:
        if row.racer_year is not None and row.racer_sex is not None:
            category_id, category_name, category_sex = get_category_snapshot_for_birth_year(
                row.racer_year,
                row.racer_sex,
                db,
            )
        else:
            category_id, category_name, category_sex = None, None, None
        new_racers.append({
            "racer_id": row.racer_id,
            "racer_name": fix_encoding(row.racer_name).strip() if row.racer_name else None,
            "racer_surname": fix_encoding(row.racer_surname).strip() if row.racer_surname else None,
            "racer_year": row.racer_year,
            "racer_sex": row.racer_sex,
            "club_name": fix_encoding(row.club_name) if row.club_name else None,
            "category_id": category_id,
            "category_name": category_name,
            "category_sex": category_sex,
        })

    # Sort by category order
    if category_order and len(category_order) > 0:
        # Build an order map: category_id -> position
        order_map = {cat_id: idx for idx, cat_id in enumerate(category_order)}
        # Racers with unknown categories go to the end
        max_order = len(category_order)
        new_racers = sorted(
            new_racers,
            key=lambda r: order_map.get(r["category_id"], max_order)
        )
    else:
        # Default: sort by min_birth_year DESC (youngest first), sex DESC (women first)
        # Need to join category data
        cat_order_query = text("""
            SELECT id, min_birth_year, sex
            FROM fuj_jmlp_category
            WHERE active = 1
            ORDER BY min_birth_year DESC, sex DESC
        """)
        cat_rows = db.execute(cat_order_query).fetchall()
        order_map = {row.id: idx for idx, row in enumerate(cat_rows)}
        max_order = len(cat_rows)
        new_racers = sorted(
            new_racers,
            key=lambda r: order_map.get(r["category_id"], max_order)
        )
    
    # Get current max start_number for this race
    max_start = db.query(func.max(models.StartListEntry.start_number)).filter(
        models.StartListEntry.race_id == race_id
    ).scalar() or 0
    
    # Get used race_number_ids for this race
    used_rn_ids = set()
    used_query = db.query(models.StartListEntry.race_number_id).filter(
        models.StartListEntry.race_id == race_id,
        models.StartListEntry.race_number_id.isnot(None)
    ).all()
    for row in used_query:
        used_rn_ids.add(row[0])
    
    # Get available active race numbers from ALL sets, ordered by set_number then actual_number
    # (lowest numbers first, set 1 before set 2, etc.)
    if used_rn_ids:
        available_rn = db.query(models.RaceNumber).filter(
            models.RaceNumber.is_active.is_(True),
            models.RaceNumber.id.notin_(used_rn_ids)
        ).order_by(models.RaceNumber.set_number, models.RaceNumber.actual_number).all()
    else:
        available_rn = db.query(models.RaceNumber).filter(
            models.RaceNumber.is_active.is_(True)
        ).order_by(
            models.RaceNumber.set_number, models.RaceNumber.actual_number
        ).all()
    
    rn_iter = iter(available_rn)
    added = 0
    
    for racer_row in new_racers:
        max_start += 1
        
        # Try to assign a race number
        race_number = next(rn_iter, None)
        
        entry = models.StartListEntry(
            race_id=race_id,
            racer_id=racer_row["racer_id"],
            category_id=racer_row["category_id"],
            start_number=max_start,
            race_number_id=race_number.id if race_number else None,
            racer_name=racer_row["racer_name"],
            racer_surname=racer_row["racer_surname"],
            racer_year=racer_row["racer_year"],
            racer_sex=racer_row["racer_sex"],
            club_name=racer_row["club_name"],
            category_name=racer_row["category_name"],
            category_sex=racer_row["category_sex"],
            race_number_actual=race_number.actual_number if race_number else None,
            race_number_display=race_number.display_number if race_number else None,
        )
        db.add(entry)
        added += 1
    
    db.commit()
    
    return {
        "message": f"Přidáno {added} závodníků na startovní listinu",
        "added": added,
        "total": max_start,
    }


@router.delete("/races/{race_id}/start-list")
def clear_start_list(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """Clear entire start list for a race (reset)."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    
    deleted = db.query(models.StartListEntry).filter(
        models.StartListEntry.race_id == race_id
    ).delete()
    db.commit()
    
    return {"message": f"Smazáno {deleted} záznamů ze startovní listiny"}


@router.put("/start-list/{entry_id}")
def update_start_list_entry(
    entry_id: int,
    data: Dict[str, Any] = Body(default={}),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update a single start list entry using snapshot-first fields."""
    entry = db.query(models.StartListEntry).filter(models.StartListEntry.id == entry_id).first()
    if not entry:
        raise StandardExceptions.not_found("Záznam na startovní listině nenalezen")

    if "category_id" in data and "racer_year" not in data and "year_override" not in data:
        raise StandardExceptions.bad_request("Kategorie se určuje automaticky podle ročníku")

    if "start_number" in data:
        entry.start_number = data.get("start_number")

    if "racer_name" in data or "name_override" in data:
        entry.racer_name = _clean_string(data.get("racer_name", data.get("name_override")))

    if "racer_surname" in data or "surname_override" in data:
        entry.racer_surname = _clean_string(data.get("racer_surname", data.get("surname_override")))

    if "racer_year" in data or "year_override" in data:
        year_value = data.get("racer_year", data.get("year_override"))
        entry.racer_year = int(year_value) if year_value not in ("", None) else None

    if "club_name" in data:
        entry.club_name = _clean_string(data.get("club_name"))

    if "racer_sex" in data:
        sex_value = data.get("racer_sex")
        entry.racer_sex = int(sex_value) if sex_value not in ("", None) else None

    if entry.racer_sex is None:
        source_snapshot = _get_racer_source_snapshot(entry.racer_id, db)
        entry.racer_sex = source_snapshot["racer_sex"]

    if any(key in data for key in ("racer_year", "year_override", "racer_name", "name_override", "racer_surname", "surname_override", "club_name", "racer_sex")):
        _apply_category_snapshot(entry, db)

    race_number_provided, race_number = _resolve_race_number_for_assignment(data, db)
    if race_number_provided:
        next_display = data.get("race_number_display", None)
        if next_display not in ("", None) and entry.race_number_display is not None and int(next_display) == entry.race_number_display:
            race_number = entry.race_number_id and _get_race_number_by_id(int(entry.race_number_id), db, require_active=False)
        _validate_race_number_assignment(db, entry.race_id, race_number.id if race_number else None, exclude_entry_id=entry.id)
        _apply_race_number_snapshot(entry, race_number)

    # Recalculate time_sum if times changed
    if 'time1' in data or 'time2' in data:
        t1 = entry.time1 if entry.time1 is not None else None
        t2 = entry.time2 if entry.time2 is not None else None
        if t1 is not None and t2 is not None:
            entry.time_sum = float(t1) + float(t2)
        elif t1 is not None:
            entry.time_sum = float(t1)
        elif t2 is not None:
            entry.time_sum = float(t2)
        else:
            entry.time_sum = None
    
    db.commit()
    db.refresh(entry)
    return {
        "message": "Záznam aktualizován",
        "entry": _get_start_list_entry_payload(entry.id, db),
    }


@router.delete("/start-list/{entry_id}")
def delete_start_list_entry(
    entry_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """Delete a single entry from the start list."""
    entry = db.query(models.StartListEntry).filter(models.StartListEntry.id == entry_id).first()
    if not entry:
        raise StandardExceptions.not_found("Záznam na startovní listině nenalezen")
    race_id = entry.race_id

    db.delete(entry)
    db.flush()
    _compact_start_numbers_for_race(race_id, db)
    db.commit()
    return {"message": "Závodník odebrán ze startovní listiny"}


@router.get("/racers/search")
def search_racers_for_start_list(
    q: str = "",
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Search racers by name/surname for manual start list entry."""
    if len(q) < 2:
        return []
    
    search = f"%{q}%"
    query = text(f"""
        SELECT r.id, 
               {convert_utf8_field('r.name')} as name,
               {convert_utf8_field('r.surname')} as surname,
               r.year, r.sex, r.slcr_id,
               {convert_utf8_field('c.name')} as club_name
        FROM fuj_jmlp_racer r
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE {convert_utf8_field('r.name')} LIKE :search
           OR {convert_utf8_field('r.surname')} LIKE :search
           OR CONCAT({convert_utf8_field('r.surname')}, ' ', {convert_utf8_field('r.name')}) LIKE :search
           OR r.slcr_id LIKE :search
        ORDER BY r.surname, r.name
        LIMIT 20
    """)
    rows = db.execute(query, {"search": search}).fetchall()
    
    return [{
        "id": row.id,
        "name": fix_encoding(row.name).strip() if row.name else "",
        "surname": fix_encoding(row.surname).strip() if row.surname else "",
        "year": row.year,
        "sex": row.sex,
        "club_name": fix_encoding(row.club_name) if row.club_name else None,
        "slcr_id": row.slcr_id,
    } for row in rows]


@router.post("/races/{race_id}/start-list/entry")
def add_manual_start_list_entry(
    race_id: int,
    data: Dict[str, Any] = Body(default={}),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Manually add an entry to the start list.
    
    Body: {
        "racer_id": 123,            // optional - existing racer
        "start_number": 50,        // optional - auto-assigns next if not provided
        "race_number_display": 201, // optional - system number
        "racer_name": "Jan",       // required for new racer, optional snapshot override
        "racer_surname": "Nový",   // required for new racer, optional snapshot override
        "racer_year": 2010,        // required for new racer
        "racer_sex": 1,            // required for new racer
        "racer_slcr_id": "12345",  // optional
        "club_name": "SKI klub"    // required for new racer, optional snapshot override
    }
    """
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()

    racer, source_snapshot, created_new_racer = _get_or_create_manual_racer(data, db)
    racer_id = racer.id

    existing_entry = db.query(models.StartListEntry).filter(
        models.StartListEntry.race_id == race_id,
        models.StartListEntry.racer_id == racer_id
    ).first()
    if existing_entry:
        raise StandardExceptions.bad_request("Závodník je již na startovní listině")

    # Auto-assign start_number if not provided
    start_number = data.get("start_number")
    if not start_number:
        start_number = _get_next_available_start_number_for_race(race_id, db)

    racer_name = _clean_string(data.get("racer_name", data.get("name_override"))) or source_snapshot["racer_name"]
    racer_surname = _clean_string(data.get("racer_surname", data.get("surname_override"))) or source_snapshot["racer_surname"]
    year_value = data.get("racer_year", data.get("year_override"))
    racer_year = int(year_value) if year_value not in ("", None) else source_snapshot["racer_year"]
    sex_value = data.get("racer_sex")
    racer_sex = int(sex_value) if sex_value not in ("", None) else source_snapshot["racer_sex"]
    club_name = _clean_string(data.get("club_name")) or source_snapshot["club_name"]
    category_id, category_name, category_sex = get_category_snapshot_for_birth_year(racer_year, racer_sex, db)

    race_number_provided, race_number = _resolve_race_number_for_assignment(data, db)
    if race_number_provided:
        _validate_race_number_assignment(db, race_id, race_number.id if race_number else None)
    else:
        race_number = _get_next_available_race_number_for_race(race_id, db)

    entry = models.StartListEntry(
        race_id=race_id,
        racer_id=racer_id,
        category_id=category_id,
        start_number=start_number,
        race_number_id=race_number.id if race_number else None,
        racer_name=racer_name,
        racer_surname=racer_surname,
        racer_year=racer_year,
        racer_sex=racer_sex,
        club_name=club_name,
        category_name=category_name,
        category_sex=category_sex,
        race_number_actual=race_number.actual_number if race_number else None,
        race_number_display=race_number.display_number if race_number else None,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    return {
        "message": "Nový závodník byl vytvořen a přidán na startovní listinu" if created_new_racer else "Závodník přidán na startovní listinu",
        "id": entry.id,
        "start_number": start_number,
        "entry": _get_start_list_entry_payload(entry.id, db),
    }
