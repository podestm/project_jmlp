from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import List
from ..database import get_db
from .. import models, schemas
from ..utils import get_current_season

router = APIRouter(prefix="/season-results", tags=["season-results"])


def _row_to_result_dict(row) -> dict:
    sr = row[0]
    return {
        "id": sr.id,
        "season_year_start": sr.season_year_start,
        "season_year_end": sr.season_year_end,
        "document_id": sr.document_id,
        "final_results": sr.final_results,
        "created_at": sr.created_at,
        "updated_at": sr.updated_at,
        "document_filename": row[1],
        "document_original_filename": row[2],
        "document_file_path": row[3],
    }


def _season_result_query():
    return select(
        models.SeasonResult,
        models.File.filename,
        models.File.original_filename,
        models.File.file_path,
    ).join(models.File, models.SeasonResult.document_id == models.File.id)


@router.get("/", response_model=List[schemas.SeasonResult])
def get_all_season_results(db: Session = Depends(get_db)):
    """Get all season results with document details"""
    results = db.execute(
        _season_result_query().order_by(models.SeasonResult.season_year_start.desc())
    ).all()
    return [_row_to_result_dict(row) for row in results]


@router.get("/current", response_model=schemas.SeasonResult)
def get_current_season_result(db: Session = Depends(get_db)):
    """Get season result for current season"""
    current_season = get_current_season()
    year_start = current_season['year_start']
    year_end = current_season['year_end']

    result = db.execute(
        _season_result_query().where(
            and_(
                models.SeasonResult.season_year_start == year_start,
                models.SeasonResult.season_year_end == year_end,
            )
        )
    ).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Celkové výsledky pro sezónu {year_start}/{year_end} nebyly nalezeny",
        )

    return _row_to_result_dict(result)


@router.get("/{season_year_start}/{season_year_end}", response_model=schemas.SeasonResult)
def get_season_result_by_years(season_year_start: int, season_year_end: int, db: Session = Depends(get_db)):
    """Get season result for specific season years"""
    result = db.execute(
        _season_result_query().where(
            and_(
                models.SeasonResult.season_year_start == season_year_start,
                models.SeasonResult.season_year_end == season_year_end,
            )
        )
    ).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Celkové výsledky pro sezónu {season_year_start}/{season_year_end} nebyly nalezeny",
        )

    return _row_to_result_dict(result)
