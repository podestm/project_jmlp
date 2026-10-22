"""Zakládání a úprava závodníka v administraci.

Schéma RacerCreate používá jiné názvy polí než model (firstName vs name,
birthYear vs year, ...). Komentáře u schématu slibují mapování, které se ale
nikde neprovádělo: založení končilo chybou 500 a úprava tiše zahodila všechno
kromě oddílu, přičemž odpověď vypadala jako úspěšná.
"""
import pytest

from app import models


def _klub(db, name="SK Test"):
    klub = models.Club(name=name, valid=True)
    db.add(klub)
    db.commit()
    db.refresh(klub)
    return klub


def _zavodnik(db, **overrides):
    data = dict(name="Jan", surname="Novak", year=2010, sex=1)
    data.update(overrides)
    racer = models.Racer(**data)
    db.add(racer)
    db.commit()
    db.refresh(racer)
    return racer


@pytest.fixture
def kategorie(db):
    kategorie = models.Category(
        name="Zaci", sex=1, min_birth_year=2008, max_birth_year=2012, active=True
    )
    db.add(kategorie)
    db.commit()
    db.refresh(kategorie)
    return kategorie


def test_zalozeni_zavodnika_ulozi_jmeno_i_rocnik(client, db, admin_headers, kategorie):
    odpoved = client.post("/api/admin/racers", headers=admin_headers, json={
        "firstName": "Anna",
        "lastName": "Holcickova",
        "sex": 2,
        "birthYear": 2011,
        "idSlcr": "SLCR-42",
    })

    assert odpoved.status_code in (200, 201), odpoved.text
    ulozeny = db.query(models.Racer).filter(models.Racer.surname == "Holcickova").first()
    assert ulozeny is not None, "závodník se vůbec neuložil"
    assert ulozeny.name == "Anna"
    assert ulozeny.year == 2011
    assert ulozeny.slcr_id == "SLCR-42"


def test_zalozeni_zavodnika_prirradi_kategorii(client, db, admin_headers, kategorie):
    client.post("/api/admin/racers", headers=admin_headers, json={
        "firstName": "Petr", "lastName": "Maly", "sex": 1, "birthYear": 2010,
    })

    ulozeny = db.query(models.Racer).filter(models.Racer.surname == "Maly").first()
    # Bez kategorie závodník nespadne do žádné startovky.
    assert ulozeny.category_id == kategorie.id


def test_zalozeni_s_oddilem(client, db, admin_headers, kategorie):
    klub = _klub(db)

    odpoved = client.post("/api/admin/racers", headers=admin_headers, json={
        "firstName": "Eva", "lastName": "Klubova", "sex": 2, "birthYear": 2010,
        "club_id": klub.id,
    })

    assert odpoved.status_code in (200, 201), odpoved.text
    assert db.query(models.Racer).filter(models.Racer.surname == "Klubova").first().club_id == klub.id


def test_zalozeni_s_neexistujicim_oddilem_odmitne(client, admin_headers, kategorie):
    odpoved = client.post("/api/admin/racers", headers=admin_headers, json={
        "firstName": "Jan", "lastName": "Nikdo", "sex": 1, "birthYear": 2010,
        "club_id": 999999,
    })
    assert odpoved.status_code == 400


def test_uprava_zavodnika_skutecne_ulozi_zmeny(client, db, admin_headers, kategorie):
    """Odpověď dřív vracela nové hodnoty, ale do databáze se nezapsaly."""
    racer = _zavodnik(db)

    odpoved = client.put(f"/api/admin/racers/{racer.id}", headers=admin_headers, json={
        "firstName": "Josef",
        "lastName": "Opraveny",
        "sex": 1,
        "birthYear": 2009,
        "idSlcr": "SLCR-99",
    })

    assert odpoved.status_code == 200, odpoved.text
    db.expire_all()
    ulozeny = db.query(models.Racer).get(racer.id)
    assert ulozeny.name == "Josef"
    assert ulozeny.surname == "Opraveny"
    assert ulozeny.year == 2009
    assert ulozeny.slcr_id == "SLCR-99"


