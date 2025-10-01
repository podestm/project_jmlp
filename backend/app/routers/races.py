from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from .. import models, schemas
from ..utils import get_current_season_id, calculate_season_for_date
from typing import List
from datetime import datetime, date
import os

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
def list_races(current_season: bool = False, upcoming: bool = False, db: Session = Depends(get_db)):
    # Sestavíme SQL dotaz s filtry
    base_query = """
        SELECT r.id, r.closed+0 as closed, r.datum, r.raceNr, 
               r.registration+0 as registration, r.areal_id, 
               r.organizer_id, r.raceCategory_id, r.raceMethod_id, r.raceType_id, r.season_id,
               r.proposition_file_id, r.results_file_id,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name,
               CONVERT(CONVERT(o.name USING binary) USING utf8mb4) as organizer_name
        FROM fuj_jmlp_race r 
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id 
        LEFT JOIN fuj_jmlp_club o ON r.organizer_id = o.id
        WHERE r.raceNr IS NOT NULL
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
    else:
        base_query += " ORDER BY r.datum DESC"
    
    # Používáme raw SQL pro správné čtení bit hodnot a načítání areálu
    result = db.execute(text(base_query)).fetchall()
    
    races = []
    for row in result:
        race_data = {
            "id": row.id,
            "closed": bool(row.closed),
            "datum": row.datum,
            "raceNr": row.raceNr,
            "registration": bool(row.registration),
            "proposition_file_id": row.proposition_file_id,
            "results_file_id": row.results_file_id,
            "areal_id": row.areal_id,
            "areal_name": row.areal_name or "Bez areálu",
            "organizer_id": row.organizer_id,
            "organizer_name": row.organizer_name or "Neznámý organizátor",
            "raceCategory_id": row.raceCategory_id,
            "raceMethod_id": row.raceMethod_id,
            "raceType_id": row.raceType_id,
            "season_id": row.season_id
        }
        races.append(race_data)
    
    return races


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
        "season_logic": f"Sezóna {current_season_id} (začíná 1.8.{current_season_id-1})",
        "current_date": current_date,
        "season_start": date(current_season_id-1, 8, 1),
        "season_end": date(current_season_id, 7, 31)
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
            "season_period": f"1.8.{season_id-1} - 31.7.{season_id}"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{race_id}", response_model=schemas.Race)
def get_race(race_id: int, db: Session = Depends(get_db)):
    # Použijeme raw SQL pro správné čtení bit hodnot
    result = db.execute(text("""
        SELECT r.id, r.closed+0 as closed, r.datum, r.raceNr, 
               r.registration+0 as registration, r.areal_id, 
               r.organizer_id, r.raceCategory_id, r.raceMethod_id, r.raceType_id, r.season_id,
               r.proposition_file_id, r.results_file_id,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name,
               CONVERT(CONVERT(o.name USING binary) USING utf8mb4) as organizer_name
        FROM fuj_jmlp_race r 
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id 
        LEFT JOIN fuj_jmlp_club o ON r.organizer_id = o.id
        WHERE r.id = :race_id
    """), {"race_id": race_id}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Race not found")
    
    # Vytvoříme race object z raw dat
    race_data = {
        "id": result.id,
        "closed": bool(result.closed),
        "datum": result.datum,
        "raceNr": result.raceNr,
        "registration": bool(result.registration),
        "proposition_file_id": result.proposition_file_id,
        "results_file_id": result.results_file_id,
        "areal_id": result.areal_id,
        "areal_name": result.areal_name or "Bez areálu",
        "organizer_id": result.organizer_id,
        "organizer_name": result.organizer_name or "Neznámý organizátor",
        "raceCategory_id": result.raceCategory_id,
        "raceMethod_id": result.raceMethod_id,
        "raceType_id": result.raceType_id,
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
            rr.registered_at
        FROM race_registration rr
        JOIN fuj_jmlp_racer r ON rr.racer_id = r.id
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE rr.race_id = :race_id
        ORDER BY c.name ASC, r.surname ASC, r.name ASC
    """), {"race_id": race_id}).fetchall()
    
    # Group by clubs
    clubs = {}
    for row in result:
        club_name = row.club_name or "Bez klubu"
        if club_name not in clubs:
            clubs[club_name] = {
                "club_name": club_name,
                "racers": []
            }
        
        clubs[club_name]["racers"].append({
            "firstName": row.firstName,
            "lastName": row.lastName,
            "sex": "M" if row.sex == 1 else ("Z" if row.sex == 2 else ""),
            "birthYear": row.birthYear,
            "idSlcr": row.idSlcr,
            "registered_at": row.registered_at
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
    
    return {
        "clubs": club_list,
        "total_racers": total_racers
    }

@router.get("/{race_id}/club-stats")
def get_club_stats(race_id: int, db: Session = Depends(get_db)):
    """Vrátí počet závodníků podle klubů pro daný závod"""
    result = db.execute(text("""
        SELECT c.name as club_name, COUNT(rr.id) as racer_count
        FROM race_registration rr
        JOIN fuj_jmlp_racer r ON rr.racer_id = r.id
        JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE rr.race_id = :race_id
        GROUP BY c.id, c.name
        ORDER BY racer_count DESC, c.name ASC
    """), {"race_id": race_id}).fetchall()
    
    club_stats = []
    total_racers = 0
    for row in result:
        club_stats.append({
            "club_name": row.club_name,
            "racer_count": row.racer_count
        })
        total_racers += row.racer_count
    
    return {
        "clubs": club_stats,
        "total_racers": total_racers
    }

@router.get("/{race_id}/documents/{doc_type}")
def download_document(race_id: int, doc_type: str, db: Session = Depends(get_db)):
    """Stáhne dokument (propozice nebo výsledky) pro daný závod"""
    if doc_type not in ["proposition", "result"]:
        raise HTTPException(status_code=400, detail="Invalid document type")
    
    # Najdeme závod
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    # Získáme název souboru
    filename = None
    if doc_type == "proposition" and race.proposition:
        filename = race.proposition
    elif doc_type == "result" and race.result:
        filename = race.result
    
    if not filename:
        raise HTTPException(status_code=404, detail=f"Document not found")
    
    # Cesta k souboru
    file_path = os.path.join("/app/documents", filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/pdf'
    )


# Public document endpoints
@router.get("/{race_id}/documents", response_model=List[schemas.Document])
def list_race_documents_public(race_id: int, db: Session = Depends(get_db)):
    """List public documents for a race."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    documents = db.query(models.Document).filter(models.Document.race_id == race_id).all()
    return documents


@router.get("/documents/{document_id}/download")
def download_document_public(document_id: int, db: Session = Depends(get_db)):
    """Download a document (public endpoint)."""
    from pathlib import Path
    from fastapi.responses import FileResponse
    
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path=str(file_path),
        filename=document.original_filename,
        media_type=document.mime_type or 'application/octet-stream'
    )


# Public document download endpoints
@router.get("/{race_id}/proposition")
def download_race_proposition(race_id: int, db: Session = Depends(get_db)):
    """Download race proposition document (public access)."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    if not race.proposition_file_id:
        raise HTTPException(status_code=404, detail="Proposition not found")
    
    # Get file from database
    file_record = db.query(models.File).filter(models.File.id == race.proposition_file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File record not found")
    
    # Check if file exists on disk
    from pathlib import Path
    file_path = Path(file_record.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path=str(file_path),
        filename=file_record.original_filename,
        media_type=file_record.mime_type or 'application/octet-stream'
    )


@router.get("/{race_id}/results")  
def download_race_results(race_id: int, db: Session = Depends(get_db)):
    """Download race results document (public access)."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    if not race.results_file_id:
        raise HTTPException(status_code=404, detail="Results not found")
    
    # Get file from database
    file_record = db.query(models.File).filter(models.File.id == race.results_file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File record not found")
    
    # Check if file exists on disk
    from pathlib import Path
    file_path = Path(file_record.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path=str(file_path),
        filename=file_record.original_filename,
        media_type=file_record.mime_type or 'application/octet-stream'
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

