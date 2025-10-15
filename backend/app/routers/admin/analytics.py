from typing import Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from ...database import get_db
from ... import models, auth

router = APIRouter(tags=["admin-analytics"])


@router.get("/analytics/visitors")
def get_visitor_stats(
    days: int = 7,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Vrací statistiku návštěv za posledních N dní.
    """
    # Datum od kterého počítáme
    start_date = datetime.now() - timedelta(days=days)
    
    # Celkový počet návštěv za období
    total_visits = db.query(func.count(models.VisitorLog.id)).filter(
        models.VisitorLog.visited_at >= start_date
    ).scalar() or 0
    
    # Počet unikátních IP adres
    unique_visitors = db.query(func.count(func.distinct(models.VisitorLog.ip_address))).filter(
        models.VisitorLog.visited_at >= start_date
    ).scalar() or 0
    
    # Statistika po dnech
    daily_stats_query = text("""
        SELECT 
            DATE(visited_at) as visit_date,
            COUNT(*) as visits,
            COUNT(DISTINCT ip_address) as unique_ips
        FROM fuj_jmlp_visitor_log
        WHERE visited_at >= :start_date
        GROUP BY DATE(visited_at)
        ORDER BY visit_date DESC
    """)
    
    daily_result = db.execute(daily_stats_query, {"start_date": start_date})
    daily_stats = []
    for row in daily_result:
        daily_stats.append({
            "date": row[0].strftime("%Y-%m-%d") if row[0] else None,
            "visits": row[1],
            "unique_visitors": row[2]
        })
    
    # Top 10 nejnavštěvovanějších stránek
    top_pages_query = text("""
        SELECT 
            path,
            COUNT(*) as visits
        FROM fuj_jmlp_visitor_log
        WHERE visited_at >= :start_date AND path IS NOT NULL
        GROUP BY path
        ORDER BY visits DESC
        LIMIT 10
    """)
    
    top_pages_result = db.execute(top_pages_query, {"start_date": start_date})
    top_pages = []
    for row in top_pages_result:
        top_pages.append({
            "path": row[0],
            "visits": row[1]
        })
    
    return {
        "period_days": days,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": datetime.now().strftime("%Y-%m-%d"),
        "total_visits": total_visits,
        "unique_visitors": unique_visitors,
        "daily_stats": daily_stats,
        "top_pages": top_pages
    }


@router.get("/analytics/visitors/today")
def get_today_visitors(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Vrací počet návštěv za dnešní den.
    """
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_today = db.query(func.count(models.VisitorLog.id)).filter(
        models.VisitorLog.visited_at >= today_start
    ).scalar() or 0
    
    unique_today = db.query(func.count(func.distinct(models.VisitorLog.ip_address))).filter(
        models.VisitorLog.visited_at >= today_start
    ).scalar() or 0
    
    return {
        "date": today_start.strftime("%Y-%m-%d"),
        "total_visits": total_today,
        "unique_visitors": unique_today
    }


# Veřejný endpoint pro logování návštěv z frontendu
@router.post("/log-visit")
async def log_visit(
    request: Request,
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """
    Veřejný endpoint pro logování návštěv z frontendu.
    Zavolá se při načtení každé stránky v React aplikaci.
    """
    try:
        # Získej IP adresu (respektuje X-Forwarded-For pokud je za proxy)
        ip_address = request.headers.get("X-Forwarded-For")
        if ip_address:
            ip_address = ip_address.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None
        
        # Získej User-Agent
        user_agent = request.headers.get("User-Agent", "")[:255]
        
        # Získej cestu z Referer nebo z body
        body = await request.json() if request.headers.get("content-type") == "application/json" else {}
        path = body.get("path", "/")[:255]
        
        # Ulož do databáze
        log_entry = models.VisitorLog(
            ip_address=ip_address,
            user_agent=user_agent,
            path=path,
            visited_at=datetime.now()
        )
        db.add(log_entry)
        db.commit()
        
        return {"status": "ok"}
    except Exception as e:
        print(f"Error logging visit: {e}")
        return {"status": "error", "message": str(e)}
