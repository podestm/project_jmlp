from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..utils import get_category_for_birth_year, StandardExceptions
import logging

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/registrations", tags=["registrations"])


def _ensure_not_registered(db: Session, race_id: int, racer_id: int) -> None:
    """Pre-check duplicity - MyISAM neumí transakce, takže musíme zabránit
    částečnému zápisu (úprava závodníka) před selháním INSERTu registrace."""
    existing = db.query(models.Registration).filter(
        models.Registration.race_id == race_id,
        models.Registration.racer_id == racer_id
    ).first()
    if existing:
        raise StandardExceptions.already_registered()


def _identity_matches(racer: models.Racer, payload: schemas.RegistrationCreate) -> bool:
    """Ověří, že volající zná identitu závodníka (jméno, příjmení, ročník, pohlaví)."""
    if not all([payload.racer_name, payload.racer_surname,
                payload.racer_year, payload.racer_sex is not None]):
        return False
    return (
        (racer.name or '').strip().lower() == payload.racer_name.strip().lower()
        and (racer.surname or '').strip().lower() == payload.racer_surname.strip().lower()
        and racer.year == payload.racer_year
        and racer.sex == payload.racer_sex
    )


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

        _ensure_not_registered(db, payload.race_id, racer.id)

        # Kontaktní údaje přepíšeme jen tomu, kdo prokáže znalost identity závodníka
        # (jméno, příjmení, ročník, pohlaví). Samotné racer_id není důkaz totožnosti.
        has_contact_update = any([
            payload.racer_telefon and payload.racer_telefon.strip(),
            payload.racer_email and payload.racer_email.strip(),
            payload.racer_slcr_id and payload.racer_slcr_id.strip(),
        ])
        if has_contact_update:
            identity_supplied = any([
                payload.racer_name, payload.racer_surname,
                payload.racer_year, payload.racer_sex is not None,
            ])
            if identity_supplied and not _identity_matches(racer, payload):
                raise StandardExceptions.bad_request("Údaje závodníka nesouhlasí")
            if identity_supplied:
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
            _ensure_not_registered(db, payload.race_id, racer.id)
            # Aktualizujeme kategorii i pro existujícího závodníka
            racer.category_id = get_category_for_birth_year(racer.year, racer.sex, db)
            # Aktualizujeme telefon, email a SLCR ID pokud jsou vyplněné
            if racer_telefon:
                racer.telefon = racer_telefon
            if racer_email:
                racer.email = racer_email
            if racer_slcr_id:
                racer.slcr_id = racer_slcr_id
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

    # přiřazení klubu nebo uložení poznámky pro admina
    club_request_note = None
    if payload.club_id:
        club = db.query(models.Club).filter(models.Club.id == payload.club_id, models.Club.valid == True).first()
        if not club:
            raise HTTPException(status_code=404, detail="Klub nenalezen")
        racer.club_id = club.id
    else:
        # závodník nezná svůj klub - uložíme poznámku, racer.club_id zůstane beze změny
        club_request_note = payload.club_request_note.strip() if payload.club_request_note else None

    # create registration record with category_id snapshot
    reg = models.Registration(
        race_id=payload.race_id,
        racer_id=racer.id,
        category_id=racer.category_id,
        club_request_note=club_request_note
    )
    db.add(reg)
    
    try:
        db.commit()
    except IntegrityError:
        # Záložní pojistka - duplicitu řeší pre-check výše, sem se dostaneme jen při závodu dvou requestů
        db.rollback()
        logger.warning("Duplicitní registrace race_id=%s racer_id=%s", payload.race_id, racer.id)
        raise StandardExceptions.already_registered()
    except Exception:
        db.rollback()
        logger.exception("Uložení registrace selhalo (race_id=%s)", payload.race_id)
        raise StandardExceptions.internal_error("Registraci se nepodařilo uložit")


    db.refresh(reg)
    return reg
