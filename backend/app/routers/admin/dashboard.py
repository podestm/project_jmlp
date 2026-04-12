from typing import Dict, Any, List
from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from ...database import get_db
from ... import models, auth
import os
from ...utils import get_current_season_id, fix_encoding, convert_utf8_field

router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Agregovaná data pro admin dashboard - jeden request místo mnoha."""
    
    today = datetime.now()
    # Frontend ukládá season_id jako START rok (2025 pro sezónu 2025/2026)
    # Backend get_current_season_id() vrací END rok (2026) - proto odečteme 1
    season_end = get_current_season_id()
    season_id = season_end - 1  # DB convention: start year
    
    # --- Počty ---
    total_racers = db.query(func.count(models.Racer.id)).scalar() or 0
    total_clubs = db.query(func.count(models.Club.id)).filter(models.Club.valid == True).scalar() or 0
    total_posts = db.query(func.count(models.Post.id)).scalar() or 0
    
    # Závody v aktuální sezóně
    season_races = db.query(func.count(models.Race.id)).filter(
        models.Race.season_id == season_id
    ).scalar() or 0
    
    open_registrations = db.query(func.count(models.Race.id)).filter(
        models.Race.registration == True,
        models.Race.closed == False
    ).scalar() or 0

    pending_club_requests = db.execute(text(
        "SELECT COUNT(*) FROM fuj_jmlp_race_registration WHERE club_request_note IS NOT NULL"
    )).scalar() or 0
    
    # --- Velikost souborů ---
    files = db.query(models.File).all()
    total_file_size = sum(f.file_size for f in files)
    file_count = len(files)
    
    def format_size(size_bytes):
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
    
    storage_size_formatted = format_size(total_file_size)
    
    # --- Návštěvy ---
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    visits_today = db.query(func.count(models.VisitorLog.id)).filter(
        models.VisitorLog.visited_at >= today_start
    ).scalar() or 0
    
    unique_today = db.query(func.count(func.distinct(models.VisitorLog.ip_address))).filter(
        models.VisitorLog.visited_at >= today_start
    ).scalar() or 0
    
    visits_7days = db.query(func.count(models.VisitorLog.id)).filter(
        models.VisitorLog.visited_at >= today - timedelta(days=7)
    ).scalar() or 0
    
    # --- Nadcházející závod ---
    upcoming_race_query = text(f"""
        SELECT r.id, r.race_nr, r.datum, r.registration, r.closed,
               {convert_utf8_field('a.name')} as areal_name,
               (SELECT COUNT(*) FROM fuj_jmlp_race_registration rr WHERE rr.race_id = r.id) as registration_count
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        WHERE r.datum >= :today AND r.closed = 0
        ORDER BY r.datum ASC
        LIMIT 1
    """)
    upcoming_row = db.execute(upcoming_race_query, {"today": today.date()}).fetchone()
    
    upcoming_race = None
    if upcoming_row:
        days_until = (upcoming_row.datum - today.date()).days if upcoming_row.datum else None
        upcoming_race = {
            "id": upcoming_row.id,
            "race_nr": upcoming_row.race_nr,
            "datum": upcoming_row.datum.isoformat() if upcoming_row.datum else None,
            "areal_name": fix_encoding(upcoming_row.areal_name) if upcoming_row.areal_name else None,
            "registration": bool(upcoming_row.registration),
            "registration_count": upcoming_row.registration_count,
            "days_until": days_until
        }
    
    # --- Posledních 5 registrací ---
    recent_regs_query = text(f"""
        SELECT rr.registered_at, 
               {convert_utf8_field('rac.name')} as racer_name,
               {convert_utf8_field('rac.surname')} as racer_surname,
               r.race_nr,
               {convert_utf8_field('a.name')} as areal_name,
               {convert_utf8_field('c.name')} as club_name
        FROM fuj_jmlp_race_registration rr
        JOIN fuj_jmlp_racer rac ON rr.racer_id = rac.id
        JOIN fuj_jmlp_race r ON rr.race_id = r.id
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        LEFT JOIN fuj_jmlp_club c ON rac.club_id = c.id
        ORDER BY rr.registered_at DESC
        LIMIT 5
    """)
    recent_regs_rows = db.execute(recent_regs_query).fetchall()
    
    recent_registrations = []
    for row in recent_regs_rows:
        recent_registrations.append({
            "registered_at": row.registered_at.isoformat() if row.registered_at else None,
            "racer_name": fix_encoding(row.racer_name).strip() if row.racer_name else "",
            "racer_surname": fix_encoding(row.racer_surname).strip() if row.racer_surname else "",
            "race_nr": row.race_nr,
            "areal_name": fix_encoding(row.areal_name) if row.areal_name else None,
            "club_name": fix_encoding(row.club_name) if row.club_name else None,
        })
    
    # --- Top 5 navštěvovaných stránek (posledních 30 dní) ---
    top_pages_query = text("""
        SELECT path, COUNT(*) as visits
        FROM fuj_jmlp_visitor_log
        WHERE visited_at >= :start AND path IS NOT NULL AND path != '/'
        GROUP BY path
        ORDER BY visits DESC
        LIMIT 5
    """)
    top_pages_rows = db.execute(top_pages_query, {"start": today - timedelta(days=30)}).fetchall()
    top_pages = [{"path": row.path, "visits": row.visits} for row in top_pages_rows]
    
    # --- Poslední příspěvky ---
    recent_posts_query = text("""
        SELECT id, title, published, created_at
        FROM fuj_jmlp_posts
        ORDER BY created_at DESC
        LIMIT 3
    """)
    recent_posts_rows = db.execute(recent_posts_query).fetchall()
    recent_posts = [{
        "id": row.id,
        "title": row.title,
        "published": bool(row.published),
        "created_at": row.created_at.isoformat() if row.created_at else None
    } for row in recent_posts_rows]
    
    return {
        "season": {
            "id": season_id,
            "label": f"{season_id}/{season_id + 1}"
        },
        "counts": {
            "total_racers": total_racers,
            "total_clubs": total_clubs,
            "total_posts": total_posts,
            "season_races": season_races,
            "open_registrations": open_registrations,
            "pending_club_requests": pending_club_requests,
            "storage_size": storage_size_formatted,
            "file_count": file_count,
        },
        "visits": {
            "today": visits_today,
            "today_unique": unique_today,
            "last_7_days": visits_7days,
        },
        "upcoming_race": upcoming_race,
        "recent_registrations": recent_registrations,
        "top_pages": top_pages,
        "recent_posts": recent_posts,
    }


@router.get("/visits-chart")
def get_visits_chart(
    days: int = 7,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Statistika návštěv pro graf s volitelným obdobím."""
    
    # Limit days to reasonable range
    days = min(max(days, 7), 90)
    today = datetime.now().date()
    data = []
    
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        date_start = datetime.combine(d, datetime.min.time())
        date_end = datetime.combine(d, datetime.max.time())
        
        visits_count = db.query(func.count(models.VisitorLog.id)).filter(
            models.VisitorLog.visited_at >= date_start,
            models.VisitorLog.visited_at <= date_end
        ).scalar() or 0
        
        unique_count = db.query(func.count(func.distinct(models.VisitorLog.ip_address))).filter(
            models.VisitorLog.visited_at >= date_start,
            models.VisitorLog.visited_at <= date_end
        ).scalar() or 0
        
        data.append({
            "date": d.strftime("%d.%m"),
            "visits": visits_count,
            "unique": unique_count,
            "fullDate": d.isoformat()
        })
    
    return data
