"""Párování závodníků s evidencí SLČR - přehled, načtení návrhů, rozhodnutí.

Viz services/slcr.py (čtení evidence a párovací pravidla) a
services/slcr_sync.py (ukládání návrhů a rozhodnutí správce).
"""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ... import auth, models
from ...database import SessionLocal, get_db
from ...services import slcr_sync

router = APIRouter(prefix="/slcr", tags=["admin-slcr"])


class SyncRequest(BaseModel):
    scope: str = slcr_sync.SCOPE_ACTIVE


def _job(row: Optional[dict]) -> Optional[dict]:
    if not row:
        return None
    return {
        "id": row["id"],
        "scope": row["scope"],
        "started_at": row["started_at"].isoformat() if row.get("started_at") else None,
        "finished_at": row["finished_at"].isoformat() if row.get("finished_at") else None,
        "total": row["total"],
        "done": row["done"],
        "error": row.get("error"),
    }


@router.get("/summary")
def summary(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Počty podle stavu a poslední (případně běžící) načítání."""
    running = slcr_sync.running_job(db)
    return {
        "counts": slcr_sync.counts(db),
        "running": running is not None,
        "job": _job(slcr_sync.last_job(db)),
    }


@router.get("/pairs")
def pairs(
    status: Optional[str] = None,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    if status and status not in slcr_sync.STATUSES:
        raise HTTPException(status_code=400, detail="Neznámý stav")
    return slcr_sync.list_pairs(db, status)


@router.post("/sync", status_code=202)
def start_sync(
    payload: SyncRequest,
    background: BackgroundTasks,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Spustí načtení návrhů ze SLČR na pozadí."""
    if payload.scope not in slcr_sync.SCOPES:
        raise HTTPException(status_code=400, detail="Neznámý rozsah")
    try:
        job_id = slcr_sync.start_job(db, payload.scope, current_admin.id)
    except slcr_sync.SyncRunning:
        raise HTTPException(status_code=409, detail="Načítání ze SLČR už běží")
    background.add_task(slcr_sync.run_job, job_id, payload.scope, SessionLocal)
    return {"job_id": job_id}


def _decision(action, racer_id: int, db: Session, *args):
    try:
        action(db, racer_id, *args)
    except slcr_sync.PairingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))
    return {"ok": True}


@router.post("/pairs/{racer_id}/confirm")
def confirm(
    racer_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    return _decision(slcr_sync.confirm, racer_id, db, current_admin.id)


@router.post("/pairs/{racer_id}/reject")
def reject(
    racer_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    return _decision(slcr_sync.reject, racer_id, db, current_admin.id)


@router.post("/pairs/{racer_id}/undo")
def undo(
    racer_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    return _decision(slcr_sync.undo, racer_id, db)
