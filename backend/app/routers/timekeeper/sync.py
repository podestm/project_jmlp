"""Timekeeper sync observability endpoints."""
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...database import get_db
from ... import auth, models
from .idempotency import ensure_idempotency_table

router = APIRouter(prefix="/sync", tags=["timekeeper-sync"])


@router.get("/health")
def sync_health(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    ensure_idempotency_table(db)
    return {
        "status": "ok",
        "idempotency_enabled": True,
        "admin_id": current_admin.id,
    }


@router.get("/operations")
def get_sync_operations(
    limit: int = Query(default=50, ge=1, le=200),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, List[Dict[str, Any]]]:
    ensure_idempotency_table(db)

    rows = db.execute(text("""
        SELECT id,
               idempotency_key,
               admin_id,
               method,
               endpoint,
               created_at,
               updated_at
        FROM fuj_jmlp_timekeeper_idempotency
        ORDER BY created_at DESC
        LIMIT :limit_value
    """), {"limit_value": limit}).fetchall()

    return {
        "operations": [
            {
                "id": row.id,
                "idempotency_key": row.idempotency_key,
                "admin_id": row.admin_id,
                "method": row.method,
                "endpoint": row.endpoint,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
            for row in rows
        ]
    }
