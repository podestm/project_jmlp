"""Startovka časoměřiče - app/routers/timekeeper/start_list.py a race_numbers.py.

Startovka vzniká v den závodu a od té chvíle žije vlastním životem: je to
snímek (jméno, ročník, klub, kategorie, dresové číslo), ne pohled do tabulky
závodníků. Testy proto hlídají hlavně tři věci:

* co se do listiny dostane a v jakém pořadí (kategorie, startovní čísla),
* aby jedno dresové číslo v závodě nedostali dva lidi,
* aby se nic z toho nedalo udělat bez oprávnění časoměřiče.

Tabulky jsou MyISAM, takže neúspěšný požadavek po sobě neuklidí - testy, které
drží současné (chybné) chování, jsou označené slovem CHYBA.
"""
import json
from datetime import date, datetime, timedelta

import pytest

from app import auth, models
from app.utils import get_current_season_id

AKTUALNI_SEZONA = get_current_season_id()


# --------------------------------------------------------------------------
# Pomocníci pro testovací data
# --------------------------------------------------------------------------

def _zavod(db, race_nr="JMLP2026-01", datum=None, season_id=None):
    zavod = models.Race(
        race_nr=race_nr,
        datum=datum or date.today(),
        season_id=season_id or AKTUALNI_SEZONA,
        closed=False,
        registration=True,
        race_method_id=1,
        is_live=False,
    )
    db.add(zavod)
    db.commit()
    db.refresh(zavod)
    return zavod


def _klub(db, name, valid=True):
    klub = models.Club(name=name, valid=valid)
    db.add(klub)
    db.commit()
    db.refresh(klub)
    return klub


def _kategorie(db, name, min_year, max_year, sex, active=True, display_name=None):
    kategorie = models.Category(
        name=name,
        display_name=display_name,
        min_birth_year=min_year,
        max_birth_year=max_year,
        sex=sex,
        active=active,
    )
    db.add(kategorie)
    db.commit()
    db.refresh(kategorie)
    return kategorie


def _zavodnik(db, name, surname, year, sex, club_id=None, slcr_id=None, category_id=None):
    zavodnik = models.Racer(
        name=name, surname=surname, year=year, sex=sex,
        club_id=club_id, slcr_id=slcr_id, category_id=category_id,
    )
    db.add(zavodnik)
    db.commit()
    db.refresh(zavodnik)
    return zavodnik


def _prihlaska(db, zavod, zavodnik, registered_at=None):
    registrace = models.Registration(race_id=zavod.id, racer_id=zavodnik.id)
    if registered_at is not None:
        registrace.registered_at = registered_at
    db.add(registrace)
    db.commit()
    db.refresh(registrace)
    return registrace


def _cisla(db, set_number=1, actual_from=1, actual_to=10, display_from=1,
           color="rose", active=True):
    """Sada dresových čísel. actual = číslo na dresu, display = systémové číslo."""
    vytvorena = []
    for posun, actual in enumerate(range(actual_from, actual_to + 1)):
        cislo = models.RaceNumber(
            set_number=set_number,
            set_color=color,
            actual_number=actual,
            display_number=display_from + posun,
            is_active=active,
        )
        db.add(cislo)
        vytvorena.append(cislo)
    db.commit()
    for cislo in vytvorena:
        db.refresh(cislo)
    return vytvorena


def _polozka(db, zavod, zavodnik, start_number=None, cislo=None, category_id=None,
             jmeno=None, prijmeni=None, rok=None, pohlavi=None, klub=None,
             nazev_kategorie=None):
    polozka = models.StartListEntry(
        race_id=zavod.id,
        racer_id=zavodnik.id,
        category_id=category_id,
        start_number=start_number,
        race_number_id=cislo.id if cislo else None,
        race_number_actual=cislo.actual_number if cislo else None,
        race_number_display=cislo.display_number if cislo else None,
        racer_name=jmeno if jmeno is not None else zavodnik.name,
        racer_surname=prijmeni if prijmeni is not None else zavodnik.surname,
        racer_year=rok if rok is not None else zavodnik.year,
        racer_sex=pohlavi if pohlavi is not None else zavodnik.sex,
        club_name=klub,
        category_name=nazev_kategorie,
    )
    db.add(polozka)
    db.commit()
    db.refresh(polozka)
    return polozka


def _uzivatel(db, email, role, is_active=True):
    uzivatel = models.AdminUser(
        email=email,
        password_hash=auth.get_password_hash("Heslo123!"),
        full_name=f"Test {role}",
        is_active=is_active,
        role=role,
    )
    db.add(uzivatel)
    db.commit()
    db.refresh(uzivatel)
    return uzivatel


def _hlavicka(uzivatel):
    token = auth.create_access_token({"sub": str(uzivatel.id), "role": uzivatel.role})
    return {"Authorization": f"Bearer {token}"}


def _obnov(db):
    """Zahodí objekty v identity mapě - jinak test čte hodnoty z doby před voláním API."""
    db.expire_all()


def _startovka(client, zavod, hlavicky):
    odpoved = client.get(f"/api/timekeeper/races/{zavod.id}/start-list", headers=hlavicky)
    assert odpoved.status_code == 200, odpoved.text
    return odpoved.json()


def _podle_prijmeni(radky):
    return {radek["racer_surname"]: radek for radek in radky}


@pytest.fixture
def klient_jako_v_provozu():
    """TestClient, který výjimku ze serveru nepřehodí do testu, ale vrátí ji jako
    odpověď - stejně, jako ji uvidí prohlížeč časoměřiče."""
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture
def kategorie(db):
    """Čtyři aktivní kategorie. Výchozí pořadí startovky je nejmladší první,
    ženy před muži - tedy U10 ženy, U10 muži, OPEN ženy, OPEN muži."""
    return {
        "u10_zeny": _kategorie(db, "U10", 2016, 2018, 2, display_name="U10 dívky"),
        "u10_muzi": _kategorie(db, "U10", 2016, 2018, 1, display_name="U10 chlapci"),
        "open_zeny": _kategorie(db, "OPEN", 1950, 2015, 2, display_name="OPEN ženy"),
        "open_muzi": _kategorie(db, "OPEN", 1950, 2015, 1, display_name="OPEN muži"),
    }


@pytest.fixture
def zavod(db):
    return _zavod(db)


@pytest.fixture
def ctyri_prihlaseni(db, zavod, kategorie):
    """Po jednom závodníkovi z každé kategorie, přihlášení v opačném pořadí,
    než v jakém mají startovat."""
    klub = _klub(db, "SK Pardubice")
    zavodnici = {
        "open_muzi": _zavodnik(db, "Petr", "Muzsky", 2000, 1, club_id=klub.id),
        "open_zeny": _zavodnik(db, "Eva", "Zenska", 2000, 2, club_id=klub.id),
        "u10_muzi": _zavodnik(db, "Kuba", "Klucik", 2017, 1, club_id=klub.id),
        "u10_zeny": _zavodnik(db, "Anna", "Holcicka", 2017, 2, club_id=klub.id),
    }
    for zavodnik in zavodnici.values():
        _prihlaska(db, zavod, zavodnik)
    return zavodnici


# --------------------------------------------------------------------------
# Sestavení startovky z přihlášek
# --------------------------------------------------------------------------

def test_startovka_se_sestavi_z_prihlasenych(client, db, zavod, kategorie,
                                             ctyri_prihlaseni, timekeeper_headers):
    _cisla(db)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                          json={}, headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["added"] == 4
    assert odpoved.json()["total"] == 4

    radky = _podle_prijmeni(_startovka(client, zavod, timekeeper_headers))
    assert set(radky) == {"Holcicka", "Klucik", "Zenska", "Muzsky"}
    anna = radky["Holcicka"]
    assert anna["racer_name"] == "Anna"
    assert anna["racer_year"] == 2017
    assert anna["racer_sex"] == 2
    assert anna["club_name"] == "SK Pardubice"
    assert anna["category_name"] == "U10 dívky"
    assert anna["category_id"] == kategorie["u10_zeny"].id
    assert anna["racer_id"] == ctyri_prihlaseni["u10_zeny"].id


def test_generovani_radi_zavodniky_podle_vychoziho_poradi_kategorii(
        client, db, zavod, kategorie, ctyri_prihlaseni, timekeeper_headers):
    _cisla(db)

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    radky = _podle_prijmeni(_startovka(client, zavod, timekeeper_headers))
    # Nejmladší první, uvnitř ročníku ženy před muži - bez ohledu na pořadí přihlášek.
    assert radky["Holcicka"]["start_number"] == 1
    assert radky["Klucik"]["start_number"] == 2
    assert radky["Zenska"]["start_number"] == 3
    assert radky["Muzsky"]["start_number"] == 4


def test_generovani_respektuje_zadane_poradi_kategorii(
        client, db, zavod, kategorie, ctyri_prihlaseni, timekeeper_headers):
    _cisla(db)
    poradi = [kategorie["open_muzi"].id, kategorie["open_zeny"].id,
              kategorie["u10_muzi"].id, kategorie["u10_zeny"].id]

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={"category_order": poradi}, headers=timekeeper_headers)

    radky = _podle_prijmeni(_startovka(client, zavod, timekeeper_headers))
    assert radky["Muzsky"]["start_number"] == 1
    assert radky["Zenska"]["start_number"] == 2
    assert radky["Klucik"]["start_number"] == 3
    assert radky["Holcicka"]["start_number"] == 4


