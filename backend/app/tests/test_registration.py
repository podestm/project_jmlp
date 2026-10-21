"""Přihlašování na závody - app/routers/registration.py,
app/routers/admin/registrations.py a vyřizování žádostí o klub
(app/routers/admin/clubs.py).

Přihláška je jediná věc, kterou na webu dělá nepřihlášený návštěvník, a zapisuje
přitom do dvou tabulek najednou (závodník + registrace). Testy proto hlídají
hlavně hranice: co se smí přepsat cizímu závodníkovi, co se stane při duplicitě,
zavřené registraci a neplatném klubu, a co z toho vidí správce.

Tabulky jsou MyISAM, takže žádný rollback neexistuje - několik testů drží
současné (chybné) chování, kdy po odmítnuté přihlášce zůstane v databázi
osiřelý řádek. Jsou označené slovem CHYBA.
"""
from datetime import date, datetime

import pytest

from app import models
from app.utils import get_current_season_id

AKTUALNI_SEZONA = get_current_season_id()


@pytest.fixture
def klient_jako_v_provozu():
    """TestClient, který výjimku ze serveru nepřehazuje do testu, ale vrátí
    odpověď tak, jak ji uvidí prohlížeč.

    Potřeba u vlastních validátorů ve schematech - ty dnes shodí obsluhu
    validačních chyb (viz testy níž), takže standardní `client` by test
    utnul výjimkou místo aby ukázal, co dostane uživatel.
    """
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


# --------------------------------------------------------------------------
# Pomocníci pro testovací data
# --------------------------------------------------------------------------

def _klub(db, name, valid=True):
    klub = models.Club(name=name, valid=valid)
    db.add(klub)
    db.commit()
    db.refresh(klub)
    return klub


def _zavod(db, race_nr="JMLP2026-01", registration=True, datum=None, season_id=None):
    zavod = models.Race(
        race_nr=race_nr,
        datum=datum or date.today(),
        season_id=season_id or AKTUALNI_SEZONA,
        closed=False,
        registration=registration,
        race_method_id=1,
        is_live=False,
    )
    db.add(zavod)
    db.commit()
    db.refresh(zavod)
    return zavod


def _zavodnik(db, name="Jan", surname="Novak", year=2010, sex=1, club_id=None,
              telefon=None, email=None, slcr_id=None, category_id=None):
    zavodnik = models.Racer(
        name=name, surname=surname, year=year, sex=sex, club_id=club_id,
        telefon=telefon, email=email, slcr_id=slcr_id, category_id=category_id,
    )
    db.add(zavodnik)
    db.commit()
    db.refresh(zavodnik)
    return zavodnik


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


def _registrace(db, zavod_id, zavodnik_id, category_id=None, note=None, registered_at=None):
    registrace = models.Registration(
        race_id=zavod_id,
        racer_id=zavodnik_id,
        category_id=category_id,
        club_request_note=note,
        registered_at=registered_at or datetime.utcnow(),
    )
    db.add(registrace)
    db.commit()
    db.refresh(registrace)
    return registrace


def _telo(zavod_id, **extra):
    """Tělo přihlášky. Schéma vyžaduje buď klub, nebo poznámku pro admina."""
    telo = {"race_id": zavod_id}
    telo.update(extra)
    if "club_id" not in telo and "club_request_note" not in telo:
        telo["club_request_note"] = "Nevím, doplňte prosím"
    return telo


def _obnov(db):
    """Zahodí objekty v identity mapě - jinak by test po volání API četl
    hodnoty, které session načetla ještě před zápisem."""
    db.expire_all()


def _pocet_registraci(db, zavod_id=None):
    dotaz = db.query(models.Registration)
    if zavod_id is not None:
        dotaz = dotaz.filter(models.Registration.race_id == zavod_id)
    return dotaz.count()


# ==========================================================================
# Veřejná přihláška - úspěšný průchod
# ==========================================================================

def test_novy_zavodnik_se_prihlasi_a_zalozi_se_i_zavodnik(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Motolodě Pardubice")

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="  Jan  ", racer_surname="  Novak  ",
        racer_year=2010, racer_sex=1, racer_telefon=" 777123456 ",
        racer_email=" jan@example.cz ", racer_slcr_id=" AB12 ",
        club_id=klub.id,
    ))

    assert odpoved.status_code == 200, odpoved.text
    telo = odpoved.json()
    assert telo["race_id"] == zavod.id
    assert telo["registered_at"]

    zavodnik = db.query(models.Racer).filter(models.Racer.id == telo["racer_id"]).one()
    assert (zavodnik.name, zavodnik.surname) == ("Jan", "Novak")
    assert zavodnik.telefon == "777123456"
    assert zavodnik.email == "jan@example.cz"
    assert zavodnik.slcr_id == "AB12"
    assert zavodnik.club_id == klub.id

    registrace = db.query(models.Registration).filter(models.Registration.id == telo["id"]).one()
    assert registrace.race_id == zavod.id
    assert registrace.racer_id == zavodnik.id
    assert registrace.club_request_note is None


