"""Vyřazení ze startovky - PUT /api/timekeeper/start-list/{id}/excluded.

Závodník, který nedorazil nebo nestihl start, se ze startovky nemaže (při
pozdním příchodu by se musel zakládat znovu a přišel by o dres). Dostane
příznak `excluded`, a dokud ho má:

* není na veřejném webu ani ve výsledcích,
* pořadí a body ostatních se počítají, jako by nestartoval,
* v Listině časoměřiče zůstává (s příznakem), aby šel vrátit.

"Vrátit" ho obnoví i se vším, co u něj bylo zapsané. Zápis vyřazení přitom
neposouvá revizi řádku - ta hlídá souběžné zápisy časů a vyřazení časy nemění.
"""

from datetime import date, datetime

import pytest
from sqlalchemy import text

from app import models
from app.database import engine
from app.migrations import _column_exists, _m_start_list_excluded
from app.utils import get_current_season_id

STARTOVKA = "fuj_jmlp_race_start_list"


# --------------------------------------------------------------------------
# Pomocníci pro testovací data
# --------------------------------------------------------------------------


def _zavod(db, race_nr="JMLP2026-03", is_live=False):
    zavod = models.Race(
        race_nr=race_nr,
        datum=date.today(),
        season_id=get_current_season_id(),
        closed=False,
        registration=True,
        race_method_id=1,
        is_live=is_live,
    )
    db.add(zavod)
    db.commit()
    db.refresh(zavod)
    return zavod


def _kategorie(db):
    kategorie = models.Category(
        name="U10",
        display_name="Přípravka dívky",
        min_birth_year=2016,
        max_birth_year=2018,
        sex=2,
        active=True,
    )
    db.add(kategorie)
    db.commit()
    db.refresh(kategorie)
    return kategorie


def _zavodnik(db, name, surname):
    zavodnik = models.Racer(name=name, surname=surname, year=2017, sex=2)
    db.add(zavodnik)
    db.commit()
    db.refresh(zavodnik)
    return zavodnik


def _polozka(
    db,
    zavod,
    kategorie,
    name,
    surname,
    start_number,
    time1=None,
    time2=None,
    time_sum=None,
    points=None,
    excluded=False,
):
    zavodnik = _zavodnik(db, name, surname)
    polozka = models.StartListEntry(
        race_id=zavod.id,
        racer_id=zavodnik.id,
        category_id=kategorie.id,
        start_number=start_number,
        racer_name=name,
        racer_surname=surname,
        racer_year=zavodnik.year,
        racer_sex=zavodnik.sex,
        category_name=kategorie.display_name,
        category_sex=kategorie.sex,
        time1=time1,
        time2=time2,
        time_sum=time_sum,
        points=points,
        excluded=excluded,
    )
    db.add(polozka)
    db.commit()
    db.refresh(polozka)
    return polozka


def _vyradit(client, polozka, hlavicky, excluded=True, idempotency_key=None):
    hlavicky = dict(hlavicky)
    if idempotency_key:
        hlavicky["X-Idempotency-Key"] = idempotency_key
    return client.put(
        f"/api/timekeeper/start-list/{polozka.id}/excluded",
        json={"excluded": excluded},
        headers=hlavicky,
    )


def _ulozeny_radek(db, polozka):
    """Přímo z tabulky - identity mapa session by vrátila stav před voláním API."""
    return db.execute(
        text(
            f"SELECT excluded, time1, time_sum, points, updated_at FROM {STARTOVKA} WHERE id = :id"
        ),
        {"id": polozka.id},
    ).first()


@pytest.fixture
def zavod(db):
    return _zavod(db)


@pytest.fixture
def kategorie(db):
    return _kategorie(db)


@pytest.fixture
def tri_zavodnice(db, zavod, kategorie):
    """Nejrychlejší z nich (Rychla) se nakonec nepostaví na start."""
    return {
        "rychla": _polozka(
            db,
            zavod,
            kategorie,
            "Anna",
            "Rychla",
            1,
            time1=29.0,
            time2=29.0,
            time_sum=58.0,
            points=100,
        ),
        "druha": _polozka(
            db,
            zavod,
            kategorie,
            "Bara",
            "Druha",
            2,
            time1=30.0,
            time2=30.0,
            time_sum=60.0,
            points=80,
        ),
        "treti": _polozka(
            db,
            zavod,
            kategorie,
            "Cilka",
            "Treti",
            3,
            time1=30.5,
            time2=31.0,
            time_sum=61.5,
            points=60,
        ),
    }


# --------------------------------------------------------------------------
# Vyřazení a vrácení
# --------------------------------------------------------------------------