def test_zadane_poradi_kategorii_se_zapamatuje_u_zavodu(
        client, db, zavod, kategorie, ctyri_prihlaseni, timekeeper_headers):
    _cisla(db)
    poradi = [kategorie["open_muzi"].id, kategorie["open_zeny"].id]

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={"category_order": poradi}, headers=timekeeper_headers)

    _obnov(db)
    ulozene = db.query(models.Race).filter(models.Race.id == zavod.id).first()
    assert json.loads(ulozene.timekeeper_category_order) == poradi

    # Ve výpisu se zapamatované pořadí projeví i bez dalšího generování:
    # nezmíněné kategorie se řadí za ty vyjmenované.
    vypis = _startovka(client, zavod, timekeeper_headers)
    assert [radek["racer_surname"] for radek in vypis] == [
        "Muzsky", "Zenska", "Holcicka", "Klucik",
    ]
    assert vypis[0]["category_rank"] == 0
    assert vypis[1]["category_rank"] == 1


def test_opakovane_generovani_neprida_stejneho_zavodnika_dvakrat(
        client, db, zavod, kategorie, ctyri_prihlaseni, timekeeper_headers):
    _cisla(db)
    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    druhe = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                        json={}, headers=timekeeper_headers)

    assert druhe.status_code == 200
    assert druhe.json()["added"] == 0
    assert "již na startovní listině" in druhe.json()["message"]
    assert len(_startovka(client, zavod, timekeeper_headers)) == 4


def test_generovani_prida_jen_nove_prihlaseneho(client, db, zavod, kategorie,
                                                ctyri_prihlaseni, timekeeper_headers):
    _cisla(db)
    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)
    pozdni = _zavodnik(db, "Ivan", "Pozdni", 2000, 1)
    _prihlaska(db, zavod, pozdni)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                          json={}, headers=timekeeper_headers)

    assert odpoved.json()["added"] == 1
    radky = _podle_prijmeni(_startovka(client, zavod, timekeeper_headers))
    assert radky["Pozdni"]["start_number"] == 5
    # Navazuje i dresovým číslem - čísla 1-4 už jsou v tomto závodě obsazená.
    assert radky["Pozdni"]["race_number_display"] == 5


def test_generovani_bez_prihlasenych_nic_nevytvori(client, db, zavod, kategorie,
                                                   timekeeper_headers):
    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                          json={}, headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()["added"] == 0
    assert _startovka(client, zavod, timekeeper_headers) == []


def test_generovani_neexistujiciho_zavodu_vrati_404(client, timekeeper_headers):
    odpoved = client.post("/api/timekeeper/races/9999/start-list/generate",
                          json={}, headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závod nenalezen"


def test_generovani_prideluje_cisla_od_nejnizsi_sady(client, db, zavod, kategorie,
                                                     ctyri_prihlaseni, timekeeper_headers):
    _cisla(db, set_number=1, actual_from=1, actual_to=3, display_from=1, color="rose")
    _cisla(db, set_number=2, actual_from=1, actual_to=3, display_from=201, color="blue")

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    radky = _podle_prijmeni(_startovka(client, zavod, timekeeper_headers))
    assert [radky[p]["race_number_display"] for p in ("Holcicka", "Klucik", "Zenska")] == [1, 2, 3]
    ctvrty = radky["Muzsky"]
    # Sada 1 došla, pokračuje se sadou 2 - dres má zase číslo 1, systémové 201.
    assert (ctvrty["race_number_actual"], ctvrty["race_number_display"]) == (1, 201)
    assert ctvrty["set_color"] == "blue"


def test_generovani_preskoci_deaktivovana_cisla(client, db, zavod, kategorie,
                                                ctyri_prihlaseni, timekeeper_headers):
    sada = _cisla(db, actual_from=1, actual_to=5, display_from=1)
    sada[0].is_active = False
    sada[2].is_active = False
    db.commit()

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    radky = _podle_prijmeni(_startovka(client, zavod, timekeeper_headers))
    assert radky["Holcicka"]["race_number_display"] == 2
    assert radky["Klucik"]["race_number_display"] == 4
    assert radky["Zenska"]["race_number_display"] == 5
    # Aktivní čísla došla dřív než závodníci - poslední zůstane bez dresu.
    assert radky["Muzsky"]["race_number_display"] is None


def test_generovani_bez_dostatku_cisel_necha_zbytek_bez_dresu(
        client, db, zavod, kategorie, ctyri_prihlaseni, timekeeper_headers):
    _cisla(db, actual_from=1, actual_to=2, display_from=1)

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    radky = _podle_prijmeni(_startovka(client, zavod, timekeeper_headers))
    assert radky["Holcicka"]["race_number_display"] == 1
    assert radky["Klucik"]["race_number_display"] == 2
    # Na poslední dva se nedostalo, ale na startovku patří i tak.
    assert radky["Zenska"]["race_number_display"] is None
    assert radky["Muzsky"]["race_number_display"] is None
    assert radky["Muzsky"]["start_number"] == 4


def test_zavodnik_bez_kategorie_startuje_posledni(client, db, zavod, kategorie,
                                                  ctyri_prihlaseni, timekeeper_headers):
    _cisla(db)
    # Ročník 1900 nespadá do žádné kategorie.
    veteran = _zavodnik(db, "Josef", "Veteran", 1900, 1)
    _prihlaska(db, zavod, veteran)

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    vypis = _startovka(client, zavod, timekeeper_headers)
    assert vypis[-1]["racer_surname"] == "Veteran"
    assert vypis[-1]["category_id"] is None
    assert vypis[-1]["category_name"] is None
    assert vypis[-1]["start_number"] == 5


def test_generovani_se_stejnym_klicem_se_neprovede_dvakrat(
        client, db, zavod, kategorie, ctyri_prihlaseni, timekeeper_headers):
    _cisla(db)
    hlavicky = dict(timekeeper_headers, **{"X-Idempotency-Key": "generate-1"})
    prvni = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                        json={}, headers=hlavicky)
    assert prvni.json()["added"] == 4
    assert prvni.json()["idempotency_replayed"] is False

    # Listinu mezitím někdo smaže; opakovaný požadavek se stejným klíčem je
    # ale jen ozvěna té první odpovědi, nikoli nové generování.
    db.query(models.StartListEntry).delete()
    db.commit()

    druhy = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                        json={}, headers=hlavicky)

    assert druhy.json()["added"] == 4
    assert druhy.json()["idempotency_replayed"] is True
    assert _startovka(client, zavod, timekeeper_headers) == []


def test_generovani_nezasahuje_do_jineho_zavodu(client, db, zavod, kategorie,
                                                ctyri_prihlaseni, timekeeper_headers):
    _cisla(db)
    jiny = _zavod(db, race_nr="JMLP2026-02")

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    assert _startovka(client, jiny, timekeeper_headers) == []


# --------------------------------------------------------------------------
# Výpis startovky
# --------------------------------------------------------------------------

def test_vypis_startovky_je_serazeny_podle_kategorii_a_startovnich_cisel(
        client, db, zavod, kategorie, timekeeper_headers):
    dospely = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    dite_a = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    dite_b = _zavodnik(db, "Bara", "Druha", 2017, 2)
    _polozka(db, zavod, dospely, start_number=1, category_id=kategorie["open_muzi"].id)
    _polozka(db, zavod, dite_b, start_number=9, category_id=kategorie["u10_zeny"].id)
    _polozka(db, zavod, dite_a, start_number=5, category_id=kategorie["u10_zeny"].id)

    vypis = _startovka(client, zavod, timekeeper_headers)

    assert [radek["racer_surname"] for radek in vypis] == ["Holcicka", "Druha", "Muzsky"]
    assert [radek["category_rank"] for radek in vypis] == [0, 0, 3]


def test_vypis_obsahuje_barvu_sady_a_priznaky_casomery(client, db, zavod, kategorie,
                                                       timekeeper_headers):
    sada = _cisla(db, actual_from=7, actual_to=7, display_from=7, color="emerald")
    zavodnik = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    polozka = _polozka(db, zavod, zavodnik, start_number=1, cislo=sada[0],
                       category_id=kategorie["open_muzi"].id)
    polozka.time1 = 31.5
    polozka.time2 = 30.25
    polozka.time_sum = 61.75
    polozka.dnf = True
    polozka.points = 12
    db.commit()

    radek = _startovka(client, zavod, timekeeper_headers)[0]

    assert radek["set_color"] == "emerald"
    assert radek["race_number_actual"] == 7
    assert radek["display_number"] == 7
    assert radek["time1"] == 31.5
    assert radek["time_sum"] == 61.75
    assert radek["dnf"] is True
    assert radek["dns"] is False
    assert radek["points"] == 12


def test_polozka_bez_dresu_ma_vychozi_barvu(client, db, zavod, kategorie,
                                            timekeeper_headers):
    zavodnik = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    _polozka(db, zavod, zavodnik, start_number=1)

    radek = _startovka(client, zavod, timekeeper_headers)[0]

    assert radek["race_number_id"] is None
    assert radek["set_color"] == "rose"


