from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ...database import get_db
from ... import models, schemas, auth
from ...models import FileTypeEnum
from ...utils import fix_encoding

router = APIRouter(prefix="/races", tags=["admin-races"])


def _build_race_dict(race: models.Race, db: Session) -> dict:
    """Build a dictionary representation of a race enriched with related data.

    Args:
        race: The Race ORM instance to serialize.
        db: The active SQLAlchemy database session used to fetch related entities.

    Returns:
        dict: A shallow copy of the race's attributes (`race.__dict__`) extended with:
            - ``areal_name``: The name of the associated Areal, or ``None`` if not set.
            - ``organizer_name``: The name of the organizing Club, or ``None`` if not set.
            - ``registrations_count``: The number of registrations linked to this race.
    """
    race_dict = race.__dict__.copy()
    if race.areal_id:
        areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
        race_dict["areal_name"] = fix_encoding(areal.name) if areal else None
    else:
        race_dict["areal_name"] = None
    if race.organizer_id:
        organizer = db.query(models.Club).filter(models.Club.id == race.organizer_id).first()
        race_dict["organizer_name"] = fix_encoding(organizer.name) if organizer else None
    else:
        race_dict["organizer_name"] = None
    race_dict["registrations_count"] = db.query(models.Registration).filter(
        models.Registration.race_id == race.id
    ).count()
    return race_dict


@router.get("", response_model=List[schemas.Race])
def get_races(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all races for admin management."""
    races = db.query(models.Race).order_by(desc(models.Race.datum)).offset(skip).limit(limit).all()
    return [_build_race_dict(race, db) for race in races]


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
    return _build_race_dict(race, db)


@router.post("", response_model=schemas.Race)
def create_race(
    race_data: schemas.RaceCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new race. Auto-creates areal/organizer from name if needed."""

    race_dict = race_data.dict()

    # Handle AREAL: priority is areal_name, fallback to areal_id (if it's a string)
    final_areal_id = None
    areal_name = race_dict.get('areal_name')

    if not areal_name and race_dict.get('areal_id') and isinstance(race_dict['areal_id'], str):
        areal_name = race_dict['areal_id']

    if areal_name and areal_name.strip():
        areal_name = areal_name.strip()
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

    if not organizer_name and race_dict.get('organizer_id') and isinstance(race_dict['organizer_id'], str):
        organizer_name = race_dict['organizer_id']

    if organizer_name and organizer_name.strip():
        organizer_name = organizer_name.strip()
        organizer = db.query(models.Club).filter(models.Club.name == organizer_name).first()
        if not organizer:
            organizer = models.Club(name=organizer_name, valid=True)
            db.add(organizer)
            db.commit()
            db.refresh(organizer)
        final_organizer_id = organizer.id

    race_dict['areal_id'] = final_areal_id
    race_dict['organizer_id'] = final_organizer_id
    race_dict.pop('areal_name', None)
    race_dict.pop('organizer_name', None)

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

    # Re-query to get a fresh object with all attributes loaded
    # (MyISAM + multiple commits can expire the SQLAlchemy instance state)
    race = db.query(models.Race).filter(models.Race.id == race.id).first()
    return _build_race_dict(race, db)


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

    update_data = race_data.dict(exclude_unset=True)

    # Handle AREAL auto-create
    if 'areal_name' in update_data or 'areal_id' in update_data:
        areal_name = update_data.get('areal_name')
        if not areal_name and update_data.get('areal_id') and isinstance(update_data['areal_id'], str):
            areal_name = update_data['areal_id']
        if areal_name and areal_name.strip():
            areal_name = areal_name.strip()
            areal = db.query(models.Areal).filter(models.Areal.name == areal_name).first()
            if not areal:
                areal = models.Areal(name=areal_name)
                db.add(areal)
                db.commit()
                db.refresh(areal)
            update_data['areal_id'] = areal.id
        update_data.pop('areal_name', None)

    # Handle ORGANIZER auto-create
    if 'organizer_name' in update_data or 'organizer_id' in update_data:
        organizer_name = update_data.get('organizer_name')
        if not organizer_name and update_data.get('organizer_id') and isinstance(update_data['organizer_id'], str):
            organizer_name = update_data['organizer_id']
        if organizer_name and organizer_name.strip():
            organizer_name = organizer_name.strip()
            organizer = db.query(models.Club).filter(models.Club.name == organizer_name).first()
            if not organizer:
                organizer = models.Club(name=organizer_name, valid=True)
                db.add(organizer)
                db.commit()
                db.refresh(organizer)
            update_data['organizer_id'] = organizer.id
        update_data.pop('organizer_name', None)

    # Handle file assignments and disconnections
    if 'proposition_file_id' in update_data:
        if update_data['proposition_file_id']:
            file_record = db.query(models.File).filter(models.File.id == update_data['proposition_file_id']).first()
            if file_record and file_record.file_type == FileTypeEnum.neprirazene:
                file_record.file_type = FileTypeEnum.propozice
        else:
            update_data['proposition_file_id'] = None

    if 'results_file_id' in update_data:
        if update_data['results_file_id']:
            file_record = db.query(models.File).filter(models.File.id == update_data['results_file_id']).first()
            if file_record and file_record.file_type == FileTypeEnum.neprirazene:
                file_record.file_type = FileTypeEnum.vysledky
        else:
            update_data['results_file_id'] = None

    for field, value in update_data.items():
        setattr(race, field, value)

    db.commit()

    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    return _build_race_dict(race, db)


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

        registrations_count = db.query(models.Registration).filter(
            models.Registration.race_id == race_id
        ).count()

        if registrations_count > 0:
            db.query(models.Registration).filter(
                models.Registration.race_id == race_id
            ).delete()

        db.delete(race)
        db.commit()

        message = "Závod úspěšně smazán"
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