def test_prihlaska_priradi_kategorii_podle_rocniku_a_pohlavi(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zaci = _kategorie(db, "Žáci", 2008, 2012, sex=1)
    zakyne = _kategorie(db, "Žákyně", 2008, 2012, sex=2)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Eva", racer_surname="Mala",
        racer_year=2010, racer_sex=2, club_id=klub.id,
    ))

    assert odpoved.status_code == 200, odpoved.text
    registrace = db.query(models.Registration).filter(
        models.Registration.id == odpoved.json()["id"]).one()
    assert registrace.category_id == zakyne.id
    assert registrace.category_id != zaci.id

    zavodnik = db.query(models.Racer).filter(
        models.Racer.id == odpoved.json()["racer_id"]).one()
    assert zavodnik.category_id == zakyne.id


def test_kategorie_pro_dane_pohlavi_prebiji_smisenou(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    _kategorie(db, "Open", 2008, 2012, sex=0)
    muzska = _kategorie(db, "Žáci", 2008, 2012, sex=1)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Petr", racer_surname="Maly",
        racer_year=2010, racer_sex=1, club_id=klub.id,
    ))

    assert odpoved.status_code == 200, odpoved.text
    registrace = db.query(models.Registration).filter(
        models.Registration.id == odpoved.json()["id"]).one()
    assert registrace.category_id == muzska.id


def test_neaktivni_kategorie_se_neprirazuje(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    _kategorie(db, "Zrušená", 2008, 2012, sex=1, active=False)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Petr", racer_surname="Maly",
        racer_year=2010, racer_sex=1, club_id=klub.id,
    ))

    assert odpoved.status_code == 200, odpoved.text
    registrace = db.query(models.Registration).filter(
        models.Registration.id == odpoved.json()["id"]).one()
    assert registrace.category_id is None


def test_existujici_zavodnik_se_prihlasi_bez_zalozeni_duplikatu(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Jan", surname="Novak", year=2010, sex=1)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id, club_id=klub.id,
    ))

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["racer_id"] == zavodnik.id
    assert db.query(models.Racer).count() == 1


def test_zavodnik_zadany_znovu_jmenem_se_neduplikuje(client, db):
    """Shoda jméno + příjmení + ročník + pohlaví je totožnost závodníka."""
    zavod_prvni = _zavod(db, race_nr="JMLP2026-01")
    zavod_druhy = _zavod(db, race_nr="JMLP2026-02")
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Jan", surname="Novak", year=2010, sex=1)
    _registrace(db, zavod_prvni.id, zavodnik.id)

    odpoved = client.post("/registrations/", json=_telo(
        zavod_druhy.id, racer_name="Jan", racer_surname="Novak",
        racer_year=2010, racer_sex=1, club_id=klub.id,
    ))

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["racer_id"] == zavodnik.id
    assert db.query(models.Racer).count() == 1


def test_stejny_zavodnik_se_muze_prihlasit_na_dva_zavody(client, db):
    prvni = _zavod(db, race_nr="JMLP2026-01")
    druhy = _zavod(db, race_nr="JMLP2026-02")
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db)

    for zavod in (prvni, druhy):
        odpoved = client.post("/registrations/", json=_telo(
            zavod.id, racer_id=zavodnik.id, club_id=klub.id))
        assert odpoved.status_code == 200, odpoved.text

    assert _pocet_registraci(db, prvni.id) == 1
    assert _pocet_registraci(db, druhy.id) == 1


def test_prihlaska_pres_endpoint_zavodu_pouzije_id_z_url(client, db):
    """/races/{id}/register přepisuje race_id z těla - URL je rozhodující."""
    cilovy = _zavod(db, race_nr="JMLP2026-01")
    jiny = _zavod(db, race_nr="JMLP2026-02")
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db)

    odpoved = client.post(f"/races/{cilovy.id}/register", json=_telo(
        jiny.id, racer_id=zavodnik.id, club_id=klub.id))

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["race_id"] == cilovy.id
    assert _pocet_registraci(db, jiny.id) == 0


def test_pocet_prihlasenych_neni_nicim_omezeny(client, db):
    """Kapacita závodu v datovém modelu ani v kódu neexistuje - přihlásit se
    může libovolný počet lidí. Test drží současné chování."""
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")

    for poradi in range(5):
        odpoved = client.post("/registrations/", json=_telo(
            zavod.id, racer_name=f"Jezdec{poradi}", racer_surname="Testovaci",
            racer_year=2000 + poradi, racer_sex=1, club_id=klub.id))
        assert odpoved.status_code == 200, odpoved.text

    assert _pocet_registraci(db, zavod.id) == 5


# ==========================================================================
# Veřejná přihláška - co se musí nepovést
# ==========================================================================

def test_prihlaska_na_neexistujici_zavod_vrati_404(client, db):
    klub = _klub(db, "Klub A")

    odpoved = client.post("/registrations/", json=_telo(
        9999, racer_name="Jan", racer_surname="Novak",
        racer_year=2010, racer_sex=1, club_id=klub.id))

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Race not found"
    assert db.query(models.Racer).count() == 0


def test_prihlaska_na_uzavrenou_registraci_se_odmitne(client, db):
    zavod = _zavod(db, registration=False)
    klub = _klub(db, "Klub A")

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Jan", racer_surname="Novak",
        racer_year=2010, racer_sex=1, club_id=klub.id))

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Registration is closed for this race"
    assert _pocet_registraci(db, zavod.id) == 0
    assert db.query(models.Racer).count() == 0


def test_druha_prihlaska_stejneho_zavodnika_se_odmitne(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db)
    _registrace(db, zavod.id, zavodnik.id)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id, club_id=klub.id))

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Jezdec je již zaregistrován na tento závod"
    assert _pocet_registraci(db, zavod.id) == 1


