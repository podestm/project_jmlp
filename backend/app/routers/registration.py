from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
import logging

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/registrations", tags=["registrations"])

@router.post("/", response_model=schemas.Registration)
def create_registration(payload: schemas.RegistrationCreate, db: Session = Depends(get_db)):
    # ensure race exists and is open
    race = db.query(models.Race).filter(models.Race.id == payload.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    if not race.registration:
        raise HTTPException(status_code=400, detail="Registration is closed for this race")

    # find or create racer
    if payload.racer_id:
        # using existing racer - aktualizujeme telefon a slcr_id pokud se změnily
        racer = db.query(models.Racer).filter(models.Racer.id == payload.racer_id).first()
        if not racer:
            raise HTTPException(status_code=404, detail="Racer not found")
        
        # Aktualizujeme telefon, email a SLCR ID pouze pokud jsou neprázdné
        if payload.racer_telefon and payload.racer_telefon.strip():
            racer.telefon = payload.racer_telefon.strip()
        if payload.racer_email and payload.racer_email.strip():
            racer.email = payload.racer_email.strip()
        if payload.racer_slcr_id and payload.racer_slcr_id.strip():
            racer.slcr_id = payload.racer_slcr_id.strip()
    else:
        # creating new racer
        if not all([payload.racer_name, payload.racer_surname, payload.racer_sex is not None, payload.racer_year]):
            raise HTTPException(status_code=400, detail="Missing required racer fields: name, surname, sex, year")
        
        # check if racer already exists (unique constraint: name, surname, year, sex)
        existing_racer = db.query(models.Racer).filter(
            models.Racer.name == payload.racer_name,
            models.Racer.surname == payload.racer_surname,
            models.Racer.year == payload.racer_year,
            models.Racer.sex == payload.racer_sex
        ).first()
        
        if existing_racer:
            racer = existing_racer
        else:
            racer = models.Racer(
                name=payload.racer_name,
                surname=payload.racer_surname,
                sex=payload.racer_sex,
                year=payload.racer_year,
                telefon=payload.racer_telefon,
                email=payload.racer_email,
                slcr_id=payload.racer_slcr_id
            )
            db.add(racer)
            db.flush()  # get racer.id

    # find or create club
    club = db.query(models.Club).filter(models.Club.name == payload.club_name).first()
    if not club:
        # create new club
        club = models.Club(name=payload.club_name, valid=True)
        db.add(club)
        db.flush()  # get club.id

    # update racer's club_id
    racer.club_id = club.id

    # create registration record
    reg = models.Registration(race_id=payload.race_id, racer_id=racer.id)
    db.add(reg)
    
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Racer already registered for this race")
    
    db.refresh(reg)
    return reg
