from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import List
from ...database import get_db
from ... import models, schemas
from ...auth import get_current_admin
from ...utils import StandardExceptions

router = APIRouter(prefix="/season-results", tags=["admin-season-results"])


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


@router.get("", response_model=List[schemas.SeasonResult])
def admin_get_all_season_results(
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin)
):
    """Admin: Get all season results"""
    results = db.execute(
        _season_result_query().order_by(models.SeasonResult.season_year_start.desc())
    ).all()
    return [_row_to_result_dict(row) for row in results]


@router.post("", response_model=schemas.SeasonResult)
def admin_create_season_result(
    season_result: schemas.SeasonResultCreate,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin)
):
    """Admin: Create new season result"""
    document = db.query(models.File).filter(models.File.id == season_result.document_id).first()
    if not document:
        raise StandardExceptions.not_found("Dokument nebyl nalezen")

    existing = db.query(models.SeasonResult).filter(
        and_(
            models.SeasonResult.season_year_start == season_result.season_year_start,
            models.SeasonResult.season_year_end == season_result.season_year_end,
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Celkové výsledky pro sezónu {season_result.season_year_start}/{season_result.season_year_end} již existují",
        )

    new_sr = models.SeasonResult(
        season_year_start=season_result.season_year_start,
        season_year_end=season_result.season_year_end,
        document_id=season_result.document_id,
        final_results=season_result.final_results,
    )
    db.add(new_sr)
    db.commit()
    db.refresh(new_sr)

    result = db.execute(
        _season_result_query().where(models.SeasonResult.id == new_sr.id)
    ).first()
    return _row_to_result_dict(result)


@router.put("/{season_result_id}", response_model=schemas.SeasonResult)
def admin_update_season_result(
    season_result_id: int,
    season_result_update: schemas.SeasonResultUpdate,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin)
):
    """Admin: Update season result (change document)"""
    db_sr = db.query(models.SeasonResult).filter(models.SeasonResult.id == season_result_id).first()
    if not db_sr:
        raise StandardExceptions.not_found("Celkové výsledky sezóny nebyly nalezeny")

    if season_result_update.document_id:
        document = db.query(models.File).filter(models.File.id == season_result_update.document_id).first()
        if not document:
            raise StandardExceptions.not_found("Dokument nebyl nalezen")
        db_sr.document_id = season_result_update.document_id

    if season_result_update.final_results is not None:
        db_sr.final_results = season_result_update.final_results

    db.commit()
    db.refresh(db_sr)

    result = db.execute(
        _season_result_query().where(models.SeasonResult.id == db_sr.id)
    ).first()
    return _row_to_result_dict(result)


@router.delete("/{season_result_id}")
def admin_delete_season_result(
    season_result_id: int,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin)
):
    """Admin: Delete season result"""
    db_sr = db.query(models.SeasonResult).filter(models.SeasonResult.id == season_result_id).first()
    if not db_sr:
        raise StandardExceptions.not_found("Celkové výsledky sezóny nebyly nalezeny")

    db.delete(db_sr)
    db.commit()

    return {"message": f"Celkové výsledky sezóny {db_sr.season_year_start}/{db_sr.season_year_end} byly úspěšně smazány"}
