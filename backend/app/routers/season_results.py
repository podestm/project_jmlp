from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import List
from ..database import get_db
from .. import models, schemas
from ..utils import get_current_season

router = APIRouter(prefix="/season-results", tags=["season-results"])


@router.get("/", response_model=List[schemas.SeasonResult])
def get_all_season_results(db: Session = Depends(get_db)):
    """Get all season results with document details"""
    
    # Join with fuj_jmlp_files table to get document details
    query = select(
        models.SeasonResult,
        models.File.filename,
        models.File.original_filename,
        models.File.file_path
    ).join(
        models.File,
        models.SeasonResult.document_id == models.File.id
    ).order_by(
        models.SeasonResult.season_year_start.desc()
    )
    
    results = db.execute(query).all()
    
    # Transform results to include document details
    season_results = []
    for row in results:
        season_result = row[0]
        result_dict = {
            "id": season_result.id,
            "season_year_start": season_result.season_year_start,
            "season_year_end": season_result.season_year_end,
            "document_id": season_result.document_id,
            "created_at": season_result.created_at,
            "updated_at": season_result.updated_at,
            "document_filename": row[1],
            "document_original_filename": row[2],
            "document_file_path": row[3]
        }
        season_results.append(result_dict)
    
    return season_results


@router.get("/current", response_model=schemas.SeasonResult)
def get_current_season_result(db: Session = Depends(get_db)):
    """Get season result for current season"""
    
    # Get current season years
    current_season = get_current_season()
    year_start = current_season['year_start']
    year_end = current_season['year_end']
    
    # Join with fuj_jmlp_files table to get document details
    query = select(
        models.SeasonResult,
        models.File.filename,
        models.File.original_filename,
        models.File.file_path
    ).join(
        models.File,
        models.SeasonResult.document_id == models.File.id
    ).where(
        and_(
            models.SeasonResult.season_year_start == year_start,
            models.SeasonResult.season_year_end == year_end
        )
    )
    
    result = db.execute(query).first()
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Celkové výsledky pro sezónu {year_start}/{year_end} nebyly nalezeny"
        )
    
    season_result = result[0]
    result_dict = {
        "id": season_result.id,
        "season_year_start": season_result.season_year_start,
        "season_year_end": season_result.season_year_end,
        "document_id": season_result.document_id,
        "created_at": season_result.created_at,
        "updated_at": season_result.updated_at,
        "document_filename": result[1],
        "document_original_filename": result[2],
        "document_file_path": result[3]
    }
    
    return result_dict


@router.get("/{season_year_start}/{season_year_end}", response_model=schemas.SeasonResult)
def get_season_result_by_years(season_year_start: int, season_year_end: int, db: Session = Depends(get_db)):
    """Get season result for specific season years"""
    
    # Join with fuj_jmlp_files table to get document details
    query = select(
        models.SeasonResult,
        models.File.filename,
        models.File.original_filename,
        models.File.file_path
    ).join(
        models.File,
        models.SeasonResult.document_id == models.File.id
    ).where(
        and_(
            models.SeasonResult.season_year_start == season_year_start,
            models.SeasonResult.season_year_end == season_year_end
        )
    )
    
    result = db.execute(query).first()
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Celkové výsledky pro sezónu {season_year_start}/{season_year_end} nebyly nalezeny"
        )
    
    season_result = result[0]
    result_dict = {
        "id": season_result.id,
        "season_year_start": season_result.season_year_start,
        "season_year_end": season_result.season_year_end,
        "document_id": season_result.document_id,
        "created_at": season_result.created_at,
        "updated_at": season_result.updated_at,
        "document_filename": result[1],
        "document_original_filename": result[2],
        "document_file_path": result[3]
    }
    
    return result_dict
