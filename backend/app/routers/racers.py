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
    db: Session = Depends(get_db),
):
    """Vyhledávání závodníků s podporou filtrování podle jména, příjmení, roku, klubu a SLCR ID"""

    from sqlalchemy import text

    # Jeden dotaz s JOINem na klub - filtr podle klubu musí proběhnout v SQL,
    # jinak by se aplikoval až po LIMIT 50 a vracel prázdné výsledky.
    # TRIM() odstraňuje historické odsazení mezerami v name/surname.
    sql = """
        SELECT r.id, TRIM(r.name) as name, TRIM(r.surname) as surname,
               r.year, r.sex, r.slcr_id, r.club_id, c.name as club_name
        FROM fuj_jmlp_racer r
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE 1=1
    """
    params = {}

    # Přidáme filtry pro závodníka
    if name and name.strip():
        sql += " AND r.name LIKE :name_filter"
        params["name_filter"] = f"%{name.strip()}%"

    if surname and surname.strip():
        sql += " AND r.surname LIKE :surname_filter"
        params["surname_filter"] = f"%{surname.strip()}%"

    if year:
        sql += " AND r.year = :year"
        params["year"] = year

    # Přidáme filtr pro SLCR ID
    if slcr_id and slcr_id.strip():
        sql += " AND r.slcr_id LIKE :slcr_id_filter"
        params["slcr_id_filter"] = f"%{slcr_id.strip()}%"

    if club and club.strip():
        sql += " AND c.name LIKE :club_filter"
        params["club_filter"] = f"%{club.strip()}%"

    sql += " ORDER BY r.surname ASC, r.name ASC LIMIT 50"

    result = db.execute(text(sql), params)
    racers_data = result.fetchall()

    results = []
    for row in racers_data:
        results.append(
            {
                "id": row.id,
                "name": fix_encoding(row.name) if row.name else None,
                "surname": fix_encoding(row.surname) if row.surname else None,
                "year": row.year,
                "sex": row.sex,
                "slcr_id": row.slcr_id,
                "club_id": row.club_id,
                "club_name": fix_encoding(row.club_name) if row.club_name else None,
                # telefon a email se záměrně nevrací při vyhledávání
            }
        )

    return results


@router.get("/", response_model=List[schemas.RacerPublic])
def list_racers(q: str | None = Query(default=None), db: Session = Depends(get_db)):
    """Veřejný seznam závodníků - bez kontaktních údajů."""
    query = db.query(models.Racer)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter((models.Racer.name.like(like)) | (models.Racer.surname.like(like)))
    return query.order_by(models.Racer.surname.asc(), models.Racer.name.asc()).limit(50).all()
