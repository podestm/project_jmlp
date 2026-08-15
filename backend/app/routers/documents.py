"""Veřejný seznam dokumentů.

Nahrazuje natvrdo napsaný seznam ve frontend/src/components/pages/Documents.jsx,
kde všech 17 položek odkazovalo na '#' a nešlo stáhnout nic.

Vrací obecné dokumenty sezóny (soutěžní řád, pokyny pro organizátory) seskupené
po sezónách - aktuální sezóna zvlášť, starší jako archiv.
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..models import AttachmentOwner, AttachmentRole
from ..services import attachments as attachment_service
from ..utils import get_current_season_id, to_roman

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
def list_documents(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Zveřejněné dokumenty seskupené po sezónách, od nejnovější."""
    seasons = db.query(models.Season).order_by(models.Season.year_start.desc()).all()
    current_season_id = get_current_season_id()

    groups: List[Dict[str, Any]] = []
    for season in seasons:
        documents = attachment_service.list_for_owner(
            db,
            AttachmentOwner.season.value,
            season.year_start,
            roles=[AttachmentRole.document.value],
            published_only=True,
        )
        if not documents:
            continue

        groups.append({
            "season_year_start": season.year_start,
            "season_year_end": season.year_end,
            "season_label": f"{season.year_start}/{season.year_end}",
            "edition_label": f"{to_roman(season.edition)}." if season.edition else None,
            "name": season.name,
            "is_current": season.year_start == current_season_id,
            "documents": [{
                "id": doc["id"],
                "title": doc["original_filename"],
                "original_filename": doc["original_filename"],
                "file_size": doc["file_size"],
                "url": doc["download_url"],
            } for doc in documents],
        })

    return {
        "current": next((g for g in groups if g["is_current"]), None),
        "archive": [g for g in groups if not g["is_current"]],
    }
