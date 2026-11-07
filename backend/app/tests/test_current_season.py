"""Aktuální sezóna - fuj_jmlp_season.is_current, services/seasons.py.

Aktuální je nejvýš jedna sezóna a nastavuje ji správce. Dokud žádná
označená není, platí sezóna podle data (hranice 1. 8.).
"""

from datetime import date

from sqlalchemy import text

from app import models
from app.database import engine
from app.migrations import _column_exists, _m_season_current
from app.services import seasons as season_service
from app.utils import get_current_season_id

PODLE_DATA = get_current_season_id()


def _sezona(db, year_start, is_current=False, edition=None):
    season = models.Season(
        year_start=year_start,
        year_end=year_start + 1,
        edition=edition if edition is not None else year_start - 2006,
        name="Jihomoravský lyžařský pohár",
        is_current=is_current,
    )
    db.add(season)
    db.commit()
    db.refresh(season)
    return season


def _aktualni(db):
    return [
        row.year_start
        for row in db.execute(text("SELECT year_start FROM fuj_jmlp_season WHERE is_current = 1"))
    ]


def _zavod(db, race_nr, season_id):
    race = models.Race(
        race_nr=race_nr,
        datum=date(season_id, 12, 20),
        season_id=season_id,
        closed=False,
        registration=True,
        race_method_id=1,
    )
    db.add(race)
    db.commit()
    return race


# --------------------------------------------------------------------------
# Migrace
# --------------------------------------------------------------------------
def test_migrace_prejmenuje_aktivni_a_oznaci_sezonu_podle_data(db):
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE fuj_jmlp_season "
                "CHANGE COLUMN is_current active TINYINT(1) NOT NULL DEFAULT 1"
            )
        )
        for year in (PODLE_DATA - 1, PODLE_DATA, PODLE_DATA + 1):
            conn.execute(
                text(
                    "INSERT INTO fuj_jmlp_season (year_start, year_end, name, active) "
                    "VALUES (:y, :y + 1, 'JMLP', 1)"
                ),
                {"y": year},
            )
    try:
        with engine.begin() as conn:
            _m_season_current(conn)

            assert _column_exists(conn, "fuj_jmlp_season", "is_current")
            assert not _column_exists(conn, "fuj_jmlp_season", "active")
            assert [
                r.year_start
                for r in conn.execute(
                    text("SELECT year_start FROM fuj_jmlp_season WHERE is_current = 1")
                )
            ] == [PODLE_DATA]

            # Druhý běh nic nemění (ani ruční volbu správce).
            conn.execute(
                text("UPDATE fuj_jmlp_season SET is_current = (year_start = :y)"),
                {"y": PODLE_DATA - 1},
            )
            _m_season_current(conn)
            assert [
                r.year_start
                for r in conn.execute(
                    text("SELECT year_start FROM fuj_jmlp_season WHERE is_current = 1")
                )
            ] == [PODLE_DATA - 1]
    finally:
        with engine.begin() as conn:
            if not _column_exists(conn, "fuj_jmlp_season", "is_current"):
                _m_season_current(conn)


def test_migrace_bez_sezony_podle_data_neoznaci_zadnou(db):
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE fuj_jmlp_season "
                "CHANGE COLUMN is_current active TINYINT(1) NOT NULL DEFAULT 1"
            )
        )
        conn.execute(
            text(
                "INSERT INTO fuj_jmlp_season (year_start, year_end, name, active) "
                "VALUES (:y, :y + 1, 'JMLP', 1)"
            ),
            {"y": PODLE_DATA - 5},
        )
        _m_season_current(conn)

    assert _aktualni(db) == []
    assert season_service.current_season_id(db) == PODLE_DATA


# --------------------------------------------------------------------------
# Pomocník a invariant "nejvýš jedna"
# --------------------------------------------------------------------------
def test_bez_oznacene_sezony_plati_sezona_podle_data(db):
    _sezona(db, PODLE_DATA - 1)

    assert season_service.flagged_season_id(db) is None
    assert season_service.current_season_id(db) == PODLE_DATA


def test_oznacena_sezona_ma_prednost_pred_datem(db):
    _sezona(db, PODLE_DATA - 1, is_current=True)
    _sezona(db, PODLE_DATA)

    assert season_service.current_season_id(db) == PODLE_DATA - 1


def test_nastaveni_aktualni_sezony_zrusi_priznak_ostatnim(db):
    starsi = _sezona(db, PODLE_DATA - 1, is_current=True)
    novejsi = _sezona(db, PODLE_DATA)

    season_service.set_current_season(db, novejsi.id)
    assert _aktualni(db) == [PODLE_DATA]

    season_service.set_current_season(db, starsi.id)
    assert _aktualni(db) == [PODLE_DATA - 1]


# --------------------------------------------------------------------------
# Endpointy
# --------------------------------------------------------------------------
def test_endpoint_nastavi_aktualni_sezonu(client, admin_headers, db):
    _sezona(db, PODLE_DATA, is_current=True)
    stara = _sezona(db, PODLE_DATA - 1)

    response = client.post(f"/api/admin/seasons/{stara.id}/current", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["is_current"] is True
    assert _aktualni(db) == [PODLE_DATA - 1]
    seznam = client.get("/api/admin/seasons", headers=admin_headers).json()
    assert [(s["year_start"], s["is_current"]) for s in seznam] == [
        (PODLE_DATA, False),
        (PODLE_DATA - 1, True),
    ]


def test_endpoint_neexistujici_sezony_konci_404(client, admin_headers, db):
    sezona = _sezona(db, PODLE_DATA, is_current=True)

    response = client.post("/api/admin/seasons/98765/current", headers=admin_headers)

    assert response.status_code == 404
    db.refresh(sezona)
    assert _aktualni(db) == [PODLE_DATA]


def test_aktualni_sezonu_smi_nastavit_jen_admin(client, timekeeper_headers, db):
    sezona = _sezona(db, PODLE_DATA)

    response = client.post(f"/api/admin/seasons/{sezona.id}/current", headers=timekeeper_headers)

    assert response.status_code == 403
    assert _aktualni(db) == []


def test_aktualni_sezonu_nelze_smazat(client, admin_headers, db):
    sezona = _sezona(db, PODLE_DATA, is_current=True)

    response = client.delete(f"/api/admin/seasons/{sezona.id}", headers=admin_headers)

    assert response.status_code == 409
    assert _aktualni(db) == [PODLE_DATA]


def test_verejna_aktualni_sezona_bere_oznacenou(client, db):
    _sezona(db, PODLE_DATA)
    _sezona(db, PODLE_DATA - 1, is_current=True, edition=42)
    _zavod(db, "LETOS", PODLE_DATA)
    _zavod(db, "LONI", PODLE_DATA - 1)

    data = client.get("/races/season/current").json()

    assert data["current_season_id"] == PODLE_DATA - 1
    assert data["edition"] == 42
    assert data["edition_label"] == "XLII."
    assert data["is_set"] is True
    assert [
        r["race_nr"] for r in client.get("/races/", params={"current_season": True}).json()
    ] == ["LONI"]


def test_verejna_aktualni_sezona_bez_oznaceni_podle_data(client, db):
    _sezona(db, PODLE_DATA)

    data = client.get("/races/season/current").json()

    assert data["current_season_id"] == PODLE_DATA
    assert data["edition"] == PODLE_DATA - 2006
    assert data["is_set"] is False
