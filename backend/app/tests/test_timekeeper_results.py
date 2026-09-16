"""Výsledky závodu v timekeeper sekci - app/routers/timekeeper/results.py.

Mazání výsledků je záchranná brzda pro závodní den: rozhodčí musí umět zahodit
naměřená data a jet znovu, aniž by přišel o rozlosovanou startovku. Testy proto
hlídají hlavně to, co se smazat SMÍ a co ne.
"""
from datetime import date

import pytest

from app import auth, models
from app.models import AttachmentOwner, AttachmentRole, FileTypeEnum
from app.utils import get_current_season_id

AKTUALNI_SEZONA = get_current_season_id()


# --------------------------------------------------------------------------
# Pomocníci pro testovací data
# --------------------------------------------------------------------------

@pytest.fixture
def zavod(db):
    zavod = models.Race(
        race_nr="JMLP2026-07",
        datum=date.today(),
        season_id=AKTUALNI_SEZONA,
        closed=False,
        registration=True,
        race_method_id=1,
        is_live=False,
    )
    db.add(zavod)
    db.commit()
    db.refresh(zavod)
    return zavod


@pytest.fixture
def kategorie(db):
    kategorie = models.Category(
        name="U10", display_name="Přípravka dívky",
        min_birth_year=2016, max_birth_year=2018, sex=2, active=True,
    )
    db.add(kategorie)
    db.commit()
    db.refresh(kategorie)
    return kategorie


def _zavodnik(db, name, surname, year=2017, sex=2):
    zavodnik = models.Racer(name=name, surname=surname, year=year, sex=sex)
    db.add(zavodnik)
    db.commit()
    db.refresh(zavodnik)
    return zavodnik


def _polozka(db, zavod, zavodnik, kategorie, start_number=1,
             time1=None, time2=None, time_sum=None,
             dnf=False, dns=False, dsq=False, points=None):
    polozka = models.StartListEntry(
        race_id=zavod.id,
        racer_id=zavodnik.id,
        category_id=kategorie.id,
        start_number=start_number,
        racer_name=zavodnik.name,
        racer_surname=zavodnik.surname,
        racer_year=zavodnik.year,
        racer_sex=zavodnik.sex,
        category_name=kategorie.display_name,
        category_sex=kategorie.sex,
        time1=time1, time2=time2, time_sum=time_sum,
        dnf=dnf, dns=dns, dsq=dsq, points=points,
    )
    db.add(polozka)
    db.commit()
    db.refresh(polozka)
    return polozka


@pytest.fixture
def namereno(db, zavod, kategorie):
    """Dva závodníci s časy a jeden nedokončivší - typický stav po závodě."""
    prvni = _polozka(db, zavod, _zavodnik(db, "Anna", "Prvni"), kategorie,
                     start_number=1, time1=30.5, time2=31.0, time_sum=61.5, points=100)
    druha = _polozka(db, zavod, _zavodnik(db, "Bara", "Druha"), kategorie,
                     start_number=2, time1=32.0, time2=33.0, time_sum=65.0, points=80)
    treti = _polozka(db, zavod, _zavodnik(db, "Cilka", "Treti"), kategorie,
                     start_number=3, dnf=True, points=0)
    return [prvni, druha, treti]


def _publikovana_listina(db, zavod, tmp_path, is_generated=True):
    """Výsledková listina připojená k závodu, i se souborem na disku."""
    cesta = tmp_path / "vysledky.pdf"
    cesta.write_bytes(b"%PDF-1.4 test")
    soubor = models.File(
        filename="uuid-vysledky.pdf",
        original_filename="JMLP2026-07_vysledky.pdf",
        file_path=str(cesta),
        file_size=cesta.stat().st_size,
        mime_type="application/pdf",
        file_type=FileTypeEnum.vysledky,
    )
    db.add(soubor)
    db.commit()
    db.refresh(soubor)

    priloha = models.Attachment(
        file_id=soubor.id,
        owner_type=AttachmentOwner.race.value,
        owner_id=zavod.id,
        role=AttachmentRole.vysledky.value,
        sort_order=0,
        published=True,
        is_generated=is_generated,
    )
    db.add(priloha)
    db.commit()
    return soubor, cesta