def test_vyrazeny_zustane_na_startovce_s_priznakem(client, db, tri_zavodnice, timekeeper_headers):
    rychla = tri_zavodnice["rychla"]

    odpoved = _vyradit(client, rychla, timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["message"] == "Závodník vyřazen ze startovní listiny"
    assert odpoved.json()["entry"]["excluded"] is True
    assert odpoved.json()["idempotency_replayed"] is False

    # Listina časoměřiče ho dál vidí - jen tam se dá vrátit.
    vypis = client.get(
        f"/api/timekeeper/races/{rychla.race_id}/start-list", headers=timekeeper_headers
    ).json()
    assert {r["racer_surname"]: r["excluded"] for r in vypis} == {
        "Rychla": True,
        "Druha": False,
        "Treti": False,
    }
    assert _ulozeny_radek(db, rychla).excluded == 1


def test_vraceni_obnovi_zavodnika_i_s_casy(client, db, tri_zavodnice, timekeeper_headers):
    rychla = tri_zavodnice["rychla"]
    _vyradit(client, rychla, timekeeper_headers)

    odpoved = _vyradit(client, rychla, timekeeper_headers, excluded=False)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["message"] == "Závodník vrácen na startovní listinu"
    vraceny = odpoved.json()["entry"]
    assert vraceny["excluded"] is False
    # Nic z toho, co u něj bylo zapsané, se vyřazením neztratilo.
    assert vraceny["time1"] == 29.0
    assert vraceny["time_sum"] == 58.0
    assert vraceny["start_number"] == 1

    vysledky = client.get(
        f"/api/timekeeper/races/{rychla.race_id}/results", headers=timekeeper_headers
    ).json()
    assert vysledky["categories"][0]["entries"][0]["racer_surname"] == "Rychla"


def test_vyrazeni_posila_cilovy_stav_ne_prepinac(client, db, tri_zavodnice, timekeeper_headers):
    """Dvakrát "vyřadit" je pořád vyřazený - přehrávka z fronty nic neotočí."""
    rychla = tri_zavodnice["rychla"]

    _vyradit(client, rychla, timekeeper_headers)
    druhe = _vyradit(client, rychla, timekeeper_headers)

    assert druhe.status_code == 200
    assert druhe.json()["entry"]["excluded"] is True
    assert _ulozeny_radek(db, rychla).excluded == 1


def test_vyrazeni_nemeni_revizi_casu(client, db, tri_zavodnice, timekeeper_headers):
    """Revize hlídá souběžné zápisy ČASŮ. Kdyby ji vyřazení posunulo, tablet,
    který zrovna zapisuje čas, by dostal konflikt 409 o ničem."""
    druha = tri_zavodnice["druha"]
    db.execute(
        text(f"UPDATE {STARTOVKA} SET updated_at = '2026-01-01 10:00:00' WHERE id = :id"),
        {"id": druha.id},
    )
    db.commit()

    _vyradit(client, druha, timekeeper_headers)
    vraceni = _vyradit(client, druha, timekeeper_headers, excluded=False)

    assert _ulozeny_radek(db, druha).updated_at == datetime(2026, 1, 1, 10, 0, 0)
    assert vraceni.json()["entry"]["updated_at"] == "2026-01-01T10:00:00"

    zapis = client.put(
        f"/api/timekeeper/start-list/{druha.id}/time",
        json={"time1": 30.2, "time2": 30.0, "base_revision": "2026-01-01T10:00:00Z"},
        headers=timekeeper_headers,
    )
    assert zapis.status_code == 200, zapis.text


def test_casomeric_smi_zapsat_cas_i_vyrazenemu(client, db, tri_zavodnice, timekeeper_headers):
    """Čas z jiného zařízení se neztratí - vyřazený ho dostane a ukáže se po vrácení."""
    rychla = tri_zavodnice["rychla"]
    _vyradit(client, rychla, timekeeper_headers)

    zapis = client.put(
        f"/api/timekeeper/start-list/{rychla.id}/time",
        json={"time1": 28.0, "time2": 28.0},
        headers=timekeeper_headers,
    )

    assert zapis.status_code == 200, zapis.text
    radek = _ulozeny_radek(db, rychla)
    assert radek.excluded == 1
    assert float(radek.time_sum) == 56.0


def test_dvoji_odeslani_vyrazeni_se_neprovede_dvakrat(
    client, db, tri_zavodnice, timekeeper_headers
):
    """Přehrávka z offline fronty se stejným klíčem je jen ozvěna první odpovědi
    - nesmí znovu vyřadit závodníka, kterého mezitím někdo vrátil."""
    rychla = tri_zavodnice["rychla"]
    prvni = _vyradit(client, rychla, timekeeper_headers, idempotency_key="vyradit-1")
    assert prvni.json()["idempotency_replayed"] is False

    _vyradit(client, rychla, timekeeper_headers, excluded=False)
    druhy = _vyradit(client, rychla, timekeeper_headers, idempotency_key="vyradit-1")

    assert druhy.status_code == 200
    assert druhy.json()["idempotency_replayed"] is True
    assert druhy.json()["entry"]["excluded"] is True
    assert _ulozeny_radek(db, rychla).excluded == 0


def test_ruzne_klice_vyrazeni_se_provedou_oba(client, db, tri_zavodnice, timekeeper_headers):
    rychla = tri_zavodnice["rychla"]

    _vyradit(client, rychla, timekeeper_headers, idempotency_key="a")
    _vyradit(client, rychla, timekeeper_headers, excluded=False, idempotency_key="b")

    assert _ulozeny_radek(db, rychla).excluded == 0


def test_vyrazeni_neexistujici_polozky_vrati_404(client, timekeeper_headers):
    odpoved = client.put(
        "/api/timekeeper/start-list/9999/excluded",
        json={"excluded": True},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Záznam na startovní listině nenalezen"


def test_vyrazeni_bez_ciloveho_stavu_odmitne(client, db, tri_zavodnice, timekeeper_headers):
    rychla = tri_zavodnice["rychla"]

    odpoved = client.put(
        f"/api/timekeeper/start-list/{rychla.id}/excluded", json={}, headers=timekeeper_headers
    )

    assert odpoved.status_code == 422
    assert _ulozeny_radek(db, rychla).excluded == 0


def test_vyrazeni_smi_i_spravce(client, db, tri_zavodnice, admin_headers):
    assert _vyradit(client, tri_zavodnice["rychla"], admin_headers).status_code == 200


def test_vyrazeni_bez_prihlaseni_neprojde(client, db, tri_zavodnice):
    rychla = tri_zavodnice["rychla"]

    odpoved = client.put(
        f"/api/timekeeper/start-list/{rychla.id}/excluded", json={"excluded": True}
    )

    assert odpoved.status_code == 403
    assert _ulozeny_radek(db, rychla).excluded == 0


# --------------------------------------------------------------------------
# Kde vyřazený není
# --------------------------------------------------------------------------


def test_vysledky_pocitaji_poradi_a_body_bez_vyrazeneho(
    client, db, tri_zavodnice, timekeeper_headers
):
    rychla = tri_zavodnice["rychla"]
    _vyradit(client, rychla, timekeeper_headers)

    vysledky = client.get(
        f"/api/timekeeper/races/{rychla.race_id}/results", headers=timekeeper_headers
    ).json()

    assert vysledky["total_entries"] == 2
    radky = vysledky["categories"][0]["entries"]
    assert [(r["racer_surname"], r["position"], r["points"]) for r in radky] == [
        ("Druha", 1, 100),
        ("Treti", 2, 80),
    ]
    # Ztráta se měří na nového vítěze, ne na vyřazenou.
    assert radky[0]["diff"] is None
    assert radky[1]["diff"] == 1.5


def test_plochy_vypis_vysledku_vyrazeneho_taky_vynecha(
    client, db, tri_zavodnice, timekeeper_headers
):
    rychla = tri_zavodnice["rychla"]
    _vyradit(client, rychla, timekeeper_headers)

    vysledky = client.get(
        f"/api/timekeeper/races/{rychla.race_id}/results?group_by_category=false",
        headers=timekeeper_headers,
    ).json()

    assert [r["racer_surname"] for r in vysledky["entries"]] == ["Druha", "Treti"]


def test_vypocet_bodu_vyrazeneho_preskoci_a_jeho_stare_body_smaze(
    client, db, tri_zavodnice, timekeeper_headers
):
    """Body se uložily ještě před vyřazením; nechat je tam by znamenalo, že
    sloupec points tvrdí něco jiného než výsledky."""
    rychla = tri_zavodnice["rychla"]
    _vyradit(client, rychla, timekeeper_headers)

    odpoved = client.post(
        f"/api/timekeeper/races/{rychla.race_id}/results/calculate-points",
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["updated"] == 2
    assert _ulozeny_radek(db, tri_zavodnice["druha"]).points == 100
    assert _ulozeny_radek(db, tri_zavodnice["treti"]).points == 80
    assert _ulozeny_radek(db, rychla).points is None
    # Časy vyřazené zůstávají - po vrácení se zase započítá.
    assert float(_ulozeny_radek(db, rychla).time_sum) == 58.0


def test_po_vraceni_vypocet_bodu_vrati_i_jeho_body(client, db, tri_zavodnice, timekeeper_headers):
    rychla = tri_zavodnice["rychla"]
    _vyradit(client, rychla, timekeeper_headers)
    client.post(
        f"/api/timekeeper/races/{rychla.race_id}/results/calculate-points",
        headers=timekeeper_headers,
    )

    _vyradit(client, rychla, timekeeper_headers, excluded=False)
    client.post(
        f"/api/timekeeper/races/{rychla.race_id}/results/calculate-points",
        headers=timekeeper_headers,
    )

    assert _ulozeny_radek(db, rychla).points == 100
    assert _ulozeny_radek(db, tri_zavodnice["druha"]).points == 80


def test_verejny_live_prenos_vyrazeneho_neukaze(client, db, kategorie, timekeeper_headers):
    zavod = _zavod(db, race_nr="JMLP2026-04", is_live=True)
    vyrazena = _polozka(db, zavod, kategorie, "Anna", "Rychla", 1, time1=29.0, time_sum=29.0)
    _polozka(db, zavod, kategorie, "Bara", "Druha", 2, time1=30.0, time_sum=30.0)
    _vyradit(client, vyrazena, timekeeper_headers)

    odpoved = client.get("/races/live")

    assert odpoved.status_code == 200, odpoved.text
    zavodnici = [e["racer_surname"] for c in odpoved.json()["categories"] for e in c["entries"]]
    assert zavodnici == ["Druha"]


def test_verejny_live_prenos_bez_jedine_kategorie_kdyz_jsou_vsichni_vyrazeni(
    client, db, kategorie, timekeeper_headers
):
    zavod = _zavod(db, race_nr="JMLP2026-04", is_live=True)
    _vyradit(client, _polozka(db, zavod, kategorie, "Anna", "Rychla", 1), timekeeper_headers)

    odpoved = client.get("/races/live")

    assert odpoved.status_code == 200
    assert odpoved.json()["categories"] == []


def test_prehled_zavodu_pocita_na_listine_jen_nevyrazene(
    client, db, tri_zavodnice, timekeeper_headers
):
    _vyradit(client, tri_zavodnice["rychla"], timekeeper_headers)

    zavody = client.get("/api/timekeeper/races", headers=timekeeper_headers).json()

    assert zavody[0]["start_list_count"] == 2


# --------------------------------------------------------------------------
# Vyřazený pořád patří k závodu - nedá se přidat podruhé
# --------------------------------------------------------------------------


def test_rucni_pridani_vyrazeneho_poradi_vratit_ho(client, db, tri_zavodnice, timekeeper_headers):
    rychla = tri_zavodnice["rychla"]
    _vyradit(client, rychla, timekeeper_headers)

    odpoved = client.post(
        f"/api/timekeeper/races/{rychla.race_id}/start-list/entry",
        json={"racer_id": rychla.racer_id},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 400
    assert "vyřazený" in odpoved.json()["detail"]
    assert "Vrátit" in odpoved.json()["detail"]


def test_generovani_vyrazeneho_neprida_znovu(client, db, tri_zavodnice, timekeeper_headers):
    rychla = tri_zavodnice["rychla"]
    db.add(models.Registration(race_id=rychla.race_id, racer_id=rychla.racer_id))
    db.commit()
    _vyradit(client, rychla, timekeeper_headers)

    odpoved = client.post(
        f"/api/timekeeper/races/{rychla.race_id}/start-list/generate",
        json={},
        headers=timekeeper_headers,
    )

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["added"] == 0
    assert _ulozeny_radek(db, rychla).excluded == 1


# --------------------------------------------------------------------------
# Migrace ostré databáze
# --------------------------------------------------------------------------


def test_migrace_doplni_sloupec_a_dosavadni_radky_necha_na_startovce(db, zavod, kategorie):
    """Na ostré databázi sloupec chybí - doplní ho migrace při startu backendu.
    Spustí se tam jednou, ale každý restart ji zavolá znovu."""
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {STARTOVKA} DROP COLUMN excluded"))
        conn.execute(
            text(
                f"INSERT INTO {STARTOVKA} (race_id, racer_id, category_id, start_number) "
                "VALUES (:race_id, 1, :category_id, 1)"
            ),
            {"race_id": zavod.id, "category_id": kategorie.id},
        )
    try:
        with engine.begin() as conn:
            _m_start_list_excluded(conn)
            _m_start_list_excluded(conn)  # druhý start backendu už nic nedělá

            sloupec = conn.execute(
                text(
                    "SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = 'excluded'"
                ),
                {"t": STARTOVKA},
            ).first()
            assert sloupec.COLUMN_TYPE == "tinyint(1)"
            assert sloupec.IS_NULLABLE == "NO"
            assert str(sloupec.COLUMN_DEFAULT) == "0"

            assert conn.execute(text(f"SELECT excluded FROM {STARTOVKA}")).scalar() == 0
    finally:
        # Schéma je společné celé sadě testů - musí zůstat, jak bylo.
        with engine.begin() as conn:
            if not _column_exists(conn, STARTOVKA, "excluded"):
                conn.execute(
                    text(
                        f"ALTER TABLE {STARTOVKA} ADD COLUMN excluded TINYINT(1) NOT NULL DEFAULT 0"
                    )
                )
