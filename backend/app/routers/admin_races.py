"""
Admin endpoints for race management - simplified version without complex season management
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime, date

from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/admin/races", tags=["admin-races"])

def get_season_year_from_date(race_date: date) -> int:
    """
    Určuje rok sezóny na základě data závodu.
    Sezóna běží od 1.8. do 31.7. následujícího roku.
    """
    if race_date.month >= 8:  # srpen a dál = nová sezóna
        return race_date.year
    else:  # leden až červenec = pokračování předchozí sezóny
        return race_date.year - 1

def generate_race_number(race_date: date, db: Session) -> str:
    """
    Generuje raceNr ve formátu JMLP{year}-{number:02d}
    """
    season_year = get_season_year_from_date(race_date)
    print(f"Generating race number for season: {season_year}")
    
    # Najdi nejvyšší číslo v dané sezóně
    pattern = f"JMLP{season_year}-%"
    print(f"Looking for pattern: {pattern}")
    
    try:
        result = db.execute(text("""
            SELECT MAX(CAST(SUBSTRING(raceNr, 10) AS UNSIGNED)) as max_num
            FROM fuj_jmlp_race 
            WHERE raceNr LIKE :pattern
        """), {"pattern": pattern}).fetchone()
        
        print(f"Query result: {result}")
        max_num = result.max_num if result and result.max_num else 0
        print(f"Max number found: {max_num}")
        
        next_number = max_num + 1
        race_nr = f"JMLP{season_year}-{next_number:02d}"
        print(f"Generated race number: {race_nr}")
        
        return race_nr
    except Exception as e:
        print(f"Error in generate_race_number: {e}")
        # Fallback to simple numbering
        return f"JMLP{season_year}-01"

def get_or_create_season_id(race_date: date, db: Session) -> int:
    """
    Vrátí rok sezóny jako season_id (bez používání tabulky)
    """
    return get_season_year_from_date(race_date)

@router.get("/", response_model=List[schemas.Race])
def list_races_admin(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """List all races with admin access"""
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
        ORDER BY r.datum DESC
        LIMIT :limit OFFSET :skip
    """), {"limit": limit, "skip": skip}).fetchall()
    
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

