from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from ...database import get_db
from ... import models, schemas, auth

router = APIRouter(tags=["admin-racers"])


@router.get("/racers", response_model=List[schemas.Racer])
def get_racers(
    skip: int = 0, 
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all racers for admin management."""
    # Use raw SQL to get racer with club name
    query = """
        SELECT r.id, r.name as firstName, r.surname as lastName, r.sex, r.year as birthYear, r.club_id, r.slcr_id as idSlcr,
               CONVERT(CONVERT(c.name USING binary) USING utf8mb4) as club_name
        FROM fuj_jmlp_racer r 
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        ORDER BY r.surname, r.name
        LIMIT :limit OFFSET :skip
    """
    
    result = db.execute(text(query), {"limit": limit, "skip": skip}).fetchall()
    
    racers = []
    for row in result:
        racer_data = {
            "id": row.id,
            "firstName": row.firstName,
            "lastName": row.lastName,
            "sex": row.sex,
            "birthYear": row.birthYear,
            "club_id": row.club_id,
            "idSlcr": row.idSlcr,
            "club_name": row.club_name,
            # Also include base fields for compatibility
            "name": row.firstName,
            "surname": row.lastName,
            "year": row.birthYear,
            "slcr_id": row.idSlcr
        }
        racers.append(racer_data)
    
    return racers


@router.post("/racers", response_model=schemas.Racer)
def create_racer(
    racer_data: schemas.RacerCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new racer."""
    # Check if club exists
    if racer_data.club_id:
        club = db.query(models.Club).filter(models.Club.id == racer_data.club_id).first()
        if not club:
            raise HTTPException(status_code=400, detail="Klub neexistuje")
    
    db_racer = models.Racer(**racer_data.dict())
    db.add(db_racer)
    db.commit()
    db.refresh(db_racer)
    return db_racer


@router.put("/racers/{racer_id}", response_model=schemas.Racer)
def update_racer(
    racer_id: int,
    racer_data: schemas.RacerCreate,  # Using RacerCreate as update schema
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Update an existing racer."""
    db_racer = db.query(models.Racer).filter(models.Racer.id == racer_id).first()
    if not db_racer:
        raise HTTPException(status_code=404, detail="Závodník nenalezen")
    
    # Check if club exists when updating club_id
    if racer_data.club_id:
        club = db.query(models.Club).filter(models.Club.id == racer_data.club_id).first()
        if not club:
            raise HTTPException(status_code=400, detail="Klub neexistuje")
    
    update_data = racer_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_racer, field, value)
    
    db.commit()
    db.refresh(db_racer)
    return db_racer


@router.delete("/racers/{racer_id}")
def delete_racer(
    racer_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a racer."""
    db_racer = db.query(models.Racer).filter(models.Racer.id == racer_id).first()
    if not db_racer:
        raise HTTPException(status_code=404, detail="Závodník nenalezen")
    
    # Check if racer has any registrations
    registrations = db.query(models.RaceRegistration).filter(
        models.RaceRegistration.racer_id == racer_id
    ).first()
    if registrations:
        raise HTTPException(
            status_code=400, 
            detail="Nelze smazat závodníka s existujícími registracemi"
        )
    
    db.delete(db_racer)
    db.commit()
    return {"message": "Závodník úspěšně smazán"}