def test_uprava_rocniku_prepocita_kategorii(client, db, admin_headers, kategorie):
    stara = models.Category(name="Starsi", sex=1, min_birth_year=2000, max_birth_year=2005, active=True)
    db.add(stara)
    db.commit()
    db.refresh(stara)
    racer = _zavodnik(db, year=2003, category_id=stara.id)

    client.put(f"/api/admin/racers/{racer.id}", headers=admin_headers, json={
        "firstName": "Jan", "lastName": "Novak", "sex": 1, "birthYear": 2010,
    })

    db.expire_all()
    assert db.query(models.Racer).get(racer.id).category_id == kategorie.id


def test_uprava_neexistujiciho_zavodnika_je_404(client, admin_headers):
    odpoved = client.put("/api/admin/racers/999999", headers=admin_headers, json={
        "firstName": "Nikdo", "lastName": "Nikde", "sex": 1, "birthYear": 2010,
    })
    assert odpoved.status_code == 404


def test_prazdny_oddil_neni_chyba(client, db, admin_headers, kategorie):
    """Formulář posílá u nevybraného oddílu prázdnou hodnotu."""
    odpoved = client.post("/api/admin/racers", headers=admin_headers, json={
        "firstName": "Bez", "lastName": "Oddilu", "sex": 1, "birthYear": 2010,
        "club_id": None,
    })

    assert odpoved.status_code in (200, 201), odpoved.text
    assert db.query(models.Racer).filter(models.Racer.surname == "Oddilu").first().club_id is None


def test_zalozeni_bez_prihlaseni_neprojde(client):
    odpoved = client.post("/api/admin/racers", json={
        "firstName": "Jan", "lastName": "Novak", "sex": 1, "birthYear": 2010,
    })
    assert odpoved.status_code in (401, 403)


def test_uprava_na_jmeno_jineho_zavodnika_hlasi_duplicitu(client, db, admin_headers, kategorie):
    """Přejmenování "Viki" na "Viktorie", když Viktorie už v registru je.

    Dřív to končilo "Interní chybou serveru" (unikátní klíč jméno + příjmení
    + ročník + pohlaví). Teď 409 s vysvětlením, kterého závodníka se to týká.
    """
    klub = _klub(db, "KSL BTL Kroměříž")
    viki = _zavodnik(db, name="Viki", surname="Bezděková", year=2012, sex=2, club_id=klub.id)
    viktorie = _zavodnik(db, name="Viktorie", surname="Bezděková", year=2012, sex=2, club_id=klub.id)

    odpoved = client.put(f"/api/admin/racers/{viki.id}", headers=admin_headers, json={
        "firstName": "Viktorie", "lastName": "Bezděková", "sex": 2, "birthYear": 2012, "club_id": klub.id,
    })

    assert odpoved.status_code == 409
    detail = odpoved.json()["detail"]
    assert "Bezděková Viktorie (2012)" in detail
    assert f"ID {viktorie.id}" in detail and "KSL BTL Kroměříž" in detail
    db.expire_all()
    assert db.get(type(viki), viki.id).name == "Viki"


def test_uprava_beze_zmeny_jmena_neni_duplicita(client, db, admin_headers, kategorie):
    viki = _zavodnik(db, name="Viki", surname="Bezděková", year=2012, sex=2)
    odpoved = client.put(f"/api/admin/racers/{viki.id}", headers=admin_headers, json={
        "firstName": "Viki", "lastName": "Bezděková", "sex": 2, "birthYear": 2012, "idSlcr": "123456",
    })
    assert odpoved.status_code == 200


def test_zalozeni_duplicitniho_zavodnika_hlasi_duplicitu(client, db, admin_headers, kategorie):
    _zavodnik(db, name="Viktorie", surname="Bezděková", year=2012, sex=2)
    odpoved = client.post("/api/admin/racers", headers=admin_headers, json={
        "firstName": "Viktorie", "lastName": "Bezděková", "sex": 2, "birthYear": 2012,
    })
    assert odpoved.status_code == 409


