from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/clubs", tags=["clubs"])


@router.get("/", response_model=list[schemas.Club])
def list_clubs(db: Session = Depends(get_db)):
    return (
        db.query(models.Club)
        .filter(models.Club.valid == True)
        .order_by(models.Club.name.asc())
        .all()
    )


# Kluby vznikají pouze schválením žádosti v adminu
# (viz backend/app/routers/admin/clubs.py - POST /requests/{registration_id}/resolve).
