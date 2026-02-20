"""Race number sets management - create, list, delete number sets and individual numbers."""
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
    query = text("""
        SELECT id, set_number, actual_number, display_number
        FROM fuj_jmlp_race_numbers
        WHERE set_number = :set_number
        ORDER BY actual_number ASC
    """)
    rows = db.execute(query, {"set_number": set_number}).fetchall()
    
    return [{
        "id": row.id,
        "set_number": row.set_number,
        "actual_number": row.actual_number,
        "display_number": row.display_number,
    } for row in rows]


@router.post("/race-numbers")
def add_single_race_number(
    data: Dict[str, Any],
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Add a single race number to a set.
    
    Body: { "set_number": 1, "actual_number": 201, "display_number": 201 }
    """
    set_number = data.get("set_number")
    actual_number = data.get("actual_number")
    display_number = data.get("display_number")
    
    if not all([set_number, actual_number, display_number]):
        raise StandardExceptions.bad_request("Chybí povinné parametry: set_number, actual_number, display_number")
    
    # Check display_number uniqueness
    existing = db.query(models.RaceNumber).filter(
        models.RaceNumber.display_number == display_number
    ).first()
    if existing:
        raise StandardExceptions.bad_request(
            f"Zobrazovací číslo {display_number} již existuje (sada {existing.set_number})"
        )
    
    entry = models.RaceNumber(
        set_number=set_number,
        actual_number=actual_number,
        display_number=display_number,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    return {
        "message": f"Přidáno číslo {actual_number} (zobrazení: {display_number}) do sady {set_number}",
        "id": entry.id,
        "actual_number": actual_number,
        "display_number": display_number,
    }


@router.delete("/race-numbers/{number_id}")
def delete_single_race_number(
    number_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """Delete a single race number. Start lists are independent snapshots, no FK constraint."""
    number = db.query(models.RaceNumber).filter(models.RaceNumber.id == number_id).first()
    if not number:
        raise StandardExceptions.not_found("Závodní číslo nenalezeno")
    
    # Nullify any start list references (start lists are snapshots, not live bindings)
    db.query(models.StartListEntry).filter(
        models.StartListEntry.race_number_id == number_id
    ).update({"race_number_id": None})
    
    db.delete(number)
    db.commit()
    return {"message": f"Smazáno číslo {number.actual_number} (zobrazení: {number.display_number})"}


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
    
    Start lists are independent snapshots — references are nullified, not blocked.
    """
    # Nullify start list references to numbers from this set
    db.execute(text("""
        UPDATE fuj_jmlp_race_start_list sl
        JOIN fuj_jmlp_race_numbers rn ON sl.race_number_id = rn.id
        SET sl.race_number_id = NULL
        WHERE rn.set_number = :set_number
    """), {"set_number": set_number})
    
    deleted = db.query(models.RaceNumber).filter(
        models.RaceNumber.set_number == set_number
    ).delete()
    
    if deleted == 0:
        raise StandardExceptions.not_found(f"Sada č. {set_number} nenalezena")
    
    db.commit()
    return {"message": f"Smazáno {deleted} závodních čísel ze sady {set_number}"}
