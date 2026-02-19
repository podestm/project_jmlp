"""Race number sets management - create, list, delete number sets."""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from ...database import get_db
from ... import models, auth
from ...utils import StandardExceptions

router = APIRouter(tags=["timekeeper-race-numbers"])


@router.get("/race-number-sets")
def get_race_number_sets(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get summary of all race number sets."""
    query = text("""
        SELECT set_number,
               COUNT(*) as count,
               MIN(actual_number) as min_actual,
               MAX(actual_number) as max_actual,
               MIN(display_number) as min_display,
               MAX(display_number) as max_display
        FROM fuj_jmlp_race_numbers
        GROUP BY set_number
        ORDER BY set_number ASC
    """)
    rows = db.execute(query).fetchall()
    
    return [{
        "set_number": row.set_number,
        "count": row.count,
        "min_actual": row.min_actual,
        "max_actual": row.max_actual,
        "min_display": row.min_display,
        "max_display": row.max_display,
    } for row in rows]


@router.get("/race-numbers")
def get_race_numbers(
    set_number: int = Query(default=1),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get all race numbers for a given set."""
    numbers = db.query(models.RaceNumber).filter(
        models.RaceNumber.set_number == set_number
    ).order_by(models.RaceNumber.actual_number).all()
    
    return [{
        "id": n.id,
        "set_number": n.set_number,
        "actual_number": n.actual_number,
        "display_number": n.display_number,
    } for n in numbers]


@router.post("/race-number-sets")
def create_race_number_set(
    data: Dict[str, Any],
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new race number set.
    
    Body: {
        "set_number": 3,
        "actual_from": 1,
        "actual_to": 200,
        "display_from": 401
    }
    
    actual_from/actual_to = the real physical numbers on the bibs
    display_from = the starting display number in the system (must not overlap existing)
    """
    set_number = data.get("set_number")
    actual_from = data.get("actual_from", 1)
    actual_to = data.get("actual_to")
    display_from = data.get("display_from")
    
    if not all([set_number, actual_to, display_from]):
        raise StandardExceptions.bad_request("Chybí povinné parametry: set_number, actual_to, display_from")
    
    if actual_from > actual_to:
        raise StandardExceptions.bad_request("actual_from musí být menší než actual_to")
    
    # Check if set_number already exists
    existing = db.query(models.RaceNumber).filter(
        models.RaceNumber.set_number == set_number
    ).count()
    if existing > 0:
        raise StandardExceptions.bad_request(f"Sada č. {set_number} již existuje ({existing} čísel)")
    
    # Check display_number overlap
    count = actual_to - actual_from + 1
    display_to = display_from + count - 1
    
    overlap = db.query(models.RaceNumber).filter(
        models.RaceNumber.display_number >= display_from,
        models.RaceNumber.display_number <= display_to
    ).count()
    if overlap > 0:
        raise StandardExceptions.bad_request(
            f"Zobrazovací čísla {display_from}-{display_to} se překrývají s existujícími ({overlap} konfliktů)"
        )
    
    # Create numbers
    created = 0
    for i, actual in enumerate(range(actual_from, actual_to + 1)):
        entry = models.RaceNumber(
            set_number=set_number,
            actual_number=actual,
            display_number=display_from + i,
        )
        db.add(entry)
        created += 1
    
    db.commit()
    
    return {
        "message": f"Vytvořeno {created} závodních čísel v sadě {set_number} (zobrazení: {display_from}-{display_to})",
        "created": created,
        "set_number": set_number,
        "display_range": f"{display_from}-{display_to}"
    }


@router.delete("/race-number-sets/{set_number}")
def delete_race_number_set(
    set_number: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """Delete all race numbers in a set.
    
    Will fail if any numbers from this set are currently assigned in a start list.
    """
    # Check if any numbers from this set are in use
    in_use = db.execute(text("""
        SELECT COUNT(*) as cnt FROM fuj_jmlp_race_start_list sl
        JOIN fuj_jmlp_race_numbers rn ON sl.race_number_id = rn.id
        WHERE rn.set_number = :set_number
    """), {"set_number": set_number}).scalar()
    
    if in_use > 0:
        raise StandardExceptions.bad_request(
            f"Nelze smazat: {in_use} čísel z této sady je přiřazeno na startovních listinách"
        )
    
    deleted = db.query(models.RaceNumber).filter(
        models.RaceNumber.set_number == set_number
    ).delete()
    
    if deleted == 0:
        raise StandardExceptions.not_found(f"Sada č. {set_number} nenalezena")
    
    db.commit()
    return {"message": f"Smazáno {deleted} závodních čísel ze sady {set_number}"}