def test_vypis_startovky_neexistujiciho_zavodu_vrati_404(client, timekeeper_headers):
    odpoved = client.get("/api/timekeeper/races/9999/start-list", headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závod nenalezen"


def test_vypis_ukazuje_jen_polozky_daneho_zavodu(client, db, zavod, kategorie,
                                                 timekeeper_headers):
    jiny = _zavod(db, race_nr="JMLP2026-02")
    a = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    b = _zavodnik(db, "Eva", "Zenska", 2000, 2)
    _polozka(db, zavod, a, start_number=1)
    _polozka(db, jiny, b, start_number=1)

    assert [r["racer_surname"] for r in _startovka(client, zavod, timekeeper_headers)] == ["Muzsky"]
    assert [r["racer_surname"] for r in _startovka(client, jiny, timekeeper_headers)] == ["Zenska"]


def test_detail_polozky_vrati_stejny_snimek_jako_vypis(client, db, zavod, kategorie,
                                                       timekeeper_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=3,
                       category_id=kategorie["u10_zeny"].id, klub="SK Pardubice")

    odpoved = client.get(f"/api/timekeeper/start-list/{polozka.id}", headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json() == _startovka(client, zavod, timekeeper_headers)[0]
    assert odpoved.json()["club_name"] == "SK Pardubice"


def test_detail_neexistujici_polozky_vrati_404(client, timekeeper_headers):
    odpoved = client.get("/api/timekeeper/start-list/9999", headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Záznam na startovní listině nenalezen"


def test_ceska_jmena_projdou_snapshotem_bez_poskozeni(client, db, zavod, kategorie,
                                                      timekeeper_headers):
    klub = _klub(db, "Ski klub Velké Meziříčí")
    zavodnice = _zavodnik(db, "Šárka", "Nováková", 2017, 2, club_id=klub.id)
    _prihlaska(db, zavod, zavodnice)
    _cisla(db)

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    radek = _startovka(client, zavod, timekeeper_headers)[0]
    assert radek["racer_name"] == "Šárka"
    assert radek["racer_surname"] == "Nováková"
    assert radek["club_name"] == "Ski klub Velké Meziříčí"


# --------------------------------------------------------------------------
# Názvy kategorií - všude oficiální název z adminu, kód jen jako doplněk
# --------------------------------------------------------------------------

def test_seznam_kategorii_k_rozlosovani_nese_nazev_z_adminu(client, kategorie,
                                                            timekeeper_headers):
    odpoved = client.get("/api/timekeeper/categories", headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    podle_id = {radek["id"]: radek for radek in odpoved.json()}
    divky = podle_id[kategorie["u10_zeny"].id]
    # Zobrazuje se oficiální název, kódové označení jen jako doplňková informace.
    assert divky["display_name"] == "U10 dívky"
    assert divky["name"] == "U10 dívky"
    assert divky["code"] == "U10"


def test_kategorie_bez_nazvu_se_slozi_z_kodu_a_pohlavi(client, db, timekeeper_headers):
    bez_nazvu = _kategorie(db, "U8", 2019, 2020, 2)

    odpoved = client.get("/api/timekeeper/categories", headers=timekeeper_headers)

    radek = next(r for r in odpoved.json() if r["id"] == bez_nazvu.id)
    assert radek["display_name"] == "U8 - Ženy"


def test_vypis_startovky_ukazuje_prejmenovanou_kategorii(client, db, zavod, kategorie,
                                                         timekeeper_headers):
    """Snapshot v listině je jen záloha - název se bere živě z adminu.

    Kategorie se dá v adminu přejmenovat i po rozlosování a od té chvíle musí
    být všude vidět nový název, ne ten, který platil při generování listiny.
    """
    zavodnice = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    _polozka(db, zavod, zavodnice, start_number=1,
             category_id=kategorie["u10_zeny"].id, nazev_kategorie="U10 - Ženy")

    kategorie["u10_zeny"].display_name = "Myšáci dívky"
    db.commit()

    radek = _startovka(client, zavod, timekeeper_headers)[0]
    assert radek["category_name"] == "Myšáci dívky"


def test_vysledky_ukazuji_stejny_nazev_kategorie_jako_startovka(
        client, db, zavod, kategorie, timekeeper_headers):
    zavodnice = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    _polozka(db, zavod, zavodnice, start_number=1,
             category_id=kategorie["u10_zeny"].id, nazev_kategorie="U10 - Ženy")

    odpoved = client.get(f"/api/timekeeper/races/{zavod.id}/results",
                         headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    nazvy = [skupina["category_name"] for skupina in odpoved.json()["categories"]]
    assert nazvy == ["U10 dívky"]
    assert nazvy[0] == _startovka(client, zavod, timekeeper_headers)[0]["category_name"]


# --------------------------------------------------------------------------
# Ruční přidání závodníka
# --------------------------------------------------------------------------

def test_rucni_pridani_existujiciho_zavodnika_prevezme_jeho_udaje(
        client, db, zavod, kategorie, timekeeper_headers):
    _cisla(db)
    klub = _klub(db, "SK Pardubice")
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2, club_id=klub.id)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": zavodnik.id}, headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    telo = odpoved.json()
    assert telo["message"] == "Závodník přidán na startovní listinu"
    assert telo["start_number"] == 1
    polozka = telo["entry"]
    assert polozka["racer_surname"] == "Holcicka"
    assert polozka["club_name"] == "SK Pardubice"
    assert polozka["category_name"] == "U10 dívky"
    assert polozka["race_number_display"] == 1  # nejnižší volné systémové číslo


def test_rucni_pridani_navazuje_na_uz_obsazena_cisla(client, db, zavod, kategorie,
                                                     timekeeper_headers):
    sada = _cisla(db)
    prvni = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    _polozka(db, zavod, prvni, start_number=1, cislo=sada[0],
             category_id=kategorie["open_muzi"].id)
    druhy = _zavodnik(db, "Eva", "Zenska", 2000, 2)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": druhy.id}, headers=timekeeper_headers)

    assert odpoved.json()["start_number"] == 2
    assert odpoved.json()["entry"]["race_number_display"] == 2


def test_rucni_pridani_zalozi_noveho_zavodnika_i_klub(client, db, zavod, kategorie,
                                                      timekeeper_headers):
    _cisla(db)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry", json={
        "racer_name": "Nova", "racer_surname": "Osoba", "racer_year": 2017,
        "racer_sex": 2, "club_name": "Novy klub", "racer_slcr_id": "AB123",
    }, headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["message"] == "Nový závodník byl vytvořen a přidán na startovní listinu"
    assert odpoved.json()["entry"]["category_name"] == "U10 dívky"

    _obnov(db)
    novy = db.query(models.Racer).filter(models.Racer.surname == "Osoba").one()
    assert novy.year == 2017
    assert novy.slcr_id == "AB123"
    assert novy.category_id == kategorie["u10_zeny"].id
    klub = db.query(models.Club).filter(models.Club.id == novy.club_id).one()
    assert klub.name == "Novy klub"


def test_rucni_pridani_noveho_zavodnika_pouzije_existujici_klub(
        client, db, zavod, kategorie, timekeeper_headers):
    klub = _klub(db, "SK Pardubice")

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry", json={
        "racer_name": "Nova", "racer_surname": "Osoba", "racer_year": 2017,
        "racer_sex": 2, "club_name": "SK Pardubice",
    }, headers=timekeeper_headers)

    _obnov(db)
    assert db.query(models.Club).count() == 1
    novy = db.query(models.Racer).filter(models.Racer.surname == "Osoba").one()
    assert novy.club_id == klub.id


def test_rucni_pridani_stejneho_jmena_zavodnika_nezaklada_znovu(
        client, db, zavod, kategorie, timekeeper_headers):
    """Shodné jméno, příjmení, ročník i pohlaví = tentýž člověk, jen bez ID."""
    klub = _klub(db, "SK Pardubice")
    puvodni = _zavodnik(db, "Anna", "Holcicka", 2017, 2, club_id=klub.id)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry", json={
        "racer_name": "Anna", "racer_surname": "Holcicka", "racer_year": 2017,
        "racer_sex": 2, "club_name": "Jiny klub",
    }, headers=timekeeper_headers)

    assert odpoved.json()["message"] == "Závodník přidán na startovní listinu"
    assert odpoved.json()["entry"]["racer_id"] == puvodni.id
    _obnov(db)
    assert db.query(models.Racer).count() == 1


def test_rucni_pridani_bez_povinnych_udaju_selze(client, db, zavod, kategorie,
                                                 timekeeper_headers):
    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_name": "Nova", "racer_surname": "Osoba"},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "rok narození" in odpoved.json()["detail"]
    _obnov(db)
    assert db.query(models.Racer).count() == 0


def test_rucni_pridani_bez_klubu_selze(client, db, zavod, kategorie, timekeeper_headers):
    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry", json={
        "racer_name": "Nova", "racer_surname": "Osoba", "racer_year": 2017, "racer_sex": 2,
    }, headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "oddíl" in odpoved.json()["detail"]


