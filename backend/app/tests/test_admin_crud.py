"""Administrace: závody, závodníci, kluby, kategorie, příspěvky a sezóny.

Pokrývá app/routers/admin/{races,racers,clubs,categories,posts,seasons}.py -
zakládání, úpravy, mazání, validaci vstupů a oprávnění.

Testy schválně sahají i do databáze: MyISAM neumí transakce a několik routerů
commituje po částech, takže odpověď 200 sama o sobě neříká, že se data uložila.
Právě tohle odhalilo, že úprava závodníka vracela nové jméno, ale zapisovala
jen pohlaví.
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import models
from app.main import app


@pytest.fixture
def klient_bez_vyjimek():
    """TestClient, který interní chybu vrátí jako odpověď 500 místo výjimky.

    Bez toho by nešlo ověřit, co na rozbitém endpointu uvidí uživatel.
    """
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


# --- pomocníci pro testovací data ------------------------------------------

def _pocet(db, sql: str, **params) -> int:
    return db.execute(text(sql), params).scalar()


def _zavodnik(db, name="Jan", surname="Novák", year=2011, sex=1, club_id=None, category_id=None):
    racer = models.Racer(name=name, surname=surname, year=year, sex=sex,
                         club_id=club_id, category_id=category_id)
    db.add(racer)
    db.commit()
    db.refresh(racer)
    return racer


def _klub(db, name="SK Test", valid=True):
    club = models.Club(name=name, valid=valid)
    db.add(club)
    db.commit()
    db.refresh(club)
    return club


def _zavod(db, race_nr="JMLP2025-01", season_id=2025, datum=None, organizer_id=None):
    race = models.Race(closed=False, registration=True, race_method_id=1,
                       season_id=season_id, race_nr=race_nr, datum=datum,
                       organizer_id=organizer_id)
    db.add(race)
    db.commit()
    db.refresh(race)
    return race


def _kategorie(db, name="Zaci", sex=1, min_year=2010, max_year=2012, active=True, display_name=None):
    category = models.Category(name=name, sex=sex, min_birth_year=min_year,
                               max_birth_year=max_year, active=active,
                               display_name=display_name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


# Soubory založené testem - uklízí se jen tyhle, nikdy podle vzoru.
_ZALOZENE_SOUBORY = []


@pytest.fixture(autouse=True)
def _uklid_souboru():
    yield
    while _ZALOZENE_SOUBORY:
        _ZALOZENE_SOUBORY.pop().unlink(missing_ok=True)


def _soubor(db, filename="dokument.pdf"):
    # Soubor musí na disku opravdu být - příloha bez souboru se z veřejných
    # odpovědí schválně vynechává.
    cesta = Path(f"uploads/documents/{filename}")
    cesta.parent.mkdir(parents=True, exist_ok=True)
    cesta.write_bytes(b"%PDF-1.4 test")
    _ZALOZENE_SOUBORY.append(cesta)

    file_record = models.File(
        filename=filename, original_filename=filename,
        file_path=str(cesta), file_size=1024,
        mime_type="application/pdf", file_type=models.FileTypeEnum.neprirazene,
    )
    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    return file_record


def _sezona(db, year_start=2025, edition=19, name="Jihomoravský pohár", active=True):
    season = models.Season(year_start=year_start, year_end=year_start + 1,
                           edition=edition, name=name, active=active)
    db.add(season)
    db.commit()
    db.refresh(season)
    return season


# ===========================================================================
# Oprávnění
# ===========================================================================

CHRANENE_ENDPOINTY = [
    ("get", "/api/admin/races"),
    ("post", "/api/admin/races"),
    ("put", "/api/admin/races/1"),
    ("delete", "/api/admin/races/1"),
    ("get", "/api/admin/racers"),
    ("post", "/api/admin/racers"),
    ("delete", "/api/admin/racers/1"),
    ("get", "/api/admin/clubs/overview"),
    ("get", "/api/admin/clubs/requests"),
    ("delete", "/api/admin/clubs/1"),
    ("get", "/api/admin/categories"),
    ("post", "/api/admin/categories"),
    ("delete", "/api/admin/categories/1"),
    ("get", "/api/admin/posts"),
    ("post", "/api/admin/posts"),
    ("delete", "/api/admin/posts/1"),
    ("get", "/api/admin/seasons"),
    ("post", "/api/admin/seasons"),
    ("delete", "/api/admin/seasons/1"),
]


@pytest.mark.parametrize("metoda,url", CHRANENE_ENDPOINTY)
def test_bez_tokenu_je_administrace_nedostupna(client, metoda, url):
    volani = getattr(client, metoda)
    response = volani(url) if metoda in ("get", "delete") else volani(url, json={})
    assert response.status_code == 403
    assert response.json()["detail"] == "Not authenticated"


@pytest.mark.parametrize("metoda,url", CHRANENE_ENDPOINTY)
def test_casomeric_nesmi_do_administrace(client, timekeeper_headers, metoda, url):
    volani = getattr(client, metoda)
    response = (volani(url, headers=timekeeper_headers) if metoda in ("get", "delete")
                else volani(url, headers=timekeeper_headers, json={}))
    assert response.status_code == 403
    assert response.json()["detail"] == "Nemáte oprávnění k této akci"


def test_podvrzeny_token_konci_401(client):
    response = client.get("/api/admin/races", headers={"Authorization": "Bearer nesmysl"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"


def test_casomeric_neulozi_sezonu_ani_nesmaze_prispevek(client, timekeeper_headers, db):
    post = models.Post(title="Zůstane", content="Obsah")
    db.add(post)
    db.commit()
    db.refresh(post)

    assert client.post("/api/admin/seasons", headers=timekeeper_headers,
                       json={"year_start": 2025}).status_code == 403
    assert client.delete(f"/api/admin/posts/{post.id}",
                         headers=timekeeper_headers).status_code == 403

    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_season") == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_posts") == 1


def test_neaktivni_ucet_se_nedostane_dovnitr(client, admin_user, admin_headers, db):
    db.execute(text("UPDATE fuj_jmlp_admin SET is_active = 0 WHERE id = :id"), {"id": admin_user.id})
    db.commit()

    response = client.get("/api/admin/races", headers=admin_headers)
    assert response.status_code == 401


# ===========================================================================
# Závody (races.py)
# ===========================================================================

def test_zavod_se_zalozi_i_s_novym_arealem_a_poradatelem(client, admin_headers, db):
    response = client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01",
        "datum": "2025-12-13",
        "season_id": 2025,
        "areal_name": "  Olesnice  ",
        "organizer_name": "SK Novy",
    })

    assert response.status_code == 200
    zavod = response.json()
    assert zavod["race_nr"] == "JMLP2025-01"
    assert zavod["datum"] == "2025-12-13"
    assert zavod["season_id"] == 2025
    assert zavod["registration"] is False
    assert zavod["closed"] is False
    # Okolní bílé znaky se ořežou, jinak by vznikaly duplicitní areály.
    assert zavod["areal_name"] == "Olesnice"
    assert zavod["organizer_name"] == "SK Novy"

    assert db.execute(text("SELECT name FROM fuj_jmlp_areal")).scalar() == "Olesnice"
    klub = db.execute(text("SELECT name, valid+0 FROM fuj_jmlp_club")).first()
    assert klub == ("SK Novy", 1)


def test_druhy_zavod_znovu_pouzije_stejny_areal(client, admin_headers, db):
    prvni = client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01", "season_id": 2025, "areal_name": "Olesnice",
    }).json()
    druhy = client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-02", "season_id": 2025, "areal_name": "Olesnice",
    }).json()

    assert prvni["areal_id"] == druhy["areal_id"]
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_areal") == 1


def test_zavod_s_neplatnym_datem_se_neulozi(client, admin_headers, db):
    response = client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01", "datum": "13.12.2025", "season_id": 2025,
    })

    assert response.status_code == 400
    assert "13.12.2025" in response.json()["detail"]
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_race") == 0


def test_zavod_bez_sezony_skonci_interni_chybou(klient_bez_vyjimek, admin_headers, db):
    """CHYBA: schéma slibuje dopočet sezóny, router ho nedělá - viz found_bugs."""
    response = klient_bez_vyjimek.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01", "datum": "2025-12-13",
    })

    assert response.status_code == 500
    assert response.json()["detail"] == "Interní chyba serveru"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_race") == 0


def test_zavod_s_neexistujicim_souborem_vrati_404_ale_presto_vznikne(client, admin_headers, db):
    """CHYBA: závod se commitne dřív, než se ověří příloha - viz found_bugs."""
    response = client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01", "season_id": 2025, "proposition_file_id": 4242,
    })

    assert response.status_code == 404
    assert response.json()["detail"] == "Soubor nebyl nalezen"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_race") == 1


def test_pripojeni_propozic_prekategorizuje_soubor_v_knihovne(client, admin_headers, db):
    soubor = _soubor(db, "propozice.pdf")

    response = client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01", "season_id": 2025, "proposition_file_id": soubor.id,
    })

    assert response.status_code == 200
    assert response.json()["proposition_file_id"] == soubor.id
    assert response.json()["proposition_file_path"] == "uploads/documents/propozice.pdf"
    assert db.execute(text("SELECT file_type FROM fuj_jmlp_files")).scalar() == "propozice"
    assert db.execute(text(
        "SELECT owner_type, role FROM fuj_jmlp_attachment"
    )).first() == ("race", "propozice")


def test_seznam_zavodu_radi_od_nejnovejsiho_a_pocita_registrace(client, admin_headers, db):
    stary = _zavod(db, race_nr="JMLP2025-01", datum="2025-12-01")
    novy = _zavod(db, race_nr="JMLP2025-02", datum="2026-01-15")
    zavodnik = _zavodnik(db)
    db.add(models.Registration(race_id=novy.id, racer_id=zavodnik.id))
    db.commit()

    radky = client.get("/api/admin/races", headers=admin_headers).json()

    assert [r["race_nr"] for r in radky] == ["JMLP2025-02", "JMLP2025-01"]
    assert radky[0]["registrations_count"] == 1
    assert radky[1]["registrations_count"] == 0
    assert radky[1]["id"] == stary.id


def test_detail_neexistujiciho_zavodu_konci_404(client, admin_headers):
    response = client.get("/api/admin/races/98765", headers=admin_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Závod nenalezen"


def test_uprava_zavodu_zmeni_jen_zaslana_pole(client, admin_headers, db):
    zavod = _zavod(db, race_nr="JMLP2025-01", datum="2025-12-13")

    response = client.put(f"/api/admin/races/{zavod.id}", headers=admin_headers, json={
        "race_nr": "JMLP2025-01b", "closed": True,
    })

    assert response.status_code == 200
    telo = response.json()
    assert telo["race_nr"] == "JMLP2025-01b"
    assert telo["closed"] is True
    assert telo["datum"] == "2025-12-13"        # nezaslané pole zůstává
    assert telo["registration"] is True

    ulozeno = db.execute(text(
        "SELECT race_nr, closed+0 FROM fuj_jmlp_race WHERE id = :id"
    ), {"id": zavod.id}).first()
    assert ulozeno == ("JMLP2025-01b", 1)


def test_uprava_neexistujiciho_zavodu_konci_404(client, admin_headers):
    response = client.put("/api/admin/races/98765", headers=admin_headers, json={"race_nr": "X"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Závod nenalezen"


def test_prazdny_nazev_arealu_areal_neodpoji(client, admin_headers, db):
    """Prázdný název je "nic neměň", ne "odpoj areál" - odpojuje se přes areal_id."""
    zavod = client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01", "season_id": 2025, "areal_name": "Olesnice",
    }).json()

    response = client.put(f"/api/admin/races/{zavod['id']}", headers=admin_headers,
                          json={"areal_name": ""})

    assert response.status_code == 200
    assert response.json()["areal_id"] == zavod["areal_id"]
    assert response.json()["areal_name"] == "Olesnice"


def test_odpojeni_propozic_ponecha_soubor_v_knihovne(client, admin_headers, db):
    soubor = _soubor(db, "propozice.pdf")
    zavod = client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01", "season_id": 2025, "proposition_file_id": soubor.id,
    }).json()

    response = client.put(f"/api/admin/races/{zavod['id']}", headers=admin_headers,
                          json={"proposition_file_id": None})

    assert response.status_code == 200
    assert response.json()["proposition_file_id"] is None
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_attachment") == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_files") == 1


def test_prepnuti_registrace_prepina_tam_a_zpet(client, admin_headers, db):
    zavod = _zavod(db)  # registration = True

    prvni = client.post(f"/api/admin/races/{zavod.id}/toggle-registration", headers=admin_headers)
    assert prvni.status_code == 200
    assert "disabled" in prvni.json()["message"]
    assert _pocet(db, "SELECT registration+0 FROM fuj_jmlp_race WHERE id = :id", id=zavod.id) == 0

    druha = client.post(f"/api/admin/races/{zavod.id}/toggle-registration", headers=admin_headers)
    assert "enabled" in druha.json()["message"]
    assert _pocet(db, "SELECT registration+0 FROM fuj_jmlp_race WHERE id = :id", id=zavod.id) == 1


def test_prepnuti_registrace_u_neexistujiciho_zavodu_konci_404(client, admin_headers):
    response = client.post("/api/admin/races/98765/toggle-registration", headers=admin_headers)
    assert response.status_code == 404


def test_smazani_zavodu_smaze_i_registrace_a_startovni_listinu(client, admin_headers, db):
    zavod = _zavod(db)
    jiny = _zavod(db, race_nr="JMLP2025-02")
    zavodnik = _zavodnik(db)
    db.add(models.Registration(race_id=zavod.id, racer_id=zavodnik.id))
    db.add(models.Registration(race_id=jiny.id, racer_id=zavodnik.id))
    db.add(models.StartListEntry(race_id=zavod.id, racer_id=zavodnik.id))
    db.commit()

    response = client.delete(f"/api/admin/races/{zavod.id}", headers=admin_headers)

    assert response.status_code == 200
    assert "1 registrací" in response.json()["message"]
    assert "1 řádků startovní listiny" in response.json()["message"]
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_race WHERE id = :id", id=zavod.id) == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_race_start_list") == 0
    # Registrace jiného závodu smazání přežije.
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_race_registration") == 1


def test_smazani_zavodu_bez_potomku_nehlasi_zadne_pocty(client, admin_headers, db):
    zavod = _zavod(db)
    response = client.delete(f"/api/admin/races/{zavod.id}", headers=admin_headers)
    assert response.json()["message"] == "Závod úspěšně smazán"


def test_smazani_zavodu_ponecha_soubory_v_knihovne(client, admin_headers, db):
    soubor = _soubor(db, "vysledky.pdf")
    zavod = client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01", "season_id": 2025, "results_file_id": soubor.id,
    }).json()

    assert client.delete(f"/api/admin/races/{zavod['id']}", headers=admin_headers).status_code == 200

    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_attachment") == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_files") == 1


def test_smazani_neexistujiciho_zavodu_konci_404(client, admin_headers):
    response = client.delete("/api/admin/races/98765", headers=admin_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Závod nenalezen"


def test_naseptavac_arealu_ignoruje_prilis_kratky_dotaz(client, admin_headers, db):
    client.post("/api/admin/races", headers=admin_headers, json={
        "race_nr": "JMLP2025-01", "season_id": 2025, "areal_name": "Olesnice",
    })

    assert client.get("/api/admin/races/autocomplete/areals?q=O",
                      headers=admin_headers).json() == []
    nalezene = client.get("/api/admin/races/autocomplete/areals?q=Ole",
                          headers=admin_headers).json()
    assert [a["name"] for a in nalezene] == ["Olesnice"]


def test_naseptavac_poradatelu_hleda_v_klubech(client, admin_headers, db):
    _klub(db, name="SK Vysocina")
    _klub(db, name="TJ Jinde")

    nalezene = client.get("/api/admin/races/autocomplete/organizers?q=Vys",
                          headers=admin_headers).json()
    assert [c["name"] for c in nalezene] == ["SK Vysocina"]


# ===========================================================================
# Závodníci (racers.py)
# ===========================================================================

def test_zalozeni_zavodnika_ulozi_pole_z_formulare(client, admin_headers, db):
    """Schéma používá jiné názvy než model, router je musí přeložit.

    Dřív to nedělal a zakládání závodníka končilo chybou 500.
    """
    response = client.post("/api/admin/racers", headers=admin_headers, json={
        "firstName": "Jan", "lastName": "Novák", "sex": 1, "birthYear": 2011,
    })

    assert response.status_code in (200, 201), response.text
    ulozeno = db.execute(text(
        "SELECT name, surname, year, sex FROM fuj_jmlp_racer"
    ), {}).first()
    assert ulozeno == ("Jan", "Novák", 2011, 1)


def test_zavodnik_s_hodnotou_vzorce_konci_500_misto_422(klient_bez_vyjimek, admin_headers):
    """CHYBA: validační chyba Pydantiku se nedá serializovat - viz found_bugs."""
    response = klient_bez_vyjimek.post("/api/admin/racers", headers=admin_headers, json={
        "firstName": "=SUM(A1)", "lastName": "Novák", "sex": 1, "birthYear": 2011,
    })

    assert response.status_code == 500


def test_uprava_zavodnika_ulozi_vsechna_pole(client, admin_headers, db):
    """Dřív se zapsalo jen pohlaví, ale odpověď tvrdila, že se uložilo všechno."""
    zavodnik = _zavodnik(db, name="Jan", surname="Novák", year=2011, sex=1)

    response = client.put(f"/api/admin/racers/{zavodnik.id}", headers=admin_headers, json={
        "firstName": "Petr", "lastName": "Svoboda", "sex": 2, "birthYear": 2012, "idSlcr": "ABC",
    })

    assert response.status_code == 200
    ulozeno = db.execute(text(
        "SELECT name, surname, year, sex, slcr_id FROM fuj_jmlp_racer WHERE id = :id"
    ), {"id": zavodnik.id}).first()
    assert ulozeno == ("Petr", "Svoboda", 2012, 2, "ABC")


def test_uprava_zavodnika_s_neexistujicim_klubem_je_odmitnuta(client, admin_headers, db):
    zavodnik = _zavodnik(db)

    response = client.put(f"/api/admin/racers/{zavodnik.id}", headers=admin_headers, json={
        "firstName": "Jan", "lastName": "Novák", "sex": 1, "birthYear": 2011, "club_id": 777,
    })

    assert response.status_code == 400
    assert response.json()["detail"] == "Klub neexistuje"
    assert _pocet(db, "SELECT club_id IS NULL FROM fuj_jmlp_racer WHERE id = :id",
                  id=zavodnik.id) == 1


def test_uprava_zavodnika_priradi_existujici_klub(client, admin_headers, db):
    klub = _klub(db, name="SK Test")
    zavodnik = _zavodnik(db)

    response = client.put(f"/api/admin/racers/{zavodnik.id}", headers=admin_headers, json={
        "firstName": "Jan", "lastName": "Novák", "sex": 1, "birthYear": 2011, "club_id": klub.id,
    })

    assert response.status_code == 200
    assert _pocet(db, "SELECT club_id FROM fuj_jmlp_racer WHERE id = :id",
                  id=zavodnik.id) == klub.id


def test_uprava_neexistujiciho_zavodnika_konci_404(client, admin_headers):
    response = client.put("/api/admin/racers/98765", headers=admin_headers, json={
        "firstName": "Jan", "lastName": "Novák", "sex": 1, "birthYear": 2011,
    })
    assert response.status_code == 404
    assert response.json()["detail"] == "Závodník nenalezen"


def test_zavodnika_s_registraci_nelze_smazat(client, admin_headers, db):
    zavod = _zavod(db)
    zavodnik = _zavodnik(db)
    db.add(models.Registration(race_id=zavod.id, racer_id=zavodnik.id))
    db.commit()

    response = client.delete(f"/api/admin/racers/{zavodnik.id}", headers=admin_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Nelze smazat závodníka s existujícími registracemi"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_racer") == 1


def test_zavodnik_bez_registraci_se_smaze(client, admin_headers, db):
    zavodnik = _zavodnik(db)

    response = client.delete(f"/api/admin/racers/{zavodnik.id}", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["message"] == "Závodník úspěšně smazán"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_racer") == 0


def test_smazani_zavodnika_nechava_osirely_radek_startovni_listiny(client, admin_headers, db):
    """CHYBA: kontroluje se jen registrace, ne startovní listina - viz found_bugs."""
    zavod = _zavod(db)
    zavodnik = _zavodnik(db)
    db.add(models.StartListEntry(race_id=zavod.id, racer_id=zavodnik.id))
    db.commit()

    assert client.delete(f"/api/admin/racers/{zavodnik.id}",
                         headers=admin_headers).status_code == 200
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_race_start_list WHERE racer_id = :id",
                  id=zavodnik.id) == 1


def test_smazani_neexistujiciho_zavodnika_konci_404(client, admin_headers):
    response = client.delete("/api/admin/racers/98765", headers=admin_headers)
    assert response.status_code == 404


def test_seznam_zavodniku_doplni_klub_a_kategorii(client, admin_headers, db):
    klub = _klub(db, name="SK Test")
    s_popiskem = _kategorie(db, name="Mysaci", sex=2, display_name="Myšáci dívky")
    bez_popisku = _kategorie(db, name="Zaci", sex=1)
    _zavodnik(db, name="Eva", surname="Adamova", sex=2, category_id=s_popiskem.id, club_id=klub.id)
    _zavodnik(db, name="Jan", surname="Bednar", sex=1, category_id=bez_popisku.id)

    radky = client.get("/api/admin/racers", headers=admin_headers).json()

    assert [r["lastName"] for r in radky] == ["Adamova", "Bednar"]  # řadí se dle příjmení
    assert radky[0]["club_name"] == "SK Test"
    assert radky[0]["category_name"] == "Myšáci dívky"
    assert radky[0]["firstName"] == radky[0]["name"] == "Eva"
    assert radky[1]["club_name"] is None
    # Bez display_name se popisek složí z názvu a pohlaví.
    assert radky[1]["category_name"] == "Zaci - Muži"


# ===========================================================================
# Kluby (clubs.py)
# ===========================================================================

def test_seznam_klubu_nabizi_jen_platne(client, admin_headers, db):
    _klub(db, name="SK Platny", valid=True)
    _klub(db, name="SK Zruseny", valid=False)

    radky = client.get("/api/admin/clubs/", headers=admin_headers).json()

    assert [c["name"] for c in radky] == ["SK Platny"]


def test_prehled_klubu_pocita_zavodniky_i_porady(client, admin_headers, db):
    klub = _klub(db, name="SK Aktivni")
    prazdny = _klub(db, name="SK Bez cinnosti", valid=False)
    _zavodnik(db, name="Jan", surname="Novak", club_id=klub.id)
    _zavodnik(db, name="Eva", surname="Novakova", sex=2, club_id=klub.id)
    _zavod(db, organizer_id=klub.id)
    logo = _soubor(db, "logo.png")
    db.add(models.Attachment(file_id=logo.id, owner_type="club", owner_id=klub.id, role="logo"))
    db.commit()

    radky = client.get("/api/admin/clubs/overview", headers=admin_headers).json()
    podle_jmena = {c["name"]: c for c in radky}

    assert podle_jmena["SK Aktivni"]["racers_count"] == 2
    assert podle_jmena["SK Aktivni"]["organized_races_count"] == 1
    assert podle_jmena["SK Aktivni"]["valid"] is True
    assert podle_jmena["SK Aktivni"]["has_logo"] is True
    assert podle_jmena["SK Bez cinnosti"]["has_logo"] is False
    assert podle_jmena["SK Bez cinnosti"]["racers_count"] == 0
    assert podle_jmena["SK Bez cinnosti"]["valid"] is False
    assert podle_jmena["SK Bez cinnosti"]["id"] == prazdny.id


def test_smazani_prazdneho_klubu_nepotrebuje_cil(client, admin_headers, db):
    klub = _klub(db, name="SK Prazdny")

    response = client.delete(f"/api/admin/clubs/{klub.id}", headers=admin_headers)

    assert response.status_code == 200
    telo = response.json()
    assert telo["moved_racers"] == 0 and telo["reassigned_to"] is None
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_club WHERE id = :id", id=klub.id) == 0


def test_klub_se_zavodniky_nejde_smazat_bez_cile(client, admin_headers, db):
    klub = _klub(db, name="SK Obsazeny")
    zavodnik = _zavodnik(db, club_id=klub.id)

    response = client.delete(f"/api/admin/clubs/{klub.id}", headers=admin_headers)

    assert response.status_code == 409
    assert "Vyberte klub" in response.json()["detail"]
    # Nesmí zmizet ani klub, ani se rozvázat závodník.
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_club WHERE id = :id", id=klub.id) == 1
    db.refresh(zavodnik)
    assert zavodnik.club_id == klub.id


def test_smazani_klubu_prevede_zavodniky_i_porady(client, admin_headers, db):
    ruseny = _klub(db, name="SK Ruseny", valid=False)
    cilovy = _klub(db, name="SK Cilovy")
    prvni = _zavodnik(db, name="Jan", surname="Novak", club_id=ruseny.id)
    druhy = _zavodnik(db, name="Eva", surname="Novakova", sex=2, club_id=ruseny.id)
    cizi = _zavodnik(db, name="Petr", surname="Cizi", club_id=cilovy.id)
    zavod = _zavod(db, race_nr="JMLP2025-07", organizer_id=ruseny.id)

    response = client.delete(f"/api/admin/clubs/{ruseny.id}",
                             params={"reassign_to": cilovy.id}, headers=admin_headers)

    assert response.status_code == 200
    telo = response.json()
    assert telo["moved_racers"] == 2
    assert telo["moved_races"] == 1
    assert telo["reassigned_to"] == cilovy.id

    # Kontrola v databázi: odpověď 200 sama neříká, že se zápis povedl.
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_club WHERE id = :id", id=ruseny.id) == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_racer WHERE club_id = :id", id=ruseny.id) == 0
    for zavodnik in (prvni, druhy, cizi):
        db.refresh(zavodnik)
        assert zavodnik.club_id == cilovy.id
    db.refresh(zavod)
    assert zavod.organizer_id == cilovy.id


def test_smazani_klubu_odpoji_logo_ale_soubor_nechava(client, admin_headers, db):
    klub = _klub(db, name="SK S Logem")
    logo = _soubor(db, "logo.png")
    db.add(models.Attachment(file_id=logo.id, owner_type="club", owner_id=klub.id, role="logo"))
    db.commit()

    response = client.delete(f"/api/admin/clubs/{klub.id}", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["detached_logo"] is True
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_attachment WHERE owner_type = 'club'"
                      " AND owner_id = :id", id=klub.id) == 0
    # Soubor je pořád v knihovně - mazání souborů je vědomá akce jinde.
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_files WHERE id = :id", id=logo.id) == 1


def test_klub_nelze_prevest_sam_na_sebe(client, admin_headers, db):
    klub = _klub(db, name="SK Sam")
    _zavodnik(db, club_id=klub.id)

    response = client.delete(f"/api/admin/clubs/{klub.id}",
                             params={"reassign_to": klub.id}, headers=admin_headers)

    assert response.status_code == 400
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_club WHERE id = :id", id=klub.id) == 1


def test_prevod_na_neexistujici_klub_nic_nezmeni(client, admin_headers, db):
    klub = _klub(db, name="SK Zdrojovy")
    zavodnik = _zavodnik(db, club_id=klub.id)

    response = client.delete(f"/api/admin/clubs/{klub.id}",
                             params={"reassign_to": 999999}, headers=admin_headers)

    assert response.status_code == 404
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_club WHERE id = :id", id=klub.id) == 1
    db.refresh(zavodnik)
    assert zavodnik.club_id == klub.id


def test_smazani_neexistujiciho_klubu_vraci_404(client, admin_headers):
    assert client.delete("/api/admin/clubs/999999", headers=admin_headers).status_code == 404


def _zadost_o_klub(db, poznamka="Jsem z SK Novy"):
    zavod = _zavod(db, race_nr="JMLP2025-01")
    zavodnik = _zavodnik(db, name="Jan", surname="Novak")
    registrace = models.Registration(race_id=zavod.id, racer_id=zavodnik.id,
                                     club_request_note=poznamka)
    db.add(registrace)
    db.commit()
    db.refresh(registrace)
    return registrace, zavodnik


def test_nevyrizena_zadost_o_klub_je_videt_i_v_pocitadle(client, admin_headers, db):
    registrace, _ = _zadost_o_klub(db)

    assert client.get("/api/admin/clubs/requests/count",
                      headers=admin_headers).json() == {"count": 1}
    radky = client.get("/api/admin/clubs/requests", headers=admin_headers).json()
    assert len(radky) == 1
    assert radky[0]["registration_id"] == registrace.id
    assert radky[0]["racer_name"] == "Jan Novak"
    assert radky[0]["race_name"] == "JMLP2025-01"
    assert radky[0]["club_request_note"] == "Jsem z SK Novy"
    assert radky[0]["current_club_name"] is None


def test_vyrizeni_zadosti_zalozi_novy_klub_a_priradi_ho(client, admin_headers, db):
    registrace, zavodnik = _zadost_o_klub(db)

    response = client.post(f"/api/admin/clubs/requests/{registrace.id}/resolve",
                           headers=admin_headers, json={"new_club_name": "  SK Novy  "})

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["club_name"] == "SK Novy"   # název se ořeže

    klub = db.execute(text("SELECT id, name, valid+0 FROM fuj_jmlp_club")).first()
    assert klub[1:] == ("SK Novy", 1)
    assert _pocet(db, "SELECT club_id FROM fuj_jmlp_racer WHERE id = :id", id=zavodnik.id) == klub[0]
    # Vyřízená žádost zmizí z pracovní fronty.
    assert client.get("/api/admin/clubs/requests/count",
                      headers=admin_headers).json() == {"count": 0}


def test_vyrizeni_zadosti_existujicim_klubem_nezaklada_dalsi(client, admin_headers, db):
    klub = _klub(db, name="SK Stavajici")
    registrace, zavodnik = _zadost_o_klub(db)

    response = client.post(f"/api/admin/clubs/requests/{registrace.id}/resolve",
                           headers=admin_headers, json={"club_id": klub.id})

    assert response.status_code == 200
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_club") == 1
    assert _pocet(db, "SELECT club_id FROM fuj_jmlp_racer WHERE id = :id",
                  id=zavodnik.id) == klub.id


def test_zadost_nelze_vyridit_neplatnym_klubem(client, admin_headers, db):
    klub = _klub(db, name="SK Zruseny", valid=False)
    registrace, zavodnik = _zadost_o_klub(db)

    response = client.post(f"/api/admin/clubs/requests/{registrace.id}/resolve",
                           headers=admin_headers, json={"club_id": klub.id})

    assert response.status_code == 404
    assert response.json()["detail"] == "Klub nenalezen"
    assert _pocet(db, "SELECT club_id IS NULL FROM fuj_jmlp_racer WHERE id = :id",
                  id=zavodnik.id) == 1
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_race_registration "
                      "WHERE club_request_note IS NOT NULL") == 1


def test_jiz_vyrizenou_zadost_nelze_vyridit_znovu(client, admin_headers, db):
    registrace, _ = _zadost_o_klub(db)
    client.post(f"/api/admin/clubs/requests/{registrace.id}/resolve",
                headers=admin_headers, json={"new_club_name": "SK Novy"})

    response = client.post(f"/api/admin/clubs/requests/{registrace.id}/resolve",
                           headers=admin_headers, json={"new_club_name": "SK Jiny"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Žádost nenalezena nebo již vyřízena"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_club") == 1


def test_vyrizeni_zadosti_bez_klubu_konci_500_misto_422(klient_bez_vyjimek, admin_headers, db):
    """CHYBA: chybová odpověď validace se nedá serializovat - viz found_bugs."""
    registrace, _ = _zadost_o_klub(db)

    response = klient_bez_vyjimek.post(f"/api/admin/clubs/requests/{registrace.id}/resolve",
                                       headers=admin_headers, json={})

    assert response.status_code == 500
    assert response.json()["detail"] == "Interní chyba serveru"


# ===========================================================================
# Kategorie (categories.py)
# ===========================================================================

def test_kategorie_se_zalozi_a_je_v_seznamu(client, admin_headers, db):
    response = client.post("/api/admin/categories", headers=admin_headers, json={
        "name": "Mysaci", "display_name": "Myšáci dívky",
        "min_birth_year": 2015, "max_birth_year": 2017, "sex": 2,
    })

    assert response.status_code == 200
    kategorie = response.json()
    assert kategorie["name"] == "Mysaci"
    assert kategorie["display_name"] == "Myšáci dívky"
    assert kategorie["active"] is True

    seznam = client.get("/api/admin/categories", headers=admin_headers).json()
    assert [k["id"] for k in seznam] == [kategorie["id"]]
    detail = client.get(f"/api/admin/categories/{kategorie['id']}", headers=admin_headers).json()
    assert detail["min_birth_year"] == 2015
    assert detail["max_birth_year"] == 2017
    assert detail["sex"] == 2


def test_kategorie_se_stejnym_nazvem_a_pohlavim_se_neulozi(client, admin_headers, db):
    telo = {"name": "Mysaci", "min_birth_year": 2015, "max_birth_year": 2017, "sex": 2}
    assert client.post("/api/admin/categories", headers=admin_headers, json=telo).status_code == 200

    response = client.post("/api/admin/categories", headers=admin_headers, json=telo)

    assert response.status_code == 400
    assert response.json()["detail"] == "Kategorie s tímto názvem a pohlavím již existuje"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_category") == 1


def test_stejny_nazev_pro_jine_pohlavi_projde(client, admin_headers, db):
    client.post("/api/admin/categories", headers=admin_headers, json={
        "name": "Mysaci", "min_birth_year": 2015, "max_birth_year": 2017, "sex": 2})

    response = client.post("/api/admin/categories", headers=admin_headers, json={
        "name": "Mysaci", "min_birth_year": 2015, "max_birth_year": 2017, "sex": 1})

    assert response.status_code == 200
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_category") == 2


def test_kategorie_s_obracenym_rozsahem_rocniku_se_neulozi(client, admin_headers, db):
    response = client.post("/api/admin/categories", headers=admin_headers, json={
        "name": "Obraceni", "min_birth_year": 2018, "max_birth_year": 2010, "sex": 0,
    })

    assert response.status_code == 400
    assert "menší nebo roven" in response.json()["detail"]
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_category") == 0


@pytest.mark.parametrize("pohlavi", [3, -1])
def test_kategorie_s_neznamym_pohlavim_se_neulozi(client, admin_headers, db, pohlavi):
    response = client.post("/api/admin/categories", headers=admin_headers, json={
        "name": "Divne", "min_birth_year": 2010, "max_birth_year": 2018, "sex": pohlavi,
    })

    assert response.status_code == 400
    assert response.json()["detail"] == "Pohlaví musí být 0 (mix), 1 (muži) nebo 2 (ženy)"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_category") == 0


def test_uprava_kategorie_ulozi_zaslana_pole(client, admin_headers, db):
    kategorie = _kategorie(db, name="Zaci", sex=1, min_year=2010, max_year=2012)

    response = client.put(f"/api/admin/categories/{kategorie.id}", headers=admin_headers,
                          json={"max_birth_year": 2013, "active": False})

    assert response.status_code == 200
    assert response.json()["max_birth_year"] == 2013
    assert response.json()["active"] is False
    assert response.json()["min_birth_year"] == 2010
    assert _pocet(db, "SELECT active+0 FROM fuj_jmlp_category WHERE id = :id",
                  id=kategorie.id) == 0


def test_uprava_kategorie_porovna_rozsah_i_s_ulozenou_hodnotou(client, admin_headers, db):
    kategorie = _kategorie(db, min_year=2010, max_year=2012)

    response = client.put(f"/api/admin/categories/{kategorie.id}", headers=admin_headers,
                          json={"min_birth_year": 2020})

    assert response.status_code == 400
    assert "menší nebo roven" in response.json()["detail"]
    assert _pocet(db, "SELECT min_birth_year FROM fuj_jmlp_category WHERE id = :id",
                  id=kategorie.id) == 2010


def test_uprava_kategorie_na_uz_obsazenou_kombinaci_je_odmitnuta(client, admin_headers, db):
    _kategorie(db, name="Zaci", sex=1)
    druha = _kategorie(db, name="Dorost", sex=1, min_year=2005, max_year=2009)

    response = client.put(f"/api/admin/categories/{druha.id}", headers=admin_headers,
                          json={"name": "Zaci"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Kategorie s tímto názvem a pohlavím již existuje"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_category WHERE name = 'Dorost'") == 1


def test_uprava_neexistujici_kategorie_konci_404(client, admin_headers):
    response = client.put("/api/admin/categories/98765", headers=admin_headers,
                          json={"name": "X"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Kategorie nenalezena"


def test_detail_neexistujici_kategorie_konci_404(client, admin_headers):
    response = client.get("/api/admin/categories/98765", headers=admin_headers)
    assert response.status_code == 404


def test_kategorie_se_smaze(client, admin_headers, db):
    kategorie = _kategorie(db)

    response = client.delete(f"/api/admin/categories/{kategorie.id}", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["message"] == "Kategorie úspěšně smazána"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_category") == 0
    assert client.delete(f"/api/admin/categories/{kategorie.id}",
                         headers=admin_headers).status_code == 404


def test_smazani_kategorie_nechava_zavodnikum_neplatne_id(client, admin_headers, db):
    """CHYBA: mazání nekontroluje závodníky ani je nepřepočítá - viz found_bugs."""
    kategorie = _kategorie(db)
    zavodnik = _zavodnik(db, category_id=kategorie.id)

    assert client.delete(f"/api/admin/categories/{kategorie.id}",
                         headers=admin_headers).status_code == 200
    assert _pocet(db, "SELECT category_id FROM fuj_jmlp_racer WHERE id = :id",
                  id=zavodnik.id) == kategorie.id


def test_prepocet_kategorii_priradi_zavodnikum_kategorii_dle_rocniku(client, admin_headers, db):
    mix = _kategorie(db, name="Mix", sex=0, min_year=2010, max_year=2012)
    divky = _kategorie(db, name="Divky", sex=2, min_year=2010, max_year=2012)
    _kategorie(db, name="Veterani", sex=0, min_year=1980, max_year=1995, active=False)
    dcera = _zavodnik(db, name="Eva", surname="Novakova", sex=2, year=2011)
    syn = _zavodnik(db, name="Jan", surname="Novak", sex=1, year=2011)
    veteran = _zavodnik(db, name="Petr", surname="Stary", sex=1, year=1990)

    response = client.post("/api/admin/categories/recalculate/all", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["stats"] == {"total": 3, "updated": 2, "unchanged": 1, "no_category": 1}

    def kategorie_zavodnika(racer_id):
        return _pocet(db, "SELECT category_id FROM fuj_jmlp_racer WHERE id = :id", id=racer_id)

    # Kategorie pro konkrétní pohlaví má přednost před mix kategorií.
    assert kategorie_zavodnika(dcera.id) == divky.id
    assert kategorie_zavodnika(syn.id) == mix.id
    # Neaktivní kategorie se nepoužije, ročník tak zůstane nezařazený.
    assert kategorie_zavodnika(veteran.id) is None


def test_kontrola_pokryti_hlasi_ok_kdyz_kategorie_pokryvaji_vse(client, admin_headers, db):
    _kategorie(db, name="Vsichni", sex=0, min_year=1800, max_year=2200)

    vysledek = client.get("/api/admin/categories/check/coverage", headers=admin_headers).json()

    assert vysledek["status"] == "ok"
    assert vysledek["active_categories"] == 1
    assert vysledek["results_by_sex"]["Muži"]["total_gaps"] == 0
    assert vysledek["results_by_sex"]["Ženy"]["total_overlaps"] == 0


def test_kontrola_pokryti_najde_mezeru_i_prekryv(client, admin_headers, db):
    _kategorie(db, name="Vsichni", sex=0, min_year=2000, max_year=2200)
    _kategorie(db, name="Divky", sex=2, min_year=2010, max_year=2012)
    _kategorie(db, name="Neaktivni", sex=0, min_year=1900, max_year=1999, active=False)

    vysledek = client.get("/api/admin/categories/check/coverage", headers=admin_headers).json()

    assert vysledek["status"] == "warning"
    muzi = vysledek["results_by_sex"]["Muži"]
    zeny = vysledek["results_by_sex"]["Ženy"]
    # Roky 1900-1999 nepokrývá žádná AKTIVNÍ kategorie.
    assert muzi["gap_ranges"][0]["start"] == 1900
    assert muzi["gap_ranges"][0]["end"] == 1999
    assert muzi["total_overlaps"] == 0
    # U žen se ročníky 2010-2012 překrývají mix kategorií a kategorií pro ženy.
    assert zeny["total_overlaps"] == 3
    assert [d["year"] for d in zeny["overlap_details"]] == [2010, 2011, 2012]
    assert [k["name"] for k in vysledek["inactive_categories"]] == ["Neaktivni"]


def test_kontrola_pokryti_pojmenovava_kategorie_nazvem_z_adminu(client, admin_headers, db):
    """Kód ("U12 Předžactvo") je jen doplňková informace - v hláškách i v seznamu
    neaktivních kategorií patří oficiální název nastavený v adminu."""
    _kategorie(db, name="U12 Predzactvo", sex=2, min_year=2014, max_year=2015,
               display_name="Předžačky")
    _kategorie(db, name="OPEN", sex=0, min_year=2014, max_year=2015,
               display_name="OPEN")
    _kategorie(db, name="U8 Mysaci", sex=2, min_year=2018, max_year=2019,
               display_name="Myšáci dívky", active=False)

    vysledek = client.get("/api/admin/categories/check/coverage", headers=admin_headers).json()

    prekryv = vysledek["results_by_sex"]["Ženy"]["overlap_details"][0]
    assert "Předžačky" in prekryv["message"]
    assert "U12 Predzactvo" not in prekryv["message"]
    # Pohlaví se nedolepuje - věta ho už jednou má; u Mix kategorie ano.
    assert "Předžačky (Ženy)" not in prekryv["message"]
    assert "OPEN (Mix)" in prekryv["message"]

    neaktivni = vysledek["inactive_categories"][0]
    assert neaktivni["display_name"] == "Myšáci dívky"
    assert neaktivni["name"] == "U8 Mysaci"


# ===========================================================================
# Příspěvky (posts.py)
# ===========================================================================

def test_prispevek_se_zalozi_i_s_obrazkem(client, admin_headers, db):
    obrazek = _soubor(db, "foto.jpg")

    response = client.post("/api/admin/posts", headers=admin_headers, json={
        "title": "Pozvánka", "content": "Přijďte", "image_file_id": obrazek.id,
        "image_position": "left", "published": False,
    })

    assert response.status_code == 200
    prispevek = response.json()
    assert prispevek["title"] == "Pozvánka"
    assert prispevek["image_file_id"] == obrazek.id
    assert prispevek["image_position"] == "left"
    assert prispevek["published"] is False
    assert db.execute(text(
        "SELECT owner_type, owner_id, role FROM fuj_jmlp_attachment"
    )).first() == ("post", prispevek["id"], "image")


def test_prispevek_bez_nazvu_se_neulozi(client, admin_headers, db):
    response = client.post("/api/admin/posts", headers=admin_headers, json={"content": "Obsah"})

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "title"]
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_posts") == 0


def test_prispevek_s_neexistujicim_souborem_vrati_404_ale_presto_vznikne(client, admin_headers, db):
    """CHYBA: příspěvek se commitne dřív, než se ověří příloha - viz found_bugs."""
    response = client.post("/api/admin/posts", headers=admin_headers, json={
        "title": "Pozvánka", "content": "Přijďte", "image_file_id": 4242,
    })

    assert response.status_code == 404
    assert response.json()["detail"] == "Soubor nebyl nalezen"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_posts") == 1
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_attachment") == 0


def test_uprava_prispevku_zmeni_jen_zaslana_pole(client, admin_headers, db):
    prispevek = client.post("/api/admin/posts", headers=admin_headers, json={
        "title": "Původní", "content": "Obsah", "published": False,
    }).json()

    response = client.put(f"/api/admin/posts/{prispevek['id']}", headers=admin_headers,
                          json={"title": "Nový", "published": True})

    assert response.status_code == 200
    assert response.json()["title"] == "Nový"
    assert response.json()["published"] is True
    assert response.json()["content"] == "Obsah"
    assert db.execute(text("SELECT title, published+0 FROM fuj_jmlp_posts")).first() == ("Nový", 1)


def test_uprava_prispevku_odpoji_obrazek_prazdnou_hodnotou(client, admin_headers, db):
    obrazek = _soubor(db, "foto.jpg")
    prispevek = client.post("/api/admin/posts", headers=admin_headers, json={
        "title": "Pozvánka", "content": "Přijďte", "image_file_id": obrazek.id,
    }).json()

    response = client.put(f"/api/admin/posts/{prispevek['id']}", headers=admin_headers,
                          json={"image_file_id": None})

    assert response.status_code == 200
    assert response.json()["image_file_id"] is None
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_attachment") == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_files") == 1


def test_uprava_neexistujiciho_prispevku_konci_404(client, admin_headers):
    response = client.put("/api/admin/posts/98765", headers=admin_headers, json={"title": "X"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Post nenalezen"


def test_smazani_prispevku_odpoji_prilohu_ale_soubor_zustane(client, admin_headers, db):
    obrazek = _soubor(db, "foto.jpg")
    prispevek = client.post("/api/admin/posts", headers=admin_headers, json={
        "title": "Pozvánka", "content": "Přijďte", "image_file_id": obrazek.id,
    }).json()

    response = client.delete(f"/api/admin/posts/{prispevek['id']}", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["message"] == "Post úspěšně smazán"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_posts") == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_attachment") == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_files") == 1


def test_smazani_neexistujiciho_prispevku_konci_404(client, admin_headers):
    response = client.delete("/api/admin/posts/98765", headers=admin_headers)
    assert response.status_code == 404


def test_seznam_prispevku_radi_od_nejnovejsiho(client, admin_headers, db):
    from datetime import datetime
    starsi = models.Post(title="Starší", content="A", created_at=datetime(2025, 1, 1))
    novejsi = models.Post(title="Novější", content="B", created_at=datetime(2025, 6, 1))
    db.add_all([starsi, novejsi])
    db.commit()

    radky = client.get("/api/admin/posts", headers=admin_headers).json()

    assert [p["title"] for p in radky] == ["Novější", "Starší"]


# ===========================================================================
# Sezóny (seasons.py)
# ===========================================================================

def test_sezona_se_zalozi_s_dopoctenym_koncem_a_rimskym_rocnikem(client, admin_headers, db):
    response = client.post("/api/admin/seasons", headers=admin_headers,
                           json={"year_start": 2025, "edition": 19})

    assert response.status_code == 200
    sezona = response.json()
    assert sezona["year_end"] == 2026            # dopočte se
    assert sezona["season_label"] == "2025/2026"
    assert sezona["edition_label"] == "XIX."
    assert sezona["name"] == "Jihomoravský lyžařský pohár"   # výchozí název
    assert sezona["active"] is True
    assert sezona["races_count"] == 0
    assert _pocet(db, "SELECT year_end FROM fuj_jmlp_season") == 2026


def test_sezonu_se_stejnym_pocatecnim_rokem_nelze_zalozit_dvakrat(client, admin_headers, db):
    client.post("/api/admin/seasons", headers=admin_headers, json={"year_start": 2025})

    response = client.post("/api/admin/seasons", headers=admin_headers, json={"year_start": 2025})

    assert response.status_code == 400
    assert response.json()["detail"] == "Sezóna 2025/2026 už existuje"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_season") == 1


def test_sezona_bez_pocatecniho_roku_se_neulozi(client, admin_headers, db):
    response = client.post("/api/admin/seasons", headers=admin_headers, json={"edition": 19})

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "year_start"]
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_season") == 0


def test_seznam_sezon_pocita_zavody_i_dokumenty(client, admin_headers, db):
    _sezona(db, year_start=2024)
    _sezona(db, year_start=2025)
    _zavod(db, race_nr="JMLP2025-01", season_id=2025)
    _zavod(db, race_nr="JMLP2025-02", season_id=2025)
    soubor = _soubor(db, "celkove.pdf")
    db.add(models.Attachment(file_id=soubor.id, owner_type="season", owner_id=2025,
                             role="vysledky"))
    db.commit()

    radky = client.get("/api/admin/seasons", headers=admin_headers).json()

    assert [s["year_start"] for s in radky] == [2025, 2024]   # od nejnovější
    assert radky[0]["races_count"] == 2
    assert radky[0]["documents_count"] == 1
    assert radky[1]["races_count"] == 0
    assert radky[1]["documents_count"] == 0


def test_uprava_sezony_ignoruje_zmenu_pocatecniho_roku(client, admin_headers, db):
    """year_start je klíč, na který se váží závody i přílohy - měnit se nesmí."""
    sezona = _sezona(db, year_start=2025, edition=19)

    response = client.put(f"/api/admin/seasons/{sezona.id}", headers=admin_headers,
                          json={"year_start": 2030, "name": "Nový název", "edition": 20})

    assert response.status_code == 200
    assert response.json()["year_start"] == 2025
    assert response.json()["name"] == "Nový název"
    assert response.json()["edition_label"] == "XX."
    assert _pocet(db, "SELECT year_start FROM fuj_jmlp_season WHERE id = :id", id=sezona.id) == 2025


def test_uprava_neexistujici_sezony_konci_404(client, admin_headers):
    response = client.put("/api/admin/seasons/98765", headers=admin_headers, json={"name": "X"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Sezóna nebyla nalezena"


def test_sezonu_se_zavody_nelze_smazat(client, admin_headers, db):
    sezona = _sezona(db, year_start=2025)
    _zavod(db, race_nr="JMLP2025-01", season_id=2025)
    _zavod(db, race_nr="JMLP2025-02", season_id=2025)

    response = client.delete(f"/api/admin/seasons/{sezona.id}", headers=admin_headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "Sezóna má 2 závodů a nelze ji smazat."
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_season") == 1
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_race") == 2


def test_sezonu_lze_smazat_kdyz_ma_zavody_jina_sezona(client, admin_headers, db):
    prazdna = _sezona(db, year_start=2024)
    _sezona(db, year_start=2025)
    _zavod(db, race_nr="JMLP2025-01", season_id=2025)

    response = client.delete(f"/api/admin/seasons/{prazdna.id}", headers=admin_headers)

    assert response.status_code == 200
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_season WHERE year_start = 2024") == 0


def test_smazani_sezony_odpoji_dokumenty_ale_soubory_zustanou(client, admin_headers, db):
    sezona = _sezona(db, year_start=2025)
    soubor = _soubor(db, "celkove.pdf")
    db.add(models.Attachment(file_id=soubor.id, owner_type="season", owner_id=2025,
                             role="vysledky"))
    db.commit()

    response = client.delete(f"/api/admin/seasons/{sezona.id}", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["message"] == "Sezóna smazána"
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_season") == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_attachment") == 0
    assert _pocet(db, "SELECT COUNT(*) FROM fuj_jmlp_files") == 1


def test_smazani_neexistujici_sezony_konci_404(client, admin_headers):
    response = client.delete("/api/admin/seasons/98765", headers=admin_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Sezóna nebyla nalezena"