def test_duplicitu_odhali_i_prihlaska_zadana_znovu_jmenem(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Jan", surname="Novak", year=2010, sex=1)
    _registrace(db, zavod.id, zavodnik.id)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Jan", racer_surname="Novak",
        racer_year=2010, racer_sex=1, club_id=klub.id))

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Jezdec je již zaregistrován na tento závod"
    assert _pocet_registraci(db, zavod.id) == 1
    assert db.query(models.Racer).count() == 1


def test_prihlaska_s_neexistujicim_zavodnikem_vrati_404(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=9999, club_id=klub.id))

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Racer not found"
    assert _pocet_registraci(db, zavod.id) == 0


def test_novy_zavodnik_bez_prijmeni_se_neulozi(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Jan", racer_year=2010, racer_sex=1, club_id=klub.id))

    assert odpoved.status_code == 400
    assert "Missing required racer fields" in odpoved.json()["detail"]
    assert db.query(models.Racer).count() == 0
    assert _pocet_registraci(db, zavod.id) == 0


def test_novy_zavodnik_bez_rocniku_se_neulozi(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Jan", racer_surname="Novak",
        racer_sex=1, club_id=klub.id))

    assert odpoved.status_code == 400
    assert "Missing required racer fields" in odpoved.json()["detail"]
    assert db.query(models.Racer).count() == 0


def test_prihlaska_bez_klubu_i_bez_poznamky_se_neulozi(client, db, klient_jako_v_provozu):
    """Přihláška se neuloží a uživatel dostane 422 s českou hláškou. Dřív tu
    byla 500 - obsluha validačních chyb v app/main.py neuměla zabalit výjimku
    z vlastního validátoru."""
    zavod = _zavod(db)

    odpoved = klient_jako_v_provozu.post("/registrations/", json={
        "race_id": zavod.id, "racer_name": "Jan", "racer_surname": "Novak",
        "racer_year": 2010, "racer_sex": 1,
    })

    assert odpoved.status_code == 422
    assert odpoved.json()["detail"][0]["msg"] == "Musíte vybrat klub nebo uvést poznámku"
    assert db.query(models.Racer).count() == 0
    assert _pocet_registraci(db, zavod.id) == 0


def test_prazdna_poznamka_o_klubu_se_bere_jako_nevyplnena(client, db, klient_jako_v_provozu):
    zavod = _zavod(db)

    odpoved = klient_jako_v_provozu.post("/registrations/", json={
        "race_id": zavod.id, "racer_name": "Jan", "racer_surname": "Novak",
        "racer_year": 2010, "racer_sex": 1, "club_request_note": "   ",
    })

    assert odpoved.status_code == 422
    assert db.query(models.Racer).count() == 0


def test_chybejici_race_id_vrati_ctitelnou_validacni_chybu(client, db):
    """Protiváha k testům výš: běžnou validační chybu (bez vlastního
    validátoru) obsluha zvládne a vrátí 422 s popisem pole."""
    odpoved = client.post("/registrations/", json={"club_request_note": "Kanoe Brno"})

    assert odpoved.status_code == 422
    chyby = odpoved.json()["detail"]
    assert [c["loc"] for c in chyby] == [["body", "race_id"]]
    assert chyby[0]["type"] == "missing"


def test_prihlaska_do_neexistujiciho_klubu_se_odmitne(client, db):
    zavod = _zavod(db)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Jan", racer_surname="Novak",
        racer_year=2010, racer_sex=1, club_id=9999))

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Klub nenalezen"
    assert _pocet_registraci(db, zavod.id) == 0


def test_prihlaska_do_zruseneho_klubu_se_odmitne(client, db):
    zavod = _zavod(db)
    zruseny = _klub(db, "Zaniklý klub", valid=False)
    zavodnik = _zavodnik(db)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id, club_id=zruseny.id))

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Klub nenalezen"
    _obnov(db)
    assert db.query(models.Racer).filter(models.Racer.id == zavodnik.id).one().club_id is None


def test_jmeno_zacinajici_rovnitkem_se_neulozi(client, db, klient_jako_v_provozu):
    """Ochrana proti CSV injection - jméno se exportuje do CSV pro pořadatele.

    Zápis se zastaví s chybou 422."""
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")

    odpoved = klient_jako_v_provozu.post("/registrations/", json=_telo(
        zavod.id, racer_name="=SUM(A1:A9)", racer_surname="Novak",
        racer_year=2010, racer_sex=1, club_id=klub.id))

    assert odpoved.status_code == 422
    assert db.query(models.Racer).count() == 0
    assert _pocet_registraci(db, zavod.id) == 0


def test_odmitnuta_prihlaska_do_neexistujiciho_klubu_nechava_zavodnika(client, db):
    """CHYBA: nový závodník se zapíše dřív, než se ověří klub, a MyISAM
    neumí rollback. Po odmítnuté přihlášce zůstane v databázi závodník
    bez jediné registrace. Test drží současné chování."""
    zavod = _zavod(db)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Osirely", racer_surname="Zavodnik",
        racer_year=2010, racer_sex=1, club_id=9999))

    assert odpoved.status_code == 404
    _obnov(db)
    osirely = db.query(models.Racer).filter(models.Racer.surname == "Zavodnik").all()
    assert len(osirely) == 1
    assert _pocet_registraci(db) == 0


