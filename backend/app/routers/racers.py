from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List
import logging
from ..database import get_db
from .. import models, schemas
from ..utils import fix_encoding

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/racers", tags=["racers"])

@router.get("/search")
def search_racers(
    name: str = Query(None),
    surname: str = Query(None), 
    year: int = Query(None),
    club: str = Query(None),
    slcr_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """Vyhledávání závodníků s podporou filtrování podle jména, příjmení, roku, klubu a SLCR ID"""
    
    from sqlalchemy import text
    
    # Nejdříve načteme všechny závodníky (bez emailu a telefonu pro vyhledávání)
    sql = "SELECT id, name, surname, year, sex, slcr_id, club_id FROM fuj_jmlp_racer WHERE 1=1"
    params = {}
    
    # Přidáme filtry pro závodníka
    if name and name.strip():
        sql += " AND name LIKE :name_filter"
        params['name_filter'] = f"%{name.strip()}%"
        
    if surname and surname.strip():
        sql += " AND surname LIKE :surname_filter" 
        params['surname_filter'] = f"%{surname.strip()}%"
        
    if year:
        sql += " AND year = :year"
        params['year'] = year
    
    # Přidáme filtr pro SLCR ID
    if slcr_id and slcr_id.strip():
        sql += " AND slcr_id LIKE :slcr_id_filter"
        params['slcr_id_filter'] = f"%{slcr_id.strip()}%"
    
    sql += " ORDER BY surname ASC, name ASC LIMIT 50"
    
    result = db.execute(text(sql), params)
    racers_data = result.fetchall()
    
    # Pro každého závodníka načteme klub explicitně
    results = []
    for row in racers_data:
        club_name = None
        if row.club_id:
            club_result = db.execute(text("SELECT name FROM fuj_jmlp_club WHERE id = :club_id"), 
                                   {"club_id": row.club_id})
            club_row = club_result.fetchone()
            if club_row:
                club_name = club_row.name
        
        # Pokud hledáme podle klubu a závodník klub nemá nebo neodpovídá, přeskočíme
        if club and club.strip():
            if not club_name or club.strip().lower() not in club_name.lower():
                continue
        
        results.append({
            "id": row.id,
            "name": fix_encoding(row.name) if row.name else None,
            "surname": fix_encoding(row.surname) if row.surname else None,
            "year": row.year,
            "sex": row.sex,
            "slcr_id": row.slcr_id,
            "club_id": row.club_id,
            "club_name": fix_encoding(club_name) if club_name else None
            # telefon a email se záměrně nevrací při vyhledávání
        })
    
    return results

@router.get("/", response_model=List[schemas.Racer])
def list_racers(q: str | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(models.Racer)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            (models.Racer.name.like(like)) | (models.Racer.surname.like(like))
        )
    return query.order_by(models.Racer.surname.asc(), models.Racer.name.asc()).limit(50).all()

@router.post("/", response_model=schemas.Racer)
def create_racer(r: schemas.RacerBase, db: Session = Depends(get_db)):
    racer = models.Racer(**r.dict())
    db.add(racer)
    db.commit()
    db.refresh(racer)
    return racer
