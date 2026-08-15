"""Time entry and management for races."""
from typing import Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from decimal import Decimal

from ...database import get_db
from ... import models, schemas, auth
from ...utils import StandardExceptions
from ...services import results as results_service
from .idempotency import try_get_idempotent_response, store_idempotent_response

router = APIRouter(tags=["timekeeper-timing"])


def _normalize_revision(value: str | None) -> str | None:
    if not value:
        return None
    try:
        candidate = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(candidate)
        return parsed.replace(microsecond=0, tzinfo=None).isoformat()
    except ValueError:
        return None


def _server_revision(entry: models.StartListEntry) -> str | None:
    if not entry.updated_at:
        return None
    return entry.updated_at.replace(microsecond=0).isoformat() + "Z"


def _raise_stale_conflict(entry_id: int, endpoint: str, client_revision: str | None, server_revision: str | None) -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "stale_revision",
            "message": "Záznam byl mezitím změněn jiným klientem.",
            "entry_id": entry_id,
            "endpoint": endpoint,
            "client_revision": client_revision,
            "server_revision": server_revision,
            "can_force_apply": True,
        },
    )


def _check_revision_or_raise(
    entry: models.StartListEntry,
    client_revision: str | None,
    endpoint: str,
    force_apply: bool = False,
) -> None:
    if force_apply:
        return

    normalized_client = _normalize_revision(client_revision)
    if not normalized_client:
        return

    server_revision = _server_revision(entry)
    normalized_server = _normalize_revision(server_revision)
    if normalized_server and normalized_server != normalized_client:
        _raise_stale_conflict(entry.id, endpoint, client_revision, server_revision)


@router.post("/races/{race_id}/times")
def save_times(
    race_id: int,
    data: schemas.BatchTimeEntry,
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Batch save times for multiple entries in a race."""
    endpoint = f"/api/timekeeper/races/{race_id}/times"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="POST",
        endpoint=endpoint,
    )
    if replay:
        return replay

    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    
    updated = 0
    updated_entries: list[models.StartListEntry] = []
    for time_entry in data.entries:
        entry = db.query(models.StartListEntry).filter(
            models.StartListEntry.id == time_entry.entry_id,
            models.StartListEntry.race_id == race_id
        ).first()

        if not entry:
            continue

        _check_revision_or_raise(
            entry=entry,
            client_revision=time_entry.base_revision,
            endpoint=endpoint,
            force_apply=bool(time_entry.force_apply),
        )
        
        entry.time1 = Decimal(str(time_entry.time1)) if time_entry.time1 is not None else None
        entry.time2 = Decimal(str(time_entry.time2)) if time_entry.time2 is not None else None
        entry.dnf = time_entry.dnf
        entry.dns = time_entry.dns
        entry.dsq = time_entry.dsq
        
        entry.time_sum = results_service.compute_time_sum(
            entry.time1, entry.time2, entry.dnf, entry.dns, entry.dsq
        )
        
        updated += 1
        updated_entries.append(entry)

    db.commit()

    # Per-entry revisions, read back from the rows themselves.
    #
    # This used to answer with a single `datetime.utcnow()` taken AFTER the
    # commit, which is not any row's `updated_at`: the column is a DATETIME with
    # no fractional seconds, MySQL rounds the flush timestamp into it, and the
    # response was truncated - so the two disagreed whenever the flush instant
    # landed at >= .5 s. The client stamped that value onto every row it had
    # just saved and the next write to any of them came back 409 with nobody
    # else having touched anything.
    revisions: Dict[str, str | None] = {}
    for entry in updated_entries:
        db.refresh(entry)
        revisions[str(entry.id)] = _server_revision(entry)

    response_payload = {
        "message": f"Uloženo {updated} časů",
        "updated": updated,
        # entry_id (as string) -> that row's stored revision. Replaces the old
        # top-level "revision", which belonged to no row at all.
        "revisions": revisions,
        "idempotency_replayed": False,
    }
    store_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="POST",
        endpoint=endpoint,
        response_payload=response_payload,
    )
    return response_payload


@router.put("/start-list/{entry_id}/time")
def update_single_time(
    entry_id: int,
    data: schemas.StartListEntryUpdate,
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update time for a single start list entry."""
    endpoint = f"/api/timekeeper/start-list/{entry_id}/time"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="PUT",
        endpoint=endpoint,
    )
    if replay:
        return replay

    entry = db.query(models.StartListEntry).filter(
        models.StartListEntry.id == entry_id
    ).first()
    
    if not entry:
        raise StandardExceptions.not_found("Záznam nenalezen")
    
    update_data = data.dict(exclude_unset=True)

    _check_revision_or_raise(
        entry=entry,
        client_revision=update_data.get("base_revision"),
        endpoint=endpoint,
        force_apply=bool(update_data.get("force_apply")),
    )

    update_data.pop("base_revision", None)
    update_data.pop("force_apply", None)
    
    for key, value in update_data.items():
        if key in ('time1', 'time2') and value is not None:
            setattr(entry, key, Decimal(str(value)))
        else:
            setattr(entry, key, value)
    
    entry.time_sum = results_service.compute_time_sum(
        entry.time1, entry.time2, entry.dnf, entry.dns, entry.dsq
    )
    
    db.commit()
    db.refresh(entry)
    response_payload = {
        "message": "Čas aktualizován",
        "revision": _server_revision(entry),
        "idempotency_replayed": False,
    }
    store_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="PUT",
        endpoint=endpoint,
        response_payload=response_payload,
    )
    return response_payload