def _smazat(client, zavod, hlavicky, published=False, idempotency_key=None):
    hlavicky = dict(hlavicky)
    if idempotency_key:
        hlavicky["X-Idempotency-Key"] = idempotency_key
    return client.delete(
        f"/api/timekeeper/races/{zavod.id}/results?published={str(published).lower()}",
        headers=hlavicky,
    )


# --------------------------------------------------------------------------
# Mazání naměřených výsledků
# --------------------------------------------------------------------------

def test_mazani_vysledku_smaze_casy_priznaky_i_body(client, db, zavod, namereno,
                                                    timekeeper_headers):
    odpoved = _smazat(client, zavod, timekeeper_headers)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["cleared"] == 3

    db.expire_all()
    for polozka in db.query(models.StartListEntry).filter(
            models.StartListEntry.race_id == zavod.id).all():
        assert polozka.time1 is None
        assert polozka.time2 is None
        assert polozka.time_sum is None
        assert polozka.dnf is False
        assert polozka.dns is False
        assert polozka.dsq is False
        assert polozka.points is None


def test_mazani_vysledku_nechá_startovku_na_pokoji(client, db, zavod, namereno,
                                                   timekeeper_headers):
    """To je celý smysl: závod se dá jet znovu bez opakovaného losování."""
    _smazat(client, zavod, timekeeper_headers)

    db.expire_all()
    polozky = db.query(models.StartListEntry).filter(
        models.StartListEntry.race_id == zavod.id
    ).order_by(models.StartListEntry.start_number).all()

    assert [p.start_number for p in polozky] == [1, 2, 3]
    assert [p.racer_surname for p in polozky] == ["Prvni", "Druha", "Treti"]
    assert all(p.category_name == "Přípravka dívky" for p in polozky)


def test_mazani_vysledku_se_tyka_jen_daneho_zavodu(client, db, zavod, kategorie,
                                                   namereno, timekeeper_headers):
    jiny = models.Race(
        race_nr="JMLP2026-08", datum=date.today(), season_id=AKTUALNI_SEZONA,
        closed=False, registration=True, race_method_id=1, is_live=False,
    )
    db.add(jiny)
    db.commit()
    db.refresh(jiny)
    cizi = _polozka(db, jiny, _zavodnik(db, "David", "Cizi", 2017, 1), kategorie,
                    start_number=1, time1=40.0, time_sum=40.0, points=100)

    _smazat(client, zavod, timekeeper_headers)

    db.expire_all()
    zustal = db.query(models.StartListEntry).filter(models.StartListEntry.id == cizi.id).first()
    assert float(zustal.time1) == 40.0
    assert zustal.points == 100


def test_mazani_vysledku_bez_namerenych_dat_projde(client, db, zavod, kategorie,
                                                   timekeeper_headers):
    _polozka(db, zavod, _zavodnik(db, "Anna", "Prvni"), kategorie, start_number=1)

    odpoved = _smazat(client, zavod, timekeeper_headers)

    assert odpoved.status_code == 200
    assert odpoved.json()["cleared"] == 1