# ==========================================================================
# Přepis kontaktních údajů cizího závodníka
# ==========================================================================

def test_kontakty_se_prepisou_jen_pri_shode_identity(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Jan", surname="Novak", year=2010, sex=1,
                         telefon="111111111", email="stary@example.cz")

    # Jméno záměrně jinou velikostí písmen a s mezerami - porovnání to má snést.
    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id,
        racer_name="  jan ", racer_surname="NOVAK", racer_year=2010, racer_sex=1,
        racer_telefon="777123456", racer_email="novy@example.cz",
        racer_slcr_id="XY99", club_id=klub.id))

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    ulozeny = db.query(models.Racer).filter(models.Racer.id == zavodnik.id).one()
    assert ulozeny.telefon == "777123456"
    assert ulozeny.email == "novy@example.cz"
    assert ulozeny.slcr_id == "XY99"
    # Jméno samotné se z přihlášky nepřepisuje.
    assert (ulozeny.name, ulozeny.surname) == ("Jan", "Novak")


def test_nesouhlasici_identita_kontakty_neprepise_a_prihlasku_odmitne(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Jan", surname="Novak", year=2010, sex=1,
                         telefon="111111111")

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id,
        racer_name="Jan", racer_surname="Uplne Jiny", racer_year=2010, racer_sex=1,
        racer_telefon="777123456", club_id=klub.id))

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Údaje závodníka nesouhlasí"
    _obnov(db)
    assert db.query(models.Racer).filter(
        models.Racer.id == zavodnik.id).one().telefon == "111111111"
    assert _pocet_registraci(db, zavod.id) == 0


def test_nesouhlasici_rocnik_kontakty_neprepise(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Jan", surname="Novak", year=2010, sex=1,
                         telefon="111111111")

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id,
        racer_name="Jan", racer_surname="Novak", racer_year=1999, racer_sex=1,
        racer_telefon="777123456", club_id=klub.id))

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Údaje závodníka nesouhlasí"
    _obnov(db)
    assert db.query(models.Racer).filter(
        models.Racer.id == zavodnik.id).one().telefon == "111111111"


def test_bez_uvedene_identity_se_telefon_potichu_neulozi(client, db):
    """Samotné racer_id není důkaz totožnosti - telefon se zahodí, ale
    přihláška projde a volající se nic nedozví. Test drží současné chování."""
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, telefon="111111111")

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id, racer_telefon="777123456", club_id=klub.id))

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    assert db.query(models.Racer).filter(
        models.Racer.id == zavodnik.id).one().telefon == "111111111"


def test_prazdny_telefon_puvodni_cislo_nesmaze(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Jan", surname="Novak", year=2010, sex=1,
                         telefon="111111111")

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id,
        racer_name="Jan", racer_surname="Novak", racer_year=2010, racer_sex=1,
        racer_telefon="   ", racer_email="novy@example.cz", club_id=klub.id))

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    ulozeny = db.query(models.Racer).filter(models.Racer.id == zavodnik.id).one()
    assert ulozeny.telefon == "111111111"
    assert ulozeny.email == "novy@example.cz"


# ==========================================================================
# Klub na přihlášce
# ==========================================================================

def test_poznamka_o_klubu_se_ulozi_a_klub_zavodnika_nemeni(client, db):
    zavod = _zavod(db)
    puvodni = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, club_id=puvodni.id)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id, club_request_note="  Jsem z Kanoe Brno  "))

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    registrace = db.query(models.Registration).filter(
        models.Registration.id == odpoved.json()["id"]).one()
    assert registrace.club_request_note == "Jsem z Kanoe Brno"
    assert db.query(models.Racer).filter(
        models.Racer.id == zavodnik.id).one().club_id == puvodni.id


def test_vyber_klubu_prepise_zavodnikovi_puvodni_klub(client, db):
    zavod = _zavod(db)
    stary = _klub(db, "Klub A")
    novy = _klub(db, "Klub B")
    zavodnik = _zavodnik(db, club_id=stary.id)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id, club_id=novy.id))

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    assert db.query(models.Racer).filter(
        models.Racer.id == zavodnik.id).one().club_id == novy.id
    assert db.query(models.Registration).filter(
        models.Registration.id == odpoved.json()["id"]).one().club_request_note is None


def test_vybrany_klub_ma_prednost_pred_poznamkou(client, db):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id, club_id=klub.id,
        club_request_note="Tohle se má zahodit"))

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    registrace = db.query(models.Registration).filter(
        models.Registration.id == odpoved.json()["id"]).one()
    assert registrace.club_request_note is None
    assert db.query(models.Racer).filter(
        models.Racer.id == zavodnik.id).one().club_id == klub.id


# ==========================================================================
# Správce: seznam přihlášených
# ==========================================================================

def test_seznam_prihlasenych_bez_tokenu_neni_pristupny(client, db):
    zavod = _zavod(db)

    odpoved = client.get(f"/api/admin/races/{zavod.id}/registrations")

    assert odpoved.status_code == 403
    assert odpoved.json()["detail"] == "Not authenticated"


def test_seznam_prihlasenych_s_podvrzenym_tokenem_neni_pristupny(client, db):
    zavod = _zavod(db)

    odpoved = client.get(f"/api/admin/races/{zavod.id}/registrations",
                         headers={"Authorization": "Bearer nesmysl"})

    assert odpoved.status_code == 401
    assert odpoved.json()["detail"] == "Could not validate credentials"


