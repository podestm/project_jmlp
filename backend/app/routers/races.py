from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from .. import models, schemas
from ..models import AttachmentRole
from ..services import attachments as attachment_service
from ..utils import get_current_season_id, calculate_season_for_date, category_display_sql
from typing import List
from pathlib import Path
from datetime import datetime, date

router = APIRouter(prefix="/races", tags=["races"])


def get_current_season_filter(db: Session) -> int:
    """
    Získá aktuální season_id pro filtrování závodů.
    """
    current_season = get_current_season_id()
    
    # Ověříme, že tato sezóna existuje v databázi
    result = db.execute(text("SELECT COUNT(*) as count FROM fuj_jmlp_race WHERE season_id = :season_id"), 
                       {"season_id": current_season}).fetchone()
    
    if result.count > 0:
        return current_season
    else:
        # Pokud aktuální sezóna neexistuje, vezmi nejvyšší dostupnou
        result = db.execute(text("SELECT MAX(season_id) as max_season FROM fuj_jmlp_race")).fetchone()
        return result.max_season if result.max_season else current_season


# Helper endpoints for dropdowns - must be before parametrized routes
@router.get("/areals", response_model=List[schemas.Areal])
def list_areals(db: Session = Depends(get_db)):
    """List all areals for dropdown selection."""
    areals = db.query(models.Areal).all()
    return areals


@router.get("/organizers", response_model=List[schemas.Club])
def list_organizers(db: Session = Depends(get_db)):
    """List all clubs that can be organizers."""
    clubs = db.query(models.Club).filter(models.Club.valid == True).all()
    return clubs


@router.get("/", response_model=List[schemas.Race])
def list_races(
    current_season: bool = False, 
    upcoming: bool = False, 
    past: bool = False,
    limit: int = None,
    db: Session = Depends(get_db)
):
    # Sestavíme SQL dotaz s filtry
    base_query = f"""
        SELECT r.id, r.closed+0 as closed, r.datum, r.race_nr,
               r.registration+0 as registration, r.areal_id,
               r.organizer_id, r.race_method_id, r.season_id,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name,
               CONVERT(CONVERT(o.name USING binary) USING utf8mb4) as organizer_name,
               {attachment_service.RACE_DOCUMENT_COLUMNS}
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        LEFT JOIN fuj_jmlp_club o ON r.organizer_id = o.id
        {attachment_service.race_document_joins(published_only=True)}
        WHERE r.race_nr IS NOT NULL
    """
    
    # Přidáme filtry
    if current_season:
        # Dynamicky určíme aktuální sezónu podle data
        current_season_id = get_current_season_filter(db)
        base_query += f" AND r.season_id = {current_season_id}"
    
    if upcoming:
        # Pouze nadcházející závody
        base_query += " AND r.datum >= CURDATE()"
        base_query += " ORDER BY r.datum ASC"
    elif past:
        # Pouze uplynulé závody
        base_query += " AND r.datum < CURDATE()"
        base_query += " ORDER BY r.datum DESC"
    else:
        base_query += " ORDER BY r.datum DESC"
    
    # Přidáme LIMIT pokud je zadán
    if limit:
        base_query += f" LIMIT {limit}"
    
    # Používáme raw SQL pro správné čtení bit hodnot a načítání areálu
    result = db.execute(text(base_query)).fetchall()
    
    races = []
    for row in result:
        race_data = {
            "id": row.id,
            "closed": bool(row.closed),
            "datum": row.datum,
            "race_nr": row.race_nr,
            "registration": bool(row.registration),
            "proposition_file_id": row.proposition_file_id,
            "results_file_id": row.results_file_id,
            "proposition_file_path": row.proposition_file_path,
            "results_file_path": row.results_file_path,
            "areal_id": row.areal_id,
            "areal_name": row.areal_name or "Bez areálu",
            "organizer_id": row.organizer_id,
            "organizer_name": row.organizer_name or "Neznámý organizátor",
            "race_method_id": row.race_method_id,
            "season_id": row.season_id
        }
        races.append(race_data)
    
    return races


# Live race public endpoints (must be before /{race_id} to avoid routing conflicts)
@router.get("/live/status")
def get_live_race_status(response: Response, db: Session = Depends(get_db)):
    """
    Lightweight "is anything live right now" check. 404 if nothing is live.

    Every visitor polls this from the navigation banner, so it must not carry
    the full start list the way /races/live does - one indexed row read only.
    """
    response.headers["Cache-Control"] = "no-store"
    live = db.execute(text("""
        SELECT r.id, r.race_nr,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        WHERE r.is_live = 1
        LIMIT 1
    """)).fetchone()

    if not live:
        raise HTTPException(status_code=404, detail="No live race")

    return {
        "race_id": live.id,
        "race_nr": live.race_nr,
        "areal_name": live.areal_name or "Bez areálu",
    }


