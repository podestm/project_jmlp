"""Time entry and management for races."""
from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from decimal import Decimal

from ...database import get_db
from ... import models, schemas, auth
from ...utils import StandardExceptions

router = APIRouter(tags=["timekeeper-timing"])


@router.post("/races/{race_id}/times")
def save_times(
    race_id: int,
    data: schemas.BatchTimeEntry,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Batch save times for multiple entries in a race."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    
    updated = 0
    for time_entry in data.entries:
        entry = db.query(models.StartListEntry).filter(
            models.StartListEntry.id == time_entry.entry_id,
            models.StartListEntry.race_id == race_id
        ).first()
        
        if not entry:
            continue
        
        entry.time1 = Decimal(str(time_entry.time1)) if time_entry.time1 is not None else None
        entry.time2 = Decimal(str(time_entry.time2)) if time_entry.time2 is not None else None
        entry.dnf = time_entry.dnf
        entry.dns = time_entry.dns
        entry.dsq = time_entry.dsq
        
        # Calculate time_sum
        if entry.dnf or entry.dns or entry.dsq:
            entry.time_sum = None
        elif entry.time1 is not None and entry.time2 is not None:
            entry.time_sum = entry.time1 + entry.time2
        elif entry.time1 is not None:
            entry.time_sum = entry.time1
        elif entry.time2 is not None:
            entry.time_sum = entry.time2
        else:
            entry.time_sum = None
        
        updated += 1
    
    db.commit()
    return {"message": f"Uloženo {updated} časů", "updated": updated}


@router.put("/start-list/{entry_id}/time")
def update_single_time(
    entry_id: int,
    data: schemas.StartListEntryUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """Update time for a single start list entry."""
    entry = db.query(models.StartListEntry).filter(
        models.StartListEntry.id == entry_id
    ).first()
    
    if not entry:
        raise StandardExceptions.not_found("Záznam nenalezen")
    
    update_data = data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        if key in ('time1', 'time2') and value is not None:
            setattr(entry, key, Decimal(str(value)))
        else:
            setattr(entry, key, value)
    
    # Recalculate time_sum
    if entry.dnf or entry.dns or entry.dsq:
        entry.time_sum = None
    elif entry.time1 is not None and entry.time2 is not None:
        entry.time_sum = entry.time1 + entry.time2
    elif entry.time1 is not None:
        entry.time_sum = entry.time1
    elif entry.time2 is not None:
        entry.time_sum = entry.time2
    else:
        entry.time_sum = None
    
    db.commit()
    return {"message": "Čas aktualizován"}