def test_casomeric_na_seznam_prihlasenych_nedosahne(client, db, timekeeper_headers):
    zavod = _zavod(db)
    zavodnik = _zavodnik(db)
    _registrace(db, zavod.id, zavodnik.id)

    odpoved = client.get(f"/api/admin/races/{zavod.id}/registrations",
                         headers=timekeeper_headers)

    assert odpoved.status_code == 403
    assert odpoved.json()["detail"] == "Nemáte oprávnění k této akci"


def test_seznam_prihlasenych_neexistujiciho_zavodu_vrati_404(client, db, admin_headers):
    odpoved = client.get("/api/admin/races/9999/registrations", headers=admin_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závod nenalezen"


def test_seznam_prihlasenych_vraci_udaje_serazene_podle_prijmeni(client, db, admin_headers):
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    novak = _zavodnik(db, name="Jan", surname="Novak", year=2010, sex=1,
                      club_id=klub.id, slcr_id="AB12")
    adamova = _zavodnik(db, name="Eva", surname="Adamova", year=2011, sex=2,
                        club_id=klub.id)
    _registrace(db, zavod.id, novak.id)
    _registrace(db, zavod.id, adamova.id)

    odpoved = client.get(f"/api/admin/races/{zavod.id}/registrations", headers=admin_headers)

    assert odpoved.status_code == 200, odpoved.text
    radky = odpoved.json()
    assert [r["lastName"] for r in radky] == ["Adamova", "Novak"]
    eva, jan = radky
    assert (eva["firstName"], eva["sex"], eva["birthYear"]) == ("Eva", "Z", 2011)
    assert (jan["firstName"], jan["sex"], jan["birthYear"]) == ("Jan", "M", 2010)
    assert jan["idSlcr"] == "AB12"
    assert jan["club_name"] == "Klub A"
    assert jan["racer_id"] == novak.id
    assert jan["race_id"] == zavod.id
    assert jan["registration_date"]


def test_seznam_prihlasenych_rozlisi_bez_klubu_a_novy_klub(client, db, admin_headers):
    zavod = _zavod(db)
    bezklubu = _zavodnik(db, name="Petr", surname="Bezklubu", year=2010, sex=1)
    zadatel = _zavodnik(db, name="Ivan", surname="Zadatel", year=2010, sex=1)
    _registrace(db, zavod.id, bezklubu.id)
    _registrace(db, zavod.id, zadatel.id, note="Jsem z Kanoe Brno")

    odpoved = client.get(f"/api/admin/races/{zavod.id}/registrations", headers=admin_headers)

    assert odpoved.status_code == 200, odpoved.text
    kluby = {r["lastName"]: r["club_name"] for r in odpoved.json()}
    assert kluby == {"Bezklubu": "Bez klubu", "Zadatel": "Nový Klub"}


def test_seznam_prihlasenych_nemicha_zavody(client, db, admin_headers):
    prvni = _zavod(db, race_nr="JMLP2026-01")
    druhy = _zavod(db, race_nr="JMLP2026-02")
    zavodnik = _zavodnik(db, name="Jan", surname="Novak")
    cizi = _zavodnik(db, name="Petr", surname="Cizi")
    _registrace(db, prvni.id, zavodnik.id)
    _registrace(db, druhy.id, cizi.id)

    odpoved = client.get(f"/api/admin/races/{prvni.id}/registrations", headers=admin_headers)

    assert [r["lastName"] for r in odpoved.json()] == ["Novak"]


def test_zavod_bez_prihlasek_vrati_prazdny_seznam(client, db, admin_headers):
    zavod = _zavod(db)

    odpoved = client.get(f"/api/admin/races/{zavod.id}/registrations", headers=admin_headers)

    assert odpoved.status_code == 200
    assert odpoved.json() == []


# ==========================================================================
# Správce: export CSV
# ==========================================================================

def _csv_radky(odpoved):
    """CSV se posílá ve Windows-1250, ne v UTF-8.

    Excel v českém prostředí otevře .csv v systémovém kódování a UTF-8 s BOM
    mu nestačilo - diakritika se rozsypala. Kontroluje se proto i hlavička,
    aby se kódování nemohlo tiše vrátit zpátky.
    """
    assert "windows-1250" in odpoved.headers["content-type"]
    obsah = odpoved.content.decode("cp1250")
    return [radek for radek in obsah.split("\r\n") if radek]


def test_export_csv_obsahuje_hlavicku_a_radky_prihlasenych(client, db, admin_headers):
    zavod = _zavod(db, race_nr="JMLP2026-03")
    klub = _klub(db, "Klub A")
    _registrace(db, zavod.id, _zavodnik(db, name="Jan", surname="Novak", year=2010,
                                        sex=1, club_id=klub.id, slcr_id="AB12").id)
    _registrace(db, zavod.id, _zavodnik(db, name="Eva", surname="Adamova", year=2011,
                                        sex=2).id)

    odpoved = client.get(f"/api/admin/races/{zavod.id}/export-csv", headers=admin_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert 'filename="registrace_JMLP2026-03.csv"' in odpoved.headers["content-disposition"]
    radky = _csv_radky(odpoved)
    assert radky[0] == "jmeno;prijmeni;sex;rocnik_narozeni;oddil;body_jmlp;id_slcr"
    assert radky[1] == "Eva;Adamova;Z;2011;;;"
    assert radky[2] == "Jan;Novak;M;2010;Klub A;;AB12"


def test_export_csv_neutralizuje_vzorec_v_nazvu_klubu(client, db, admin_headers):
    """Do názvu klubu se dá vzorec dostat starým importem - v CSV musí být
    odzobáčkovaný, jinak ho Excel vyhodnotí."""
    zavod = _zavod(db)
    klub = _klub(db, "=HYPERLINK(\"http://zlo\")")
    _registrace(db, zavod.id, _zavodnik(db, club_id=klub.id).id)

    odpoved = client.get(f"/api/admin/races/{zavod.id}/export-csv", headers=admin_headers)

    assert odpoved.status_code == 200, odpoved.text
    radek = _csv_radky(odpoved)[1]
    assert "'=HYPERLINK" in radek


def test_export_csv_bez_prihlasenych_vrati_404(client, db, admin_headers):
    zavod = _zavod(db)

    odpoved = client.get(f"/api/admin/races/{zavod.id}/export-csv", headers=admin_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Pro tento závod nejsou registrace"


def test_export_csv_neexistujiciho_zavodu_vrati_404(client, db, admin_headers):
    odpoved = client.get("/api/admin/races/9999/export-csv", headers=admin_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závod nenalezen"


def test_casomeric_export_csv_nestahne(client, db, timekeeper_headers):
    zavod = _zavod(db)
    _registrace(db, zavod.id, _zavodnik(db).id)

    odpoved = client.get(f"/api/admin/races/{zavod.id}/export-csv", headers=timekeeper_headers)

    assert odpoved.status_code == 403
    assert odpoved.json()["detail"] == "Nemáte oprávnění k této akci"


def test_registrace_bez_zavodnika_je_v_seznamu_ale_v_csv_chybi(client, db, admin_headers):
    """CHYBA: seznam pro správce jede přes LEFT JOIN, export CSV přes JOIN.
    Registrace ukazující na smazaného závodníka (MyISAM nemá cizí klíče) se
    tak v přehledu tváří jako prázdný řádek, ale do CSV se nedostane."""
    zavod = _zavod(db)
    _registrace(db, zavod.id, 9999)

    seznam = client.get(f"/api/admin/races/{zavod.id}/registrations", headers=admin_headers)
    export = client.get(f"/api/admin/races/{zavod.id}/export-csv", headers=admin_headers)

    assert seznam.status_code == 200
    assert len(seznam.json()) == 1
    assert seznam.json()[0]["lastName"] is None
    assert export.status_code == 404


# ==========================================================================
# Správce: žádosti o klub
# ==========================================================================

def _zadost(db, zavod, jmeno="Ivan", prijmeni="Zadatel", note="Jsem z Kanoe Brno",
            club_id=None, registered_at=None):
    zavodnik = _zavodnik(db, name=jmeno, surname=prijmeni, club_id=club_id)
    return _registrace(db, zavod.id, zavodnik.id, note=note, registered_at=registered_at)


def test_zadost_o_klub_se_objevi_v_prehledu_spravce(client, db, admin_headers):
    zavod = _zavod(db, race_nr="JMLP2026-07")
    puvodni = _klub(db, "Klub A")
    zadost = _zadost(db, zavod, club_id=puvodni.id)

    prehled = client.get("/api/admin/clubs/requests", headers=admin_headers)
    pocet = client.get("/api/admin/clubs/requests/count", headers=admin_headers)

    assert prehled.status_code == 200, prehled.text
    assert pocet.json() == {"count": 1}
    polozka = prehled.json()[0]
    assert polozka["registration_id"] == zadost.id
    assert polozka["racer_name"] == "Ivan Zadatel"
    assert polozka["race_name"] == "JMLP2026-07"
    assert polozka["club_request_note"] == "Jsem z Kanoe Brno"
    assert polozka["current_club_name"] == "Klub A"


def test_prehled_zadosti_vraci_nejnovejsi_nahore(client, db, admin_headers):
    zavod = _zavod(db)
    _zadost(db, zavod, prijmeni="Starsi", registered_at=datetime(2026, 1, 1, 10, 0))
    _zadost(db, zavod, prijmeni="Novejsi", registered_at=datetime(2026, 3, 1, 10, 0))

    odpoved = client.get("/api/admin/clubs/requests", headers=admin_headers)

    assert [p["racer_name"].split()[-1] for p in odpoved.json()] == ["Novejsi", "Starsi"]


def test_vyrizene_prihlasky_se_v_zadostech_neukazuji(client, db, admin_headers):
    zavod = _zavod(db)
    _registrace(db, zavod.id, _zavodnik(db).id, note=None)

    prehled = client.get("/api/admin/clubs/requests", headers=admin_headers)
    pocet = client.get("/api/admin/clubs/requests/count", headers=admin_headers)

    assert prehled.json() == []
    assert pocet.json() == {"count": 0}


def test_schvaleni_zadosti_priradi_existujici_klub(client, db, admin_headers):
    zavod = _zavod(db)
    klub = _klub(db, "Kanoe Brno")
    zadost = _zadost(db, zavod)

    odpoved = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                          json={"club_id": klub.id}, headers=admin_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json() == {"ok": True, "club_id": klub.id, "club_name": "Kanoe Brno"}
    _obnov(db)
    registrace = db.query(models.Registration).filter(
        models.Registration.id == zadost.id).one()
    assert registrace.club_request_note is None
    assert db.query(models.Racer).filter(
        models.Racer.id == registrace.racer_id).one().club_id == klub.id
    assert client.get("/api/admin/clubs/requests/count",
                      headers=admin_headers).json() == {"count": 0}


def test_schvaleni_zadosti_zalozi_novy_klub(client, db, admin_headers):
    zavod = _zavod(db)
    zadost = _zadost(db, zavod)

    odpoved = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                          json={"new_club_name": "  Kanoe Brno  "}, headers=admin_headers)

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    novy = db.query(models.Club).filter(models.Club.name == "Kanoe Brno").one()
    assert bool(novy.valid) is True
    assert odpoved.json()["club_id"] == novy.id
    registrace = db.query(models.Registration).filter(
        models.Registration.id == zadost.id).one()
    assert registrace.club_request_note is None
    assert db.query(models.Racer).filter(
        models.Racer.id == registrace.racer_id).one().club_id == novy.id


def test_schvaleni_podle_nazvu_nezaklada_druhy_stejny_klub(client, db, admin_headers):
    zavod = _zavod(db)
    stavajici = _klub(db, "Kanoe Brno")
    zadost = _zadost(db, zavod)

    odpoved = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                          json={"new_club_name": "Kanoe Brno"}, headers=admin_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["club_id"] == stavajici.id
    assert db.query(models.Club).count() == 1


def test_schvaleni_podle_nazvu_ozivi_i_zruseny_klub(client, db, admin_headers):
    """CHYBA: hledání klubu podle názvu nekontroluje valid, na rozdíl od
    výběru přes club_id. Závodník tak skončí ve zrušeném klubu, který se
    nenabízí ani ve výběru. Test drží současné chování."""
    zavod = _zavod(db)
    zruseny = _klub(db, "Zaniklý klub", valid=False)
    zadost = _zadost(db, zavod)

    odpoved = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                          json={"new_club_name": "Zaniklý klub"}, headers=admin_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["club_id"] == zruseny.id
    _obnov(db)
    registrace = db.query(models.Registration).filter(
        models.Registration.id == zadost.id).one()
    assert db.query(models.Racer).filter(
        models.Racer.id == registrace.racer_id).one().club_id == zruseny.id


def test_zadost_nelze_vyridit_dvakrat(client, db, admin_headers):
    zavod = _zavod(db)
    prvni_klub = _klub(db, "Kanoe Brno")
    druhy_klub = _klub(db, "Klub B")
    zadost = _zadost(db, zavod)

    prvni = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                        json={"club_id": prvni_klub.id}, headers=admin_headers)
    druhy = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                        json={"club_id": druhy_klub.id}, headers=admin_headers)

    assert prvni.status_code == 200, prvni.text
    assert druhy.status_code == 404
    assert druhy.json()["detail"] == "Žádost nenalezena nebo již vyřízena"
    _obnov(db)
    registrace = db.query(models.Registration).filter(
        models.Registration.id == zadost.id).one()
    assert db.query(models.Racer).filter(
        models.Racer.id == registrace.racer_id).one().club_id == prvni_klub.id


def test_vyrizeni_neexistujici_zadosti_vrati_404(client, db, admin_headers):
    klub = _klub(db, "Kanoe Brno")

    odpoved = client.post("/api/admin/clubs/requests/9999/resolve",
                          json={"club_id": klub.id}, headers=admin_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Žádost nenalezena nebo již vyřízena"


def test_zadost_nelze_vyridit_neexistujicim_klubem(client, db, admin_headers):
    zavod = _zavod(db)
    zadost = _zadost(db, zavod)

    odpoved = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                          json={"club_id": 9999}, headers=admin_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Klub nenalezen"
    _obnov(db)
    assert db.query(models.Registration).filter(
        models.Registration.id == zadost.id).one().club_request_note == "Jsem z Kanoe Brno"


def test_zadost_nelze_vyridit_zrusenym_klubem(client, db, admin_headers):
    zavod = _zavod(db)
    zruseny = _klub(db, "Zaniklý klub", valid=False)
    zadost = _zadost(db, zavod)

    odpoved = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                          json={"club_id": zruseny.id}, headers=admin_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Klub nenalezen"


def test_vyrizeni_bez_klubu_i_bez_nazvu_zadost_nezmeni(client, db, admin_headers,
                                                       klient_jako_v_provozu):
    """Vlastní validátor skončí 422 s českou hláškou a žádost zůstane
    nevyřízená."""
    zavod = _zavod(db)
    zadost = _zadost(db, zavod)

    odpoved = klient_jako_v_provozu.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                                         json={"new_club_name": "   "}, headers=admin_headers)

    assert odpoved.status_code == 422
    assert db.query(models.Club).count() == 0
    _obnov(db)
    assert db.query(models.Registration).filter(
        models.Registration.id == zadost.id).one().club_request_note is not None


def test_casomeric_zadost_o_klub_vyridit_nemuze(client, db, timekeeper_headers):
    zavod = _zavod(db)
    klub = _klub(db, "Kanoe Brno")
    zadost = _zadost(db, zavod)

    odpoved = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                          json={"club_id": klub.id}, headers=timekeeper_headers)

    assert odpoved.status_code == 403
    assert odpoved.json()["detail"] == "Nemáte oprávnění k této akci"
    _obnov(db)
    assert db.query(models.Registration).filter(
        models.Registration.id == zadost.id).one().club_request_note is not None


