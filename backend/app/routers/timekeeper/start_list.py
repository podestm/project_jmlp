"""Start list management - generate and manage start lists from registrations."""
import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Body, Header
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from ...database import get_db
from ... import models, schemas, auth
from ...utils import (
    fix_encoding,
    category_display_sql,
    convert_utf8_field,
    StandardExceptions,
    get_category_snapshot_for_birth_year,
)
from .idempotency import try_get_idempotent_response, store_idempotent_response
from ...services.start_list import (
    _apply_category_snapshot,
    _apply_race_number_snapshot,
    _clean_string,
    _compact_start_numbers_for_race,
    _find_or_create_club,
    _get_category_rank_map,
    _get_effective_category_order,
    _get_next_available_race_number_for_race,
    _get_next_available_start_number_for_race,
    _get_or_create_manual_racer,
    _get_race_number_by_display,
    _get_race_number_by_id,
    _get_racer_source_snapshot,
    _get_start_list_entry_payload,
    _get_start_list_rows,
    _resolve_race_number_for_assignment,
    _serialize_start_list_row,
    _sort_start_list_rows,
    _validate_race_number_assignment,
)

router = APIRouter(tags=["timekeeper-start-list"])


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

    Zobrazuje se `display_name` z adminu ("Myšáci dívky"). Kódové označení
    ("U8") zůstává v `code` jako doplňková informace - nikde se nesmí tisknout
    místo oficiálního názvu.
    """
    query = text(f"""
        SELECT id, {convert_utf8_field('name')} as name,
               {category_display_sql('fuj_jmlp_category')} as display_name,
               min_birth_year, max_birth_year, sex, active
        FROM fuj_jmlp_category
        WHERE active = 1
        ORDER BY min_birth_year DESC, sex DESC
    """)
    rows = db.execute(query).fetchall()

    return [{
        "id": row.id,
        "code": fix_encoding(row.name) if row.name else "",
        "display_name": fix_encoding(row.display_name) if row.display_name else "",
        # Zpětná kompatibilita: `name` je to, co se zobrazuje.
        "name": fix_encoding(row.display_name) if row.display_name else "",
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
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
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
    endpoint = f"/api/timekeeper/races/{race_id}/start-list/generate"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="POST",
        endpoint=endpoint,
    )
    if replay:
        return replay

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
        ORDER BY rr.registered_at, rr.id
    """)
    # Pořadí přihlášení do závodu je pořadí startu v kategorii - u prvních
    # závodů sezóny (včetně suchých) a všude, kde není podle čeho rozhodnout.
    # Bez ORDER BY vracela MyISAM řádky v pořadí, v jakém leží v tabulce,
    # a startovka pak neodpovídala ničemu. Řazení podle kategorií níže je
    # stabilní, takže tohle pořadí uvnitř kategorie zachová.
    new_racers_raw = db.execute(new_racers_query, {"race_id": race_id}).fetchall()
    
    if not new_racers_raw:
        if data and data.get("category_order"):
            db.commit()
        response_payload = {
            "message": "Všichni registrovaní závodníci jsou již na startovní listině",
            "added": 0,
            "idempotency_replayed": False,
        }
        store_idempotent_response(
            db=db,
            idempotency_key=x_idempotency_key,
            admin_id=int(current_admin.id),
            method="POST",
            endpoint=endpoint,
            response_payload=response_payload,
        )
        return response_payload
    
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

    response_payload = {
        "message": f"Přidáno {added} závodníků na startovní listinu",
        "added": added,
        "total": max_start,
        "idempotency_replayed": False,
    }
    store_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="POST",
        endpoint=endpoint,
        response_payload=response_payload,
    )
    return response_payload


@router.delete("/races/{race_id}/start-list")
def clear_start_list(
    race_id: int,
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Clear entire start list for a race (reset).

    Návratový typ musí být Dict[str, Any]: odpověď nese i logické
    `idempotency_replayed` a se starou anotací Dict[str, str] neprošla
    kontrolou schématu - časoměřič dostal 500, přestože se startovka smazala.
    """
    endpoint = f"/api/timekeeper/races/{race_id}/start-list"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="DELETE",
        endpoint=endpoint,
    )
    if replay:
        return replay

    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()

    deleted = db.query(models.StartListEntry).filter(
        models.StartListEntry.race_id == race_id
    ).delete()
    db.commit()

    response_payload = {
        "message": f"Smazáno {deleted} záznamů ze startovní listiny",
        "idempotency_replayed": False,
    }
    store_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="DELETE",
        endpoint=endpoint,
        response_payload=response_payload,
    )
    return response_payload


@router.put("/start-list/{entry_id}")
def update_start_list_entry(
    entry_id: int,
    data: Dict[str, Any] = Body(default={}),
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update a single start list entry using snapshot-first fields."""
    endpoint = f"/api/timekeeper/start-list/{entry_id}"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="PUT",
        endpoint=endpoint,
    )
    if replay:
        return replay

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