def test_rucni_pridani_s_prilis_dlouhym_slcr_id_selze(client, db, zavod, kategorie,
                                                      timekeeper_headers):
    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry", json={
        "racer_name": "Nova", "racer_surname": "Osoba", "racer_year": 2017,
        "racer_sex": 2, "club_name": "Novy klub", "racer_slcr_id": "12345678901",
    }, headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "10 znaků" in odpoved.json()["detail"]
    _obnov(db)
    assert db.query(models.Racer).count() == 0


def test_rucni_pridani_tehoz_zavodnika_dvakrat_selze(client, db, zavod, kategorie,
                                                     timekeeper_headers):
    _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                json={"racer_id": zavodnik.id}, headers=timekeeper_headers)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": zavodnik.id}, headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Závodník je již na startovní listině"
    assert len(_startovka(client, zavod, timekeeper_headers)) == 1


def test_rucni_pridani_neexistujiciho_zavodnika_vrati_404(client, db, zavod, kategorie,
                                                          timekeeper_headers):
    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": 9999}, headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závodník nenalezen"


def test_rucni_pridani_do_neexistujiciho_zavodu_vrati_404(client, db, kategorie,
                                                          timekeeper_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)

    odpoved = client.post("/api/timekeeper/races/9999/start-list/entry",
                          json={"racer_id": zavodnik.id}, headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závod nenalezen"


def test_rucni_pridani_prevezme_zadane_startovni_i_systemove_cislo(
        client, db, zavod, kategorie, timekeeper_headers):
    _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": zavodnik.id, "start_number": 42,
                                "race_number_display": 5},
                          headers=timekeeper_headers)

    polozka = odpoved.json()["entry"]
    assert polozka["start_number"] == 42
    assert polozka["race_number_display"] == 5
    assert polozka["race_number_actual"] == 5


def test_rucni_pridani_prepise_jmeno_jen_ve_startovce(client, db, zavod, kategorie,
                                                      timekeeper_headers):
    """Startovka je snímek - oprava jména v ní nesmí přepsat kartu závodníka."""
    _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": zavodnik.id, "racer_surname": "Provdana",
                                "club_name": "Jiny klub"},
                          headers=timekeeper_headers)

    assert odpoved.json()["entry"]["racer_surname"] == "Provdana"
    assert odpoved.json()["entry"]["club_name"] == "Jiny klub"
    _obnov(db)
    assert db.query(models.Racer).filter(models.Racer.id == zavodnik.id).one().surname == "Holcicka"


def test_rucni_pridani_doplni_kontakt_existujicimu_zavodnikovi(
        client, db, zavod, kategorie, timekeeper_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                json={"racer_id": zavodnik.id, "racer_telefon": "777123456",
                      "racer_email": "anna@test.cz", "racer_slcr_id": "CZ1"},
                headers=timekeeper_headers)

    _obnov(db)
    ulozeny = db.query(models.Racer).filter(models.Racer.id == zavodnik.id).one()
    assert (ulozeny.telefon, ulozeny.email, ulozeny.slcr_id) == ("777123456", "anna@test.cz", "CZ1")


# --------------------------------------------------------------------------
# Kolize dresových čísel
# --------------------------------------------------------------------------

def test_rucni_pridani_s_obsazenym_cislem_selze(client, db, zavod, kategorie,
                                                timekeeper_headers):
    sada = _cisla(db)
    obsazuje = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    _polozka(db, zavod, obsazuje, start_number=1, cislo=sada[0])
    dalsi = _zavodnik(db, "Eva", "Zenska", 2000, 2)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": dalsi.id, "race_number_display": 1},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    # Ve zprávě musí být vidět, kdo číslo drží - jinak se s tím na place nedá nic dělat.
    assert odpoved.json()["detail"] == "Systémové číslo 1 je již přiřazeno závodníkovi Muzsky Petr"
    assert len(_startovka(client, zavod, timekeeper_headers)) == 1


def test_stejne_cislo_smi_byt_ve_dvou_ruznych_zavodech(client, db, zavod, kategorie,
                                                       timekeeper_headers):
    sada = _cisla(db)
    jiny = _zavod(db, race_nr="JMLP2026-02")
    prvni = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    druhy = _zavodnik(db, "Eva", "Zenska", 2000, 2)
    _polozka(db, zavod, prvni, start_number=1, cislo=sada[0])

    odpoved = client.post(f"/api/timekeeper/races/{jiny.id}/start-list/entry",
                          json={"racer_id": druhy.id, "race_number_display": 1},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["entry"]["race_number_display"] == 1


def test_pridani_s_deaktivovanym_cislem_selze(client, db, zavod, kategorie,
                                              timekeeper_headers):
    sada = _cisla(db)
    sada[0].is_active = False
    db.commit()
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": zavodnik.id, "race_number_display": 1},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Systémové číslo 1 je deaktivované"


def test_pridani_s_neexistujicim_cislem_selze(client, db, zavod, kategorie,
                                              timekeeper_headers):
    _cisla(db, actual_from=1, actual_to=3, display_from=1)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": zavodnik.id, "race_number_display": 999},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Systémové číslo 999 neexistuje"


def test_pridani_s_prazdnym_cislem_necha_zavodnika_bez_dresu(client, db, zavod, kategorie,
                                                             timekeeper_headers):
    _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": zavodnik.id, "race_number_display": ""},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()["entry"]["race_number_display"] is None
    assert odpoved.json()["entry"]["race_number_id"] is None


def test_CHYBA_neuspesne_pridani_presto_zalozi_zavodnika_i_klub(
        client, db, zavod, kategorie, timekeeper_headers):
    """CHYBA: nový závodník i klub se zapíšou dřív, než se ověří dresové číslo,
    a MyISAM neumí rollback - po odmítnutém požadavku zůstanou v databázi."""
    sada = _cisla(db)
    obsazuje = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    _polozka(db, zavod, obsazuje, start_number=1, cislo=sada[0])

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry", json={
        "racer_name": "Nova", "racer_surname": "Osoba", "racer_year": 2017,
        "racer_sex": 2, "club_name": "Klub duchu", "race_number_display": 1,
    }, headers=timekeeper_headers)

    assert odpoved.status_code == 400
    _obnov(db)
    assert db.query(models.Racer).filter(models.Racer.surname == "Osoba").count() == 1
    assert db.query(models.Club).filter(models.Club.name == "Klub duchu").count() == 1
    # Na startovce přitom není - závodník zůstal viset "mimo" závod.
    assert [r["racer_surname"] for r in _startovka(client, zavod, timekeeper_headers)] == ["Muzsky"]


def test_CHYBA_automaticke_cislo_nepreskoci_na_dalsi_sadu(client, db, zavod, kategorie,
                                                          timekeeper_headers):
    """CHYBA: automatické přidělení hledá jen systémové číslo o jedna vyšší.
    Mezi sadami je díra (3 -> 201), takže závodník zůstane bez dresu, přestože
    je celá druhá sada volná."""
    sada1 = _cisla(db, set_number=1, actual_from=1, actual_to=3, display_from=1)
    _cisla(db, set_number=2, actual_from=1, actual_to=3, display_from=201, color="blue")
    posledni = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    _polozka(db, zavod, posledni, start_number=1, cislo=sada1[2])
    dalsi = _zavodnik(db, "Eva", "Zenska", 2000, 2)

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": dalsi.id}, headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()["entry"]["race_number_display"] is None


# --------------------------------------------------------------------------
# Úprava položky startovky
# --------------------------------------------------------------------------

def test_uprava_jmena_a_klubu_se_ulozi_do_snapshotu(client, db, zavod, kategorie,
                                                    timekeeper_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1,
                       category_id=kategorie["u10_zeny"].id, klub="SK Pardubice")

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"racer_name": "Anička", "racer_surname": "Provdana",
                               "club_name": "Novy klub"},
                         headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["message"] == "Záznam aktualizován"
    ulozena = odpoved.json()["entry"]
    assert (ulozena["racer_name"], ulozena["racer_surname"]) == ("Anička", "Provdana")
    assert ulozena["club_name"] == "Novy klub"
    assert _startovka(client, zavod, timekeeper_headers)[0]["racer_surname"] == "Provdana"


def test_zmena_rocniku_prepocita_kategorii(client, db, zavod, kategorie,
                                           timekeeper_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1,
                       category_id=kategorie["u10_zeny"].id, nazev_kategorie="U10 dívky")

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"racer_year": 2000}, headers=timekeeper_headers)

    ulozena = odpoved.json()["entry"]
    assert ulozena["racer_year"] == 2000
    assert ulozena["category_id"] == kategorie["open_zeny"].id
    assert ulozena["category_name"] == "OPEN ženy"
    assert ulozena["category_sex"] == 2


def test_zmena_pohlavi_prepocita_kategorii(client, db, zavod, kategorie,
                                           timekeeper_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1,
                       category_id=kategorie["u10_zeny"].id, nazev_kategorie="U10 dívky")

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"racer_sex": 1}, headers=timekeeper_headers)

    assert odpoved.json()["entry"]["category_id"] == kategorie["u10_muzi"].id
    assert odpoved.json()["entry"]["category_name"] == "U10 chlapci"


