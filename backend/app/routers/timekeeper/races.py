"""Timekeeper race listing - shows races with registration data."""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from ...database import get_db
from ... import models, auth
from ...utils import fix_encoding, convert_utf8_field

router = APIRouter(prefix="/races", tags=["timekeeper-races"])


@router.get("")
def get_races_for_timekeeper(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get all races with registration counts, ordered by date desc."""
    query = text(f"""
        SELECT r.id, r.raceNr, r.datum, r.closed, r.registration, r.season_id,
               {convert_utf8_field('a.name')} as areal_name,
               (SELECT COUNT(*) FROM race_registration rr WHERE rr.race_id = r.id) as reg_count,
               (SELECT COUNT(*) FROM fuj_jmlp_race_start_list sl WHERE sl.race_id = r.id) as start_list_count
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        ORDER BY r.datum DESC
    """)
    rows = db.execute(query).fetchall()
    
    return [{
        "id": row.id,
        "raceNr": row.raceNr,
        "datum": row.datum.isoformat() if row.datum else None,
        "closed": bool(row.closed),
        "registration": bool(row.registration),
        "season_id": row.season_id,
        "areal_name": fix_encoding(row.areal_name) if row.areal_name else None,
        "reg_count": row.reg_count,
        "start_list_count": row.start_list_count,
    } for row in rows]
