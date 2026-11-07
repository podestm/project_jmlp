"""Výsledky do evidence SLČR po kategoriích a zkušební režim -
app/services/slcr_evidence.py a app/routers/timekeeper/slcr.py.

Evidence se nevolá: služba se nahradí podvrhem a ve zkušebním režimu se
hlídá, že zápis vůbec nesáhne na httpx.
"""

from datetime import date
from decimal import Decimal

import httpx
import pytest

from app import models
from app.services import slcr_evidence
from app.utils import get_current_season_id

EVENT_ID = 7193


@pytest.fixture(autouse=True)
def cisty_stav(monkeypatch):
    monkeypatch.delenv("SLCR_DRY_RUN", raising=False)
    slcr_evidence._DRY.reset()
    slcr_evidence._PUBLISHED_AT.clear()
    yield
    slcr_evidence._DRY.reset()


@pytest.fixture
def zavod(db):
    """Závod se dvěma obsazenými kategoriemi a jednou prázdnou."""
    zavod = models.Race(
        race_nr="JMLP2026-04",
        datum=date(2026, 10, 18),
        season_id=get_current_season_id(),
        closed=False,
        registration=True,
        race_method_id=1,
        is_live=False,
    )
    divky = models.Category(
        name="U10",
        display_name="Přípravka dívky",
        min_birth_year=2017,
        max_birth_year=2018,
        sex=2,
        active=True,
    )
    hosi = models.Category(
        name="U10H",
        display_name="Přípravka hoši",
        min_birth_year=2017,
        max_birth_year=2018,
        sex=1,
        active=True,
    )
    prazdna = models.Category(
        name="U8",
        display_name="Myšáci",
        min_birth_year=2019,
        max_birth_year=2020,
        sex=1,
        active=True,
    )
    db.add_all([zavod, divky, hosi, prazdna])
    db.commit()
    for i, (kategorie, cas, dnf) in enumerate(
        [
            (divky, Decimal("41.20"), False),
            (divky, None, True),
            (hosi, Decimal("39.80"), False),
            (hosi, None, False),
        ]
    ):
        racer = models.Racer(name=f"Jmeno{i}", surname=f"Prijmeni{i}", year=2017, sex=kategorie.sex)
        db.add(racer)
        db.commit()
        db.add(
            models.StartListEntry(
                race_id=zavod.id,
                racer_id=racer.id,
                category_id=kategorie.id,
                start_number=i + 1,
                racer_name=racer.name,
                racer_surname=racer.surname,
                racer_year=2017,
                racer_sex=kategorie.sex,
                time1=cas,
                time_sum=cas,
                dnf=dnf,
            )
        )
    db.commit()
    db.refresh(zavod)
    return {"zavod": zavod, "divky": divky.id, "hosi": hosi.id, "prazdna": prazdna.id}


def _race(race_id, codex, state=None):
    return {
        "id": race_id,
        "name": f"Závod {codex}",
        "codex": str(codex).zfill(4),
        "resultRace": {"id": race_id, "state": state} if state else None,
    }


@pytest.fixture
def evidence(monkeypatch, zavod):
    stav = {
        "event": {
            "id": EVENT_ID,
            "name": "JMLP Kraví hora",
            "categoryMode": "Manual",
            "date": {"from": "2026-10-18"},
            "races": [_race(501, zavod["divky"]), _race(502, zavod["hosi"], "Published")],
        },
        "publikovano": [],
    }

    monkeypatch.setattr(slcr_evidence, "fetch_event", lambda event_id, *a, **k: stav["event"])

    def publish(event_id, race_id, xml, layout=None, config=None):
        stav["publikovano"].append((event_id, race_id, xml, layout))
        return "Published"

    monkeypatch.setattr(slcr_evidence, "publish_race_results", publish)
    return stav


# --- ráno: zakládají se jen obsazené kategorie ------------------------------


