"""Evidence SLČR z časomíry: založení závodů v akci a odeslání výsledků.

Postup u závodu:
  1. GET  .../slcr/events  - akce v evidenci kolem data závodu (výběr akce),
  2. GET  .../slcr/plan    - náhled: které kategorie se v akci založí,
  3. POST .../slcr/races   - založí chybějící závody (kodex = id kategorie),
  4. POST .../slcr/results - pošle výsledky jako FIS XML Dataset (celá akce).

Během závodu po kategoriích (každá kategorie = jeden závod akce, kodex = id
kategorie):
  GET  .../slcr/categories?event_id=          - připravenost a stav v evidenci,
  POST .../slcr/categories/{id}/publish       - pošle a zveřejní jednu kategorii
                                                (už zveřejněnou opraví).

Komunikace s evidencí je v services/slcr_evidence.py.
"""

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ... import auth, models
from ...database import get_db
from ...services import category_order as category_order_service
from ...services import results as results_service
from ...services import slcr_evidence
from ...utils import category_display_sql, fix_encoding
from .results import _group_by_category, _load_entries, _race_or_404, build_fis_dataset

router = APIRouter(tags=["timekeeper-slcr"])


class RacesRequest(BaseModel):
    event_id: int
    discipline: int = slcr_evidence.DEFAULT_DISCIPLINE


class ResultsRequest(BaseModel):
    event_id: int
    discipline: int = slcr_evidence.DEFAULT_DISCIPLINE


def _fail(exc: slcr_evidence.SlcrError) -> HTTPException:
    status = 409 if isinstance(exc, slcr_evidence.SlcrBusy) else 502
    return HTTPException(status_code=status, detail=str(exc))


def _entry_counts(db: Session, race_id: int) -> dict[int, int]:
    """Kolik závodníků je v každé kategorii na startovce (bez vyřazených)."""
    rows = db.execute(
        text("""
        SELECT category_id, COUNT(*) AS n FROM fuj_jmlp_race_start_list
        WHERE race_id = :race_id AND excluded = 0
        GROUP BY category_id
    """),
        {"race_id": race_id},
    ).fetchall()
    return {int(row.category_id): int(row.n) for row in rows if row.category_id is not None}


def _categories(db: Session, race: models.Race) -> list[dict[str, Any]]:
    rows = db.execute(
        text(f"""
        SELECT id, {category_display_sql('fuj_jmlp_category')} AS display_name,
               min_birth_year, max_birth_year, sex
        FROM fuj_jmlp_category
        WHERE active = 1
    """)
    ).fetchall()
    rank = category_order_service.category_rank_map(race, db)
    counts = _entry_counts(db, race.id)
    categories = [
        {
            "id": int(row.id),
            "name": fix_encoding(row.display_name) if row.display_name else f"Kategorie {row.id}",
            "sex": row.sex,
            "year_from": row.min_birth_year,
            "year_to": row.max_birth_year,
            "entries": counts.get(int(row.id), 0),
        }
        for row in rows
    ]
    return sorted(categories, key=lambda item: rank.get(item["id"], 10**6))


def _start_time(db: Session, race_id: int) -> str | None:
    row = db.execute(
        text("""
        SELECT start_time FROM fuj_jmlp_race_run
        WHERE race_id = :race_id AND run_number = 1
    """),
        {"race_id": race_id},
    ).first()
    value = (row.start_time or "").strip() if row else ""
    parts = value.replace(".", ":").split(":")
    if len(parts) >= 2 and all(part.isdigit() for part in parts[:2]):
        hours, minutes = int(parts[0]), int(parts[1])
        if 0 <= hours < 24 and 0 <= minutes < 60:
            return f"{hours:02d}:{minutes:02d}:00"
    return None


def _plan(
    db: Session, race: models.Race, event: dict[str, Any], discipline: int
) -> list[dict[str, Any]]:
    if not race.datum:
        raise HTTPException(status_code=400, detail="Závod nemá datum")
    return slcr_evidence.plan_races(
        _categories(db, race),
        event.get("races") or [],
        race.datum,
        start_time=_start_time(db, race.id),
        discipline=discipline,
    )


def _event_info(event: dict[str, Any]) -> dict[str, Any]:
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
def slcr_status(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
) -> dict[str, Any]:
    """Co je v .env nastavené (hodnoty se nikdy nevrací)."""
    config = slcr_evidence.settings()
    return {
        "token": config.has_token,
        "login": config.has_login,
        "dry_run": slcr_evidence.dry_run(),
        "disciplines": slcr_evidence.DISCIPLINES,
        "default_discipline": slcr_evidence.DEFAULT_DISCIPLINE,
    }


