"""Zápis naměřených časů.

Nejcitlivější místo aplikace: rozhodčí zadává časy z tabletu, který může být
offline, a zápis se pak přehrává z fronty. Testuje se proto nejen "uložilo se",
ale hlavně tři věci, na kterých ta fronta stojí:

  * revize (base_revision) - zápis proti zastaralým datům musí skončit 409,
  * force_apply - vědomé přepsání po vyřešení konfliktu,
  * idempotence - dvojí odeslání téhož požadavku smí zapsat jen jednou.
"""
from decimal import Decimal

import pytest

from app import models


def _zavod(db, race_nr="JMLP2026-09"):
    # closed, registration a race_method_id jsou v legacy schématu NOT NULL
    # bez výchozí hodnoty, takže je musí doplnit i test.
    zavod = models.Race(
        race_nr=race_nr, datum="2026-02-01", season_id=2025,
        closed=False, registration=True, race_method_id=1,
    )
    db.add(zavod)
    db.commit()
    db.refresh(zavod)
    return zavod


def _kategorie(db):
    kategorie = models.Category(
        name="Open", sex=0, min_birth_year=1950, max_birth_year=2020, active=True
    )
    db.add(kategorie)
    db.commit()
    db.refresh(kategorie)
    return kategorie


def _zavodnik(db, name, surname, category_id):
    zavodnik = models.Racer(
        name=name, surname=surname, year=2000, sex=1, category_id=category_id
    )
    db.add(zavodnik)
    db.commit()
    db.refresh(zavodnik)
    return zavodnik


def _polozka(db, zavod, zavodnik, start_number=1):
    polozka = models.StartListEntry(
        race_id=zavod.id,
        racer_id=zavodnik.id,
        category_id=zavodnik.category_id,
        start_number=start_number,
    )
    db.add(polozka)
    db.commit()
    db.refresh(polozka)
    return polozka


@pytest.fixture
def zavod(db):
    return _zavod(db)


@pytest.fixture
def polozky(db, zavod):
    kategorie = _kategorie(db)
    return [
        _polozka(db, zavod, _zavodnik(db, "Jan", "Novak", kategorie.id), 1),
        _polozka(db, zavod, _zavodnik(db, "Petr", "Svoboda", kategorie.id), 2),
    ]


# ---------------------------------------------------------------------------
# Zápis jednoho času
# ---------------------------------------------------------------------------

def test_zapis_casu_secte_obe_jizdy(client, db, polozky, timekeeper_headers):
    odpoved = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 30.5, "time2": 29.5},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 200
    db.refresh(polozky[0])
    assert polozky[0].time_sum == Decimal("60.00")


def test_jedina_jizda_je_celkovym_casem(client, db, polozky, timekeeper_headers):
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 30.5},
        headers=timekeeper_headers,
    )

    db.refresh(polozky[0])
    assert polozky[0].time_sum == Decimal("30.50")


@pytest.mark.parametrize("priznak", ["dnf", "dns", "dsq"])
def test_priznak_rusi_celkovy_cas(client, db, polozky, timekeeper_headers, priznak):
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 30.5, "time2": 29.5, priznak: True},
        headers=timekeeper_headers,
    )

    db.refresh(polozky[0])
    assert polozky[0].time_sum is None
    assert getattr(polozky[0], priznak) is True


@pytest.mark.parametrize("nula", [0, 0.0, "0.00"])
def test_nulovy_cas_se_ulozi_jako_prazdny(client, db, polozky, timekeeper_headers, nula):
    odpoved = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 30.5, "time2": nula},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 200
    db.refresh(polozky[0])
    assert polozky[0].time2 is None
    assert polozky[0].time_sum == Decimal("30.50")


def test_hromadny_zapis_nulu_ulozi_jako_prazdny_cas(client, db, zavod, polozky, timekeeper_headers):
    client.post(
        f"/api/timekeeper/races/{zavod.id}/times",
        json={"entries": [{"entry_id": polozky[0].id, "time1": 0, "time2": 0.0,
                           "dnf": False, "dns": False, "dsq": False}]},
        headers=timekeeper_headers,
    )

    db.refresh(polozky[0])
    assert polozky[0].time1 is None
    assert polozky[0].time2 is None
    assert polozky[0].time_sum is None


def test_odpoved_nese_revizi_pro_dalsi_zapis(client, polozky, timekeeper_headers):
    odpoved = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 10},
        headers=timekeeper_headers,
    )

    assert odpoved.json()["revision"] is not None


