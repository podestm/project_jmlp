"""Načtení návrhů párování ze SLČR do databáze a rozhodnutí správce.

Načítání trvá minuty (stovky dotazů na evidenci s pauzou mezi nimi), takže
běží na pozadí a průběh se ukládá do fuj_jmlp_slcr_sync - aplikace běží ve
více workerech a stav v paměti by obrazovka nemusela vidět.

Rozhodnutí správce se při dalším načtení nepřepisuje: potvrzené párování
zůstává, a odmítnutý návrh se znovu nenabídne, dokud evidence nenavrhne
jiného člena.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta
from typing import Callable, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..utils import fix_encoding, get_current_season_id
from . import slcr

logger = logging.getLogger(__name__)

SCOPE_ACTIVE = "active"
SCOPE_ALL = "all"
SCOPES = (SCOPE_ACTIVE, SCOPE_ALL)

STATUS_SUGGESTED = "suggested"
STATUS_CONFIRMED = "confirmed"
STATUS_REJECTED = "rejected"
STATUS_NOT_FOUND = "not_found"
STATUSES = (STATUS_SUGGESTED, STATUS_CONFIRMED, STATUS_REJECTED, STATUS_NOT_FOUND)

# Kolik sezón zpátky se berou výsledky JMLP z evidence a závodníci do
# "aktivních" (přihlášení v letošní nebo loňské sezóně).
RESULT_SEASONS_BACK = 3
ACTIVE_SEASONS_BACK = 1

# Běh, který se do té doby neozval, se považuje za spadlý (restart serveru).
STALE_AFTER = timedelta(minutes=30)
PROGRESS_EVERY = 10


class SyncRunning(Exception):
    pass


# --------------------------------------------------------------------------
# Běhy načítání
# --------------------------------------------------------------------------
def running_job(db: Session, now: Optional[datetime] = None) -> Optional[dict]:
    now = now or datetime.now()
    row = db.execute(text(
        "SELECT id, scope, started_at, total, done FROM fuj_jmlp_slcr_sync "
        "WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1"
    )).mappings().first()
    if row and now - row["started_at"] < STALE_AFTER:
        return dict(row)
    return None


def last_job(db: Session) -> Optional[dict]:
    row = db.execute(text(
        "SELECT id, scope, started_at, finished_at, total, done, error FROM fuj_jmlp_slcr_sync "
        "ORDER BY id DESC LIMIT 1"
    )).mappings().first()
    return dict(row) if row else None


def start_job(db: Session, scope: str, admin_id: Optional[int]) -> int:
    if running_job(db):
        raise SyncRunning()
    # Spadlé běhy uzavřít, ať nevisí jako rozběhnuté.
    db.execute(text(
        "UPDATE fuj_jmlp_slcr_sync SET finished_at = NOW(), error = 'Přerušeno' WHERE finished_at IS NULL"
    ))
    result = db.execute(text(
        "INSERT INTO fuj_jmlp_slcr_sync (scope, started_at, started_by) VALUES (:scope, NOW(), :admin)"
    ), {"scope": scope, "admin": admin_id})
    db.commit()
    return int(result.lastrowid)


def _progress(db: Session, job_id: int, **values) -> None:
    sets = ", ".join(f"{key} = :{key}" for key in values)
    db.execute(text(f"UPDATE fuj_jmlp_slcr_sync SET {sets} WHERE id = :id"), {**values, "id": job_id})
    db.commit()


# --------------------------------------------------------------------------
# Závodníci k párování
# --------------------------------------------------------------------------
def load_racers(db: Session, scope: str, today: Optional[date] = None) -> list[slcr.RacerToPair]:
    params = {}
    where = ""
    if scope == SCOPE_ACTIVE:
        params["season"] = get_current_season_id(today) - ACTIVE_SEASONS_BACK
        where = """
            WHERE r.id IN (
                SELECT rr.racer_id FROM fuj_jmlp_race_registration rr
                JOIN fuj_jmlp_race x ON x.id = rr.race_id WHERE x.season_id >= :season
                UNION
                SELECT sl.racer_id FROM fuj_jmlp_race_start_list sl
                JOIN fuj_jmlp_race x ON x.id = sl.race_id WHERE x.season_id >= :season
            )"""
    rows = db.execute(text(f"""
        SELECT r.id, r.name, r.surname, r.year, r.slcr_id
        FROM fuj_jmlp_racer r
        {where}
        ORDER BY r.id
    """), params).fetchall()
    return [
        slcr.RacerToPair(
            id=row.id,
            surname=fix_encoding(row.surname or "").strip(),
            name=fix_encoding(row.name or "").strip(),
            year=row.year,
            slcr_id=row.slcr_id,
        )
        for row in rows
    ]


# --------------------------------------------------------------------------
# Ukládání návrhů
# --------------------------------------------------------------------------
def _person_json(person: slcr.SlcrPerson) -> dict:
    return {
        "member_id": person.member_id, "slug": person.slug, "surname": person.surname,
        "name": person.name, "year": person.year, "race_code": person.race_code, "club": person.club,
    }


def save_proposal(db: Session, racer_id: int, proposal: slcr.Proposal, now: datetime) -> str:
    """Uloží návrh a vrátí výsledný stav. Rozhodnutí správce nepřepisuje."""
    current = db.execute(text(
        "SELECT status, member_id FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"
    ), {"id": racer_id}).mappings().first()
    person = proposal.person
    member_id = person.member_id if person else None

    if current and current["status"] == STATUS_CONFIRMED:
        db.execute(text("UPDATE fuj_jmlp_racer_slcr SET checked_at = :now WHERE racer_id = :id"),
                   {"now": now, "id": racer_id})
        return STATUS_CONFIRMED
    if current and current["status"] == STATUS_REJECTED and current["member_id"] == member_id:
        db.execute(text("UPDATE fuj_jmlp_racer_slcr SET checked_at = :now WHERE racer_id = :id"),
                   {"now": now, "id": racer_id})
        return STATUS_REJECTED

    status = STATUS_SUGGESTED if person else STATUS_NOT_FOUND
    values = {
        "id": racer_id,
        "status": status,
        "member_id": member_id,
        "member_slug": person.slug if person else None,
        "race_code": person.race_code if person else None,
        "slcr_surname": person.surname if person else None,
        "slcr_name": person.name if person else None,
        "slcr_year": person.year if person else None,
        "slcr_club": (person.club or None) if person else None,
        "confidence": proposal.confidence,
        "source": proposal.source,
        "note": (proposal.note or "")[:400] or None,
        "alternatives": json.dumps([_person_json(p) for p in proposal.alternatives[:5]], ensure_ascii=False)
        if proposal.alternatives else None,
        "now": now,
    }
    db.execute(text("""
        REPLACE INTO fuj_jmlp_racer_slcr
            (racer_id, status, member_id, member_slug, race_code, slcr_surname, slcr_name, slcr_year,
             slcr_club, confidence, source, note, alternatives, checked_at, decided_at, decided_by)
        VALUES
            (:id, :status, :member_id, :member_slug, :race_code, :slcr_surname, :slcr_name, :slcr_year,
             :slcr_club, :confidence, :source, :note, :alternatives, :now, NULL, NULL)
    """), values)
    return status


def results_since(today: Optional[date] = None) -> str:
    return f"{get_current_season_id(today) - RESULT_SEASONS_BACK}-08-01"


def run_job(
    job_id: int,
    scope: str,
    session_factory: Callable[[], Session],
    client_factory: Optional[Callable[[], slcr.SlcrClient]] = None,
) -> None:
    """Načte návrhy pro všechny závodníky v rozsahu. Běží na pozadí."""
    client_factory = client_factory or slcr.SlcrClient
    db = session_factory()
    try:
        racers = load_racers(db, scope)
        _progress(db, job_id, total=len(racers), done=0)
        client = client_factory()
        results = client.jmlp_results(results_since())
        for index, racer in enumerate(racers, start=1):
            proposal = slcr.propose(racer, results, client.search_with_codes)
            save_proposal(db, racer.id, proposal, datetime.now())
            if index % PROGRESS_EVERY == 0:
                _progress(db, job_id, done=index)
        db.commit()
        _progress(db, job_id, done=len(racers), finished_at=datetime.now())
    except Exception as exc:  # noqa: BLE001 - běh na pozadí musí stav vždy uzavřít
        logger.exception("Načítání ze SLČR selhalo")
        db.rollback()
        message = str(exc) if isinstance(exc, slcr.SlcrError) else f"Neočekávaná chyba: {exc}"
        _progress(db, job_id, finished_at=datetime.now(), error=message[:500])
    finally:
        db.close()


# --------------------------------------------------------------------------
# Rozhodnutí správce
# --------------------------------------------------------------------------
class PairingError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _row(db: Session, racer_id: int) -> dict:
    row = db.execute(text(
        "SELECT racer_id, status, member_id FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"
    ), {"id": racer_id}).mappings().first()
    if not row:
        raise PairingError("Pro závodníka zatím není návrh ze SLČR", 404)
    return dict(row)


def confirm(db: Session, racer_id: int, admin_id: Optional[int]) -> None:
    row = _row(db, racer_id)
    if not row["member_id"]:
        raise PairingError("Závodník nemá navrženého člena SLČR")
    other = db.execute(text(
        "SELECT racer_id FROM fuj_jmlp_racer_slcr "
        "WHERE member_id = :member AND status = :confirmed AND racer_id <> :id LIMIT 1"
    ), {"member": row["member_id"], "confirmed": STATUS_CONFIRMED, "id": racer_id}).scalar()
    if other:
        raise PairingError(
            "Tento člen SLČR je už potvrzený u jiného závodníka (nejspíš duplicita v registru)", 409)
    _decide(db, racer_id, STATUS_CONFIRMED, admin_id)


def reject(db: Session, racer_id: int, admin_id: Optional[int]) -> None:
    row = _row(db, racer_id)
    if not row["member_id"]:
        raise PairingError("Závodník nemá navrženého člena SLČR")
    _decide(db, racer_id, STATUS_REJECTED, admin_id)


def undo(db: Session, racer_id: int) -> None:
    row = _row(db, racer_id)
    status = STATUS_SUGGESTED if row["member_id"] else STATUS_NOT_FOUND
    db.execute(text(
        "UPDATE fuj_jmlp_racer_slcr SET status = :status, decided_at = NULL, decided_by = NULL "
        "WHERE racer_id = :id"
    ), {"status": status, "id": racer_id})
    db.commit()


def _decide(db: Session, racer_id: int, status: str, admin_id: Optional[int]) -> None:
    db.execute(text(
        "UPDATE fuj_jmlp_racer_slcr SET status = :status, decided_at = NOW(), decided_by = :admin "
        "WHERE racer_id = :id"
    ), {"status": status, "admin": admin_id, "id": racer_id})
    db.commit()


def forget_racer(db: Session, racer_id: int) -> None:
    """Smazaný závodník nemá co párovat."""
    db.execute(text("DELETE FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"), {"id": racer_id})


# --------------------------------------------------------------------------
# Přehled
# --------------------------------------------------------------------------
def counts(db: Session) -> dict:
    rows = db.execute(text(
        "SELECT status, COUNT(*) AS n FROM fuj_jmlp_racer_slcr GROUP BY status"
    )).fetchall()
    result = {status: 0 for status in STATUSES}
    result.update({row.status: row.n for row in rows})
    return result


def list_pairs(db: Session, status: Optional[str]) -> list[dict]:
    params = {}
    where = ""
    if status:
        where = "WHERE p.status = :status"
        params["status"] = status
    rows = db.execute(text(f"""
        SELECT p.*, r.name, r.surname, r.year, r.slcr_id, c.name AS club
        FROM fuj_jmlp_racer_slcr p
        JOIN fuj_jmlp_racer r ON r.id = p.racer_id
        LEFT JOIN fuj_jmlp_club c ON c.id = r.club_id
        {where}
        ORDER BY FIELD(p.confidence, 'low', 'medium', 'high'), r.surname, r.name
    """), params).mappings().all()

    # Stejný člen navržený nebo potvrzený u víc našich závodníků = duplicita v registru.
    member_ids = [row["member_id"] for row in rows if row["member_id"]]
    shared = {}
    if member_ids:
        for row in db.execute(text(
            "SELECT member_id, COUNT(*) AS n FROM fuj_jmlp_racer_slcr "
            "WHERE member_id IS NOT NULL AND status IN ('suggested', 'confirmed') GROUP BY member_id HAVING n > 1"
        )):
            shared[row.member_id] = row.n

    items = []
    for row in rows:
        our_code = slcr.race_code_of(row["slcr_id"])
        their_code = row["race_code"]
        club = fix_encoding(row["club"]).strip() if row["club"] else None
        items.append({
            "racer_id": row["racer_id"],
            "status": row["status"],
            "confidence": row["confidence"],
            "source": row["source"],
            "note": row["note"],
            "racer": {
                "surname": fix_encoding(row["surname"] or "").strip(),
                "name": fix_encoding(row["name"] or "").strip(),
                "year": row["year"],
                "slcr_id": (row["slcr_id"] or "").strip() or None,
                "club": club,
            },
            "slcr": None if not row["member_id"] else {
                "member_id": row["member_id"],
                "url": slcr.member_url(row["member_id"], row["member_slug"]),
                "surname": row["slcr_surname"],
                "name": row["slcr_name"],
                "year": row["slcr_year"],
                "race_code": their_code,
                "club": row["slcr_club"],
            },
            "alternatives": [
                {**alt, "url": slcr.member_url(alt.get("member_id"), alt.get("slug"))}
                for alt in json.loads(row["alternatives"] or "[]")
            ],
            "flags": {
                # Naše ID závodníka nesouhlasí s číslem v evidenci.
                "code_mismatch": their_code is not None and our_code is not None and our_code != their_code,
                # Evidence číslo má, u nás chybí nebo není číslo.
                "code_missing": their_code is not None and our_code is None,
                # SLČR páruje výsledky podle jména a ročníku - jiný zápis
                # jména nebo jiný ročník znamená, že se výsledek ke členovi
                # nepřiřadí.
                "name_differs": bool(row["member_id"]) and (
                    slcr.norm(fix_encoding(row["surname"] or "")) != slcr.norm(row["slcr_surname"])
                    or slcr.norm(fix_encoding(row["name"] or "")) != slcr.norm(row["slcr_name"])),
                "year_differs": row["slcr_year"] is not None and row["year"] != row["slcr_year"],
                "shared_member": shared.get(row["member_id"], 0) > 1,
            },
            "checked_at": row["checked_at"].isoformat() if row["checked_at"] else None,
            "decided_at": row["decided_at"].isoformat() if row["decided_at"] else None,
        })
    return items
