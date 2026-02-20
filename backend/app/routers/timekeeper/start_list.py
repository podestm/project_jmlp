"""Start list management - generate and manage start lists from registrations."""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from ...database import get_db
from ... import models, schemas, auth
from ...utils import fix_encoding, convert_utf8_field, StandardExceptions

router = APIRouter(tags=["timekeeper-start-list"])


def _category_display_name(name, sex):
    """Build display name with sex suffix: 'U8 Myšáci - Ženy'."""
    if not name:
        return None
    display = fix_encoding(name)
    if sex == 2:
        return f"{display} - Ženy"
    elif sex == 1:
        return f"{display} - Muži"
    return display


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
    """Get start list for a specific race with racer details."""
    # Verify race exists
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    
    query = text(f"""
        SELECT sl.id, sl.race_id, sl.racer_id, sl.category_id, 
               sl.start_number, sl.race_number_id,
               sl.time1, sl.time2, sl.time_sum, sl.dnf, sl.dns, sl.dsq, sl.points,
               sl.name_override, sl.surname_override, sl.year_override,
               COALESCE(sl.name_override, {convert_utf8_field('rac.name')}) as racer_name,
               COALESCE(sl.surname_override, {convert_utf8_field('rac.surname')}) as racer_surname,
               COALESCE(sl.year_override, rac.year) as racer_year,
               rac.sex as racer_sex,
               {convert_utf8_field('c.name')} as club_name,
               {convert_utf8_field('cat.name')} as category_name,
               cat.sex as category_sex,
               rn.display_number
        FROM fuj_jmlp_race_start_list sl
        JOIN fuj_jmlp_racer rac ON sl.racer_id = rac.id
        LEFT JOIN fuj_jmlp_club c ON rac.club_id = c.id
        LEFT JOIN fuj_jmlp_category cat ON sl.category_id = cat.id
        LEFT JOIN fuj_jmlp_race_numbers rn ON sl.race_number_id = rn.id
        WHERE sl.race_id = :race_id
        ORDER BY sl.start_number ASC, sl.id ASC
    """)
    rows = db.execute(query, {"race_id": race_id}).fetchall()
    
    return [{
        "id": row.id,
        "race_id": row.race_id,
        "racer_id": row.racer_id,
        "category_id": row.category_id,
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
        "category_name": _category_display_name(row.category_name, row.category_sex),
        "category_sex": row.category_sex,
        "display_number": row.display_number,
        "has_override": bool(row.name_override or row.surname_override or row.year_override),
    } for row in rows]


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
    
    # Get registrations that don't have a start list entry yet
    new_racers_query = text("""
        SELECT rr.racer_id, rr.category_id
        FROM race_registration rr
        WHERE rr.race_id = :race_id
        AND rr.racer_id NOT IN (
            SELECT sl.racer_id FROM fuj_jmlp_race_start_list sl WHERE sl.race_id = :race_id
        )
    """)
    new_racers_raw = db.execute(new_racers_query, {"race_id": race_id}).fetchall()
    
    if not new_racers_raw:
        return {"message": "Všichni registrovaní závodníci jsou již na startovní listině", "added": 0}
    
    # Sort by category order
    if category_order and len(category_order) > 0:
        # Build an order map: category_id -> position
        order_map = {cat_id: idx for idx, cat_id in enumerate(category_order)}
        # Racers with unknown categories go to the end
        max_order = len(category_order)
        new_racers = sorted(
            new_racers_raw,
            key=lambda r: order_map.get(r.category_id, max_order)
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
            new_racers_raw,
            key=lambda r: order_map.get(r.category_id, max_order)
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
    
    # Get available race numbers from ALL sets, ordered by set_number then actual_number
    # (lowest numbers first, set 1 before set 2, etc.)
    if used_rn_ids:
        available_rn = db.query(models.RaceNumber).filter(
            models.RaceNumber.id.notin_(used_rn_ids)
        ).order_by(models.RaceNumber.set_number, models.RaceNumber.actual_number).all()
    else:
        available_rn = db.query(models.RaceNumber).order_by(
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
            racer_id=racer_row.racer_id,
            category_id=racer_row.category_id,
            start_number=max_start,
            race_number_id=race_number.id if race_number else None,
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
) -> Dict[str, str]:
    """Update a single start list entry (number, race number, name overrides, etc.).
    
    Accepts: start_number, race_number_id, name_override, surname_override, year_override,
             category_id, time1, time2, dnf, dns, dsq, points
    """
    entry = db.query(models.StartListEntry).filter(models.StartListEntry.id == entry_id).first()
    if not entry:
        raise StandardExceptions.not_found("Záznam na startovní listině nenalezen")
    
    allowed_fields = {
        'start_number', 'race_number_id', 'category_id',
        'name_override', 'surname_override', 'year_override',
        'time1', 'time2', 'dnf', 'dns', 'dsq', 'points'
    }
    
    for key, value in data.items():
        if key in allowed_fields:
            setattr(entry, key, value)
    
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
    return {"message": "Záznam aktualizován"}


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
    
    db.delete(entry)
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
               r.year, r.sex,
               {convert_utf8_field('c.name')} as club_name
        FROM fuj_jmlp_racer r
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE {convert_utf8_field('r.name')} LIKE :search
           OR {convert_utf8_field('r.surname')} LIKE :search
           OR CONCAT({convert_utf8_field('r.surname')}, ' ', {convert_utf8_field('r.name')}) LIKE :search
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
        "racer_id": 123,           // required - base racer
        "category_id": 10,         // optional
        "start_number": 50,        // optional - auto-assigns next if not provided
        "race_number_id": null,    // optional
        "name_override": "Jan",    // optional - override name just for this list
        "surname_override": "Nový", // optional
        "year_override": 2010      // optional
    }
    """
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    
    racer_id = data.get("racer_id")
    if not racer_id:
        raise StandardExceptions.bad_request("Chybí racer_id")
    
    # Check racer exists
    racer = db.query(models.Racer).filter(models.Racer.id == racer_id).first()
    if not racer:
        raise StandardExceptions.not_found("Závodník nenalezen")
    
    # Auto-assign start_number if not provided
    start_number = data.get("start_number")
    if not start_number:
        max_sn = db.query(func.max(models.StartListEntry.start_number)).filter(
            models.StartListEntry.race_id == race_id
        ).scalar() or 0
        start_number = max_sn + 1
    
    entry = models.StartListEntry(
        race_id=race_id,
        racer_id=racer_id,
        category_id=data.get("category_id"),
        start_number=start_number,
        race_number_id=data.get("race_number_id"),
        name_override=data.get("name_override"),
        surname_override=data.get("surname_override"),
        year_override=data.get("year_override"),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    return {
        "message": "Závodník přidán na startovní listinu",
        "id": entry.id,
        "start_number": start_number,
    }
