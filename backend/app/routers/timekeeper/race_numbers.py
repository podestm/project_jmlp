"""Race number sets management - create, list, delete number sets and individual numbers."""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import text

from ...database import get_db
from ... import models, auth
from ...utils import StandardExceptions
from ...services.race_number_codes import MAX_SETS, race_number_code, set_letter
from .idempotency import try_get_idempotent_response, store_idempotent_response

router = APIRouter(tags=["timekeeper-race-numbers"])

SET_COLOR_OPTIONS = {"rose", "blue", "emerald", "amber", "violet"}


def _normalize_set_color(value: Any) -> str:
    color = str(value or "rose").strip().lower()
    if color not in SET_COLOR_OPTIONS:
        allowed = ", ".join(sorted(SET_COLOR_OPTIONS))
        raise StandardExceptions.bad_request(f"Neplatná barva sady. Povolené hodnoty: {allowed}")
    return color


@router.get("/race-number-sets")
def get_race_number_sets(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get summary of all race number sets."""
    query = text("""
        SELECT set_number,
               MIN(set_color) as set_color,
               COUNT(*) as count,
               SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count,
               SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_count,
               MIN(actual_number) as min_actual,
               MAX(actual_number) as max_actual
        FROM fuj_jmlp_race_numbers
        GROUP BY set_number
        ORDER BY set_number ASC
    """)
    rows = db.execute(query).fetchall()
    
    return [{
        "set_number": row.set_number,
        "set_color": row.set_color or "rose",
        "count": row.count,
        "active_count": int(row.active_count or 0),
        "inactive_count": int(row.inactive_count or 0),
        "min_actual": row.min_actual,
        "max_actual": row.max_actual,
        "letter": set_letter(row.set_number) if 1 <= row.set_number <= MAX_SETS else "",
        "min_display": race_number_code(row.set_number, row.min_actual) if 1 <= row.set_number <= MAX_SETS else None,
        "max_display": race_number_code(row.set_number, row.max_actual) if 1 <= row.set_number <= MAX_SETS else None,
    } for row in rows]


@router.get("/race-numbers")
def get_race_numbers(
    set_number: int = Query(default=1),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get all race numbers for a given set."""
    query = text("""
        SELECT id, set_number, set_color, actual_number, display_number, is_active
        FROM fuj_jmlp_race_numbers
        WHERE set_number = :set_number
        ORDER BY actual_number ASC
    """)
    rows = db.execute(query, {"set_number": set_number}).fetchall()
    
    return [{
        "id": row.id,
        "set_number": row.set_number,
        "set_color": row.set_color or "rose",
        "actual_number": row.actual_number,
        "display_number": row.display_number,
        "is_active": bool(row.is_active),
    } for row in rows]


@router.get("/race-number-options")
def get_active_race_number_options(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get all active race numbers across sets for assignment by system number."""
    query = text("""
        SELECT id, set_number, set_color, actual_number, display_number, is_active
        FROM fuj_jmlp_race_numbers
        WHERE is_active = 1
        ORDER BY set_number ASC, actual_number ASC
    """)
    rows = db.execute(query).fetchall()

    return [{
        "id": row.id,
        "set_number": row.set_number,
        "set_color": row.set_color or "rose",
        "actual_number": row.actual_number,
        "display_number": row.display_number,
        "is_active": bool(row.is_active),
    } for row in rows]


@router.post("/race-numbers")
def add_single_race_number(
    data: Dict[str, Any],
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Add a single race number to a set.

    Body: { "set_number": 1, "actual_number": 201 } - označení (A201) se
    dopočítá z písmena sady a čísla dresu.
    """
    endpoint = "/api/timekeeper/race-numbers"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="POST",
        endpoint=endpoint,
    )
    if replay:
        return replay

    set_number = data.get("set_number")
    actual_number = data.get("actual_number")

    if not all([set_number, actual_number]):
        raise StandardExceptions.bad_request("Chybí povinné parametry: set_number, actual_number")
    try:
        display_number = race_number_code(int(set_number), int(actual_number))
    except ValueError as exc:
        raise StandardExceptions.bad_request(str(exc)) from exc

    duplicate_actual = db.query(models.RaceNumber).filter(
        models.RaceNumber.set_number == set_number,
        models.RaceNumber.actual_number == actual_number,
    ).first()
    if duplicate_actual:
        raise StandardExceptions.bad_request(
            f"Dresové číslo {actual_number} již v sadě {set_number} existuje"
        )
    
    existing_set_number = db.query(models.RaceNumber).filter(
        models.RaceNumber.set_number == set_number
    ).first()
    set_color = existing_set_number.set_color if existing_set_number and existing_set_number.set_color else "rose"
    
    entry = models.RaceNumber(
        set_number=set_number,
        set_color=set_color,
        actual_number=actual_number,
        display_number=display_number,
        is_active=True,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    response_payload = {
        "message": f"Přidáno číslo {display_number} (dres {actual_number}) do sady {set_number}",
        "id": entry.id,
        "set_color": entry.set_color,
        "actual_number": actual_number,
        "display_number": display_number,
        "is_active": True,
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


@router.put("/race-numbers/{number_id}")
def update_single_race_number(
    number_id: int,
    data: Dict[str, Any],
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update a single race number state."""
    endpoint = f"/api/timekeeper/race-numbers/{number_id}"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="PUT",
        endpoint=endpoint,
    )
    if replay:
        return replay

    number = db.query(models.RaceNumber).filter(models.RaceNumber.id == number_id).first()
    if not number:
        raise StandardExceptions.not_found("Závodní číslo nenalezeno")

    if "is_active" not in data:
        raise StandardExceptions.bad_request("Chybí parametr is_active")

    number.is_active = bool(data.get("is_active"))
    db.commit()

    state_label = "aktivní" if number.is_active else "deaktivní"
    response_payload = {
        "message": f"Číslo {number.display_number} je nyní {state_label}",
        "id": number.id,
        "is_active": number.is_active,
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
    return {"message": f"Smazáno číslo {number.display_number} (dres {number.actual_number})"}


@router.put("/race-number-sets/{set_number}")
def update_race_number_set(
    set_number: int,
    data: Dict[str, Any],
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update set metadata such as color."""
    if "set_color" not in data:
        raise StandardExceptions.bad_request("Chybí parametr set_color")

    set_color = _normalize_set_color(data.get("set_color"))
    updated = db.query(models.RaceNumber).filter(
        models.RaceNumber.set_number == set_number
    ).update({"set_color": set_color})

    if updated == 0:
        raise StandardExceptions.not_found(f"Sada č. {set_number} nenalezena")

    db.commit()
    return {
        "message": f"Barva sady {set_number} byla změněna",
        "set_number": set_number,
        "set_color": set_color,
    }


@router.post("/race-number-sets")
def create_race_number_set(
    data: Dict[str, Any],
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new race number set.

    Body: {
        "set_number": 3,
        "actual_from": 1,
        "actual_to": 200
    }
    Označení čísel je písmeno sady + číslo dresu (sada 3 = C1 ... C200).
    """
    endpoint = "/api/timekeeper/race-number-sets"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="POST",
        endpoint=endpoint,
    )
    if replay:
        return replay

    set_number = data.get("set_number")
    actual_from = data.get("actual_from", 1)
    actual_to = data.get("actual_to")
    set_color = _normalize_set_color(data.get("set_color"))

    if not all([set_number, actual_to]):
        raise StandardExceptions.bad_request("Chybí povinné parametry: set_number, actual_to")
    if not 1 <= int(set_number) <= MAX_SETS:
        raise StandardExceptions.bad_request(f"Číslo sady musí být 1-{MAX_SETS} (písmeno A-Z)")

    if actual_from > actual_to:
        raise StandardExceptions.bad_request("actual_from musí být menší než actual_to")
    
    # Check if set_number already exists
    existing = db.query(models.RaceNumber).filter(
        models.RaceNumber.set_number == set_number
    ).count()
    if existing > 0:
        raise StandardExceptions.bad_request(f"Sada č. {set_number} již existuje ({existing} čísel)")
    
    display_from = race_number_code(set_number, actual_from)
    display_to = race_number_code(set_number, actual_to)

    # Create numbers
    created = 0
    for actual in range(actual_from, actual_to + 1):
        entry = models.RaceNumber(
            set_number=set_number,
            set_color=set_color,
            actual_number=actual,
            display_number=race_number_code(set_number, actual),
        )
        db.add(entry)
        created += 1
    
    db.commit()

    response_payload = {
        "message": f"Vytvořeno {created} závodních čísel v sadě {set_letter(set_number)} ({display_from}-{display_to})",
        "created": created,
        "set_number": set_number,
        "set_color": set_color,
        "display_range": f"{display_from}-{display_to}",
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