def test_rocnik_mimo_kategorie_polozku_bez_kategorie_nechá(client, db, zavod, kategorie,
                                                           timekeeper_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1,
                       category_id=kategorie["u10_zeny"].id, nazev_kategorie="U10 dívky")

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"racer_year": 1900}, headers=timekeeper_headers)

    assert odpoved.json()["entry"]["category_id"] is None
    assert odpoved.json()["entry"]["category_name"] is None


def test_kategorii_nelze_nastavit_rucne(client, db, zavod, kategorie, timekeeper_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1,
                       category_id=kategorie["u10_zeny"].id)

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"category_id": kategorie["open_muzi"].id},
                         headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Kategorie se určuje automaticky podle ročníku"
    _obnov(db)
    assert db.query(models.StartListEntry).filter(
        models.StartListEntry.id == polozka.id).one().category_id == kategorie["u10_zeny"].id


def test_uprava_startovniho_cisla_se_ulozi(client, db, zavod, kategorie,
                                           timekeeper_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1)

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"start_number": 17}, headers=timekeeper_headers)

    assert odpoved.json()["entry"]["start_number"] == 17


def test_prirazeni_dresu_podle_systemoveho_cisla(client, db, zavod, kategorie,
                                                 timekeeper_headers):
    _cisla(db, set_number=2, actual_from=1, actual_to=3, display_from=201, color="violet")
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1)

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"race_number_display": 202}, headers=timekeeper_headers)

    ulozena = odpoved.json()["entry"]
    assert ulozena["race_number_display"] == 202
    assert ulozena["race_number_actual"] == 2
    assert ulozena["set_color"] == "violet"


def test_prirazeni_dresu_podle_id(client, db, zavod, kategorie, timekeeper_headers):
    sada = _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1)

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"race_number_id": sada[3].id}, headers=timekeeper_headers)

    assert odpoved.json()["entry"]["race_number_id"] == sada[3].id
    assert odpoved.json()["entry"]["race_number_display"] == 4


def test_prirazeni_obsazeneho_dresu_selze(client, db, zavod, kategorie, timekeeper_headers):
    sada = _cisla(db)
    drzitel = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    _polozka(db, zavod, drzitel, start_number=1, cislo=sada[0])
    druhy = _zavodnik(db, "Eva", "Zenska", 2000, 2)
    polozka = _polozka(db, zavod, druhy, start_number=2, cislo=sada[1])

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"race_number_display": 1}, headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Systémové číslo 1 je již přiřazeno závodníkovi Muzsky Petr"
    _obnov(db)
    assert db.query(models.StartListEntry).filter(
        models.StartListEntry.id == polozka.id).one().race_number_display == 2


def test_prirazeni_vlastniho_cisla_projde(client, db, zavod, kategorie, timekeeper_headers):
    """Uložení beze změny dresu nesmí spadnout na kolizi se sebou samým."""
    sada = _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1, cislo=sada[0])

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"race_number_display": 1, "racer_name": "Anicka"},
                         headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["entry"]["race_number_display"] == 1
    assert odpoved.json()["entry"]["racer_name"] == "Anicka"


def test_odebrani_dresu_prazdnou_hodnotou(client, db, zavod, kategorie, timekeeper_headers):
    sada = _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1, cislo=sada[0])

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"race_number_display": ""}, headers=timekeeper_headers)

    ulozena = odpoved.json()["entry"]
    assert ulozena["race_number_id"] is None
    assert ulozena["race_number_display"] is None
    assert ulozena["race_number_actual"] is None
    # A tím se číslo uvolní pro někoho jiného.
    druhy = _zavodnik(db, "Eva", "Zenska", 2000, 2)
    dalsi = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                        json={"racer_id": druhy.id, "race_number_display": 1},
                        headers=timekeeper_headers)
    assert dalsi.status_code == 200, dalsi.text


def test_uprava_bez_zminky_o_dresu_ho_nechá_beze_zmeny(client, db, zavod, kategorie,
                                                       timekeeper_headers):
    sada = _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1, cislo=sada[2])

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"racer_name": "Anicka"}, headers=timekeeper_headers)

    assert odpoved.json()["entry"]["race_number_display"] == 3


def test_prirazeni_deaktivovaneho_cisla_selze(client, db, zavod, kategorie,
                                              timekeeper_headers):
    sada = _cisla(db)
    sada[1].is_active = False
    db.commit()
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1)

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"race_number_display": 2}, headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Systémové číslo 2 je deaktivované"


def test_CHYBA_polozku_s_deaktivovanym_vlastnim_cislem_nelze_ulozit(
        client, db, zavod, kategorie, timekeeper_headers):
    """CHYBA: závodník už dres má, ale číslo bylo mezitím vyřazeno ze sady.
    Uložení jakékoli jiné změny (jméno, ročník) pak skončí chybou, protože se
    kontroluje aktivita čísla dřív, než se pozná, že se dres vůbec nemění."""
    sada = _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1, cislo=sada[0])
    sada[0].is_active = False
    db.commit()

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"race_number_display": 1, "racer_name": "Anicka"},
                         headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Systémové číslo 1 je deaktivované"


