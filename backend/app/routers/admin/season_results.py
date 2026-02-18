from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import List
from ...database import get_db
from ... import models, schemas
from ...auth import get_current_admin
from ...utils import StandardExceptions

router = APIRouter(prefix="/season-results", tags=["admin-season-results"])


@router.get("", response_model=List[schemas.SeasonResult])
def admin_get_all_season_results(
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin)
):
    """Admin: Get all season results"""
    
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
            "final_results": season_result.final_results,
            "created_at": season_result.created_at,
            "updated_at": season_result.updated_at,
            "document_filename": row[1],
            "document_original_filename": row[2],
            "document_file_path": row[3]
        }
        season_results.append(result_dict)
    
    return season_results


@router.post("", response_model=schemas.SeasonResult)
def admin_create_season_result(
    season_result: schemas.SeasonResultCreate,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin)
):
    """Admin: Create new season result"""
    
    # Check if document exists
    document = db.query(models.File).filter(models.File.id == season_result.document_id).first()
    if not document:
        raise StandardExceptions.not_found("Dokument nebyl nalezen")
    
    # Check if season result already exists
    existing = db.query(models.SeasonResult).filter(
        and_(
            models.SeasonResult.season_year_start == season_result.season_year_start,
            models.SeasonResult.season_year_end == season_result.season_year_end
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Celkové výsledky pro sezónu {season_result.season_year_start}/{season_result.season_year_end} již existují"
        )
    
    # Create new season result
    new_season_result = models.SeasonResult(
        season_year_start=season_result.season_year_start,
        season_year_end=season_result.season_year_end,
        document_id=season_result.document_id,
        final_results=season_result.final_results
    )
    
    db.add(new_season_result)
    db.commit()
    db.refresh(new_season_result)
    
    # Get document details for response
    query = select(
        models.SeasonResult,
        models.File.filename,
        models.File.original_filename,
        models.File.file_path
    ).join(
        models.File,
        models.SeasonResult.document_id == models.File.id
    ).where(models.SeasonResult.id == new_season_result.id)
    
    result = db.execute(query).first()
    season_result_obj = result[0]
    
    result_dict = {
        "id": season_result_obj.id,
        "season_year_start": season_result_obj.season_year_start,
        "season_year_end": season_result_obj.season_year_end,
        "document_id": season_result_obj.document_id,
        "final_results": season_result_obj.final_results,
        "created_at": season_result_obj.created_at,
        "updated_at": season_result_obj.updated_at,
        "document_filename": result[1],
        "document_original_filename": result[2],
        "document_file_path": result[3]
    }
    
    return result_dict


@router.put("/{season_result_id}", response_model=schemas.SeasonResult)
def admin_update_season_result(
    season_result_id: int,
    season_result_update: schemas.SeasonResultUpdate,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin)
):
    """Admin: Update season result (change document)"""
    
    # Check if season result exists
    db_season_result = db.query(models.SeasonResult).filter(models.SeasonResult.id == season_result_id).first()
    if not db_season_result:
        raise StandardExceptions.not_found("Celkové výsledky sezóny nebyly nalezeny")
    
    # Check if new document exists
    if season_result_update.document_id:
        document = db.query(models.File).filter(models.File.id == season_result_update.document_id).first()
        if not document:
            raise StandardExceptions.not_found("Dokument nebyl nalezen")
        
        db_season_result.document_id = season_result_update.document_id
    
    if season_result_update.final_results is not None:
        db_season_result.final_results = season_result_update.final_results
    
    db.commit()
    db.refresh(db_season_result)
    
    # Get document details for response
    query = select(
        models.SeasonResult,
        models.File.filename,
        models.File.original_filename,
        models.File.file_path
    ).join(
        models.File,
        models.SeasonResult.document_id == models.File.id
    ).where(models.SeasonResult.id == db_season_result.id)
    
    result = db.execute(query).first()
    season_result_obj = result[0]
    
    result_dict = {
        "id": season_result_obj.id,
        "season_year_start": season_result_obj.season_year_start,
        "season_year_end": season_result_obj.season_year_end,
        "document_id": season_result_obj.document_id,
        "final_results": season_result_obj.final_results,
        "created_at": season_result_obj.created_at,
        "updated_at": season_result_obj.updated_at,
        "document_filename": result[1],
        "document_original_filename": result[2],
        "document_file_path": result[3]
    }
    
    return result_dict


@router.delete("/{season_result_id}")
def admin_delete_season_result(
    season_result_id: int,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin)
):
    """Admin: Delete season result"""
    
    # Check if season result exists
    db_season_result = db.query(models.SeasonResult).filter(models.SeasonResult.id == season_result_id).first()
    if not db_season_result:
        raise StandardExceptions.not_found("Celkové výsledky sezóny nebyly nalezeny")
    
    db.delete(db_season_result)
    db.commit()
    
    return {"message": f"Celkové výsledky sezóny {db_season_result.season_year_start}/{db_season_result.season_year_end} byly úspěšně smazány"}