def test_plan_preskoci_prazdnou_kategorii():
    kategorie = [
        {"id": 8, "name": "Přípravka dívky", "sex": 2, "entries": 3},
        {"id": 9, "name": "Myšáci", "sex": 1, "entries": 0},
    ]
    plan = slcr_evidence.plan_races(kategorie, [], date(2026, 10, 18))
    assert [(item["category_id"], item["action"]) for item in plan] == [(8, "create"), (9, "skip")]
    assert plan[1]["reason"] == slcr_evidence.SKIP_REASON
    assert len(slcr_evidence.build_inputs([], plan)) == 1


def test_prazdna_kategorie_s_hotovym_zavodem_zustava():
    hotovy = {"id": 77, "name": "Myšáci", "codex": "0009"}
    plan = slcr_evidence.plan_races(
        [{"id": 9, "name": "Myšáci", "entries": 0}], [hotovy], date(2026, 10, 18)
    )
    assert plan[0]["action"] == "keep"


def test_nahled_ukaze_preskocene(client, timekeeper_headers, zavod, monkeypatch):
    monkeypatch.setattr(
        slcr_evidence,
        "fetch_event",
        lambda *a, **k: {"id": EVENT_ID, "name": "Akce", "categoryMode": "Manual", "races": []},
    )
    odpoved = client.get(
        f"/api/timekeeper/races/{zavod['zavod'].id}/slcr/plan",
        params={"event_id": EVENT_ID},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 200, odpoved.text
    akce = {item["category_id"]: item["action"] for item in odpoved.json()["items"]}
    assert akce[zavod["divky"]] == "create" and akce[zavod["hosi"]] == "create"
    assert akce[zavod["prazdna"]] == "skip"


# --- během závodu: stav po kategoriích --------------------------------------


def test_stav_kategorii(client, timekeeper_headers, zavod, evidence):
    odpoved = client.get(
        f"/api/timekeeper/races/{zavod['zavod'].id}/slcr/categories",
        params={"event_id": EVENT_ID},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 200, odpoved.text
    data = odpoved.json()
    assert data["dry_run"] is False
    kategorie = {item["category_id"]: item for item in data["categories"]}
    assert zavod["prazdna"] not in kategorie
    divky, hosi = kategorie[zavod["divky"]], kategorie[zavod["hosi"]]
    assert (divky["total"], divky["missing"], divky["ready"]) == (2, 0, True)
    assert (divky["slcr_race_id"], divky["slcr_state"]) == (501, None)
    assert (hosi["missing"], hosi["ready"], hosi["slcr_state"]) == (1, False, "Published")


def test_kategorie_bez_casu_se_neposle(client, timekeeper_headers, zavod, evidence):
    odpoved = client.post(
        f"/api/timekeeper/races/{zavod['zavod'].id}/slcr/categories/{zavod['hosi']}/publish",
        json={"event_id": EVENT_ID, "discipline": 18},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 409
    assert "1 závodník ještě nemá čas" in odpoved.json()["detail"]
    assert evidence["publikovano"] == []


def test_zverejneni_kategorie(client, timekeeper_headers, zavod, evidence):
    odpoved = client.post(
        f"/api/timekeeper/races/{zavod['zavod'].id}/slcr/categories/{zavod['divky']}/publish",
        json={"event_id": EVENT_ID, "discipline": 18},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 200, odpoved.text
    data = odpoved.json()
    assert data["corrected"] is False
    assert data["category"]["slcr_state"] == "Published"
    ((event_id, race_id, xml, layout),) = evidence["publikovano"]
    assert (event_id, race_id, layout) == (EVENT_ID, 501, "ALPINE_SKIING_INDIVIDUAL_SLALOM")
    # V souboru je jen tahle kategorie.
    text = xml.decode("utf-8")
    assert "Prijmeni0" in text and "Prijmeni2" not in text


def test_kategorie_bez_zavodu_v_akci(client, timekeeper_headers, zavod, evidence):
    evidence["event"]["races"] = [_race(502, zavod["hosi"])]
    odpoved = client.post(
        f"/api/timekeeper/races/{zavod['zavod'].id}/slcr/categories/{zavod['divky']}/publish",
        json={"event_id": EVENT_ID},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 409
    assert "Založit závody" in odpoved.json()["detail"]
    assert evidence["publikovano"] == []


def test_prazdna_kategorie_404(client, timekeeper_headers, zavod, evidence):
    odpoved = client.post(
        f"/api/timekeeper/races/{zavod['zavod'].id}/slcr/categories/{zavod['prazdna']}/publish",
        json={"event_id": EVENT_ID},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 404


# --- služba: přechody stavů v evidenci ---------------------------------------


@pytest.fixture
def podvrh_evidence(monkeypatch):
    """Evidence jako stavový automat: zaznamená volání v pořadí."""
    stav = {"state": None, "volani": []}

    def graphql(client, query, variables, token=None):
        for name in slcr_evidence.RESULT_MUTATIONS:
            if f"{name}(" in query:
                stav["volani"].append(name)
                stav["state"] = {
                    "resultRaceCheck": "Checked",
                    "resultRacePublish": "Published",
                    "resultRaceDraft": "Draft",
                }[name]
                return {name: {"id": 501, "resultRace": {"state": stav["state"]}}}, None
        race = {"id": 501, "resultRace": {"state": stav["state"]} if stav["state"] else None}
        return {"publicRacingEvent": {"id": EVENT_ID, "races": [race]}}, None

    def upload(event_id, xml, layout=None, config=None):
        stav["volani"].append("upload")
        if stav["state"] in (None, "Draft"):
            stav["state"] = "Draft"
        return {}

    monkeypatch.setattr(slcr_evidence, "_login", lambda client, config: "token")
    monkeypatch.setattr(slcr_evidence, "_graphql", graphql)
    monkeypatch.setattr(slcr_evidence, "upload_results", upload)
    return stav


CONFIG = slcr_evidence.Settings(api_token="t", username="u", password="p")


def test_nove_vysledky_se_zkontroluji_a_zverejni(podvrh_evidence):
    stav = slcr_evidence.publish_race_results(EVENT_ID, 501, b"<xml/>", config=CONFIG)
    assert stav == "Published"
    assert podvrh_evidence["volani"] == ["upload", "resultRaceCheck", "resultRacePublish"]
    assert slcr_evidence.published_at(501) is not None


def test_oprava_zverejnenych(podvrh_evidence):
    podvrh_evidence["state"] = "Published"
    slcr_evidence.publish_race_results(EVENT_ID, 501, b"<xml/>", config=CONFIG)
    assert podvrh_evidence["volani"] == [
        "resultRaceDraft",
        "upload",
        "resultRaceCheck",
        "resultRacePublish",
    ]


def test_zrusene_vysledky_se_nesahaji(podvrh_evidence):
    podvrh_evidence["state"] = "Canceled"
    with pytest.raises(slcr_evidence.SlcrError, match="zrušené"):
        slcr_evidence.publish_race_results(EVENT_ID, 501, b"<xml/>", config=CONFIG)
    assert podvrh_evidence["volani"] == []


def test_neprirazene_vysledky_jsou_chyba(podvrh_evidence, monkeypatch):
    monkeypatch.setattr(slcr_evidence, "upload_results", lambda *a, **k: {})
    with pytest.raises(slcr_evidence.SlcrError, match="nepřiřadila"):
        slcr_evidence.publish_race_results(EVENT_ID, 501, b"<xml/>", config=CONFIG)


def test_soubezne_odeslani_se_odmitne():
    with slcr_evidence.race_lock(501):
        with pytest.raises(slcr_evidence.SlcrBusy):
            with slcr_evidence.race_lock(501):
                pass
    with slcr_evidence.race_lock(501):
        pass


# --- zkušební režim ----------------------------------------------------------


class ZakazanySitovyKlient:
    def __init__(self, *args, **kwargs):
        raise AssertionError("ve zkušebním režimu se do evidence nic neposílá")


@pytest.fixture
def zkusebni(monkeypatch):
    monkeypatch.setenv("SLCR_DRY_RUN", "1")
    monkeypatch.setattr(httpx, "Client", ZakazanySitovyKlient)


def test_zkusebni_rezim_zapisy_neposila(zkusebni):
    inputs = [
        {
            "name": "Přípravka dívky",
            "codex": "8",
            "discipline": 26,
            "date": "2026-10-18",
            "category": {"manual": {"name": "Přípravka dívky", "sex": "Female"}},
        }
    ]
    vysledek = slcr_evidence.update_races(EVENT_ID, inputs, CONFIG)
    assert vysledek["dry_run"] is True
    assert slcr_evidence.upload_results(EVENT_ID, b"<xml/>", config=CONFIG)["dry_run"] is True
    novy_id = vysledek["races"][0]["id"]
    assert novy_id < 0
    assert (
        slcr_evidence.publish_race_results(EVENT_ID, novy_id, b"<xml/>", config=CONFIG)
        == "Published"
    )

    # Čtení akce zkušební zápisy promítne: závod je založený a zveřejněný.
    akce = slcr_evidence._DRY.overlay({"id": EVENT_ID, "races": []})
    zavod = slcr_evidence.find_race(akce["races"], 8)
    assert zavod["id"] == novy_id and slcr_evidence.result_state(zavod) == "Published"
    assert slcr_evidence.published_at(novy_id) is not None


def test_zkusebni_rezim_doplni_kodex_stavajicimu():
    slcr_evidence._DRY.update_races(EVENT_ID, [{"id": 46337, "name": "OPEN", "codex": "20"}])
    akce = slcr_evidence._DRY.overlay(
        {"id": EVENT_ID, "races": [{"id": 46337, "name": "OPEN", "codex": None}]}
    )
    assert [race["codex"] for race in akce["races"]] == ["20"]


def test_stav_hlasi_zkusebni_rezim(client, timekeeper_headers, monkeypatch):
    monkeypatch.setenv("SLCR_DRY_RUN", "1")
    assert (
        client.get("/api/timekeeper/slcr/status", headers=timekeeper_headers).json()["dry_run"]
        is True
    )
    monkeypatch.setenv("SLCR_DRY_RUN", "")
    assert (
        client.get("/api/timekeeper/slcr/status", headers=timekeeper_headers).json()["dry_run"]
        is False
    )


def test_zkusebni_rezim_cely_postup(client, timekeeper_headers, zavod, monkeypatch):
    """Založení závodů a zveřejnění kategorie bez jediného zápisu do evidence."""
    monkeypatch.setenv("SLCR_DRY_RUN", "1")
    akce = {
        "id": EVENT_ID,
        "name": "Akce",
        "categoryMode": "Manual",
        "date": {"from": "2026-10-18"},
        "races": [],
    }
    monkeypatch.setattr(slcr_evidence, "_login", lambda client, config: None)
    monkeypatch.setattr(
        slcr_evidence,
        "_graphql",
        lambda client, query, variables, token=None: ({"publicRacingEvent": akce}, None),
    )
    zavod_id = zavod["zavod"].id

    zalozeni = client.post(
        f"/api/timekeeper/races/{zavod_id}/slcr/races",
        json={"event_id": EVENT_ID},
        headers=timekeeper_headers,
    )
    assert zalozeni.status_code == 200, zalozeni.text
    assert zalozeni.json()["created"] == 2

    monkeypatch.setattr(httpx, "Client", ZakazanySitovyKlient)
    monkeypatch.setattr(
        slcr_evidence, "fetch_event", lambda event_id, *a, **k: slcr_evidence._DRY.overlay(akce)
    )
    odpoved = client.post(
        f"/api/timekeeper/races/{zavod_id}/slcr/categories/{zavod['divky']}/publish",
        json={"event_id": EVENT_ID},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["dry_run"] is True
    stav = client.get(
        f"/api/timekeeper/races/{zavod_id}/slcr/categories",
        params={"event_id": EVENT_ID},
        headers=timekeeper_headers,
    ).json()
    divky = next(item for item in stav["categories"] if item["category_id"] == zavod["divky"])
    assert divky["slcr_state"] == "Published" and divky["published_at"]
