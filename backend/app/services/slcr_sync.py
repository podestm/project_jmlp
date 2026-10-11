"""Doplnění chybějících ID závodníků z evidence SLČR - běh na pozadí a jeho výsledky.

Spouští se ručně z administrace, pak běží sám: každému závodníkovi bez ID
najde člena evidence se stejným jménem a ročníkem (services/slcr.py) a doplní
mu ID. Trvá to minuty (stovky dotazů s pauzou), proto běží na pozadí a průběh
se ukládá do fuj_jmlp_slcr_sync - aplikace běží ve víc workerech.

Každé doplněné ID se zapíše do fuj_jmlp_racer_slcr i s původní hodnotou, aby
šlo vrátit. Vrácené se při dalším běhu znovu nedoplní.
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

# Řádek fuj_jmlp_racer_slcr: doplněné ID (filled), nebo vrácené, které se
# už nemá doplňovat (reverted). "confirmed" jsou záznamy z dřívějšího párování.
STATUS_FILLED = "filled"
STATUS_REVERTED = "reverted"
STATUS_CONFIRMED = "confirmed"
# Víc členů evidence se stejným jménem a ročníkem - vybere správce (manual),
# nebo rozhodne ID nepřiřazovat (dismissed).
STATUS_MANUAL = "manual"
STATUS_DISMISSED = "dismissed"
DONE_STATUSES = (STATUS_FILLED, STATUS_CONFIRMED)

# Kolik sezón zpátky se berou výsledky JMLP z evidence a závodníci do
# "aktivních" (přihlášení v letošní nebo loňské sezóně).
RESULT_SEASONS_BACK = 3
ACTIVE_SEASONS_BACK = 1

# Běh, který se do té doby neozval, se považuje za spadlý (restart serveru).
STALE_AFTER = timedelta(minutes=30)
PROGRESS_EVERY = 10

FIELD_LABELS = {"surname": "příjmení", "name": "jméno", "year": "ročník", "slcr_id": "ID závodníka"}


class SyncRunning(Exception):
    pass


class PairingError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


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
# Závodníci bez ID
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
    racers = [
        slcr.RacerToPair(
            id=row.id,
            surname=fix_encoding(row.surname or "").strip(),
            name=fix_encoding(row.name or "").strip(),
            year=row.year,
            slcr_id=row.slcr_id,
        )
        for row in rows
    ]
    # Jen ti, komu ID chybí - vyplněné ID se nekontroluje ani nemění.
    return [racer for racer in racers if slcr.race_code_of(racer.slcr_id) is None]


# --------------------------------------------------------------------------
# Doplnění ID
# --------------------------------------------------------------------------
def results_since(today: Optional[date] = None) -> str:
    return f"{get_current_season_id(today) - RESULT_SEASONS_BACK}-08-01"


def fill_id(db: Session, racer: slcr.RacerToPair, person: slcr.SlcrPerson, now: datetime) -> bool:
    """Doplní závodníkovi ID z evidence. Necommituje. False = přeskočeno."""
    current = db.execute(text(
        "SELECT status, member_id FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"
    ), {"id": racer.id}).mappings().first()
    # Vrácené doplnění se znovu nedělá.
    if current and current["status"] == STATUS_REVERTED and current["member_id"] == person.member_id:
        return False
    code = str(person.race_code)
    # Stejné ID u jiného našeho závodníka - nejspíš duplicita, nechat na člověku.
    taken = db.execute(text(
        "SELECT id FROM fuj_jmlp_racer WHERE TRIM(slcr_id) = :code AND id <> :id LIMIT 1"
    ), {"code": code, "id": racer.id}).scalar()
    if taken:
        return False
    old = db.execute(text("SELECT slcr_id FROM fuj_jmlp_racer WHERE id = :id"), {"id": racer.id}).scalar()
    db.execute(text("UPDATE fuj_jmlp_racer SET slcr_id = :code WHERE id = :id"), {"code": code, "id": racer.id})
    db.execute(text("""
        REPLACE INTO fuj_jmlp_racer_slcr
            (racer_id, status, member_id, member_slug, race_code, slcr_surname, slcr_name, slcr_year,
             slcr_club, source, note, previous, checked_at, applied_at, decided_at)
        VALUES
            (:id, :status, :member_id, :slug, :race_code, :surname, :name, :year,
             :club, 'fill_id', :note, :previous, :now, :now, :now)
    """), {
        "id": racer.id, "status": STATUS_FILLED, "member_id": person.member_id, "slug": person.slug,
        "race_code": person.race_code, "surname": person.surname, "name": person.name,
        "year": person.year, "club": person.club or None,
        "note": "věk v evidenci %s" % person.age if person.age is not None and person.year is None else None,
        "previous": json.dumps({"slcr_id": old}, ensure_ascii=False), "now": now,
    })
    return True


def run_job(
    job_id: int,
    scope: str,
    session_factory: Callable[[], Session],
    client_factory: Optional[Callable[[], slcr.SlcrClient]] = None,
) -> None:
    """Doplní chybějící ID všem závodníkům v rozsahu. Běží na pozadí."""
    client_factory = client_factory or slcr.SlcrClient
    db = session_factory()
    try:
        racers = load_racers(db, scope)
        _progress(db, job_id, total=len(racers), done=0)
        client = client_factory()
        results = client.jmlp_results(results_since())
        for index, racer in enumerate(racers, start=1):
            candidates = slcr.find_candidates(racer, results, client.search_with_details)
            if len(candidates) == 1:
                fill_id(db, racer, candidates[0], datetime.now())
                db.commit()
            elif len(candidates) > 1:
                save_manual(db, racer.id, candidates, datetime.now())
                db.commit()
            if index % PROGRESS_EVERY == 0:
                _progress(db, job_id, done=index)
        _progress(db, job_id, done=len(racers), finished_at=datetime.now())
    except Exception as exc:  # noqa: BLE001 - běh na pozadí musí stav vždy uzavřít
        logger.exception("Doplňování ID ze SLČR selhalo")
        db.rollback()
        message = str(exc) if isinstance(exc, slcr.SlcrError) else f"Neočekávaná chyba: {exc}"
        _progress(db, job_id, finished_at=datetime.now(), error=message[:500])
    finally:
        db.close()


# --------------------------------------------------------------------------
# Ruční zpracování - víc členů se stejným jménem a ročníkem
# --------------------------------------------------------------------------
def _person_json(person: slcr.SlcrPerson) -> dict:
    return {"member_id": person.member_id, "slug": person.slug, "surname": person.surname, "name": person.name,
            "year": person.year, "age": person.age, "race_code": person.race_code, "club": person.club}


def save_manual(db: Session, racer_id: int, candidates: list[slcr.SlcrPerson], now: datetime) -> None:
    """Zapíše závodníka k ručnímu výběru. Rozhodnutí "nepřiřazovat" a vrácené ID nepřepíše."""
    current = db.execute(text("SELECT status FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"),
                         {"id": racer_id}).scalar()
    if current in (STATUS_DISMISSED, STATUS_REVERTED):
        return
    db.execute(text("""
        REPLACE INTO fuj_jmlp_racer_slcr (racer_id, status, source, note, alternatives, checked_at)
        VALUES (:id, :status, 'fill_id', :note, :alternatives, :now)
    """), {"id": racer_id, "status": STATUS_MANUAL, "now": now,
           "note": f"v evidenci je {len(candidates)} členů se stejným jménem a ročníkem",
           "alternatives": json.dumps([_person_json(p) for p in candidates], ensure_ascii=False)})


def _manual_row(db: Session, racer_id: int) -> dict:
    row = db.execute(text(
        "SELECT status, alternatives FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"
    ), {"id": racer_id}).mappings().first()
    if not row or row["status"] != STATUS_MANUAL:
        raise PairingError("Závodník nečeká na ruční zpracování", 404)
    return dict(row)


def assign(db: Session, racer_id: int, member_id: int) -> None:
    """Přiřadí závodníkovi ID vybraného člena evidence."""
    row = _manual_row(db, racer_id)
    chosen = next((c for c in json.loads(row["alternatives"] or "[]") if c.get("member_id") == member_id), None)
    if chosen is None:
        raise PairingError("Vybraný člen mezi kandidáty není")
    racer = db.execute(text("SELECT id, name, surname, year, slcr_id FROM fuj_jmlp_racer WHERE id = :id"),
                       {"id": racer_id}).mappings().first()
    person = slcr.SlcrPerson(**{k: chosen.get(k) for k in
                                ("member_id", "slug", "surname", "name", "year", "age", "race_code", "club")})
    if not fill_id(db, slcr.RacerToPair(racer["id"], racer["surname"], racer["name"], racer["year"],
                                        racer["slcr_id"]), person, datetime.now()):
        db.rollback()
        raise PairingError(f"ID {person.race_code} už má jiný náš závodník", 409)
    db.commit()


def dismiss(db: Session, racer_id: int) -> None:
    """ID nepřiřazovat - závodník z ručního zpracování zmizí a příště se nenabídne."""
    _manual_row(db, racer_id)
    db.execute(text("UPDATE fuj_jmlp_racer_slcr SET status = :status, decided_at = NOW() WHERE racer_id = :id"),
               {"status": STATUS_DISMISSED, "id": racer_id})
    db.commit()


def list_manual(db: Session) -> list[dict]:
    rows = db.execute(text("""
        SELECT p.racer_id, p.note, p.alternatives, r.name, r.surname, r.year, r.slcr_id
        FROM fuj_jmlp_racer_slcr p
        JOIN fuj_jmlp_racer r ON r.id = p.racer_id
        WHERE p.status = :manual
        ORDER BY r.surname, r.name
    """), {"manual": STATUS_MANUAL}).mappings().all()
    return [{
        "racer_id": row["racer_id"],
        "racer": {"surname": fix_encoding(row["surname"] or "").strip(), "name": fix_encoding(row["name"] or "").strip(),
                  "year": row["year"]},
        "note": row["note"],
        "candidates": [{**c, "url": slcr.member_url(c.get("member_id"), c.get("slug"))}
                       for c in json.loads(row["alternatives"] or "[]")],
    } for row in rows if slcr.race_code_of(row["slcr_id"]) is None]


# --------------------------------------------------------------------------
# Vrácení
# --------------------------------------------------------------------------
def _write_racer(db: Session, racer_id: int, values: dict) -> None:
    racer = db.execute(text(
        "SELECT id, name, surname, year, sex FROM fuj_jmlp_racer WHERE id = :id"
    ), {"id": racer_id}).mappings().first()
    if not racer:
        raise PairingError("Závodník v registru neexistuje", 404)
    merged = {**racer, **values}
    other = db.execute(text("""
        SELECT id FROM fuj_jmlp_racer
        WHERE name = :name AND surname = :surname AND year = :year AND sex = :sex AND id <> :id LIMIT 1
    """), {"name": merged["name"], "surname": merged["surname"], "year": merged["year"],
           "sex": merged["sex"], "id": racer_id}).scalar()
    if other:
        raise PairingError(f"V registru už je {merged['surname']} {merged['name']} ({merged['year']}) pod ID {other}.", 409)
    sets = {k: v for k, v in values.items() if k in FIELD_LABELS}
    if "year" in sets:
        sets["category_id"], _, _ = get_category_snapshot_for_birth_year(merged["year"], merged["sex"], db)
    if sets:
        assignments = ", ".join(f"{field} = :{field}" for field in sets)
        db.execute(text(f"UPDATE fuj_jmlp_racer SET {assignments} WHERE id = :id"), {**sets, "id": racer_id})


def undo(db: Session, racer_id: int) -> None:
    """Vrátí doplněné ID (i dřívější převzaté údaje) a příště ho už nedoplní."""
    row = db.execute(text(
        "SELECT status, previous FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"
    ), {"id": racer_id}).mappings().first()
    if not row or row["status"] not in DONE_STATUSES:
        raise PairingError("U závodníka není co vracet", 404)
    try:
        _write_racer(db, racer_id, json.loads(row["previous"] or "{}"))
    except PairingError:
        db.rollback()
        raise
    db.execute(text(
        "UPDATE fuj_jmlp_racer_slcr SET status = :status, previous = NULL, applied_at = NULL, decided_at = NOW() "
        "WHERE racer_id = :id"
    ), {"status": STATUS_REVERTED, "id": racer_id})
    db.commit()


def forget_racer(db: Session, racer_id: int) -> None:
    """Smazaný závodník nemá co vracet."""
    db.execute(text("DELETE FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"), {"id": racer_id})


# --------------------------------------------------------------------------
# Přehled
# --------------------------------------------------------------------------
def counts(db: Session, job: Optional[dict] = None) -> dict:
    total = db.execute(text(
        "SELECT COUNT(*) FROM fuj_jmlp_racer_slcr WHERE status = :filled"
    ), {"filled": STATUS_FILLED}).scalar()
    last = 0
    if job:
        last = db.execute(text(
            "SELECT COUNT(*) FROM fuj_jmlp_racer_slcr WHERE status = :filled AND applied_at >= :since"
        ), {"filled": STATUS_FILLED, "since": job["started_at"]}).scalar()
    missing = len(load_racers(db, SCOPE_ALL))
    return {"filled": total, "filled_last_run": last, "missing": missing, "manual": len(list_manual(db))}


def list_filled(db: Session) -> list[dict]:
    rows = db.execute(text("""
        SELECT p.*, r.name, r.surname, r.year, r.slcr_id
        FROM fuj_jmlp_racer_slcr p
        JOIN fuj_jmlp_racer r ON r.id = p.racer_id
        WHERE p.status = 'filled' OR (p.status = 'confirmed' AND p.previous IS NOT NULL)
        ORDER BY p.applied_at DESC, r.surname, r.name
    """)).mappings().all()
    items = []
    for row in rows:
        current = {"surname": row["surname"], "name": row["name"], "year": row["year"], "slcr_id": row["slcr_id"]}
        changes = [
            {"field": field, "label": FIELD_LABELS.get(field, field), "old": old,
             "new": fix_encoding(current.get(field)).strip() if isinstance(current.get(field), str) else current.get(field)}
            for field, old in json.loads(row["previous"] or "{}").items()
        ]
        items.append({
            "racer_id": row["racer_id"],
            "status": row["status"],
            "racer": {
                "surname": fix_encoding(row["surname"] or "").strip(),
                "name": fix_encoding(row["name"] or "").strip(),
                "year": row["year"],
                "slcr_id": (row["slcr_id"] or "").strip() or None,
            },
            "slcr": None if not row["member_id"] else {
                "member_id": row["member_id"],
                "url": slcr.member_url(row["member_id"], row["member_slug"]),
                "surname": row["slcr_surname"],
                "name": row["slcr_name"],
                "race_code": row["race_code"],
            },
            "changes": changes,
            "note": row["note"],
            "applied_at": row["applied_at"].isoformat() if row["applied_at"] else None,
        })
    return items
