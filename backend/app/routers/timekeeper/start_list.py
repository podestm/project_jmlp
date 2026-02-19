"""Start list management - generate and manage start lists from registrations."""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from ...database import get_db
from ... import models, schemas, auth
from ...utils import fix_encoding, convert_utf8_field, StandardExceptions

router = APIRouter(tags=["timekeeper-start-list"])


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
               {convert_utf8_field('rac.name')} as racer_name,
               {convert_utf8_field('rac.surname')} as racer_surname,
               rac.year as racer_year, rac.sex as racer_sex,
               {convert_utf8_field('c.name')} as club_name,
               {convert_utf8_field('cat.name')} as category_name,
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
        "category_name": fix_encoding(row.category_name) if row.category_name else None,
        "display_number": row.display_number,
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
        "set_number": 1,              // which race number set to use (default: 1)
        "category_order": [11, 10, 8, 7, ...]  // category IDs in desired start order
    }
    
    Creates start list entries for all registered racers who don't have one yet.
    Assigns sequential start numbers and race numbers from the chosen set.
    Racers are grouped by categories in the given order.
    """
    # Verify race exists
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    
    set_number = data.get("set_number", 1) if data else 1
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
    
    # Get available race numbers from the chosen set
    if used_rn_ids:
        available_rn = db.query(models.RaceNumber).filter(
            models.RaceNumber.set_number == set_number,
            models.RaceNumber.id.notin_(used_rn_ids)
        ).order_by(models.RaceNumber.actual_number).all()
    else:
        available_rn = db.query(models.RaceNumber).filter(
            models.RaceNumber.set_number == set_number
        ).order_by(models.RaceNumber.actual_number).all()
    
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
        "message": f"Přidáno {added} závodníků na startovní listinu (sada č. {set_number})",
        "added": added,
        "total": max_start,
        "set_used": set_number
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
    data: schemas.StartListEntryUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """Update a single start list entry (number, race number, etc.)."""
    entry = db.query(models.StartListEntry).filter(models.StartListEntry.id == entry_id).first()
    if not entry:
        raise StandardExceptions.not_found("Záznam na startovní listině nenalezen")
    
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)
    
    db.commit()
    return {"message": "Záznam aktualizován"}