def test_prehled_zadosti_bez_tokenu_neni_pristupny(client, db):
    odpoved = client.get("/api/admin/clubs/requests")

    assert odpoved.status_code == 403
    assert odpoved.json()["detail"] == "Not authenticated"


def test_zadost_smazaneho_zavodnika_zalozi_klub_a_pak_selze(client, db, admin_headers):
    """CHYBA: klub se založí dřív, než se ověří existence závodníka, a MyISAM
    neumí rollback. Po neúspěšném vyřízení zůstane v číselníku prázdný klub.
    Test drží současné chování."""
    zavod = _zavod(db)
    zadost = _registrace(db, zavod.id, 9999, note="Jsem z Kanoe Brno")

    odpoved = client.post(f"/api/admin/clubs/requests/{zadost.id}/resolve",
                          json={"new_club_name": "Klub Duchů"}, headers=admin_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závodník nenalezen"
    _obnov(db)
    assert db.query(models.Club).filter(models.Club.name == "Klub Duchů").count() == 1
    assert db.query(models.Registration).filter(
        models.Registration.id == zadost.id).one().club_request_note is not None


def test_prihlaska_s_poznamkou_projde_celou_cestu_az_k_priradenemu_klubu(client, db, admin_headers):
    """Průchod celým scénářem: závodník neví klub -> správce ho vidí mezi
    žádostmi -> přiřadí klub -> žádost zmizí a v seznamu je klub vidět."""
    zavod = _zavod(db, race_nr="JMLP2026-09")
    klub = _klub(db, "Kanoe Brno")

    prihlaska = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Ivan", racer_surname="Zadatel",
        racer_year=2010, racer_sex=1, club_request_note="Jsem z Kanoe Brno"))
    assert prihlaska.status_code == 200, prihlaska.text

    zadosti = client.get("/api/admin/clubs/requests", headers=admin_headers).json()
    assert len(zadosti) == 1
    registration_id = zadosti[0]["registration_id"]
    assert zadosti[0]["current_club_name"] is None

    vyrizeni = client.post(f"/api/admin/clubs/requests/{registration_id}/resolve",
                           json={"club_id": klub.id}, headers=admin_headers)
    assert vyrizeni.status_code == 200, vyrizeni.text

    assert client.get("/api/admin/clubs/requests", headers=admin_headers).json() == []
    seznam = client.get(f"/api/admin/races/{zavod.id}/registrations",
                        headers=admin_headers).json()
    assert [(r["lastName"], r["club_name"]) for r in seznam] == [("Zadatel", "Kanoe Brno")]


