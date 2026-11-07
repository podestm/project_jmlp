"""Helpers for idempotent timekeeper sync operations."""

import json
from typing import Any, Dict, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

_table_ready = False


def ensure_idempotency_table(db: Session) -> None:
    global _table_ready
    if _table_ready:
        return

    db.execute(
        text("""
        CREATE TABLE IF NOT EXISTS fuj_jmlp_timekeeper_idempotency (
            id BIGINT NOT NULL AUTO_INCREMENT,
            idempotency_key VARCHAR(128) NOT NULL,
            admin_id BIGINT NOT NULL,
            method VARCHAR(10) NOT NULL,
            endpoint VARCHAR(255) NOT NULL,
            response_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_timekeeper_idempotency (idempotency_key, admin_id, method, endpoint),
            KEY idx_timekeeper_idempotency_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    )
    db.commit()
    _table_ready = True


def try_get_idempotent_response(
    db: Session, idempotency_key: Optional[str], admin_id: int, method: str, endpoint: str
) -> Optional[Dict[str, Any]]:
    if not idempotency_key:
        return None

    ensure_idempotency_table(db)

    row = db.execute(
        text("""
        SELECT response_json
        FROM fuj_jmlp_timekeeper_idempotency
        WHERE idempotency_key = :idempotency_key
          AND admin_id = :admin_id
          AND method = :method
          AND endpoint = :endpoint
        LIMIT 1
    """),
        {
            "idempotency_key": idempotency_key,
            "admin_id": admin_id,
            "method": method,
            "endpoint": endpoint,
        },
    ).first()

    if not row:
        return None

    parsed = json.loads(row.response_json)
    parsed["idempotency_replayed"] = True
    return parsed


def store_idempotent_response(
    db: Session,
    idempotency_key: Optional[str],
    admin_id: int,
    method: str,
    endpoint: str,
    response_payload: Dict[str, Any],
) -> None:
    if not idempotency_key:
        return

    ensure_idempotency_table(db)

    db.execute(
        text("""
        INSERT INTO fuj_jmlp_timekeeper_idempotency (
            idempotency_key,
            admin_id,
            method,
            endpoint,
            response_json
        ) VALUES (
            :idempotency_key,
            :admin_id,
            :method,
            :endpoint,
            :response_json
        )
        ON DUPLICATE KEY UPDATE
            response_json = VALUES(response_json),
            updated_at = CURRENT_TIMESTAMP
    """),
        {
            "idempotency_key": idempotency_key,
            "admin_id": admin_id,
            "method": method,
            "endpoint": endpoint,
            "response_json": json.dumps(response_payload, ensure_ascii=False),
        },
    )
    db.commit()
