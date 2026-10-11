"""Veřejné výsledky sezóny.

Cesta zůstává /season-results, aby se nemusel měnit nginx ani proxy ve Vite,
ale data se čtou z fuj_jmlp_season + fuj_jmlp_attachment.

Sezóna má vždy nejvýše jeden výsledkový dokument: během sezóny průběžné pořadí,
po jejím skončení celkové výsledky, které ho nahradí. Hlídá to
ATTACHMENT_EXCLUSIVE_GROUPS v models.py.

Vedle něj může mít sezóna obecné dokumenty (soutěžní řád, pokyny). Ty sem
nepatří - dřív se bral první zveřejněný dokument jakékoli role a kalendář pak
nabízel soutěžní řád pod tlačítkem "Průběžné výsledky".
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..models import AttachmentOwner, AttachmentRole
from ..services import attachments as attachment_service
from ..services import standings as standings_service
from ..utils import get_current_season, to_roman

router = APIRouter(prefix="/season-results", tags=["season-results"])

RESULT_ROLES = (AttachmentRole.vysledky.value, AttachmentRole.prubezne.value)


def _season_payload(season: models.Season, db: Session) -> Optional[Dict[str, Any]]:
    documents = attachment_service.list_for_owner(
        db, AttachmentOwner.season.value, season.year_start,
        roles=RESULT_ROLES, published_only=True,
    )
    if not documents:
        return None

    primary = documents[0]

    return {
        "season_year_start": season.year_start,
        "season_year_end": season.year_end,
        "edition": season.edition,
        "edition_label": f"{to_roman(season.edition)}." if season.edition else None,
        "name": season.name,
        # final_results drží tvar, na který je navázaný kalendář:
        # 1 = celkové výsledky, 0 = průběžné
        "final_results": 1 if primary["role"] == AttachmentRole.vysledky.value else 0,
        "document_id": primary["file_id"],
        "document_filename": primary["filename"],
        "document_original_filename": primary["original_filename"],
        "document_file_path": f"uploads/documents/{primary['filename']}",
    }


@router.get("/")
def get_all_season_results(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Sezóny, které mají zveřejněné výsledky (průběžné nebo celkové)."""
    seasons = db.query(models.Season).order_by(models.Season.year_start.desc()).all()
    payloads = (_season_payload(season, db) for season in seasons)
    return [payload for payload in payloads if payload]


@router.get("/current")
def get_current_season_result(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Výsledky aktuální sezóny."""
    year_start = get_current_season()["year_start"]
    season = db.query(models.Season).filter(models.Season.year_start == year_start).first()
    payload = _season_payload(season, db) if season else None
    if not payload:
        raise HTTPException(
            status_code=404,
            detail=f"Celkové výsledky pro sezónu {year_start}/{year_start + 1} nebyly nalezeny",
        )
    return payload


def _public_cell(cell: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Buňka pořadí pro web: místo textu „2/80“ (formát listiny LIP) zvlášť
    místo a body, u DSQ/DNF jen stav."""
    if cell is None:
        return None
    rank, _, points = cell["text"].partition("/")
    if points:
        return {"rank": int(rank), "points": int(points), "status": None, "counted": cell["counted"]}
    return {"rank": None, "points": 0, "status": cell["text"] or None, "counted": cell["counted"]}


@router.get("/{season_id}/standings")
def get_public_standings(season_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Pořadí poháru pro veřejnou stránku Výsledky (jen čtení).

    Počítá stejná služba jako náhled časomíry (services/standings.py), takže
    web, PDF i časomíra mají stejné body i pořadí. Celkové výsledky (final)
    jen tehdy, když jsou u sezóny zveřejněné celkové výsledky; jinak průběžné.
    Sezóna bez odjetého závodu s výsledky vrátí prázdný seznam kategorií.
    """
    season = db.query(models.Season).filter(models.Season.year_start == season_id).first()
    if not season:
        raise HTTPException(status_code=404, detail="Sezóna nenalezena")

    document = _season_payload(season, db)
    final = bool(document and document["final_results"] == 1)
    data = standings_service.season_standings(db, season_id, final=final)

    return {
        "season_id": season_id,
        "season_label": f"{season_id}/{(season_id + 1) % 100:02d}",
        "edition_label": f"{to_roman(season.edition)}." if season.edition else None,
        "final": final,
        "document": {
            "url": f"/{document['document_file_path']}",
            "final": final,
        } if document else None,
        "races": [
            {key: race[key] for key in ("id", "kind", "datum", "race_nr", "areal_name")}
            for race in data["races"]
        ],
        "races_without_results": len(data["races_without_results"]),
        "categories": [
            {
                "category_id": category["category_id"],
                "name": category["name"],
                "rows": [
                    {
                        "rank": row["rank"],
                        "surname": row["surname"],
                        "name": row["name"],
                        "year": row["year"],
                        "club": row["club"],
                        "cells": [_public_cell(cell) for cell in row["cells"]],
                        "prep_points": row["prep_points"],
                        "snow_points": row["snow_points"],
                        "total": row["total"],
                    }
                    for row in category["rows"]
                ],
            }
            for category in data["categories"]
        ],
    }


@router.get("/{season_year_start}/{season_year_end}")
def get_season_result_by_years(
    season_year_start: int, season_year_end: int, db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Výsledky konkrétní sezóny."""
    season = db.query(models.Season).filter(models.Season.year_start == season_year_start).first()
    payload = _season_payload(season, db) if season else None
    if not payload:
        raise HTTPException(
            status_code=404,
            detail=f"Celkové výsledky pro sezónu {season_year_start}/{season_year_end} nebyly nalezeny",
        )
    return payload
