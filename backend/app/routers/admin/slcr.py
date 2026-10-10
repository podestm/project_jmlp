"""Doplnění chybějících ID závodníků z evidence SLČR.

Spouští se ručně, pak běží sám na pozadí (services/slcr_sync.py). Přehled
ukazuje doplněná ID; každé jde vrátit.
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
    """Kolik ID je doplněných, kolik závodníků ID nemá a poslední (běžící) běh."""
    job = slcr_sync.last_job(db)
    return {
        "counts": slcr_sync.counts(db, job),
        "running": slcr_sync.running_job(db) is not None,
        "job": _job(job),
    }


@router.get("/filled")
def filled(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    return slcr_sync.list_filled(db)


@router.post("/sync", status_code=202)
def start_sync(
    payload: SyncRequest,
    background: BackgroundTasks,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Spustí doplnění chybějících ID ze SLČR na pozadí."""
    if payload.scope not in slcr_sync.SCOPES:
        raise HTTPException(status_code=400, detail="Neznámý rozsah")
    try:
        job_id = slcr_sync.start_job(db, payload.scope, current_admin.id)
    except slcr_sync.SyncRunning:
        raise HTTPException(status_code=409, detail="Doplňování ID ze SLČR už běží")
    background.add_task(slcr_sync.run_job, job_id, payload.scope, SessionLocal)
    return {"job_id": job_id}


@router.post("/filled/{racer_id}/undo")
def undo(
    racer_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Vrátí doplněné ID; při dalším běhu se už nedoplní."""
    try:
        slcr_sync.undo(db, racer_id)
    except slcr_sync.PairingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))
    return {"ok": True}