# ==========================================================================
# Oprava pohlaví přihláškou - identitu tvoří jméno, příjmení a ročník
# ==========================================================================

def test_prihlaska_opravi_pohlavi_existujiciho_zavodnika(client, db):
    """Kdo u existujícího závodníka opraví pohlaví, opraví evidenci i kategorii.
    Dřív se oprava tiše zahodila a dívka zůstala mezi chlapci."""
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Edita", surname="Kelblova", year=2016, sex=1)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id,
        racer_name="Edita", racer_surname="Kelblova", racer_year=2016, racer_sex=2,
        club_id=klub.id))

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    assert db.query(models.Racer).filter(models.Racer.id == zavodnik.id).one().sex == 2


def test_oprava_pohlavi_bez_shody_identity_neprojde(client, db):
    """Jiný ročník je jiný závodník - podle něj se cizí záznam opravit nedá."""
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Edita", surname="Kelblova", year=2016, sex=1)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_id=zavodnik.id,
        racer_name="Edita", racer_surname="Kelblova", racer_year=2015, racer_sex=2,
        club_id=klub.id))

    assert odpoved.status_code == 400
    assert odpoved.json()["detail"] == "Údaje závodníka nesouhlasí"
    _obnov(db)
    assert db.query(models.Racer).filter(models.Racer.id == zavodnik.id).one().sex == 1


