from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ...database import get_db
from ... import models, schemas, auth
from ...models import FileTypeEnum
from ...utils import fix_encoding

router = APIRouter(prefix="/races", tags=["admin-races"])


@router.get("", response_model=List[schemas.Race])
def get_races(
    skip: int = 0, 
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all races for admin management."""
    races = db.query(models.Race).order_by(desc(models.Race.datum)).offset(skip).limit(limit).all()
    
    # Add areal names, organizer names and registration counts
    result = []
    for race in races:
        race_dict = race.__dict__.copy()
        
        # Add areal name
        if race.areal_id:
            areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
            race_dict["areal_name"] = fix_encoding(areal.name) if areal else None
        else:
            race_dict["areal_name"] = None
        
        # Add organizer name
        if race.organizer_id:
            organizer = db.query(models.Club).filter(models.Club.id == race.organizer_id).first()
            race_dict["organizer_name"] = fix_encoding(organizer.name) if organizer else None
        else:
            race_dict["organizer_name"] = None
        
        # Add registrations count
        registrations_count = db.query(models.Registration).filter(
            models.Registration.race_id == race.id
        ).count()
        race_dict["registrations_count"] = registrations_count
            
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
        race_dict["areal_name"] = fix_encoding(areal.name) if areal else None
    else:
        race_dict["areal_name"] = None
    
    # Add organizer name
    if race.organizer_id:
        organizer = db.query(models.Club).filter(models.Club.id == race.organizer_id).first()
        race_dict["organizer_name"] = fix_encoding(organizer.name) if organizer else None
    else:
        race_dict["organizer_name"] = None
    
    # Add registrations count
    registrations_count = db.query(models.Registration).filter(
        models.Registration.race_id == race.id
    ).count()
    race_dict["registrations_count"] = registrations_count
    
    return race_dict


@router.post("", response_model=schemas.Race)
def create_race(
    race_data: schemas.RaceCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new race. Auto-creates areal/organizer from name if needed."""
    
    # Convert race_data to dict
    race_dict = race_data.dict()
    
    # Handle AREAL: priority is areal_name, fallback to areal_id (if it's a string)
    final_areal_id = None
    areal_name = race_dict.get('areal_name')
    
    # If areal_name is empty/None, try areal_id as string
    if not areal_name and race_dict.get('areal_id') and isinstance(race_dict['areal_id'], str):
        areal_name = race_dict['areal_id']
    
    if areal_name and areal_name.strip():
        areal_name = areal_name.strip()
        # Find existing or create new areal
        areal = db.query(models.Areal).filter(models.Areal.name == areal_name).first()
        if not areal:
            areal = models.Areal(name=areal_name)
            db.add(areal)
            db.commit()
            db.refresh(areal)
        final_areal_id = areal.id
    
    # Handle ORGANIZER: priority is organizer_name, fallback to organizer_id (if it's a string)
    final_organizer_id = None
    organizer_name = race_dict.get('organizer_name')
    
    # If organizer_name is empty/None, try organizer_id as string
    if not organizer_name and race_dict.get('organizer_id') and isinstance(race_dict['organizer_id'], str):
        organizer_name = race_dict['organizer_id']
    
    if organizer_name and organizer_name.strip():
        organizer_name = organizer_name.strip()
        # Find existing or create new club
        organizer = db.query(models.Club).filter(models.Club.name == organizer_name).first()
        if not organizer:
            organizer = models.Club(name=organizer_name, valid=True)
            db.add(organizer)
            db.commit()
            db.refresh(organizer)
        final_organizer_id = organizer.id
    
    # Update race_dict with resolved IDs
    race_dict['areal_id'] = final_areal_id
    race_dict['organizer_id'] = final_organizer_id
    
    # Remove the _name fields before creating Race model
    race_dict.pop('areal_name', None)
    race_dict.pop('organizer_name', None)
    
    # Convert datum from string to date object if provided
    if race_dict.get('datum'):
        from ...utils import parse_date_string
        try:
            race_dict['datum'] = parse_date_string(race_dict['datum'])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    race = models.Race(**race_dict)
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
    
    # Handle AREAL auto-create (same logic as create_race)
    if 'areal_name' in update_data or 'areal_id' in update_data:
        final_areal_id = None
        areal_name = update_data.get('areal_name')
        
        # If areal_name is empty/None, try areal_id as string
        if not areal_name and update_data.get('areal_id') and isinstance(update_data['areal_id'], str):
            areal_name = update_data['areal_id']
        
        if areal_name and areal_name.strip():
            areal_name = areal_name.strip()
            # Find existing or create new areal
            areal = db.query(models.Areal).filter(models.Areal.name == areal_name).first()
            if not areal:
                areal = models.Areal(name=areal_name)
                db.add(areal)
                db.commit()
                db.refresh(areal)
            final_areal_id = areal.id
            update_data['areal_id'] = final_areal_id
        
        # Remove the _name field before updating
        update_data.pop('areal_name', None)
    
    # Handle ORGANIZER auto-create (same logic as create_race)
    if 'organizer_name' in update_data or 'organizer_id' in update_data:
        final_organizer_id = None
        organizer_name = update_data.get('organizer_name')
        
        # If organizer_name is empty/None, try organizer_id as string
        if not organizer_name and update_data.get('organizer_id') and isinstance(update_data['organizer_id'], str):
            organizer_name = update_data['organizer_id']
        
        if organizer_name and organizer_name.strip():
            organizer_name = organizer_name.strip()
            # Find existing or create new club
            organizer = db.query(models.Club).filter(models.Club.name == organizer_name).first()
            if not organizer:
                organizer = models.Club(name=organizer_name, valid=True)
                db.add(organizer)
                db.commit()
                db.refresh(organizer)
            final_organizer_id = organizer.id
            update_data['organizer_id'] = final_organizer_id
        
        # Remove the _name field before updating
        update_data.pop('organizer_name', None)
    
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
    """Delete a race and all its registrations (cascade delete)."""
    try:
        race = db.query(models.Race).filter(models.Race.id == race_id).first()
        if not race:
            raise HTTPException(status_code=404, detail="Závod nenalezen")
        
        # Delete all registrations for this race (cascade delete)
        registrations_count = db.query(models.Registration).filter(
            models.Registration.race_id == race_id
        ).count()
        
        if registrations_count > 0:
            db.query(models.Registration).filter(
                models.Registration.race_id == race_id
            ).delete()
        
        # Delete the race itself
        db.delete(race)
        db.commit()
        
        message = f"Závod úspěšně smazán"
        if registrations_count > 0:
            message += f" (včetně {registrations_count} registrací)"
        
        return {"message": message}
    
    except HTTPException:
        raise
    except Exception as e:
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
    
    return [{"id": areal.id, "name": fix_encoding(areal.name)} for areal in areals]


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
    
    return [{"id": club.id, "name": fix_encoding(club.name)} for club in clubs]
    db.refresh(club)
    return club