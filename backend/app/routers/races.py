from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from .. import models, schemas
from typing import List
from datetime import datetime, date
import os

router = APIRouter(prefix="/races", tags=["races"])


def get_current_season_id(reference_date: date = None) -> int:
    """
    Dynamicky určí season_id podle data.
    Nová sezóna začíná 1. srpna každého roku.
    
    Args:
        reference_date: Datum pro určení sezóny (pokud None, použije se aktuální datum)
    
    Returns:
        int: season_id (rok kdy sezóna končí)
    
    Příklad:
        - 15.7.2025 -> sezóna 2025 (ještě stará sezóna)
        - 1.8.2025 -> sezóna 2026 (nová sezóna)
        - 15.3.2026 -> sezóna 2026 (pokračuje sezóna)
    """
    if reference_date is None:
        reference_date = date.today()
    
    year = reference_date.year
    
    # Pokud jsme před 1. srpnem, patříme do sezóny tohoto roku
    # Pokud jsme od 1. srpna, patříme do sezóny následujícího roku
    if reference_date.month >= 8:  # srpen a později
        season_id = year + 1
    else:  # leden až červenec
        season_id = year
    
    return season_id


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

@router.get("/", response_model=List[schemas.Race])
def list_races(current_season: bool = False, upcoming: bool = False, db: Session = Depends(get_db)):
    # Sestavíme SQL dotaz s filtry
    base_query = """
        SELECT r.id, r.closed+0 as closed, r.datum, r.proposition, r.raceNr, 
               r.registration+0 as registration, r.result, r.areal_id, 
               r.organizer_id, r.raceCategory_id, r.raceMethod_id, r.raceType_id, r.season_id,
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
            "proposition": row.proposition,
            "raceNr": row.raceNr,
            "registration": bool(row.registration),
            "result": row.result,
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

@router.get("/{race_id}", response_model=schemas.Race)
def get_race(race_id: int, db: Session = Depends(get_db)):
    # Použijeme raw SQL pro správné čtení bit hodnot
    result = db.execute(text("""
        SELECT r.id, r.closed+0 as closed, r.datum, r.proposition, r.raceNr, 
               r.registration+0 as registration, r.result, r.areal_id, 
               r.organizer_id, r.raceCategory_id, r.raceMethod_id, r.raceType_id, r.season_id,
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
        "proposition": result.proposition,
        "raceNr": result.raceNr,
        "registration": bool(result.registration),
        "result": result.result,
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

@router.get("/{race_id}/registrations", response_model=List[schemas.Registration])
def get_registrations(race_id: int, db: Session = Depends(get_db)):
    regs = db.query(models.Registration).filter(models.Registration.race_id == race_id).all()
    return regs

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
def calculate_season_for_date(race_date: str):
    """
    Vypočítá správné season_id pro zadané datum závodu.
    
    Args:
        race_date: Datum ve formátu YYYY-MM-DD
    
    Returns:
        season_id a informace o sezóně
    """
    try:
        race_date_obj = datetime.strptime(race_date, "%Y-%m-%d").date()
        season_id = get_current_season_id(race_date_obj)
        
        return {
            "race_date": race_date,
            "season_id": season_id,
            "season_logic": f"Závod dne {race_date} patří do sezóny {season_id}",
            "season_period": f"1.8.{season_id-1} - 31.7.{season_id}"
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Neplatný formát data. Použijte YYYY-MM-DD")