@router.get("/races/{race_id}/slcr/events")
def slcr_events(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Naše akce v evidenci (měří je naše měřící skupina) ±3 dny od data závodu."""
    race = _race_or_404(db, race_id)
    if not race.datum:
        raise HTTPException(status_code=400, detail="Závod nemá datum")
    try:
        events = slcr_evidence.own_events(
            slcr_evidence.list_events(
                race.datum - timedelta(days=3), race.datum + timedelta(days=3)
            )
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
) -> dict[str, Any]:
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
) -> dict[str, Any]:
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
        changes = [item for item in plan if item["action"] in ("create", "codex")]
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
) -> dict[str, Any]:
    """Pošle výsledky závodu do akce (FIS XML Dataset, české číslo závodníka)."""
    _check_discipline(payload.discipline)
    fis_code = slcr_evidence.FIS_CODE_BY_DISCIPLINE.get(payload.discipline, "")
    content, unfinished, _ = build_fis_dataset(db, race_id, fis_code)
    layout = slcr_evidence.RESULT_LAYOUTS.get(fis_code, slcr_evidence.DEFAULT_LAYOUT)
    try:
        response = slcr_evidence.upload_results(payload.event_id, content, layout)
    except slcr_evidence.SlcrError as exc:
        raise _fail(exc) from exc
    return {"unfinished": unfinished, "response": response, "dry_run": slcr_evidence.dry_run()}


# ---------------------------------------------------------------------------
# Výsledky po kategoriích
# ---------------------------------------------------------------------------
def _readiness(db: Session, race: models.Race) -> list[dict[str, Any]]:
    """Kategorie se závodníky: kolik jich ještě nemá čas ani DNF/DNS/DSQ."""
    items = []
    for group in _group_by_category(_load_entries(db, race.id), race, db):
        if not group["category_id"]:
            continue
        ranked = results_service.rank_category(group["rows"])
        missing = sum(1 for item in ranked if item.rank is None and item.status is None)
        items.append(
            {
                "category_id": int(group["category_id"]),
                "name": group["category_name"],
                "total": len(ranked),
                "missing": missing,
                "ready": missing == 0,
            }
        )
    return items


def _category_state(item: dict[str, Any], races: list[dict[str, Any]]) -> dict[str, Any]:
    race = slcr_evidence.find_race(races, item["category_id"])
    race_id = race["id"] if race else None
    published = slcr_evidence.published_at(race_id)
    return {
        **item,
        "slcr_race_id": race_id,
        "slcr_state": slcr_evidence.result_state(race),
        "published_at": published.isoformat(timespec="seconds") if published else None,
    }


@router.get("/races/{race_id}/slcr/categories")
def slcr_categories(
    race_id: int,
    event_id: int = Query(...),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Po kategoriích: připravenost výsledků u nás a jejich stav v evidenci."""
    race = _race_or_404(db, race_id)
    try:
        event = slcr_evidence.fetch_event(event_id)
    except slcr_evidence.SlcrError as exc:
        raise _fail(exc) from exc
    races = event.get("races") or []
    return {
        "event": _event_info(event),
        "dry_run": slcr_evidence.dry_run(),
        "categories": [_category_state(item, races) for item in _readiness(db, race)],
    }


def _missing_text(count: int) -> str:
    if count == 1:
        return "1 závodník ještě nemá"
    if 2 <= count <= 4:
        return f"{count} závodníci ještě nemají"
    return f"{count} závodníků ještě nemá"


@router.post("/races/{race_id}/slcr/categories/{category_id}/publish")
def slcr_publish_category(
    race_id: int,
    category_id: int,
    payload: ResultsRequest,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Pošle výsledky jedné kategorie do jejího závodu v akci a zveřejní je.
    Už zveřejněné se opraví (zrušit zveřejnění → nahrát → zveřejnit)."""
    _check_discipline(payload.discipline)
    race = _race_or_404(db, race_id)
    item = next((cat for cat in _readiness(db, race) if cat["category_id"] == category_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="V kategorii nikdo nezávodí")
    if not item["ready"]:
        raise HTTPException(
            status_code=409,
            detail=f"V kategorii {item['name']} {_missing_text(item['missing'])} čas ani DNF/DNS/DSQ.",
        )
    fis_code = slcr_evidence.FIS_CODE_BY_DISCIPLINE.get(payload.discipline, "")
    layout = slcr_evidence.RESULT_LAYOUTS.get(fis_code, slcr_evidence.DEFAULT_LAYOUT)
    content, _, _ = build_fis_dataset(db, race_id, fis_code, category_id=category_id)
    try:
        event = slcr_evidence.fetch_event(payload.event_id)
        slcr_race = slcr_evidence.find_race(event.get("races") or [], category_id)
        if slcr_race is None:
            raise HTTPException(
                status_code=409,
                detail=f"Kategorie {item['name']} nemá v akci „{event.get('name')}“ svůj závod. "
                "Založte ho v Evidenci SLČR (krok 2 – Založit závody).",
            )
        corrected = slcr_evidence.result_state(slcr_race) == "Published"
        state = slcr_evidence.publish_race_results(
            payload.event_id, slcr_race["id"], content, layout
        )
    except slcr_evidence.SlcrError as exc:
        raise _fail(exc) from exc
    published = {**slcr_race, "resultRace": {"id": slcr_race["id"], "state": state}}
    return {
        "event": _event_info(event),
        "dry_run": slcr_evidence.dry_run(),
        "corrected": corrected,
        "category": _category_state(item, [published]),
    }