@router.get("/generate-race-number")
def get_race_number_preview(
    date_str: str,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Generate race number preview for given date"""
    print(f"=== GENERATE RACE NUMBER ENDPOINT HIT ===")
    print(f"Received date_str parameter: '{date_str}' (type: {type(date_str)})")
    try:
        print(f"=== GENERATE RACE NUMBER CALLED ===")
        print(f"Input date_str: '{date_str}'")
        
        print(f"Parsing date: {date_str}")
        race_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        print(f"Parsed race_date: {race_date}")
        
        print("Generating race number...")
        race_number = generate_race_number(race_date, db)
        print(f"Generated race_number: {race_number}")
        
        print("Getting season year...")
        season_year = get_season_year_from_date(race_date)
        print(f"Season year: {season_year}")
        
        print("Getting season ID...")
        season_id = get_or_create_season_id(race_date, db)
        print(f"Season ID: {season_id}")
        
        result = {
            "raceNr": race_number,
            "season_year": season_year,
            "season_id": season_id
        }
        print(f"Returning result: {result}")
        return result
        
    except ValueError as e:
        print(f"ValueError in generate_race_number: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid date format. Use YYYY-MM-DD. Error: {str(e)}")
    except Exception as e:
        print(f"Unexpected error in generate_race_number: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/{race_id}", response_model=schemas.Race)
def get_race_admin(
    race_id: int, 
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Get race by ID with admin access"""
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

from fastapi import Request

@router.post("/test-raw")
async def test_raw_post(
    request: Request,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Test endpoint that accepts raw JSON"""
    print(f"=== RAW POST TEST ===")
    data = await request.json()
    print(f"Received raw data: {data}")
    print(f"Data type: {type(data)}")
    for key, value in data.items():
        print(f"  {key}: {value} (type: {type(value)})")
    return {"status": "ok", "received": data}

@router.post("/", response_model=schemas.Race)
def create_race_admin(
    race: schemas.RaceCreate,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Create new race with automatic raceNr and season_id generation"""
    print(f"=== CREATE RACE DEBUG ===")
    print(f"Received race data: {race}")
    print(f"Race dict: {race.dict()}")
    print(f"Admin: {current_admin.email}")
    
    if not race.datum:
        print("ERROR: Race date is missing")
        raise HTTPException(status_code=400, detail="Race date is required")
    
    # Convert string date to date object
    try:
        race_date = datetime.strptime(race.datum, "%Y-%m-%d").date()
        print(f"Converted race date: {race_date}")
    except ValueError as e:
        print(f"ERROR: Invalid date format: {race.datum}")
        raise HTTPException(status_code=400, detail=f"Invalid date format. Use YYYY-MM-DD. Error: {str(e)}")
    
    print(f"Race date: {race_date}")
    
    # Automaticky vygenerujeme raceNr a season_id na základě data
    print("Generating race number...")
    race_number = generate_race_number(race_date, db)
    print(f"Generated race number: {race_number}")
    
    print("Getting season ID...")
    season_id = race.season_id or get_or_create_season_id(race_date, db)
    print(f"Season ID: {season_id}")

    print("Creating race object...")
    # Vytvoříme race objekt
    db_race = models.Race(
        datum=race_date,  # Use converted date object
        raceNr=race_number,  # Automaticky generovaný
        areal_id=race.areal_id,
        organizer_id=race.organizer_id,
        raceCategory_id=race.raceCategory_id or 1,  # Default 1
        raceMethod_id=race.raceMethod_id or 1,      # Default 1
        raceType_id=race.raceType_id or 1,         # Default 1
        registration=race.registration if race.registration is not None else True,
        closed=race.closed if race.closed is not None else False,
        proposition_file_id=race.proposition_file_id,
        results_file_id=race.results_file_id,
        season_id=season_id  # Automaticky generovaný nebo z požadavku
    )
    
    print("Adding to database...")
    db.add(db_race)
    db.commit()
    db.refresh(db_race)
    
    print(f"Race created with ID: {db_race.id}")
    # Vrátíme kompletní race data
    return get_race_admin(db_race.id, db, current_admin)

@router.put("/{race_id}", response_model=schemas.Race)
def update_race_admin(
    race_id: int,
    race: schemas.RaceUpdate,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Update existing race"""
    db_race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not db_race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    # Aktualizujeme pouze poskytnuté hodnoty
    update_data = race.dict(exclude_unset=True)
    
    # Pokud se mění datum, aktualizujeme i season_id a možná i raceNr
    if "datum" in update_data and update_data["datum"]:
        new_season_id = get_or_create_season_id(update_data["datum"], db)
        update_data["season_id"] = new_season_id
        
        # Optionálně můžeme přegenerovat raceNr pokud se změnila sezóna
        old_season_year = get_season_year_from_date(db_race.datum)
        new_season_year = get_season_year_from_date(update_data["datum"])
        
        if old_season_year != new_season_year:
            # Sezóna se změnila, vygenerujeme nové raceNr
            new_race_number = generate_race_number(update_data["datum"], db)
            update_data["raceNr"] = new_race_number
    
    for field, value in update_data.items():
        setattr(db_race, field, value)
    
    db.commit()
    db.refresh(db_race)
    
    # Vrátíme kompletní race data
    return get_race_admin(race_id, db, current_admin)

@router.delete("/{race_id}")
def delete_race_admin(
    race_id: int,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Delete race"""
    db_race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not db_race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    # Zkontrolujeme, jestli má závod registrace
    registrations_count = db.execute(text("""
        SELECT COUNT(*) as count FROM race_registration WHERE race_id = :race_id
    """), {"race_id": race_id}).fetchone()
    
    if registrations_count.count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete race with {registrations_count.count} registrations"
        )
    
    db.delete(db_race)
    db.commit()
    
    return {"message": "Race deleted successfully"}

@router.post("/{race_id}/toggle-registration")
def toggle_race_registration(
    race_id: int,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Toggle race registration on/off"""
    db_race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not db_race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    db_race.registration = not db_race.registration
    db.commit()
    
    return {"message": f"Registration {'enabled' if db_race.registration else 'disabled'} for race {race_id}"}

@router.get("/autocomplete/areals")
def autocomplete_areals(
    q: str = "",
    limit: int = 10,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Autocomplete search for areals"""
    result = db.execute(text("""
        SELECT id, CONVERT(CONVERT(name USING binary) USING utf8mb4) as name
        FROM fuj_jmlp_areal 
        WHERE CONVERT(CONVERT(name USING binary) USING utf8mb4) LIKE :search_term
        ORDER BY name
        LIMIT :limit
    """), {"search_term": f"%{q}%", "limit": limit}).fetchall()
    
    return [{"id": row.id, "name": row.name} for row in result]

@router.post("/autocomplete/areals")
def create_areal(
    areal_data: dict,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Create new areal if it doesn't exist"""
    name = areal_data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Areal name is required")
    
    # Check if areal already exists
    result = db.execute(text("""
        SELECT id FROM fuj_jmlp_areal 
        WHERE CONVERT(CONVERT(name USING binary) USING utf8mb4) = :name
    """), {"name": name}).fetchone()
    
    if result:
        return {"id": result.id, "name": name}
    
    # Create new areal
    db.execute(text("""
        INSERT INTO fuj_jmlp_areal (name) VALUES (:name)
    """), {"name": name})
    db.commit()
    
    # Get the new areal ID
    result = db.execute(text("""
        SELECT id FROM fuj_jmlp_areal 
        WHERE CONVERT(CONVERT(name USING binary) USING utf8mb4) = :name
    """), {"name": name}).fetchone()
    
    return {"id": result.id, "name": name}

@router.get("/autocomplete/organizers")
def autocomplete_organizers(
    q: str = "",
    limit: int = 10,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Autocomplete search for organizers (clubs)"""
    result = db.execute(text("""
        SELECT id, CONVERT(CONVERT(name USING binary) USING utf8mb4) as name
        FROM fuj_jmlp_club 
        WHERE CONVERT(CONVERT(name USING binary) USING utf8mb4) LIKE :search_term
        ORDER BY name
        LIMIT :limit
    """), {"search_term": f"%{q}%", "limit": limit}).fetchall()
    
    return [{"id": row.id, "name": row.name} for row in result]

@router.post("/autocomplete/organizers")
def create_organizer(
    organizer_data: dict,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Create new organizer (club) if it doesn't exist"""
    name = organizer_data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Organizer name is required")
    
    # Check if organizer already exists
    result = db.execute(text("""
        SELECT id FROM fuj_jmlp_club 
        WHERE CONVERT(CONVERT(name USING binary) USING utf8mb4) = :name
    """), {"name": name}).fetchone()
    
    if result:
        return {"id": result.id, "name": name}
    
    # Create new organizer
    db.execute(text("""
        INSERT INTO fuj_jmlp_club (name) VALUES (:name)
    """), {"name": name})
    db.commit()
    
    # Get the new organizer ID
    result = db.execute(text("""
        SELECT id FROM fuj_jmlp_club 
        WHERE CONVERT(CONVERT(name USING binary) USING utf8mb4) = :name
    """), {"name": name}).fetchone()
    
    return {"id": result.id, "name": name}

@router.get("/test")
def test_endpoint():
    """Simple test endpoint"""
    print("=== TEST ENDPOINT CALLED ===")
    return {"status": "ok", "message": "Test endpoint works"}

@router.get("/generate-race-number-noauth")
def get_race_number_preview_no_auth(
    date_str: str,
    db: Session = Depends(get_db)
):
    """Generate race number preview for given date - NO AUTH for testing"""
    try:
        print(f"=== GENERATE RACE NUMBER NO AUTH CALLED ===")
        print(f"Input date_str: '{date_str}'")
        
        if not date_str or date_str == "":
            print("ERROR: Empty date_str")
            return {"error": "Date string is required"}
        
        race_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        print(f"Parsed race_date: {race_date}")
        
        season_year = get_season_year_from_date(race_date)
        print(f"Season year: {season_year}")
        
        return {
            "raceNr": f"JMLP{season_year}-01",
            "season_year": season_year,
            "season_id": season_year
        }
        
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}

@router.get("/test-simple")
def test_simple(current_admin: models.AdminUser = Depends(auth.get_current_admin)):
    """Simple test endpoint with no parameters"""
    print("=== SIMPLE TEST CALLED ===")
    return {"status": "ok", "message": "Simple endpoint works"}