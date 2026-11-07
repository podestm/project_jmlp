"""Správa sezón (ročníků poháru).

Nahrazuje dřívější "Celkové výsledky", které uměly jen připnout jedno PDF
k sezóně. Sezóna je teď plnohodnotná entita s ročníkem (XIX.) a názvem, které
se propisují do hlavičky výsledkové listiny, a s libovolným počtem dokumentů
přes fuj_jmlp_attachment - tedy i průběžné a celkové výsledky zároveň.
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, schemas, auth
from ...models import AttachmentOwner
from ...services import attachments as attachment_service
from ...services import seasons as season_service
from ...utils import to_roman

router = APIRouter(prefix="/seasons", tags=["admin-seasons"])


def _season_dict(season: models.Season, db: Session) -> Dict[str, Any]:
    races_count = db.query(models.Race).filter(models.Race.season_id == season.year_start).count()
    documents_count = (
        db.query(models.Attachment)
        .filter(
            models.Attachment.owner_type == AttachmentOwner.season.value,
            models.Attachment.owner_id == season.year_start,
        )
        .count()
    )
    return {
        "id": season.id,
        "year_start": season.year_start,
        "year_end": season.year_end,
        "edition": season.edition,
        "edition_label": f"{to_roman(season.edition)}." if season.edition else None,
        "season_label": f"{season.year_start}/{season.year_end}",
        "name": season.name,
        "is_current": bool(season.is_current),
        "races_count": races_count,
        "documents_count": documents_count,
    }


def _get_season(db: Session, season_id: int) -> models.Season:
    season = db.query(models.Season).filter(models.Season.id == season_id).first()
    if not season:
        raise HTTPException(status_code=404, detail="Sezóna nebyla nalezena")
    return season


@router.get("", response_model=List[schemas.Season])
def list_seasons(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    seasons = db.query(models.Season).order_by(models.Season.year_start.desc()).all()
    return [_season_dict(season, db) for season in seasons]


@router.post("", response_model=schemas.Season)
def create_season(
    payload: schemas.SeasonCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(models.Season).filter(models.Season.year_start == payload.year_start).first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Sezóna {payload.year_start}/{payload.year_start + 1} už existuje",
        )

    season = models.Season(
        year_start=payload.year_start,
        year_end=payload.year_end or payload.year_start + 1,
        edition=payload.edition,
        name=payload.name,
    )
    db.add(season)
    db.commit()
    db.refresh(season)
    return _season_dict(season, db)


@router.put("/{season_id}", response_model=schemas.Season)
def update_season(
    season_id: int,
    payload: schemas.SeasonUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    season = _get_season(db, season_id)

    # year_start se needituje - je to klíč, na který se váží závody i přílohy.
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(season, field, value)

    db.commit()
    db.refresh(season)
    return _season_dict(season, db)


@router.post("/{season_id}/current", response_model=schemas.Season)
def set_current_season(
    season_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Nastaví sezónu jako aktuální; ostatním příznak zruší."""
    season = _get_season(db, season_id)
    season_service.set_current_season(db, season.id)
    db.refresh(season)
    return _season_dict(season, db)


@router.delete("/{season_id}")
def delete_season(
    season_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    season = _get_season(db, season_id)

    if season.is_current:
        raise HTTPException(
            status_code=409,
            detail="Aktuální sezónu nelze smazat. Nejdřív nastavte jako aktuální jinou.",
        )

    races_count = db.query(models.Race).filter(models.Race.season_id == season.year_start).count()
    if races_count:
        raise HTTPException(
            status_code=409,
            detail=f"Sezóna má {races_count} závodů a nelze ji smazat.",
        )

    attachment_service.detach_owner(db, AttachmentOwner.season.value, season.year_start)
    db.delete(season)
    db.commit()
    return {"message": "Sezóna smazána"}
