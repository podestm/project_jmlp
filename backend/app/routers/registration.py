from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..utils import get_category_for_birth_year
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
        
        # Trim name and surname if they have trailing spaces
        if racer.name:
            racer.name = racer.name.strip()
        if racer.surname:
            racer.surname = racer.surname.strip()
        
        # Přiřadíme kategorii podle roku narození (vždy aktuální)
        racer.category_id = get_category_for_birth_year(racer.year, racer.sex, db)
    else:
        # creating new racer
        if not all([payload.racer_name, payload.racer_surname, payload.racer_sex is not None, payload.racer_year]):
            raise HTTPException(status_code=400, detail="Missing required racer fields: name, surname, sex, year")
        
        # Trim input values
        racer_name = payload.racer_name.strip() if payload.racer_name else None
        racer_surname = payload.racer_surname.strip() if payload.racer_surname else None
        racer_telefon = payload.racer_telefon.strip() if payload.racer_telefon else None
        racer_email = payload.racer_email.strip() if payload.racer_email else None
        racer_slcr_id = payload.racer_slcr_id.strip() if payload.racer_slcr_id else None
        
        # check if racer already exists (unique constraint: name, surname, year, sex)
        existing_racer = db.query(models.Racer).filter(
            models.Racer.name == racer_name,
            models.Racer.surname == racer_surname,
            models.Racer.year == payload.racer_year,
            models.Racer.sex == payload.racer_sex
        ).first()
        
        if existing_racer:
            racer = existing_racer
            # Aktualizujeme kategorii i pro existujícího závodníka
            racer.category_id = get_category_for_birth_year(racer.year, racer.sex, db)
        else:
            # Přiřadíme kategorii podle roku narození
            category_id = get_category_for_birth_year(payload.racer_year, payload.racer_sex, db)
            
            racer = models.Racer(
                name=racer_name,
                surname=racer_surname,
                sex=payload.racer_sex,
                year=payload.racer_year,
                telefon=racer_telefon,
                email=racer_email,
                slcr_id=racer_slcr_id,
                category_id=category_id
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

    # create registration record with category_id snapshot
    reg = models.Registration(
        race_id=payload.race_id, 
        racer_id=racer.id,
        category_id=racer.category_id  # Uložíme aktuální kategorii do registrace
    )
    db.add(reg)
    
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Racer already registered for this race")
    
    db.refresh(reg)
    return reg