@router.get("/live")
def get_live_race(response: Response, db: Session = Depends(get_db)):
    """Returns currently live race with live results. 404 if no race is live."""
    # NOTE: nginx is configured to pass through Cache-Control headers (see nginx.conf:84).
    # This endpoint intentionally sets "no-store" here to ensure live data is never cached
    # by clients or intermediate proxies. If nginx cache policy changes, keep this behavior.
    response.headers["Cache-Control"] = "no-store"
    live = db.execute(text("""
        SELECT r.id, r.race_nr, r.datum, r.race_method_id,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        WHERE r.is_live = 1
        LIMIT 1
    """)).fetchone()

    if not live:
        raise HTTPException(status_code=404, detail="No live race")

    # Název kategorie živě z adminu; snapshot v listině je jen záloha pro
    # historická data - jinak by na webu svítil název z doby rozlosování.
    entries = db.execute(text(f"""
        SELECT sl.id, sl.start_number, sl.race_number_actual, sl.race_number_display,
               sl.racer_name, sl.racer_surname, sl.racer_year,
               sl.club_name,
               COALESCE({category_display_sql('cat')}, sl.category_name) as category_name,
               sl.category_id,
               sl.time1, sl.time2, sl.time_sum,
               sl.dnf+0 as dnf, sl.dns+0 as dns, sl.dsq+0 as dsq,
               COALESCE(rn.set_color, 'rose') as set_color
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_race_numbers rn ON sl.race_number_id = rn.id
        LEFT JOIN fuj_jmlp_category cat ON cat.id = sl.category_id
        WHERE sl.race_id = :race_id
        ORDER BY category_name, sl.start_number ASC
    """), {"race_id": live.id}).fetchall()

    categories: dict = {}
    cat_order: list = []
    for e in entries:
        cat_id = e.category_id or 0
        if cat_id not in categories:
            categories[cat_id] = {"category_id": cat_id, "category_name": e.category_name or "Bez kategorie", "entries": []}
            cat_order.append(cat_id)
        status = "DNF" if e.dnf else ("DNS" if e.dns else ("DSQ" if e.dsq else None))
        categories[cat_id]["entries"].append({
            "id": e.id,
            "start_number": e.start_number,
            "race_number_actual": e.race_number_actual,
            "race_number_display": e.race_number_display,
            "racer_name": e.racer_name,
            "racer_surname": e.racer_surname,
            "racer_year": e.racer_year,
            "club_name": e.club_name,
            "set_color": e.set_color,
            "time1": float(e.time1) if e.time1 is not None else None,
            "time2": float(e.time2) if e.time2 is not None else None,
            "time_sum": float(e.time_sum) if e.time_sum is not None else None,
            "status": status,
            "points": None,
        })

    result_categories = [categories[cid] for cid in cat_order]

    return {
        "race_id": live.id,
        "race_nr": live.race_nr,
        "race_date": live.datum.isoformat() if live.datum else None,
        "areal_name": live.areal_name,
        "race_method_id": live.race_method_id,
        "categories": result_categories,
        "updated_at": datetime.utcnow().isoformat(),
    }


# Season-related endpoints (must be before /{race_id} to avoid routing conflicts)
@router.get("/season/current")
def get_current_season(db: Session = Depends(get_db)):
    """
    Vrátí informace o aktuální sezóně podle data.
    """
    current_season_id = get_current_season_filter(db)
    current_date = date.today()
    
    return {
        "current_season_id": current_season_id,
        "season_logic": f"Sezóna {current_season_id} (začíná 1.8.{current_season_id})",
        "current_date": current_date,
        "season_start": date(current_season_id, 8, 1),
        "season_end": date(current_season_id + 1, 7, 31)
    }


