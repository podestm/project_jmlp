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

from ..utils import fix_encoding, get_category_snapshot_for_birth_year, get_current_season_id
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

    if current and current["status"] == STATUS_CONFIRMED and current["member_id"] == member_id:
        # Potvrzené zůstává; výsledek kontroly se jen aktualizuje.
        db.execute(text(
            "UPDATE fuj_jmlp_racer_slcr SET checked_at = :now, source = :kind, note = :note WHERE racer_id = :id"
        ), {"now": now, "kind": proposal.kind, "note": (proposal.note or "")[:400] or None, "id": racer_id})
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
        # Jasné výsledky (sedí, doplnit ID) jdou potvrdit hromadně.
        "confidence": "high" if proposal.kind in slcr.CLEAR_KINDS else "low",
        "source": proposal.kind,
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
            proposal = slcr.cross_check(racer, results, client.search_with_details)
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
        "SELECT racer_id, status, member_id, slcr_surname, slcr_name, slcr_year, race_code, previous, applied_at "
        "FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"
    ), {"id": racer_id}).mappings().first()
    if not row:
        raise PairingError("Pro závodníka zatím není návrh ze SLČR", 404)
    return dict(row)


# Co se z evidence přebírá do našeho záznamu. Délky odpovídají sloupcům
# fuj_jmlp_racer.
FIELD_LABELS = {"surname": "příjmení", "name": "jméno", "year": "ročník", "slcr_id": "ID závodníka"}
_MAX_LENGTH = {"surname": 30, "name": 25, "slcr_id": 10}


def _clean(value) -> str:
    return fix_encoding(value or "").strip() if isinstance(value, str) or value is None else str(value)


def planned_changes(racer: dict, pairing: dict) -> list[dict]:
    """Co se v našem záznamu změní, když se převezmou údaje z evidence.

    Evidence SLČR je zdroj pravdy pro jméno, příjmení, ročník a ID závodníka.
    Co evidence neuvádí (veřejně často chybí ročník), zůstává naše.
    """
    wanted = {
        "surname": (pairing.get("slcr_surname") or "").strip() or None,
        "name": (pairing.get("slcr_name") or "").strip() or None,
        "year": pairing.get("slcr_year"),
        "slcr_id": str(pairing["race_code"]) if pairing.get("race_code") else None,
    }
    changes = []
    for field, new in wanted.items():
        if new is None:
            continue
        old = racer.get(field)
        old_clean = old if field == "year" else _clean(old)
        if field != "year" and old_clean == "":
            old_clean = None
        if old_clean != new:
            changes.append({"field": field, "label": FIELD_LABELS[field], "old": old_clean, "new": new})
    return changes


def _racer_values(db: Session, racer_id: int) -> dict:
    row = db.execute(text(
        "SELECT id, name, surname, year, sex, slcr_id FROM fuj_jmlp_racer WHERE id = :id"
    ), {"id": racer_id}).mappings().first()
    if not row:
        raise PairingError("Závodník v registru neexistuje", 404)
    return dict(row)


def _write_racer(db: Session, racer: dict, values: dict) -> None:
    """Zapíše hodnoty do registru; hlídá délky a identitu (jméno + příjmení + ročník + pohlaví)."""
    for field, value in values.items():
        limit = _MAX_LENGTH.get(field)
        if limit and value is not None and len(str(value)) > limit:
            raise PairingError(f"{FIELD_LABELS[field].capitalize()} z evidence je delší, než registr dovolí ({limit} znaků): {value}")
    merged = {**racer, **values}
    other = db.execute(text("""
        SELECT id FROM fuj_jmlp_racer
        WHERE name = :name AND surname = :surname AND year = :year AND sex = :sex AND id <> :id LIMIT 1
    """), {"name": merged["name"], "surname": merged["surname"], "year": merged["year"],
           "sex": merged["sex"], "id": racer["id"]}).scalar()
    if other:
        raise PairingError(
            f"V registru už je {merged['surname']} {merged['name']} ({merged['year']}) pod ID {other} - "
            "nejspíš duplicita, nejdřív je slučte.", 409)

    sets = dict(values)
    if "year" in values:
        category_id, _, _ = get_category_snapshot_for_birth_year(merged["year"], merged["sex"], db)
        sets["category_id"] = category_id
    assignments = ", ".join(f"{field} = :{field}" for field in sets)
    db.execute(text(f"UPDATE fuj_jmlp_racer SET {assignments} WHERE id = :id"), {**sets, "id": racer["id"]})


