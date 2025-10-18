from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from app.database import get_db
from app.auth import get_current_admin
from app.models import VisitorLog
from typing import List, Dict

router = APIRouter(prefix="/stats", tags=["admin-stats"])

@router.get("/visits/week")
async def get_weekly_visits(
    db: Session = Depends(get_db),
    current_admin: dict = Depends(get_current_admin)
) -> List[Dict]:
    """Získá statistiku návštěv za posledních 7 dní z databáze."""
    
    today = datetime.now().date()
    data = []
    
    for i in range(6, -1, -1):
        date = today - timedelta(days=i)
        date_start = datetime.combine(date, datetime.min.time())
        date_end = datetime.combine(date, datetime.max.time())
        
        # Počet návštěv za daný den
        visits_count = db.query(func.count(VisitorLog.id)).filter(
            VisitorLog.visited_at >= date_start,
            VisitorLog.visited_at <= date_end
        ).scalar() or 0
        
        data.append({
            "date": date.strftime("%d.%m"),
            "visits": visits_count,
            "fullDate": date.isoformat()
        })
    
    return data