def test_cas_neexistujici_polozce_je_404(client, timekeeper_headers):
    odpoved = client.put(
        "/api/timekeeper/start-list/999999/time",
        json={"time1": 10},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 404


def test_zapis_casu_bez_prihlaseni_neprojde(client, polozky):
    odpoved = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time", json={"time1": 10}
    )
    assert odpoved.status_code == 403


# ---------------------------------------------------------------------------
# Souběžná úprava (base_revision)
# ---------------------------------------------------------------------------

def test_zapis_proti_zastarale_revizi_konci_konfliktem(client, polozky, timekeeper_headers):
    prvni = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 10},
        headers=timekeeper_headers,
    )
    zastarala = "2020-01-01T00:00:00"

    druhy = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 20, "base_revision": zastarala},
        headers=timekeeper_headers,
    )

    assert prvni.status_code == 200
    assert druhy.status_code == 409
    assert druhy.json()["detail"]["entry_id"] == polozky[0].id


def test_zastarala_revize_se_stejnou_hodnotou_neni_konflikt(client, db, polozky, timekeeper_headers):
    """Fronta čas mezitím doručila, nebo přišel z impulzu i ručně: stejná
    hodnota pod starším razítkem se uloží bez konfliktu a vrátí novou revizi."""
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 219.6, "time2": None, "dnf": False, "dns": False, "dsq": False},
        headers=timekeeper_headers,
    )

    odpoved = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 219.60, "time2": None, "dnf": False, "dns": False, "dsq": False,
              "base_revision": "2020-01-01T00:00:00"},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 200
    assert odpoved.json()["revision"] is not None
    db.refresh(polozky[0])
    assert polozky[0].time1 == Decimal("219.60")


def test_zastarala_revize_s_jinym_priznakem_je_konflikt(client, polozky, timekeeper_headers):
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 30.5},
        headers=timekeeper_headers,
    )

    odpoved = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 30.5, "dnf": True, "base_revision": "2020-01-01T00:00:00"},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 409


def test_hromadny_zapis_se_stejnou_hodnotou_a_starou_revizi_projde(client, zavod, polozky, timekeeper_headers):
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 41.2},
        headers=timekeeper_headers,
    )

    odpoved = client.post(
        f"/api/timekeeper/races/{zavod.id}/times",
        json={"entries": [{
            "entry_id": polozky[0].id, "time1": 41.2, "time2": None,
            "dnf": False, "dns": False, "dsq": False,
            "base_revision": "2020-01-01T00:00:00", "force_apply": False,
        }]},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 200


def test_zapis_se_spravnou_revizi_projde(client, polozky, timekeeper_headers):
    prvni = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 10},
        headers=timekeeper_headers,
    )
    revize = prvni.json()["revision"]

    druhy = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 20, "base_revision": revize},
        headers=timekeeper_headers,
    )

    assert druhy.status_code == 200


def test_zapis_bez_revize_projde(client, polozky, timekeeper_headers):
    """Offline zápis revizi vědomě nenese - fronta se přehrává v pořadí vzniku."""
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 10},
        headers=timekeeper_headers,
    )

    odpoved = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 20},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 200


def test_force_apply_konflikt_prebije(client, db, polozky, timekeeper_headers):
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 10},
        headers=timekeeper_headers,
    )

    odpoved = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 20, "base_revision": "2020-01-01T00:00:00", "force_apply": True},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 200
    db.refresh(polozky[0])
    assert polozky[0].time1 == Decimal("20.00")


# ---------------------------------------------------------------------------
# Hromadný zápis
# ---------------------------------------------------------------------------

def test_hromadny_zapis_ulozi_vsechny_polozky(client, db, zavod, polozky, timekeeper_headers):
    odpoved = client.post(
        f"/api/timekeeper/races/{zavod.id}/times",
        json={"entries": [
            {"entry_id": polozky[0].id, "time1": 10, "time2": 11},
            {"entry_id": polozky[1].id, "time1": 12, "time2": 13},
        ]},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 200
    assert odpoved.json()["updated"] == 2
    db.refresh(polozky[0])
    db.refresh(polozky[1])
    assert polozky[0].time_sum == Decimal("21.00")
    assert polozky[1].time_sum == Decimal("25.00")


def test_hromadny_zapis_vraci_revizi_ke_kazdemu_radku(client, zavod, polozky, timekeeper_headers):
    """Jedna společná revize by patřila každému řádku špatně a další zápis
    do kteréhokoli z nich by skončil 409."""
    odpoved = client.post(
        f"/api/timekeeper/races/{zavod.id}/times",
        json={"entries": [
            {"entry_id": polozky[0].id, "time1": 10},
            {"entry_id": polozky[1].id, "time1": 12},
        ]},
        headers=timekeeper_headers,
    )

    revize = odpoved.json()["revisions"]
    assert set(revize) == {str(polozky[0].id), str(polozky[1].id)}
    assert all(v is not None for v in revize.values())


def test_revize_z_hromadneho_zapisu_plati_pro_dalsi_zapis(client, zavod, polozky, timekeeper_headers):
    davka = client.post(
        f"/api/timekeeper/races/{zavod.id}/times",
        json={"entries": [{"entry_id": polozky[0].id, "time1": 10}]},
        headers=timekeeper_headers,
    )
    revize = davka.json()["revisions"][str(polozky[0].id)]

    dalsi = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 11, "base_revision": revize},
        headers=timekeeper_headers,
    )

    assert dalsi.status_code == 200