def test_nova_prihlaska_s_jinym_pohlavim_nezalozi_duplicitu(client, db):
    """Bez racer_id se existující závodník hledá podle jména, příjmení a ročníku.
    Jiné pohlaví je oprava, ne nový člověk - nevznikne druhý záznam."""
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    zavodnik = _zavodnik(db, name="Mariana", surname="Junova", year=2016, sex=1)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Mariana", racer_surname="Junova", racer_year=2016,
        racer_sex=2, club_id=klub.id))

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    zaznamy = db.query(models.Racer).filter(models.Racer.surname == "Junova").all()
    assert [(z.id, z.sex) for z in zaznamy] == [(zavodnik.id, 2)]


def test_jiny_rocnik_zalozi_noveho_zavodnika(client, db):
    """Jméno, příjmení a ročník jsou identifikační kombinace - jiný ročník je nový záznam."""
    zavod = _zavod(db)
    klub = _klub(db, "Klub A")
    _zavodnik(db, name="Mariana", surname="Junova", year=2022, sex=2)

    odpoved = client.post("/registrations/", json=_telo(
        zavod.id, racer_name="Mariana", racer_surname="Junova", racer_year=2016,
        racer_sex=2, club_id=klub.id))

    assert odpoved.status_code == 200, odpoved.text
    _obnov(db)
    assert sorted(z.year for z in db.query(models.Racer).filter(models.Racer.surname == "Junova")) == [2016, 2022]