@router.put("/start-list/{entry_id}/excluded")
def set_start_list_entry_excluded(
    entry_id: int,
    data: schemas.StartListExcludedUpdate,
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Vyřadí závodníka ze startovky, nebo ho do ní vrátí.

    Pro závodníka, který nedorazil nebo nestihl start. Řádek se NEMAŽE:
    startovní číslo, dres i naměřené časy mu zůstanou, takže "Vrátit" ho
    obnoví přesně v té podobě, v jaké byl. Dokud je vyřazený, není na
    startovce, v zadávání časů, ve výsledcích ani v bodech - pořadí ostatních
    se počítá, jako by vůbec nestartoval. Když ho nikdo nevrátí, je to
    v podstatě odhlášení a nic dalšího se dělat nemusí.

    Tělo nese cílový stav ({"excluded": true|false}), ne přepínač: zápis
    přehraný z offline fronty pak nemůže stav otočit podruhé.

    Revize řádku (updated_at) se schválně nemění. Hlídá souběžné zápisy ČASŮ
    (base_revision v timing.py) a vyřazení časy nemění - posunutá revize by
    zařízení, které zrovna zapisuje čas, vyrobila konflikt 409 o ničem.
    """
    endpoint = f"/api/timekeeper/start-list/{entry_id}/excluded"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="PUT",
        endpoint=endpoint,
    )
    if replay:
        return replay

    exists = db.execute(
        text("SELECT id FROM fuj_jmlp_race_start_list WHERE id = :entry_id"),
        {"entry_id": entry_id},
    ).first()
    if not exists:
        raise StandardExceptions.not_found("Záznam na startovní listině nenalezen")

    # Raw SQL kvůli revizi: ORM by updated_at přepsal sám (onupdate v modelu)
    # a MySQL taky (ON UPDATE CURRENT_TIMESTAMP), proto se výslovně ponechá.
    db.execute(text("""
        UPDATE fuj_jmlp_race_start_list
        SET excluded = :excluded, updated_at = updated_at
        WHERE id = :entry_id
    """), {"excluded": 1 if data.excluded else 0, "entry_id": entry_id})
    db.commit()

    response_payload = {
        "message": (
            "Závodník vyřazen ze startovní listiny"
            if data.excluded
            else "Závodník vrácen na startovní listinu"
        ),
        "entry": _get_start_list_entry_payload(entry_id, db),
        "idempotency_replayed": False,
    }
    store_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="PUT",
        endpoint=endpoint,
        response_payload=response_payload,
    )
    return response_payload


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


@router.get("/racers/snapshot")
def racers_snapshot(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Celý registr závodníků v kompaktní podobě pro offline hledání.

    Časomíra si ho drží v IndexedDB: na kopci často není signál a přidat
    závodníka z registru (dohláška na místě) musí jít i bez něj. Jen to, co
    hledání a formulář potřebují - žádné kontakty.
    """
    rows = db.execute(text(f"""
        SELECT r.id,
               {convert_utf8_field('r.name')} as name,
               {convert_utf8_field('r.surname')} as surname,
               r.year, r.sex, r.slcr_id,
               {convert_utf8_field('c.name')} as club_name
        FROM fuj_jmlp_racer r
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        ORDER BY r.surname, r.name
    """)).fetchall()
    return [{
        "id": row.id,
        "name": fix_encoding(row.name).strip() if row.name else "",
        "surname": fix_encoding(row.surname).strip() if row.surname else "",
        "year": row.year,
        "sex": row.sex,
        "club_name": fix_encoding(row.club_name).strip() if row.club_name else None,
        "slcr_id": (row.slcr_id or "").strip() or None,
    } for row in rows]


@router.post("/races/{race_id}/start-list/entry")
def add_manual_start_list_entry(
    race_id: int,
    data: Dict[str, Any] = Body(default={}),
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
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

    Idempotentní podle X-Idempotency-Key: časomíra přidává závodníky i offline
    a fronta zápis po výpadku pošle znovu. Opakovaný požadavek vrátí původní
    odpověď (i s id řádku, na které se přemapuje dočasné lokální id) a nového
    závodníka nezaloží podruhé. `client_temp_id` v těle je dočasné id z
    časomíry; server ho jen vrací zpátky.
    """
    endpoint = f"/api/timekeeper/races/{race_id}/start-list/entry"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="POST",
        endpoint=endpoint,
    )
    if replay:
        return {**replay, "idempotency_replayed": True}

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
        if existing_entry.excluded:
            # Pozdě dorazivšího závodníka časoměřič zkusí přidat znovu - řádek
            # ale pořád existuje, jen vyřazený, a vrátit ho jde i s dresem.
            raise StandardExceptions.bad_request(
                "Závodník je na startovní listině vyřazený - vraťte ho v Listině tlačítkem Vrátit"
            )
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

    response_payload = {
        "message": "Nový závodník byl vytvořen a přidán na startovní listinu" if created_new_racer else "Závodník přidán na startovní listinu",
        "id": entry.id,
        "start_number": start_number,
        "entry": _get_start_list_entry_payload(entry.id, db),
        "client_temp_id": data.get("client_temp_id"),
        "idempotency_replayed": False,
    }
    store_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="POST",
        endpoint=endpoint,
        response_payload=response_payload,
    )
    return response_payload
