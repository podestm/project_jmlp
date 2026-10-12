"""Evidence SLČR z časomíry: založení závodů v akci a odeslání výsledků.

Postup u závodu:
  1. GET  .../slcr/events  - akce v evidenci kolem data závodu (výběr akce),
  2. GET  .../slcr/plan    - náhled: které kategorie se v akci založí,
  3. POST .../slcr/races   - založí chybějící závody (kodex = id kategorie),
  4. POST .../slcr/results - pošle výsledky jako FIS XML Dataset.

Komunikace s evidencí je v services/slcr_evidence.py.
"""
from datetime import timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ... import auth, models
from ...database import get_db
from ...services import category_order as category_order_service
from ...services import slcr_evidence
from ...utils import category_display_sql, fix_encoding
from .results import _race_or_404, build_fis_dataset

router = APIRouter(tags=["timekeeper-slcr"])


class RacesRequest(BaseModel):
    event_id: int
    discipline: int = slcr_evidence.DEFAULT_DISCIPLINE


class ResultsRequest(BaseModel):
    event_id: int
    discipline: int = slcr_evidence.DEFAULT_DISCIPLINE


def _fail(exc: slcr_evidence.SlcrError) -> HTTPException:
    return HTTPException(status_code=502, detail=str(exc))


def _categories(db: Session, race: models.Race) -> List[Dict[str, Any]]:
    rows = db.execute(text(f"""
        SELECT id, {category_display_sql('fuj_jmlp_category')} AS display_name,
               min_birth_year, max_birth_year, sex
        FROM fuj_jmlp_category
        WHERE active = 1
    """)).fetchall()
    rank = category_order_service.category_rank_map(race, db)
    categories = [{
        "id": int(row.id),
        "name": fix_encoding(row.display_name) if row.display_name else f"Kategorie {row.id}",
        "sex": row.sex,
        "year_from": row.min_birth_year,
        "year_to": row.max_birth_year,
    } for row in rows]
    return sorted(categories, key=lambda item: rank.get(item["id"], 10 ** 6))


def _start_time(db: Session, race_id: int) -> Optional[str]:
    row = db.execute(text("""
        SELECT start_time FROM fuj_jmlp_race_run
        WHERE race_id = :race_id AND run_number = 1
    """), {"race_id": race_id}).first()
    value = (row.start_time or "").strip() if row else ""
    parts = value.replace(".", ":").split(":")
    if len(parts) >= 2 and all(part.isdigit() for part in parts[:2]):
        hours, minutes = int(parts[0]), int(parts[1])
        if 0 <= hours < 24 and 0 <= minutes < 60:
            return f"{hours:02d}:{minutes:02d}:00"
    return None


def _plan(db: Session, race: models.Race, event: Dict[str, Any], discipline: int) -> List[Dict[str, Any]]:
    if not race.datum:
        raise HTTPException(status_code=400, detail="Závod nemá datum")
    return slcr_evidence.plan_races(
        _categories(db, race), event.get("races") or [], race.datum,
        start_time=_start_time(db, race.id), discipline=discipline,
    )


def _event_info(event: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": event.get("id"),
        "name": event.get("name"),
        "place": event.get("place"),
        "date": (event.get("date") or {}).get("from"),
        "category_mode": event.get("categoryMode"),
        "url": f"{slcr_evidence.BASE_URL}/kalendar-a-vysledky/{event.get('id')}/zavody",
    }


def _check_discipline(discipline: int) -> None:
    if discipline not in {item["id"] for item in slcr_evidence.DISCIPLINES}:
        raise HTTPException(status_code=400, detail="Neznámá disciplína")


@router.get("/slcr/status")
def slcr_status(current_admin: models.AdminUser = Depends(auth.get_current_admin)) -> Dict[str, Any]:
    """Co je v .env nastavené (hodnoty se nikdy nevrací)."""
    config = slcr_evidence.settings()
    return {
        "token": config.has_token,
        "login": config.has_login,
        "disciplines": slcr_evidence.DISCIPLINES,
        "default_discipline": slcr_evidence.DEFAULT_DISCIPLINE,
    }


@router.get("/races/{race_id}/slcr/events")
def slcr_events(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Naše akce v evidenci (měří je naše měřící skupina) ±3 dny od data závodu."""
    race = _race_or_404(db, race_id)
    if not race.datum:
        raise HTTPException(status_code=400, detail="Závod nemá datum")
    try:
        events = slcr_evidence.own_events(
            slcr_evidence.list_events(race.datum - timedelta(days=3), race.datum + timedelta(days=3))
        )
    except slcr_evidence.SlcrError as exc:
        raise _fail(exc) from exc
    return events


@router.get("/races/{race_id}/slcr/plan")
def slcr_plan(
    race_id: int,
    event_id: int = Query(...),
    discipline: int = Query(default=slcr_evidence.DEFAULT_DISCIPLINE),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Náhled: akce a co se v ní u kterých kategorií udělá."""
    _check_discipline(discipline)
    race = _race_or_404(db, race_id)
    try:
        event = slcr_evidence.fetch_event(event_id)
    except slcr_evidence.SlcrError as exc:
        raise _fail(exc) from exc
    return {"event": _event_info(event), "items": _plan(db, race, event, discipline)}


@router.post("/races/{race_id}/slcr/races")
def slcr_create_races(
    race_id: int,
    payload: RacesRequest,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Založí v akci chybějící závody a doplní kodex tam, kde chybí."""
    _check_discipline(payload.discipline)
    race = _race_or_404(db, race_id)
    try:
        event = slcr_evidence.fetch_event(payload.event_id)
        if event.get("categoryMode") != "Manual":
            raise HTTPException(
                status_code=409,
                detail="Akce v evidenci používá kategorie z číselníku. Přepni ji v nastavení akce "
                       "na vlastní kategorie a zkus to znovu.",
            )
        existing = event.get("races") or []
        plan = _plan(db, race, event, payload.discipline)
        changes = [item for item in plan if item["action"] != "keep"]
        if changes:
            slcr_evidence.update_races(payload.event_id, slcr_evidence.build_inputs(existing, plan))
            event = slcr_evidence.fetch_event(payload.event_id)
    except slcr_evidence.SlcrError as exc:
        raise _fail(exc) from exc
    return {
        "event": _event_info(event),
        "created": sum(1 for item in changes if item["action"] == "create"),
        "codex_filled": sum(1 for item in changes if item["action"] == "codex"),
        "items": _plan(db, race, event, payload.discipline),
    }


@router.post("/races/{race_id}/slcr/results")
def slcr_send_results(
    race_id: int,
    payload: ResultsRequest,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Pošle výsledky závodu do akce (FIS XML Dataset, české číslo závodníka)."""
    _check_discipline(payload.discipline)
    fis_code = slcr_evidence.FIS_CODE_BY_DISCIPLINE.get(payload.discipline, "")
    content, unfinished, _ = build_fis_dataset(db, race_id, fis_code)
    layout = slcr_evidence.RESULT_LAYOUTS.get(fis_code, slcr_evidence.DEFAULT_LAYOUT)
    try:
        response = slcr_evidence.upload_results(payload.event_id, content, layout)
    except slcr_evidence.SlcrError as exc:
        raise _fail(exc) from exc
    return {"unfinished": unfinished, "response": response}