def test_hromadny_zapis_preskoci_cizi_polozku(client, db, zavod, polozky, timekeeper_headers):
    jiny_zavod = _zavod(db, race_nr="JMLP2026-10")
    kategorie = db.query(models.Category).first()
    cizi = _polozka(db, jiny_zavod, _zavodnik(db, "Cizi", "Zavodnik", kategorie.id), 1)

    odpoved = client.post(
        f"/api/timekeeper/races/{zavod.id}/times",
        json={"entries": [
            {"entry_id": polozky[0].id, "time1": 10},
            {"entry_id": cizi.id, "time1": 99},
        ]},
        headers=timekeeper_headers,
    )

    assert odpoved.json()["updated"] == 1
    db.refresh(cizi)
    assert cizi.time1 is None


def test_hromadny_zapis_neexistujicimu_zavodu_je_404(client, timekeeper_headers):
    odpoved = client.post(
        "/api/timekeeper/races/999999/times",
        json={"entries": []},
        headers=timekeeper_headers,
    )
    assert odpoved.status_code == 404


# ---------------------------------------------------------------------------
# Idempotence
# ---------------------------------------------------------------------------

def test_dvoji_odeslani_tehoz_zapisu_ulozi_jednou(client, db, polozky, timekeeper_headers):
    """Přehrávka z offline fronty nese stejný klíč jako původní pokus. Když
    první požadavek dorazil a jen se ztratila odpověď, nesmí se zapsat dvakrát."""
    hlavicky = {**timekeeper_headers, "X-Idempotency-Key": "op-1"}
    telo = {"time1": 10}

    prvni = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time", json=telo, headers=hlavicky
    )
    # Mezitím někdo hodnotu změnil; přehrávka ji nesmí přepsat zpátky.
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 55},
        headers=timekeeper_headers,
    )
    druhy = client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time", json=telo, headers=hlavicky
    )

    assert prvni.status_code == 200
    assert druhy.status_code == 200
    assert druhy.json()["idempotency_replayed"] is True
    db.refresh(polozky[0])
    assert polozky[0].time1 == Decimal("55.00")


def test_ruzne_klice_zapisuji_oba(client, db, polozky, timekeeper_headers):
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 10},
        headers={**timekeeper_headers, "X-Idempotency-Key": "op-a"},
    )
    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 20},
        headers={**timekeeper_headers, "X-Idempotency-Key": "op-b"},
    )

    db.refresh(polozky[0])
    assert polozky[0].time1 == Decimal("20.00")


def test_idempotence_plati_i_pro_hromadny_zapis(client, zavod, polozky, timekeeper_headers):
    hlavicky = {**timekeeper_headers, "X-Idempotency-Key": "davka-1"}
    telo = {"entries": [{"entry_id": polozky[0].id, "time1": 10}]}

    client.post(f"/api/timekeeper/races/{zavod.id}/times", json=telo, headers=hlavicky)
    druhy = client.post(f"/api/timekeeper/races/{zavod.id}/times", json=telo, headers=hlavicky)

    assert druhy.json()["idempotency_replayed"] is True


def test_stejny_klic_na_jinem_endpointu_se_neplete(client, zavod, polozky, timekeeper_headers):
    hlavicky = {**timekeeper_headers, "X-Idempotency-Key": "sdileny"}

    client.put(
        f"/api/timekeeper/start-list/{polozky[0].id}/time",
        json={"time1": 10},
        headers=hlavicky,
    )
    davka = client.post(
        f"/api/timekeeper/races/{zavod.id}/times",
        json={"entries": [{"entry_id": polozky[1].id, "time1": 20}]},
        headers=hlavicky,
    )

    assert davka.json()["idempotency_replayed"] is False
    assert davka.json()["updated"] == 1