def apply_evidence(db: Session, racer_id: int, row: Optional[dict] = None) -> list[dict]:
    """Opraví náš záznam podle evidence a uloží původní hodnoty. Necommituje."""
    row = row or _row(db, racer_id)
    racer = _racer_values(db, racer_id)
    changes = planned_changes(racer, row)
    if changes:
        _write_racer(db, racer, {change["field"]: change["new"] for change in changes})
    previous = {change["field"]: racer[change["field"]] for change in changes}
    db.execute(text(
        "UPDATE fuj_jmlp_racer_slcr SET previous = :previous, applied_at = NOW() WHERE racer_id = :id"
    ), {"previous": json.dumps(previous, ensure_ascii=False) if previous else None, "id": racer_id})
    return changes


def confirm(db: Session, racer_id: int, admin_id: Optional[int]) -> list[dict]:
    """Potvrdí párování a převezme do našeho záznamu údaje z evidence."""
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
    try:
        changes = apply_evidence(db, racer_id, row)
    except PairingError:
        db.rollback()
        raise
    _decide(db, racer_id, STATUS_CONFIRMED, admin_id)
    return changes


def apply_confirmed(db: Session) -> dict:
    """Převezme údaje z evidence u potvrzených, kterým se ještě nepřevzaly."""
    ids = [r.racer_id for r in db.execute(text(
        "SELECT racer_id FROM fuj_jmlp_racer_slcr WHERE status = :confirmed AND applied_at IS NULL"
    ), {"confirmed": STATUS_CONFIRMED})]
    changed, failed = 0, []
    for racer_id in ids:
        try:
            if apply_evidence(db, racer_id):
                changed += 1
            db.commit()
        except PairingError as exc:
            db.rollback()
            failed.append({"racer_id": racer_id, "reason": str(exc)})
    return {"processed": len(ids), "changed": changed, "failed": failed}


def reject(db: Session, racer_id: int, admin_id: Optional[int]) -> None:
    row = _row(db, racer_id)
    if not row["member_id"]:
        raise PairingError("Závodník nemá navrženého člena SLČR")
    _decide(db, racer_id, STATUS_REJECTED, admin_id)


def undo(db: Session, racer_id: int) -> None:
    """Vrátí rozhodnutí; převzaté údaje z evidence vrátí na původní."""
    row = _row(db, racer_id)
    if row["previous"]:
        previous = json.loads(row["previous"])
        try:
            _write_racer(db, _racer_values(db, racer_id), previous)
        except PairingError:
            db.rollback()
            raise
    status = STATUS_SUGGESTED if row["member_id"] else STATUS_NOT_FOUND
    db.execute(text(
        "UPDATE fuj_jmlp_racer_slcr SET status = :status, decided_at = NULL, decided_by = NULL, "
        "previous = NULL, applied_at = NULL WHERE racer_id = :id"
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
    # Potvrzení, u kterých se údaje z evidence ještě nepřevzaly (potvrzená
    # dřív, než potvrzení začalo opravovat záznam).
    result["pending_apply"] = db.execute(text(
        "SELECT COUNT(*) FROM fuj_jmlp_racer_slcr WHERE status = :confirmed AND applied_at IS NULL"
    ), {"confirmed": STATUS_CONFIRMED}).scalar()
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
        ORDER BY FIELD(p.source, 'other_id', 'id_mismatch', 'ambiguous', 'id_unknown', 'fill_id', 'ok'), r.surname, r.name
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
            "kind": row["source"],
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
            # Co potvrzení u nás změní (u potvrzených bez převzetí totéž),
            # a co se už převzalo.
            "changes": planned_changes(
                {"surname": row["surname"], "name": row["name"], "year": row["year"], "slcr_id": row["slcr_id"]}, row)
            if row["member_id"] and not row["applied_at"] and row["status"] != STATUS_REJECTED else [],
            "applied": [
                {"field": field, "label": FIELD_LABELS.get(field, field), "old": old}
                for field, old in json.loads(row["previous"] or "{}").items()
            ],
            "flags": {
                # Naše ID závodníka je jiné číslo než v evidenci - může jít
                # o překlep, ale i o jiného člověka.
                "code_mismatch": their_code is not None and our_code is not None and our_code != their_code,
                "shared_member": shared.get(row["member_id"], 0) > 1,
            },
            "checked_at": row["checked_at"].isoformat() if row["checked_at"] else None,
            "decided_at": row["decided_at"].isoformat() if row["decided_at"] else None,
        })
    return items