def test_CHYBA_cas_poslany_do_upravy_polozky_se_neulozi(client, db, zavod, kategorie,
                                                        timekeeper_headers):
    """CHYBA: PUT /start-list/{id} má větev na přepočet součtu časů, ale samotné
    time1/time2 z těla nikdy nepřevezme - odpoví 200 a čas zahodí."""
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    polozka = _polozka(db, zavod, zavodnik, start_number=1)

    odpoved = client.put(f"/api/timekeeper/start-list/{polozka.id}",
                         json={"time1": 31.5, "time2": 30.25}, headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()["entry"]["time1"] is None
    assert odpoved.json()["entry"]["time_sum"] is None


def test_uprava_neexistujici_polozky_vrati_404(client, timekeeper_headers):
    odpoved = client.put("/api/timekeeper/start-list/9999", json={"start_number": 3},
                         headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Záznam na startovní listině nenalezen"


# --------------------------------------------------------------------------
# Mazání ze startovky
# --------------------------------------------------------------------------

def test_smazani_polozky_precisluje_zbytek(client, db, zavod, kategorie,
                                           timekeeper_headers):
    prvni = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    druhy = _zavodnik(db, "Bara", "Druha", 2017, 2)
    treti = _zavodnik(db, "Cilka", "Treti", 2017, 2)
    _polozka(db, zavod, prvni, start_number=1, category_id=kategorie["u10_zeny"].id)
    prostredni = _polozka(db, zavod, druhy, start_number=2,
                          category_id=kategorie["u10_zeny"].id)
    _polozka(db, zavod, treti, start_number=3, category_id=kategorie["u10_zeny"].id)

    odpoved = client.delete(f"/api/timekeeper/start-list/{prostredni.id}",
                            headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()["message"] == "Závodník odebrán ze startovní listiny"
    vypis = _startovka(client, zavod, timekeeper_headers)
    assert [(r["racer_surname"], r["start_number"]) for r in vypis] == [
        ("Holcicka", 1), ("Treti", 2),
    ]


def test_smazani_polozky_precisluje_podle_poradi_kategorii(client, db, zavod, kategorie,
                                                           timekeeper_headers):
    """Přečíslování nejde jen po pořadí, srovná startovku podle kategorií."""
    dospely = _zavodnik(db, "Petr", "Muzsky", 2000, 1)
    dite = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    navic = _zavodnik(db, "Bara", "Druha", 2017, 2)
    _polozka(db, zavod, dospely, start_number=1, category_id=kategorie["open_muzi"].id)
    _polozka(db, zavod, dite, start_number=2, category_id=kategorie["u10_zeny"].id)
    odebirana = _polozka(db, zavod, navic, start_number=3,
                         category_id=kategorie["u10_zeny"].id)

    client.delete(f"/api/timekeeper/start-list/{odebirana.id}", headers=timekeeper_headers)

    vypis = _startovka(client, zavod, timekeeper_headers)
    assert [(r["racer_surname"], r["start_number"]) for r in vypis] == [
        ("Holcicka", 1), ("Muzsky", 2),
    ]


def test_smazani_polozky_nezasahne_jiny_zavod(client, db, zavod, kategorie,
                                              timekeeper_headers):
    jiny = _zavod(db, race_nr="JMLP2026-02")
    a = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    b = _zavodnik(db, "Bara", "Druha", 2017, 2)
    odebirana = _polozka(db, zavod, a, start_number=1)
    _polozka(db, jiny, b, start_number=7)

    client.delete(f"/api/timekeeper/start-list/{odebirana.id}", headers=timekeeper_headers)

    assert _startovka(client, zavod, timekeeper_headers) == []
    assert _startovka(client, jiny, timekeeper_headers)[0]["start_number"] == 7


def test_smazani_neexistujici_polozky_vrati_404(client, timekeeper_headers):
    odpoved = client.delete("/api/timekeeper/start-list/9999", headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Záznam na startovní listině nenalezen"


def test_smazani_cele_startovky_odpovi_200_a_smaze_jen_svuj_zavod(
        client, klient_jako_v_provozu, db, zavod, kategorie, ctyri_prihlaseni,
        timekeeper_headers):
    """Dřív tenhle endpoint vracel 500 vždycky: obsluha byla deklarovaná jako
    Dict[str, str], ale do odpovědi dávala i logické idempotency_replayed.
    Startovka se smazala, časoměřič ale viděl chybu a nevěděl, na čem je."""
    _cisla(db)
    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)
    jiny = _zavod(db, race_nr="JMLP2026-02")
    cizi = _zavodnik(db, "Ivan", "Cizi", 2000, 1)
    _polozka(db, jiny, cizi, start_number=1)

    odpoved = klient_jako_v_provozu.delete(f"/api/timekeeper/races/{zavod.id}/start-list",
                                           headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["message"] == "Smazáno 4 záznamů ze startovní listiny"
    assert odpoved.json()["idempotency_replayed"] is False
    assert _startovka(client, zavod, timekeeper_headers) == []
    # Jiný závod zůstal nedotčený.
    assert len(_startovka(client, jiny, timekeeper_headers)) == 1


def test_dvoji_odeslani_smazani_startovky_se_neprovede_dvakrat(
        client, db, zavod, kategorie, ctyri_prihlaseni, timekeeper_headers):
    """Přehrávka z offline fronty nesmí smazat startovku vygenerovanou mezitím."""
    _cisla(db)
    hlavicky = {**timekeeper_headers, "X-Idempotency-Key": "smazat-startovku-1"}
    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    prvni = client.delete(f"/api/timekeeper/races/{zavod.id}/start-list", headers=hlavicky)
    assert prvni.status_code == 200, prvni.text

    # Startovka se mezitím vygeneruje znovu.
    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    druhy = client.delete(f"/api/timekeeper/races/{zavod.id}/start-list", headers=hlavicky)

    assert druhy.status_code == 200
    assert druhy.json()["idempotency_replayed"] is True
    assert len(_startovka(client, zavod, timekeeper_headers)) == 4


def test_smazani_startovky_nechava_prihlasky_beze_zmeny(
        client, klient_jako_v_provozu, db, zavod, kategorie, ctyri_prihlaseni,
        timekeeper_headers):
    _cisla(db)
    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    klient_jako_v_provozu.delete(f"/api/timekeeper/races/{zavod.id}/start-list",
                                 headers=timekeeper_headers)

    _obnov(db)
    assert db.query(models.Registration).filter(
        models.Registration.race_id == zavod.id).count() == 4
    # Startovku lze proto postavit znovu.
    znovu = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                        json={}, headers=timekeeper_headers)
    assert znovu.json()["added"] == 4
    assert len(_startovka(client, zavod, timekeeper_headers)) == 4


def test_smazani_startovky_neexistujiciho_zavodu_vrati_404(client, timekeeper_headers):
    odpoved = client.delete("/api/timekeeper/races/9999/start-list", headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závod nenalezen"


def test_smazani_startovky_se_stejnym_klicem_se_neopakuje(
        client, klient_jako_v_provozu, db, zavod, kategorie, ctyri_prihlaseni,
        timekeeper_headers):
    """Druhý pokus se stejným klíčem už nemaže - i když se to (viz CHYBA výše)
    z odpovědi nedá poznat."""
    _cisla(db)
    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)
    hlavicky = dict(timekeeper_headers, **{"X-Idempotency-Key": "smaz-1"})
    klient_jako_v_provozu.delete(f"/api/timekeeper/races/{zavod.id}/start-list",
                                 headers=hlavicky)
    assert _startovka(client, zavod, timekeeper_headers) == []

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)
    klient_jako_v_provozu.delete(f"/api/timekeeper/races/{zavod.id}/start-list",
                                 headers=hlavicky)

    # Nová listina zůstala nedotčená - odpověď byla jen ozvěna té první.
    assert len(_startovka(client, zavod, timekeeper_headers)) == 4


# --------------------------------------------------------------------------
# Vyhledávání závodníků a pořadí kategorií
# --------------------------------------------------------------------------

def test_vyhledavani_vyzaduje_alespon_dva_znaky(client, db, timekeeper_headers):
    _zavodnik(db, "Anna", "Holcicka", 2017, 2)

    assert client.get("/api/timekeeper/racers/search?q=H",
                      headers=timekeeper_headers).json() == []
    assert client.get("/api/timekeeper/racers/search",
                      headers=timekeeper_headers).json() == []


def test_vyhledavani_najde_podle_prijmeni_i_registracniho_cisla(client, db, timekeeper_headers):
    klub = _klub(db, "SK Pardubice")
    _zavodnik(db, "Anna", "Holcicka", 2017, 2, club_id=klub.id, slcr_id="CZ12345")
    _zavodnik(db, "Petr", "Muzsky", 2000, 1, club_id=klub.id)

    podle_jmena = client.get("/api/timekeeper/racers/search?q=Holc",
                             headers=timekeeper_headers).json()
    podle_slcr = client.get("/api/timekeeper/racers/search?q=CZ123",
                            headers=timekeeper_headers).json()

    assert [z["surname"] for z in podle_jmena] == ["Holcicka"]
    assert podle_jmena[0]["club_name"] == "SK Pardubice"
    assert podle_jmena[0]["year"] == 2017
    assert podle_jmena[0]["sex"] == 2
    assert [z["surname"] for z in podle_slcr] == ["Holcicka"]


def test_vyhledavani_nic_nenajde_pro_neznamy_retezec(client, db, timekeeper_headers):
    _zavodnik(db, "Anna", "Holcicka", 2017, 2)

    assert client.get("/api/timekeeper/racers/search?q=Xyz",
                      headers=timekeeper_headers).json() == []


def test_kategorie_pro_razeni_jsou_jen_aktivni_a_od_nejmladsich(client, db, kategorie,
                                                                timekeeper_headers):
    _kategorie(db, "ZRUSENA", 1950, 2015, 1, active=False)

    odpoved = client.get("/api/timekeeper/categories", headers=timekeeper_headers)

    assert odpoved.status_code == 200
    vraceno = odpoved.json()
    assert [k["id"] for k in vraceno] == [
        kategorie["u10_zeny"].id, kategorie["u10_muzi"].id,
        kategorie["open_zeny"].id, kategorie["open_muzi"].id,
    ]
    assert [k["sex_label"] for k in vraceno] == ["Ženy", "Muži", "Ženy", "Muži"]
    assert "ZRUSENA" not in [k["name"] for k in vraceno]


# --------------------------------------------------------------------------
# Sady dresových čísel
# --------------------------------------------------------------------------

def test_vytvoreni_sady_vytvori_cely_rozsah(client, timekeeper_headers):
    odpoved = client.post("/api/timekeeper/race-number-sets",
                          json={"set_number": 2, "actual_from": 1, "actual_to": 3,
                                "display_from": 201, "set_color": "blue"},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["created"] == 3
    assert odpoved.json()["display_range"] == "201-203"

    cisla = client.get("/api/timekeeper/race-numbers?set_number=2",
                       headers=timekeeper_headers).json()
    assert [(c["actual_number"], c["display_number"]) for c in cisla] == [
        (1, 201), (2, 202), (3, 203),
    ]
    assert all(c["is_active"] and c["set_color"] == "blue" for c in cisla)


def test_sadu_se_stejnym_cislem_nelze_zalozit_dvakrat(client, db, timekeeper_headers):
    _cisla(db, set_number=1, actual_from=1, actual_to=3, display_from=1)

    odpoved = client.post("/api/timekeeper/race-number-sets",
                          json={"set_number": 1, "actual_to": 3, "display_from": 500},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "Sada č. 1 již existuje" in odpoved.json()["detail"]


def test_prekryv_systemovych_cisel_selze(client, db, timekeeper_headers):
    _cisla(db, set_number=1, actual_from=1, actual_to=10, display_from=1)

    odpoved = client.post("/api/timekeeper/race-number-sets",
                          json={"set_number": 2, "actual_to": 5, "display_from": 8},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "překrývají" in odpoved.json()["detail"]
    _obnov(db)
    assert db.query(models.RaceNumber).filter(models.RaceNumber.set_number == 2).count() == 0


def test_sada_s_neplatnou_barvou_selze(client, db, timekeeper_headers):
    odpoved = client.post("/api/timekeeper/race-number-sets",
                          json={"set_number": 1, "actual_to": 3, "display_from": 1,
                                "set_color": "duhova"},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "Neplatná barva sady" in odpoved.json()["detail"]
    _obnov(db)
    assert db.query(models.RaceNumber).count() == 0


def test_sada_bez_povinnych_parametru_selze(client, timekeeper_headers):
    odpoved = client.post("/api/timekeeper/race-number-sets",
                          json={"set_number": 1}, headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "Chybí povinné parametry" in odpoved.json()["detail"]


def test_prevraceny_rozsah_sady_selze(client, timekeeper_headers):
    odpoved = client.post("/api/timekeeper/race-number-sets",
                          json={"set_number": 1, "actual_from": 10, "actual_to": 3,
                                "display_from": 1},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "actual_from musí být menší" in odpoved.json()["detail"]


def test_prehled_sad_scita_aktivni_a_neaktivni_cisla(client, db, timekeeper_headers):
    sada = _cisla(db, set_number=1, actual_from=1, actual_to=4, display_from=1)
    _cisla(db, set_number=2, actual_from=1, actual_to=2, display_from=201, color="blue")
    sada[0].is_active = False
    db.commit()

    prehled = client.get("/api/timekeeper/race-number-sets", headers=timekeeper_headers).json()

    assert [s["set_number"] for s in prehled] == [1, 2]
    prvni = prehled[0]
    assert (prvni["count"], prvni["active_count"], prvni["inactive_count"]) == (4, 3, 1)
    assert (prvni["min_actual"], prvni["max_actual"]) == (1, 4)
    assert (prvni["min_display"], prvni["max_display"]) == (1, 4)
    assert prehled[1]["set_color"] == "blue"


def test_vypis_cisel_sady_je_serazeny_podle_dresoveho_cisla(client, db, timekeeper_headers):
    _cisla(db, set_number=1, actual_from=1, actual_to=3, display_from=1)
    _cisla(db, set_number=2, actual_from=1, actual_to=3, display_from=201, color="blue")

    cisla = client.get("/api/timekeeper/race-numbers?set_number=2",
                       headers=timekeeper_headers).json()

    assert [c["actual_number"] for c in cisla] == [1, 2, 3]
    assert all(c["set_number"] == 2 for c in cisla)


def test_nabidka_cisel_obsahuje_jen_aktivni_napric_sadami(client, db, timekeeper_headers):
    sada1 = _cisla(db, set_number=1, actual_from=1, actual_to=2, display_from=1)
    _cisla(db, set_number=2, actual_from=1, actual_to=2, display_from=201, color="blue")
    sada1[0].is_active = False
    db.commit()

    nabidka = client.get("/api/timekeeper/race-number-options",
                         headers=timekeeper_headers).json()

    assert [c["display_number"] for c in nabidka] == [2, 201, 202]


def test_pridani_jednotliveho_cisla_prevezme_barvu_sady(client, db, timekeeper_headers):
    _cisla(db, set_number=2, actual_from=1, actual_to=2, display_from=201, color="amber")

    odpoved = client.post("/api/timekeeper/race-numbers",
                          json={"set_number": 2, "actual_number": 3, "display_number": 203},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["set_color"] == "amber"
    assert odpoved.json()["is_active"] is True
    cisla = client.get("/api/timekeeper/race-numbers?set_number=2",
                       headers=timekeeper_headers).json()
    assert [c["display_number"] for c in cisla] == [201, 202, 203]


def test_duplicitni_dresove_cislo_v_sade_selze(client, db, timekeeper_headers):
    _cisla(db, set_number=1, actual_from=1, actual_to=3, display_from=1)

    odpoved = client.post("/api/timekeeper/race-numbers",
                          json={"set_number": 1, "actual_number": 2, "display_number": 55},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Dresové číslo 2 již v sadě 1 existuje"


def test_duplicitni_systemove_cislo_napric_sadami_selze(client, db, timekeeper_headers):
    _cisla(db, set_number=1, actual_from=1, actual_to=3, display_from=1)

    odpoved = client.post("/api/timekeeper/race-numbers",
                          json={"set_number": 2, "actual_number": 1, "display_number": 2},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Zobrazovací číslo 2 již existuje (sada 1)"


def test_pridani_cisla_bez_parametru_selze(client, timekeeper_headers):
    odpoved = client.post("/api/timekeeper/race-numbers",
                          json={"set_number": 1, "actual_number": 5},
                          headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "Chybí povinné parametry" in odpoved.json()["detail"]


def test_deaktivace_cisla_ho_vyradi_z_nabidky(client, db, timekeeper_headers):
    sada = _cisla(db, actual_from=1, actual_to=2, display_from=1)

    odpoved = client.put(f"/api/timekeeper/race-numbers/{sada[0].id}",
                         json={"is_active": False}, headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()["message"] == "Číslo 1 je nyní deaktivní"
    nabidka = client.get("/api/timekeeper/race-number-options",
                         headers=timekeeper_headers).json()
    assert [c["display_number"] for c in nabidka] == [2]


def test_uprava_cisla_bez_priznaku_selze(client, db, timekeeper_headers):
    sada = _cisla(db, actual_from=1, actual_to=1, display_from=1)

    odpoved = client.put(f"/api/timekeeper/race-numbers/{sada[0].id}",
                         json={"set_color": "blue"}, headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Chybí parametr is_active"


def test_uprava_neexistujiciho_cisla_vrati_404(client, timekeeper_headers):
    odpoved = client.put("/api/timekeeper/race-numbers/9999", json={"is_active": False},
                         headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závodní číslo nenalezeno"


def test_smazani_cisla_odpoji_polozku_startovky(client, db, zavod, kategorie,
                                                timekeeper_headers):
    sada = _cisla(db, actual_from=1, actual_to=2, display_from=1)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    _polozka(db, zavod, zavodnik, start_number=1, cislo=sada[0])

    odpoved = client.delete(f"/api/timekeeper/race-numbers/{sada[0].id}",
                            headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert "Smazáno číslo 1" in odpoved.json()["message"]
    radek = _startovka(client, zavod, timekeeper_headers)[0]
    assert radek["race_number_id"] is None
    # Snímek dresu v listině zůstává, i když číslo v číselníku už neexistuje.
    assert radek["race_number_display"] == 1


def test_smazani_neexistujiciho_cisla_vrati_404(client, timekeeper_headers):
    odpoved = client.delete("/api/timekeeper/race-numbers/9999", headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závodní číslo nenalezeno"


def test_smazani_sady_smaze_cisla_a_odpoji_startovku(client, db, zavod, kategorie,
                                                     timekeeper_headers):
    sada1 = _cisla(db, set_number=1, actual_from=1, actual_to=2, display_from=1)
    _cisla(db, set_number=2, actual_from=1, actual_to=2, display_from=201, color="blue")
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    _polozka(db, zavod, zavodnik, start_number=1, cislo=sada1[0])

    odpoved = client.delete("/api/timekeeper/race-number-sets/1", headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()["message"] == "Smazáno 2 závodních čísel ze sady 1"
    _obnov(db)
    assert db.query(models.RaceNumber).count() == 2
    assert _startovka(client, zavod, timekeeper_headers)[0]["race_number_id"] is None


def test_smazani_neexistujici_sady_vrati_404(client, timekeeper_headers):
    odpoved = client.delete("/api/timekeeper/race-number-sets/9", headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Sada č. 9 nenalezena"


def test_zmena_barvy_sady_se_projevi_ve_startovce(client, db, zavod, kategorie,
                                                  timekeeper_headers):
    sada = _cisla(db, actual_from=1, actual_to=2, display_from=1, color="rose")
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    _polozka(db, zavod, zavodnik, start_number=1, cislo=sada[0])

    odpoved = client.put("/api/timekeeper/race-number-sets/1",
                         json={"set_color": "emerald"}, headers=timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()["set_color"] == "emerald"
    assert _startovka(client, zavod, timekeeper_headers)[0]["set_color"] == "emerald"


def test_zmena_barvy_na_neplatnou_selze(client, db, timekeeper_headers):
    _cisla(db, actual_from=1, actual_to=2, display_from=1, color="rose")

    odpoved = client.put("/api/timekeeper/race-number-sets/1",
                         json={"set_color": "duhova"}, headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert "Povolené hodnoty" in odpoved.json()["detail"]
    cisla = client.get("/api/timekeeper/race-numbers?set_number=1",
                       headers=timekeeper_headers).json()
    assert cisla[0]["set_color"] == "rose"


def test_zmena_barvy_bez_parametru_selze(client, db, timekeeper_headers):
    _cisla(db, actual_from=1, actual_to=2, display_from=1)

    odpoved = client.put("/api/timekeeper/race-number-sets/1", json={},
                         headers=timekeeper_headers)

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Chybí parametr set_color"


def test_zmena_barvy_neexistujici_sady_vrati_404(client, timekeeper_headers):
    odpoved = client.put("/api/timekeeper/race-number-sets/9", json={"set_color": "blue"},
                         headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Sada č. 9 nenalezena"


def test_pridani_cisla_se_stejnym_klicem_se_neopakuje(client, db, timekeeper_headers):
    _cisla(db, set_number=1, actual_from=1, actual_to=2, display_from=1)
    hlavicky = dict(timekeeper_headers, **{"X-Idempotency-Key": "cislo-1"})
    telo = {"set_number": 1, "actual_number": 3, "display_number": 3}
    prvni = client.post("/api/timekeeper/race-numbers", json=telo, headers=hlavicky)
    assert prvni.json()["idempotency_replayed"] is False

    druhy = client.post("/api/timekeeper/race-numbers", json=telo, headers=hlavicky)

    assert druhy.status_code == 200
    assert druhy.json()["idempotency_replayed"] is True
    _obnov(db)
    assert db.query(models.RaceNumber).filter(models.RaceNumber.display_number == 3).count() == 1


# --------------------------------------------------------------------------
# Oprávnění
# --------------------------------------------------------------------------

CTECI_ENDPOINTY = [
    ("get", "/api/timekeeper/categories"),
    ("get", "/api/timekeeper/race-number-sets"),
    ("get", "/api/timekeeper/race-number-options"),
    ("get", "/api/timekeeper/racers/search?q=No"),
    ("get", "/api/timekeeper/races/1/start-list"),
    ("get", "/api/timekeeper/start-list/1"),
]

ZAPISOVE_ENDPOINTY = [
    ("post", "/api/timekeeper/races/1/start-list/generate"),
    ("post", "/api/timekeeper/races/1/start-list/entry"),
    ("put", "/api/timekeeper/start-list/1"),
    ("put", "/api/timekeeper/start-list/1/excluded"),
    ("delete", "/api/timekeeper/start-list/1"),
    ("delete", "/api/timekeeper/races/1/start-list"),
    ("post", "/api/timekeeper/race-number-sets"),
    ("post", "/api/timekeeper/race-numbers"),
    ("put", "/api/timekeeper/race-numbers/1"),
    ("delete", "/api/timekeeper/race-numbers/1"),
    ("put", "/api/timekeeper/race-number-sets/1"),
    ("delete", "/api/timekeeper/race-number-sets/1"),
]


@pytest.mark.parametrize("metoda,cesta", CTECI_ENDPOINTY + ZAPISOVE_ENDPOINTY)
def test_startovka_neni_pristupna_bez_prihlaseni(client, metoda, cesta):
    # client.request, ne getattr(client, metoda): httpx u GET a DELETE
    # argument json= nepřijímá.
    odpoved = client.request(metoda.upper(), cesta, json={})

    assert odpoved.status_code == 403
    assert odpoved.json()["detail"] == "Not authenticated"


@pytest.mark.parametrize("metoda,cesta", ZAPISOVE_ENDPOINTY)
def test_zapis_do_startovky_s_neplatnym_tokenem_vrati_401(client, metoda, cesta):
    odpoved = client.request(metoda.upper(), cesta, json={},
                             headers={"Authorization": "Bearer nesmysl"})

    assert odpoved.status_code == 401
    assert odpoved.json()["detail"] == "Could not validate credentials"


def test_spravce_ma_ke_startovce_pristup(client, db, zavod, kategorie, admin_headers):
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    _polozka(db, zavod, zavodnik, start_number=1)

    odpoved = client.get(f"/api/timekeeper/races/{zavod.id}/start-list", headers=admin_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()[0]["racer_surname"] == "Holcicka"


def test_podvrzeny_token_ke_startovce_nesmi(client, zavod, kategorie):
    """Sloupec role je ENUM('admin','timekeeper') a obě role ke startovce smí
    (endpointy visí na get_current_admin), takže se hlídá platnost tokenu."""
    odpoved = client.get(f"/api/timekeeper/races/{zavod.id}/start-list",
                         headers={"Authorization": "Bearer podvrh"})

    assert odpoved.status_code == 401
    assert odpoved.json()["detail"] == "Could not validate credentials"


def test_zruseny_ucet_casomerice_ke_startovce_nesmi(client, db, zavod, kategorie):
    hlavicky = _hlavicka(_uzivatel(db, "byvaly@test.cz", "timekeeper", is_active=False))

    odpoved = client.get(f"/api/timekeeper/races/{zavod.id}/start-list", headers=hlavicky)

    assert odpoved.status_code == 401
    assert odpoved.json()["detail"] == "Could not validate credentials"


def test_bez_opravneni_se_startovka_nezmeni(client, db, zavod, kategorie):
    """Odmítnutý požadavek nesmí nic zapsat - ověření běží před obsluhou."""
    _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    _prihlaska(db, zavod, zavodnik)
    hlavicky = _hlavicka(_uzivatel(db, "byvaly@test.cz", "timekeeper", is_active=False))

    odpoved = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                          json={}, headers=hlavicky)

    assert odpoved.status_code == 401
    _obnov(db)
    assert db.query(models.StartListEntry).count() == 0


# --------------------------------------------------------------------------
# Údaje pro listiny v podobě z LiZy
# --------------------------------------------------------------------------

def test_startovka_nese_registracni_cislo_a_sadu(client, db, zavod, kategorie, timekeeper_headers):
    """Startovka tiskne registrační číslo SLČR ve sloupci "Body" a rozpis po klubech
    číslo sady před startovním číslem - obojí musí přijít v řádku startovky."""
    cislo = _cisla(db, set_number=2, actual_from=5, actual_to=5)[0]
    s_cislem = _zavodnik(db, "Anna", "Registrovana", 2018, 2, slcr_id="891586")
    bez_cisla = _zavodnik(db, "Bara", "Bezcisla", 2018, 2, slcr_id="-")
    _polozka(db, zavod, s_cislem, start_number=1, cislo=cislo)
    _polozka(db, zavod, bez_cisla, start_number=2)

    radky = _podle_prijmeni(_startovka(client, zavod, timekeeper_headers))

    assert radky["Registrovana"]["slcr_id"] == "891586"
    assert radky["Registrovana"]["set_number"] == 2
    # "-" v datech znamená, že registrační číslo nemá.
    assert radky["Bezcisla"]["slcr_id"] is None
    assert radky["Bezcisla"]["set_number"] is None


def test_generovani_radi_kategorii_podle_poradi_prihlaseni(client, db, zavod, kategorie,
                                                          timekeeper_headers):
    """V kategorii startuje dřív, kdo se dřív přihlásil - ne podle toho, v jakém
    pořadí leží přihlášky v tabulce. Při stejném čase rozhodne pořadí záznamu."""
    _cisla(db)
    zaklad = datetime(2026, 9, 20, 10, 0, 0)
    pozdni = _zavodnik(db, "Anna", "Pozdni", 2017, 2)
    prvni = _zavodnik(db, "Bara", "Prvni", 2017, 2)
    druha = _zavodnik(db, "Cecilie", "Druha", 2017, 2)
    stejna_a = _zavodnik(db, "Dana", "StejnaA", 2017, 2)
    stejna_b = _zavodnik(db, "Eva", "StejnaB", 2017, 2)
    _prihlaska(db, zavod, pozdni, registered_at=zaklad + timedelta(hours=5))
    _prihlaska(db, zavod, prvni, registered_at=zaklad)
    _prihlaska(db, zavod, druha, registered_at=zaklad + timedelta(minutes=1))
    _prihlaska(db, zavod, stejna_a, registered_at=zaklad + timedelta(hours=2))
    _prihlaska(db, zavod, stejna_b, registered_at=zaklad + timedelta(hours=2))

    client.post(f"/api/timekeeper/races/{zavod.id}/start-list/generate",
                json={}, headers=timekeeper_headers)

    radky = sorted(_startovka(client, zavod, timekeeper_headers), key=lambda r: r["start_number"])
    assert [r["racer_surname"] for r in radky] == ["Prvni", "Druha", "StejnaA", "StejnaB", "Pozdni"]


# --------------------------------------------------------------------------
# Offline dohláška: idempotence a lokální kopie registru
# --------------------------------------------------------------------------

def test_rucni_pridani_se_stejnym_klicem_nezalozi_zavodnika_dvakrat(
        client, db, zavod, kategorie, timekeeper_headers):
    """Fronta časomíry pošle offline dohlášku po výpadku znovu se stejným klíčem."""
    _cisla(db)
    telo = {"racer_name": "Nova", "racer_surname": "Osoba", "racer_year": 2017,
            "racer_sex": 2, "club_name": "Novy klub", "client_temp_id": -1700000000000}
    hlavicky = {**timekeeper_headers, "X-Idempotency-Key": "offline-op-1"}

    prvni = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry", json=telo, headers=hlavicky)
    druha = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry", json=telo, headers=hlavicky)

    assert prvni.status_code == 200 and druha.status_code == 200, druha.text
    assert druha.json()["id"] == prvni.json()["id"]
    assert druha.json()["client_temp_id"] == -1700000000000
    assert druha.json()["idempotency_replayed"] is True
    _obnov(db)
    assert db.query(models.Racer).filter(models.Racer.surname == "Osoba").count() == 1
    assert db.query(models.StartListEntry).filter(models.StartListEntry.race_id == zavod.id).count() == 1


def test_kopie_registru_pro_offline_hledani(client, db, timekeeper_headers):
    klub = _klub(db, "SK Pardubice")
    _zavodnik(db, "Anna", "Holcicka", 2017, 2, club_id=klub.id, slcr_id="891586")

    odpoved = client.get("/api/timekeeper/racers/snapshot", headers=timekeeper_headers)

    assert odpoved.status_code == 200
    [zavodnik] = odpoved.json()
    assert zavodnik == {"id": zavodnik["id"], "name": "Anna", "surname": "Holcicka", "year": 2017,
                        "sex": 2, "club_name": "SK Pardubice", "slcr_id": "891586"}


def test_offline_dohlaska_uz_zapsaneho_zavodnika_se_spoji_s_jeho_radkem(
        client, db, zavod, kategorie, timekeeper_headers):
    """Mezitím ho přidalo jiné zařízení - časomíra dostane jeho řádek, ne chybu."""
    _cisla(db)
    zavodnik = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    prvni = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                        json={"racer_id": zavodnik.id}, headers=timekeeper_headers).json()

    offline = client.post(f"/api/timekeeper/races/{zavod.id}/start-list/entry",
                          json={"racer_id": zavodnik.id, "client_temp_id": -5},
                          headers={**timekeeper_headers, "X-Idempotency-Key": "op-merge"})

    assert offline.status_code == 200, offline.text
    assert offline.json()["id"] == prvni["id"]
    assert offline.json()["merged_existing"] is True
    assert offline.json()["client_temp_id"] == -5
