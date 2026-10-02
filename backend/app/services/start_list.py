"""Pravidla startovní listiny.

Vytaženo z routers/timekeeper/start_list.py, kde soubor přerostl 900 řádků a
pravidla se ztrácela mezi obsluhou požadavků. Tady není žádný FastAPI kód -
jen práce s daty, takže se to dá volat i odjinud a testovat bez HTTP.
"""
import json
from typing import Any, Dict

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from .. import models
from ..utils import (
    category_display_sql,
    convert_utf8_field,
    fix_encoding,
    get_category_snapshot_for_birth_year,
    StandardExceptions,
)


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


def _category_name(row: Any) -> str | None:
    """Oficiální název kategorie z adminu, snapshot jako záloha.

    Kódové označení ("U10") je jen doplňková informace - všude, kde je název
    vidět, patří `display_name` nastavený v adminu. Snapshot uložený v listině
    mohl vzniknout před přejmenováním, proto má přednost živá hodnota.
    """
    live = getattr(row, "category_display_name", None)
    if live:
        return fix_encoding(live)
    return fix_encoding(row.category_name) if row.category_name else None


def _slcr_id(value: Any) -> str | None:
    """Registrační číslo SLČR; v datech bývá i "-" nebo prázdný řetězec."""
    text_value = str(value).strip() if value is not None else ""
    return text_value if text_value and text_value != "-" else None


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
        # Vyřazený ze startky - časoměřič ho v Listině vidí (aby ho mohl
        # vrátit), všude jinde ho klient vynechá (isExcluded na klientovi).
        "excluded": bool(row.excluded),
        "racer_name": fix_encoding(row.racer_name).strip() if row.racer_name else "",
        "racer_surname": fix_encoding(row.racer_surname).strip() if row.racer_surname else "",
        "racer_year": row.racer_year,
        "racer_sex": row.racer_sex,
        "club_name": fix_encoding(row.club_name) if row.club_name else None,
        # Název kategorie se bere živě z adminu; snapshot v listině je jen
        # záloha pro historická data (a pro řádky bez kategorie).
        "category_name": _category_name(row),
        "category_sex": row.category_sex,
        "race_number_actual": row.race_number_actual,
        "race_number_display": row.race_number_display,
        "set_color": row.set_color or "rose",
        # Sada startovních čísel a registrační číslo SLČR - tisknou se v rozpisu
        # po klubech a ve sloupci "Body" startovky jako v LiZe.
        "set_number": row.set_number,
        "slcr_id": _slcr_id(row.slcr_id),
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
    query = text(f"""
        SELECT sl.id, sl.race_id, sl.racer_id, sl.category_id,
               sl.start_number, sl.race_number_id,
               sl.racer_name, sl.racer_surname, sl.racer_year, sl.racer_sex,
               sl.club_name, sl.category_name, sl.category_sex,
               {category_display_sql('cat')} as category_display_name,
               sl.race_number_actual, sl.race_number_display,
               rn.set_color, rn.set_number, rac.slcr_id,
               sl.time1, sl.time2, sl.time_sum, sl.dnf, sl.dns, sl.dsq, sl.points,
               sl.excluded, sl.updated_at
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_race_numbers rn ON rn.id = sl.race_number_id
        LEFT JOIN fuj_jmlp_racer rac ON rac.id = sl.racer_id
        LEFT JOIN fuj_jmlp_category cat ON cat.id = sl.category_id
        WHERE sl.race_id = :race_id
    """)
    return db.execute(query, {"race_id": race_id}).fetchall()


def _get_start_list_entry_payload(entry_id: int, db: Session) -> Dict[str, Any]:
    query = text(f"""
        SELECT sl.id, sl.race_id, sl.racer_id, sl.category_id,
               sl.start_number, sl.race_number_id,
               sl.racer_name, sl.racer_surname, sl.racer_year, sl.racer_sex,
               sl.club_name, sl.category_name, sl.category_sex,
               {category_display_sql('cat')} as category_display_name,
               sl.race_number_actual, sl.race_number_display,
               rn.set_color, rn.set_number, rac.slcr_id,
               sl.time1, sl.time2, sl.time_sum, sl.dnf, sl.dns, sl.dsq, sl.points,
               sl.excluded, sl.updated_at
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_race_numbers rn ON rn.id = sl.race_number_id
        LEFT JOIN fuj_jmlp_racer rac ON rac.id = sl.racer_id
        LEFT JOIN fuj_jmlp_category cat ON cat.id = sl.category_id
        WHERE sl.id = :entry_id
    """)
    row = db.execute(query, {"entry_id": entry_id}).first()
    if not row:
        raise StandardExceptions.not_found("Záznam na startovní listině nenalezen")
    race = db.query(models.Race).filter(models.Race.id == row.race_id).first()
    category_rank_map = _get_category_rank_map(race, db) if race else {}
    return _serialize_start_list_row(row, category_rank_map)

