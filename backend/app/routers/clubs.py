from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/clubs", tags=["clubs"])

@router.get("/", response_model=List[schemas.Club])
def list_clubs(db: Session = Depends(get_db)):
    return db.query(models.Club).filter(models.Club.valid == True).order_by(models.Club.name.asc()).all()

@router.post("/", response_model=schemas.Club)
def create_club(name: str, db: Session = Depends(get_db)):
    # check if club already exists
    existing = db.query(models.Club).filter(models.Club.name == name).first()
    if existing:
        return existing
    
    club = models.Club(name=name, valid=True)
    db.add(club)
    db.commit()
    db.refresh(club)
    return club