def test_mazani_vysledku_neexistujiciho_zavodu_je_404(client, timekeeper_headers):
    odpoved = client.delete("/api/timekeeper/races/9999/results", headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závod nenalezen"


def test_mazani_vysledku_bez_prihlaseni_neprojde(client, zavod):
    odpoved = client.delete(f"/api/timekeeper/races/{zavod.id}/results")

    assert odpoved.status_code in (401, 403)


def test_dvoji_odeslani_tehoz_mazani_se_neprovede_dvakrat(client, db, zavod, kategorie,
                                                          namereno, timekeeper_headers):
    """Odpověď z fronty se přehraje beze změny dat - jinak by druhý pokus
    smazal i časy naměřené mezitím."""
    prvni = _smazat(client, zavod, timekeeper_headers, idempotency_key="klic-1")
    assert prvni.status_code == 200
    assert prvni.json()["cleared"] == 3

    # Mezitím se naměří nový čas.
    polozka = db.query(models.StartListEntry).filter(
        models.StartListEntry.race_id == zavod.id
    ).order_by(models.StartListEntry.start_number).first()
    polozka.time1 = 29.9
    polozka.time_sum = 29.9
    db.commit()

    druhy = _smazat(client, zavod, timekeeper_headers, idempotency_key="klic-1")

    assert druhy.status_code == 200
    assert druhy.json()["idempotency_replayed"] is True
    db.expire_all()
    assert float(db.query(models.StartListEntry).filter(
        models.StartListEntry.id == polozka.id).first().time1) == 29.9


def test_mazani_casu_a_mazani_i_listiny_jsou_dve_ruzne_operace(
        client, db, zavod, namereno, tmp_path, timekeeper_headers):
    """Stejný klíč, jiný rozsah - druhá varianta se nesmí přehrát z první."""
    _publikovana_listina(db, zavod, tmp_path)

    jen_casy = _smazat(client, zavod, timekeeper_headers, idempotency_key="klic-2")
    i_listina = _smazat(client, zavod, timekeeper_headers, published=True,
                        idempotency_key="klic-2")

    assert jen_casy.json()["published_removed"] is False
    assert i_listina.json()["idempotency_replayed"] is False
    assert i_listina.json()["published_removed"] is True


# --------------------------------------------------------------------------
# Publikovaná výsledková listina
# --------------------------------------------------------------------------

def test_bez_priznaku_zustane_publikovana_listina_viset(client, db, zavod, namereno,
                                                        tmp_path, timekeeper_headers):
    soubor, cesta = _publikovana_listina(db, zavod, tmp_path)

    odpoved = _smazat(client, zavod, timekeeper_headers)

    assert odpoved.json()["published_removed"] is False
    assert db.query(models.Attachment).filter(
        models.Attachment.owner_id == zavod.id,
        models.Attachment.role == AttachmentRole.vysledky.value,
    ).count() == 1
    assert cesta.exists()


def test_s_priznakem_se_vygenerovana_listina_odpoji_i_smaze(client, db, zavod, namereno,
                                                            tmp_path, timekeeper_headers):
    soubor, cesta = _publikovana_listina(db, zavod, tmp_path)
    # Id se musí přečíst dřív, než ho endpoint smaže - jinak si SQLAlchemy
    # sáhne na zmizelý řádek.
    soubor_id = soubor.id

    odpoved = _smazat(client, zavod, timekeeper_headers, published=True)

    assert odpoved.status_code == 200, odpoved.text
    assert odpoved.json()["published_removed"] is True
    db.expire_all()
    assert db.query(models.Attachment).filter(
        models.Attachment.owner_id == zavod.id,
        models.Attachment.role == AttachmentRole.vysledky.value,
    ).count() == 0
    assert db.query(models.File).filter(models.File.id == soubor_id).first() is None
    assert not cesta.exists()


def test_rucne_nahrana_listina_se_odpoji_ale_soubor_zustane_v_knihovne(
        client, db, zavod, namereno, tmp_path, timekeeper_headers):
    """Mazat cizí soubor z knihovny je vždycky vědomá akce v knihovně, ne
    vedlejší efekt mazání výsledků."""
    soubor, cesta = _publikovana_listina(db, zavod, tmp_path, is_generated=False)

    odpoved = _smazat(client, zavod, timekeeper_headers, published=True)

    assert odpoved.json()["published_removed"] is True
    assert db.query(models.File).filter(models.File.id == soubor.id).first() is not None
    assert cesta.exists()


def test_mazani_s_priznakem_bez_publikovane_listiny_projde(client, zavod, namereno,
                                                           timekeeper_headers):
    odpoved = _smazat(client, zavod, timekeeper_headers, published=True)

    assert odpoved.status_code == 200
    assert odpoved.json()["published_removed"] is False