@router.get("/season/calculate")
def calculate_season_for_date_endpoint(race_date: str):
    """
    Vypočítá správné season_id pro zadané datum závodu.
    
    Args:
        race_date: Datum ve formátu YYYY-MM-DD
    
    Returns:
        season_id a informace o sezóně
    """
    try:
        season_id = calculate_season_for_date(race_date)
        
        return {
            "race_date": race_date,
            "season_id": season_id,
            "season_logic": f"Závod dne {race_date} patří do sezóny {season_id}",
            "season_period": f"1.8.{season_id} - 31.7.{season_id + 1}"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{race_id}", response_model=schemas.Race)
def get_race(race_id: int, db: Session = Depends(get_db)):
    # Použijeme raw SQL pro správné čtení bit hodnot
    result = db.execute(text(f"""
        SELECT r.id, r.closed+0 as closed, r.datum, r.race_nr,
               r.registration+0 as registration, r.areal_id,
               r.organizer_id, r.race_method_id, r.season_id,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name,
               CONVERT(CONVERT(o.name USING binary) USING utf8mb4) as organizer_name,
               {attachment_service.RACE_DOCUMENT_COLUMNS}
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        LEFT JOIN fuj_jmlp_club o ON r.organizer_id = o.id
        {attachment_service.race_document_joins(published_only=True)}
        WHERE r.id = :race_id
    """), {"race_id": race_id}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Race not found")
    
    # Vytvoříme race object z raw dat
    race_data = {
        "id": result.id,
        "closed": bool(result.closed),
        "datum": result.datum,
        "race_nr": result.race_nr,
        "registration": bool(result.registration),
        "proposition_file_id": result.proposition_file_id,
        "results_file_id": result.results_file_id,
        "proposition_file_path": result.proposition_file_path,
        "results_file_path": result.results_file_path,
        "areal_id": result.areal_id,
        "areal_name": result.areal_name or "Bez areálu",
        "organizer_id": result.organizer_id,
        "organizer_name": result.organizer_name or "Neznámý organizátor",
        "race_method_id": result.race_method_id,
        "season_id": result.season_id
    }
    
    return race_data

@router.get("/{race_id}/registrations")
def get_registrations(race_id: int, db: Session = Depends(get_db)):
    """Vrátí detailní seznam všech registrovaných závodníků seskupených podle klubů"""
    result = db.execute(text("""
        SELECT 
            CONVERT(CONVERT(r.name USING binary) USING utf8mb4) as firstName,
            CONVERT(CONVERT(r.surname USING binary) USING utf8mb4) as lastName,
            r.sex,
            r.year as birthYear,
            r.slcr_id as idSlcr,
            CONVERT(CONVERT(c.name USING binary) USING utf8mb4) as club_name,
            c.id as club_id,
            rr.registered_at,
            {category_display} as category_name,
            cat.id as category_id,
            cat.sex as category_sex
        FROM fuj_jmlp_race_registration rr
        JOIN fuj_jmlp_racer r ON rr.racer_id = r.id
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        LEFT JOIN fuj_jmlp_category cat ON rr.category_id = cat.id
        WHERE rr.race_id = :race_id
        ORDER BY c.name ASC, r.surname ASC, r.name ASC
    """.format(category_display=category_display_sql("cat"))), {"race_id": race_id}).fetchall()

    # Group by clubs
    clubs = {}
    categories = set()  # Pro sběr unikátních kategorií
    for row in result:
        club_name = row.club_name or "Bez klubu"
        if club_name not in clubs:
            clubs[club_name] = {
                "club_name": club_name,
                "racers": []
            }
        
        # Přidáme kategorii do setu (název už je zobrazovaný, viz category_display_sql)
        if row.category_name:
            categories.add((row.category_id, row.category_name))
        
        clubs[club_name]["racers"].append({
            "firstName": row.firstName,
            "lastName": row.lastName,
            "sex": "M" if row.sex == 1 else ("Z" if row.sex == 2 else ""),
            "birthYear": row.birthYear,
            "idSlcr": row.idSlcr,
            "registered_at": row.registered_at,
            # Název je už zobrazovaný (category_display_sql doplní pohlaví jen
            # kategoriím bez vlastního názvu) - přidat ho znovu by dalo
            # "Myšáci dívky - Ženy".
            "category_name": row.category_name,
            "category_id": row.category_id
        })
    
    # Convert to list and add counts
    club_list = []
    total_racers = 0
    for club_name, club_data in clubs.items():
        club_data["racer_count"] = len(club_data["racers"])
        club_list.append(club_data)
        total_racers += club_data["racer_count"]
    
    # Sort by racer count descending, then by club name
    club_list.sort(key=lambda x: (-x["racer_count"], x["club_name"]))
    
    # Seznam kategorií pro filtry
    category_list = [{"id": cat_id, "name": cat_name} for cat_id, cat_name in sorted(categories, key=lambda x: x[1])]
    
    return {
        "clubs": club_list,
        "total_racers": total_racers,
        "categories": category_list
    }

# ============================================================================
# PUBLIC DOCUMENT DOWNLOAD ENDPOINTS (fuj_jmlp_files table)
# ============================================================================
def _race_document_response(race_id: int, role: str, missing_detail: str, db: Session):
    """Stažení dokumentu závodu (propozice / výsledky) - veřejně."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nebyl nalezen")

    file_record = attachment_service.race_document_file(db, race_id, role)
    if not file_record:
        raise HTTPException(status_code=404, detail=missing_detail)

    file_path = Path(file_record.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Soubor nebyl na disku nalezen")

    return FileResponse(
        path=str(file_path),
        filename=file_record.original_filename,
        media_type=file_record.mime_type or 'application/octet-stream'
    )


@router.get("/{race_id}/proposition")
def download_race_proposition(race_id: int, db: Session = Depends(get_db)):
    """Download race proposition document (public access)."""
    return _race_document_response(
        race_id, AttachmentRole.propozice.value, "Propozice nebyly nalezeny", db
    )


@router.get("/{race_id}/results")
def download_race_results(race_id: int, db: Session = Depends(get_db)):
    """Download race results document (public access)."""
    return _race_document_response(
        race_id, AttachmentRole.vysledky.value, "Výsledky nebyly nalezeny", db
    )


@router.post("/{race_id}/register", response_model=schemas.Registration)
def register_for_race(
    race_id: int,
    payload: schemas.RegistrationCreate,
    db: Session = Depends(get_db)
):
    """Register a racer for a race"""
    # Set race_id from URL parameter
    payload.race_id = race_id
    
    # Import and use the registration logic from registration router
    from .registration import create_registration
    return create_registration(payload, db)

