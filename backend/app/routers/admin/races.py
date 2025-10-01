from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ...database import get_db
from ... import models, schemas, auth
from ...models import FileTypeEnum

router = APIRouter(prefix="/races", tags=["admin-races"])


@router.get("/", response_model=List[schemas.Race])
def get_races(
    skip: int = 0, 
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all races for admin management."""
    races = db.query(models.Race).order_by(desc(models.Race.datum)).offset(skip).limit(limit).all()
    
    # Add areal names and organizer names
    result = []
    for race in races:
        race_dict = race.__dict__.copy()
        
        # Add areal name
        if race.areal_id:
            areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
            race_dict["areal_name"] = areal.name if areal else None
        else:
            race_dict["areal_name"] = None
        
        # Add organizer name
        if race.organizer_id:
            organizer = db.query(models.Club).filter(models.Club.id == race.organizer_id).first()
            race_dict["organizer_name"] = organizer.name if organizer else None
        else:
            race_dict["organizer_name"] = None
            
        result.append(race_dict)
    
    return result


@router.get("/{race_id}", response_model=schemas.Race)
def get_race(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get single race details for admin."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    race_dict = race.__dict__.copy()
    
    # Add areal name
    if race.areal_id:
        areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
        race_dict["areal_name"] = areal.name if areal else None
    else:
        race_dict["areal_name"] = None
    
    # Add organizer name
    if race.organizer_id:
        organizer = db.query(models.Club).filter(models.Club.id == race.organizer_id).first()
        race_dict["organizer_name"] = organizer.name if organizer else None
    else:
        race_dict["organizer_name"] = None
    
    return race_dict


@router.post("/", response_model=schemas.Race)
def create_race(
    race_data: schemas.RaceCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new race."""
    race = models.Race(**race_data.dict())
    db.add(race)
    db.commit()
    db.refresh(race)
    
    # Auto-categorize files when assigned to race
    if race_data.proposition_file_id:
        file_record = db.query(models.File).filter(models.File.id == race_data.proposition_file_id).first()
        if file_record and file_record.file_type == FileTypeEnum.neprirazene:
            file_record.file_type = FileTypeEnum.propozice
            db.commit()
    
    if race_data.results_file_id:
        file_record = db.query(models.File).filter(models.File.id == race_data.results_file_id).first()
        if file_record and file_record.file_type == FileTypeEnum.neprirazene:
            file_record.file_type = FileTypeEnum.vysledky
            db.commit()
    
    # Add areal name
    race_dict = race.__dict__.copy()
    if race.areal_id:
        areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
        race_dict["areal_name"] = areal.name if areal else None
    else:
        race_dict["areal_name"] = None
    
    return race_dict


@router.put("/{race_id}", response_model=schemas.Race)
def update_race(
    race_id: int,
    race_data: schemas.RaceUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Update an existing race."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    # Update only provided fields
    update_data = race_data.dict(exclude_unset=True)
    
    # Handle file assignments and disconnections
    if 'proposition_file_id' in update_data:
        if update_data['proposition_file_id']:  # Assigning a file
            file_record = db.query(models.File).filter(models.File.id == update_data['proposition_file_id']).first()
            if file_record and file_record.file_type == FileTypeEnum.neprirazene:
                file_record.file_type = FileTypeEnum.propozice
        else:  # Disconnecting file (empty string or None)
            update_data['proposition_file_id'] = None
    
    if 'results_file_id' in update_data:
        if update_data['results_file_id']:  # Assigning a file
            file_record = db.query(models.File).filter(models.File.id == update_data['results_file_id']).first()
            if file_record and file_record.file_type == FileTypeEnum.neprirazene:
                file_record.file_type = FileTypeEnum.vysledky
        else:  # Disconnecting file (empty string or None)
            update_data['results_file_id'] = None
    
    # Apply updates to race
    for field, value in update_data.items():
        setattr(race, field, value)
    
    db.commit()
    db.refresh(race)
    
    # Add areal name
    race_dict = race.__dict__.copy()
    if race.areal_id:
        areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
        race_dict["areal_name"] = areal.name if areal else None
    else:
        race_dict["areal_name"] = None
    
    return race_dict


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
    db.commit()
    
    status_text = "otevřené" if race.registrace_otevrene else "uzavřené"
    return {"message": f"Registrace pro závod jsou nyní {status_text}"}


@router.delete("/{race_id}")
def delete_race(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a race."""
    try:
        race = db.query(models.Race).filter(models.Race.id == race_id).first()
        if not race:
            raise HTTPException(status_code=404, detail="Závod nenalezen")
        
        # Check if race has any registrations
        registrations_count = db.query(models.Registration).filter(
            models.Registration.race_id == race_id
        ).count()
        
        if registrations_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Nelze smazat závod s {registrations_count} registracemi"
            )
        
        db.delete(race)
        db.commit()
        return {"message": "Závod úspěšně smazán"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting race {race_id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Chyba při mazání závodu: {str(e)}")


@router.get("/autocomplete/areals")
def autocomplete_areals(
    q: str,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get areals matching search query for autocomplete."""
    if not q or len(q.strip()) < 2:
        return []
    
    areals = db.query(models.Areal).filter(
        models.Areal.name.like(f"%{q}%")
    ).limit(10).all()
    
    return [{"id": areal.id, "name": areal.name} for areal in areals]


@router.get("/autocomplete/organizers")
def autocomplete_organizers(
    q: str,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get clubs/organizers matching search query for autocomplete."""
    if not q or len(q.strip()) < 2:
        return []
    
    clubs = db.query(models.Club).filter(
        models.Club.name.like(f"%{q}%")
    ).limit(10).all()
    
    return [{"id": club.id, "name": club.name} for club in clubs]