"""Results generation and viewing - sort by times, assign points, export."""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from ...database import get_db
from ... import models, schemas, auth
from ...utils import fix_encoding, convert_utf8_field, StandardExceptions

router = APIRouter(tags=["timekeeper-results"])


# Points table for classified racers with valid times (1st-30th).
POINTS_TABLE = [
    100, 80, 60, 50, 45, 40, 36, 32, 29, 26,
    24, 22, 20, 18, 16, 15, 14, 13, 12, 11,
    10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
]


def get_points_for_position(position: int) -> int:
    """Get points for a given finishing position (1-based)."""
    if position <= 0:
        return 0
    if position <= len(POINTS_TABLE):
        return POINTS_TABLE[position - 1]
    return 0


@router.get("/races/{race_id}/results")
def get_race_results(
    race_id: int,
    group_by_category: bool = Query(default=True, description="Group results by category"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get race results sorted by time, optionally grouped by category."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    
    # Get areal name
    areal_name = None
    if race.areal_id:
        areal_query = text(f"""
            SELECT {convert_utf8_field('name')} as name 
            FROM fuj_jmlp_areal WHERE id = :areal_id
        """)
        areal_row = db.execute(areal_query, {"areal_id": race.areal_id}).first()
        if areal_row:
            areal_name = fix_encoding(areal_row.name)
    
    query = text(f"""
        SELECT sl.id, sl.racer_id, sl.category_id, sl.start_number,
               sl.time1, sl.time2, sl.time_sum, sl.dnf, sl.dns, sl.dsq, sl.points,
               sl.racer_name, sl.racer_surname,
               sl.racer_year, sl.racer_sex,
               sl.club_name,
               sl.category_name,
               cat.id as cat_id,
               sl.category_sex,
               sl.race_number_actual,
             sl.race_number_display,
             rn.set_color
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_category cat ON sl.category_id = cat.id
         LEFT JOIN fuj_jmlp_race_numbers rn ON rn.id = sl.race_number_id
        WHERE sl.race_id = :race_id
        ORDER BY cat.min_birth_year DESC, cat.sex DESC,
                 CASE
                     WHEN sl.time_sum IS NOT NULL AND sl.dnf = 0 AND sl.dns = 0 AND sl.dsq = 0 THEN 0
                     WHEN sl.dnf = 1 OR sl.dns = 1 OR sl.dsq = 1 THEN 1
                     ELSE 2
                 END ASC,
                 sl.time_sum ASC,
                 CASE WHEN sl.start_number IS NULL THEN 1 ELSE 0 END ASC,
                 sl.start_number ASC,
                 sl.id ASC
    """)
    rows = db.execute(query, {"race_id": race_id}).fetchall()
    
    def format_entry(row, position=None):
        status = None
        if row.dnf:
            status = "DNF"
        elif row.dns:
            status = "DNS"
        elif row.dsq:
            status = "DSQ"
        
        return {
            "id": row.id,
            "position": position,
            "start_number": row.start_number,
            "display_number": row.race_number_display,
            "race_number_display": row.race_number_display,
            "race_number_actual": row.race_number_actual,
            "set_color": row.set_color or "rose",
            "racer_name": fix_encoding(row.racer_name).strip() if row.racer_name else "",
            "racer_surname": fix_encoding(row.racer_surname).strip() if row.racer_surname else "",
            "racer_year": row.racer_year,
            "racer_sex": row.racer_sex,
            "club_name": fix_encoding(row.club_name) if row.club_name else None,
            "category_name": fix_encoding(row.category_name) if row.category_name else None,
            "time1": float(row.time1) if row.time1 is not None else None,
            "time2": float(row.time2) if row.time2 is not None else None,
            "time_sum": float(row.time_sum) if row.time_sum is not None else None,
            "points": row.points,
            "status": status,
        }
    
    if group_by_category:
        categories = {}
        for row in rows:
            cat_name = fix_encoding(row.category_name) if row.category_name else "Bez kategorie"
            cat_id = row.cat_id or 0
            key = str(cat_id)
            
            if key not in categories:
                categories[key] = {
                    "category_id": cat_id,
                    "category_name": cat_name,
                    "entries": []
                }
            categories[key]["entries"].append(row)
        
        # Assign positions within categories
        result_categories = []
        for key, cat_data in categories.items():
            entries = []
            pos = 1
            for row in cat_data["entries"]:
                has_time = row.time_sum is not None and not row.dnf and not row.dns and not row.dsq
                entry = format_entry(row, position=pos if has_time else None)
                if has_time:
                    pos += 1
                entries.append(entry)
            
            result_categories.append({
                "category_id": cat_data["category_id"],
                "category_name": cat_data["category_name"],
                "entries": entries
            })
        
        return {
            "race_id": race_id,
            "race_nr": race.race_nr,
            "race_date": str(race.datum) if race.datum else None,
            "areal_name": areal_name,
            "grouped": True,
            "categories": result_categories,
            "total_entries": len(rows)
        }
    else:
        # Flat list sorted by time_sum
        entries = []
        pos = 1
        for row in rows:
            has_time = row.time_sum is not None and not row.dnf and not row.dns and not row.dsq
            entry = format_entry(row, position=pos if has_time else None)
            if has_time:
                pos += 1
            entries.append(entry)
        
        return {
            "race_id": race_id,
            "race_nr": race.race_nr,
            "race_date": str(race.datum) if race.datum else None,
            "areal_name": areal_name,
            "grouped": False,
            "entries": entries,
            "total_entries": len(rows)
        }


@router.post("/races/{race_id}/results/calculate-points")
def calculate_points(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Calculate and assign points for all entries in a race based on positions."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    
    # Get entries grouped by category, sorted by time
    query = text("""
        SELECT sl.id, sl.category_id, sl.time_sum, sl.dnf, sl.dns, sl.dsq
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_category cat ON sl.category_id = cat.id
        WHERE sl.race_id = :race_id
        ORDER BY cat.min_birth_year DESC, cat.sex DESC,
                 CASE
                     WHEN sl.time_sum IS NOT NULL AND sl.dnf = 0 AND sl.dns = 0 AND sl.dsq = 0 THEN 0
                     WHEN sl.dnf = 1 OR sl.dns = 1 OR sl.dsq = 1 THEN 1
                     ELSE 2
                 END ASC,
                 sl.time_sum ASC,
                 CASE WHEN sl.start_number IS NULL THEN 1 ELSE 0 END ASC,
                 sl.start_number ASC,
                 sl.id ASC
    """)
    rows = db.execute(query, {"race_id": race_id}).fetchall()
    
    # Group by category and assign points
    categories = {}
    for row in rows:
        cat_id = row.category_id or 0
        if cat_id not in categories:
            categories[cat_id] = []
        categories[cat_id].append(row)
    
    updated = 0
    for cat_id, entries in categories.items():
        pos = 1
        for row in entries:
            has_valid_time = (
                row.time_sum is not None 
                and not row.dnf 
                and not row.dns 
                and not row.dsq
            )
            
            if has_valid_time:
                points = get_points_for_position(pos)
                pos += 1
            else:
                points = 0
            
            db.query(models.StartListEntry).filter(
                models.StartListEntry.id == row.id
            ).update({"points": points})
            updated += 1
    
    db.commit()
    return {
        "message": f"Body přiřazeny pro {updated} závodníků v {len(categories)} kategoriích",
        "updated": updated,
        "categories": len(categories)
    }