def test_seznam_zavodniku_odkazuje_na_kartu_clena_slcr(client, db, admin_headers):
    """Jméno je odkaz na kartu člena SLČR, když sedí ID, nebo přesně jméno a ročník (i s diakritikou)."""
    from sqlalchemy import text
    db.execute(text("""INSERT INTO fuj_jmlp_slcr_member (member_id, slug, race_code, surname, name, year) VALUES
        (42073, 'valeska-viktorie', 890521, 'Valeská', 'Viktorie', 2019),
        (5038, 'podestova-renata', 806816, 'Podešťová', 'Renata', 1973)"""))
    db.commit()
    podle_id = _zavodnik(db, name="Viki", surname="Valeská", year=2019, sex=2, slcr_id="890521")
    podle_jmena = _zavodnik(db, name="Renata", surname="Podešťová", year=1973, sex=2, slcr_id="-")
    # Registr je k diakritice lhostejný (unikátní klíč), proto jiné pohlaví.
    bez_diakritiky = _zavodnik(db, name="Renata", surname="Podestova", year=1973, sex=1)
    jiny_rocnik = _zavodnik(db, name="Renata", surname="Podešťová", year=1974, sex=2)

    urls = {r["id"]: r["slcr_url"] for r in client.get("/api/admin/racers", headers=admin_headers).json()}

    assert urls[podle_id.id] == "https://evidence.czech-ski.com/clenove/42073/valeska-viktorie"
    assert urls[podle_jmena.id] == "https://evidence.czech-ski.com/clenove/5038/podestova-renata"
    assert urls[bez_diakritiky.id] is None
    assert urls[jiny_rocnik.id] is None


def test_uprava_zavodnika_s_pomlckou_misto_id_slcr(client, db, admin_headers, kategorie):
    """806 starších záznamů má místo chybějícího ID SLČR pomlčku. Formulář ji
    pošle zpátky a ochrana proti vzorcům (nic nesmí začínat "-") pak
    zablokovala jakoukoli úpravu - ani příjmení, ani oddíl nešlo změnit."""
    klub = _klub(db)
    racer = _zavodnik(db, surname="Wolf", slcr_id="-")
    odpoved = client.put(f"/api/admin/racers/{racer.id}", headers=admin_headers, json={
        "firstName": "Jan", "lastName": "Wolff", "sex": 1, "birthYear": 2010,
        "club_id": klub.id, "idSlcr": "-",
    })
    assert odpoved.status_code == 200, odpoved.text
    db.expire_all()
    ulozeny = db.get(models.Racer, racer.id)
    assert (ulozeny.surname.strip(), ulozeny.club_id, ulozeny.slcr_id) == ("Wolff", klub.id, None)


def test_neplatna_hodnota_je_chyba_422_ne_500(client, db, admin_headers, kategorie):
    racer = _zavodnik(db)
    odpoved = client.put(f"/api/admin/racers/{racer.id}", headers=admin_headers, json={
        "firstName": "Jan", "lastName": "=SUM(A1)", "sex": 1, "birthYear": 2010,
    })
    assert odpoved.status_code == 422
    assert "nesmí začínat" in odpoved.json()["detail"][0]["msg"]


def test_nula_misto_id_slcr_se_ulozi_jako_prazdne(client, db, admin_headers, kategorie):
    racer = _zavodnik(db, slcr_id="0")
    odpoved = client.put(f"/api/admin/racers/{racer.id}", headers=admin_headers, json={
        "firstName": "Jan", "lastName": "Novak", "sex": 1, "birthYear": 2010, "idSlcr": "0",
    })
    assert odpoved.status_code == 200, odpoved.text
    db.expire_all()
    assert db.get(models.Racer, racer.id).slcr_id is None
