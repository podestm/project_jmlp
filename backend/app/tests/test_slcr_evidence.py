"""Zakládání závodů v evidenci SLČR - app/services/slcr_evidence.py a
app/routers/timekeeper/slcr.py.

Evidence se v testech nevolá: služba se nahradí podvrhem. Hlídá se hlavně,
že se do evidence pošle celý seznam závodů akce (stávající beze změny), nové
závody mají kodex = id naší kategorie a nic se nezaloží dvakrát.
"""
from datetime import date

import pytest

from app import models
from app.services import slcr_evidence
from app.utils import get_current_season_id

STAVAJICI = {
    "id": 46337, "name": "OPEN Ženy", "code": None, "codex": None, "sex": "Female",
    "date": "2026-10-18", "startTime": "10:00:00", "distance": None, "state": "Published",
    "registrationLimit": None, "type": None, "discipline": {"id": 26, "name": "Trenink"}, "technique": None,
    "documents": [{"id": 5, "variant": "Propozice", "file": {"uuid": "abc"}}],
    "category": {"__typename": "PublicRacingRaceCategory", "name": "Open Ženy", "sex": "Female",
                 "yearFrom": 1900, "yearTo": 2005},
}
KATEGORIE = [
    {"id": 8, "name": "Přípravka dívky", "sex": 2, "year_from": 2017, "year_to": 2018},
    {"id": 20, "name": "OPEN ženy", "sex": 2, "year_from": 1900, "year_to": 2005},
]


def test_plan_zalozi_chybejici_a_doplni_kodex_podle_nazvu():
    plan = slcr_evidence.plan_races(KATEGORIE, [STAVAJICI], date(2026, 10, 18), "09:30:00", 18)

    assert [(item["category_id"], item["action"]) for item in plan] == [(8, "create"), (20, "codex")]
    nova = plan[0]["input"]
    assert nova == {
        "discipline": 18,
        "category": {"manual": {"name": "Přípravka dívky", "sex": "Female", "yearFrom": 2017, "yearTo": 2018}},
        "name": "Přípravka dívky", "codex": "8", "date": "2026-10-18", "startTime": "09:30:00",
        "state": "Published", "documents": [],
    }
    assert plan[1]["slcr_race_id"] == 46337


def test_zavod_s_kodexem_se_nemeni():
    # Evidence kodex ukládá doplněný nulami.
    s_kodexem = {**STAVAJICI, "name": "Cokoliv", "codex": "0020"}
    plan = slcr_evidence.plan_races(KATEGORIE[1:], [s_kodexem], date(2026, 10, 18))
    assert plan[0]["action"] == "keep"


def test_do_evidence_jde_cely_seznam_stavajici_beze_zmeny():
    plan = slcr_evidence.plan_races(KATEGORIE, [STAVAJICI], date(2026, 10, 18))
    inputs = slcr_evidence.build_inputs([STAVAJICI], plan)

    assert len(inputs) == 2
    stavajici = inputs[0]
    assert stavajici["id"] == 46337
    assert stavajici["codex"] == "20"
    assert stavajici["discipline"] == 26
    assert stavajici["category"] == {"manual": {"name": "Open Ženy", "sex": "Female", "yearFrom": 1900, "yearTo": 2005}}
    assert stavajici["documents"] == [{"id": 5, "variant": "Propozice", "file": "abc"}]
    assert "id" not in inputs[1] and inputs[1]["codex"] == "8"


def test_mix_kategorie_je_both_a_ciselnikova_kategorie_zustava():
    assert slcr_evidence.racing_sex(0) == "Both"
    ciselnik = {**STAVAJICI, "category": {"__typename": "PublicRacingCategory", "id": 77}}
    assert slcr_evidence.existing_race_input(ciselnik)["category"] == {"codebook": 77}


# --------------------------------------------------------------------------
# Endpointy časomíry
# --------------------------------------------------------------------------

@pytest.fixture
def zavod(db):
    zavod = models.Race(race_nr="JMLP2026-03", datum=date(2026, 10, 18), season_id=get_current_season_id(),
                        closed=False, registration=True, race_method_id=1, is_live=False)
    kategorie = models.Category(name="U10", display_name="Přípravka dívky", min_birth_year=2017,
                                max_birth_year=2018, sex=2, active=True)
    zavodnice = models.Racer(name="Anna", surname="Holcicka", year=2017, sex=2)
    db.add_all([zavod, kategorie, zavodnice])
    db.commit()
    # Zakládají se jen kategorie, ve kterých někdo je na startovce.
    db.add(models.StartListEntry(race_id=zavod.id, racer_id=zavodnice.id, category_id=kategorie.id))
    db.commit()
    db.refresh(zavod)
    return zavod


@pytest.fixture
def evidence(monkeypatch):
    stav = {"event": {"id": 7193, "name": "JMLP Fitness Run", "categoryMode": "Manual",
                      "date": {"from": "2026-10-18"}, "races": [STAVAJICI]},
            "poslano": []}

    def fetch_event(event_id, *args, **kwargs):
        return stav["event"]

    def update_races(event_id, inputs, *args, **kwargs):
        stav["poslano"].append((event_id, inputs))
        stav["event"] = {**stav["event"], "races": [
            {**STAVAJICI, **{k: v for k, v in item.items() if k in ("name", "codex")}, "id": item.get("id") or 99}
            for item in inputs
        ]}
        return {}

    monkeypatch.setattr(slcr_evidence, "fetch_event", fetch_event)
    monkeypatch.setattr(slcr_evidence, "update_races", update_races)
    return stav


def test_zalozeni_zavodu_z_casomiry(client, timekeeper_headers, zavod, evidence):
    nahled = client.get(f"/api/timekeeper/races/{zavod.id}/slcr/plan", params={"event_id": 7193},
                        headers=timekeeper_headers)
    assert nahled.status_code == 200, nahled.text
    assert [item["action"] for item in nahled.json()["items"]] == ["create"]

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/slcr/races", json={"event_id": 7193},
                          headers=timekeeper_headers)
    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["created"] == 1
    (event_id, inputs), = evidence["poslano"]
    assert event_id == 7193
    assert [item.get("id") for item in inputs] == [46337, None]
    assert [item["action"] for item in odpoved.json()["items"]] == ["keep"]

    # Podruhé se nic neposílá.
    znovu = client.post(f"/api/timekeeper/races/{zavod.id}/slcr/races", json={"event_id": 7193},
                        headers=timekeeper_headers)
    assert znovu.json()["created"] == 0
    assert len(evidence["poslano"]) == 1


def test_akce_s_ciselnikovymi_kategoriemi_se_odmitne(client, timekeeper_headers, zavod, evidence):
    evidence["event"]["categoryMode"] = "Codebook"
    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/slcr/races", json={"event_id": 7193},
                          headers=timekeeper_headers)
    assert odpoved.status_code == 409
    assert evidence["poslano"] == []


def test_stav_neprozrazuje_hodnoty(client, timekeeper_headers, monkeypatch):
    monkeypatch.setenv("SLCR_API_TOKEN", "tajne")
    monkeypatch.delenv("SLCR_USERNAME", raising=False)
    odpoved = client.get("/api/timekeeper/slcr/status", headers=timekeeper_headers).json()
    assert odpoved["token"] is True and odpoved["login"] is False
    assert "tajne" not in str(odpoved)


# --- výběr akcí: jen ty, které měří naše měřící skupina ---------------------

def test_vlastni_akce_podle_meric_skupiny():
    nase = {"timekeepingCompany": {"id": 44, "name": "Měřící skupina JMLP"}}
    assert slcr_evidence.is_own_event(nase)
    assert slcr_evidence.is_own_event({"timekeepingCompany": {"id": 44, "name": "Merici skupina jmlp"}})
    assert not slcr_evidence.is_own_event({"timekeepingCompany": {"id": 7, "name": "Jiná časomíra"}})
    assert not slcr_evidence.is_own_event({"timekeepingCompany": None})
    assert not slcr_evidence.is_own_event({})


def test_seznam_akci_necha_jen_nase(monkeypatch):
    owners = {
        7203: {"timekeepingCompany": None, "region": {"name": "Jihočeský kraj"}},
        7178: {"timekeepingCompany": {"id": 44, "name": "Měřící skupina JMLP"}, "region": {"name": "Jihomoravský kraj"}},
    }
    monkeypatch.setattr(slcr_evidence, "_login", lambda client, config: "token")
    monkeypatch.setattr(
        slcr_evidence, "_graphql",
        lambda client, query, variables, token=None: ({"publicRacingEvent": owners[variables["event"]]}, None),
    )
    config = slcr_evidence.Settings(api_token="t", username="u", password="p")
    events = [{"id": 7203, "name": "Oddílové závody"}, {"id": 7178, "name": "JMLP Kraví hora"}]
    assert slcr_evidence.own_events(events, config) == [{"id": 7178, "name": "JMLP Kraví hora"}]
    assert slcr_evidence.own_events([], config) == []
