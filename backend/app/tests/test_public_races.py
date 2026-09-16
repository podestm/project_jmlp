"""Veřejné endpointy závodů a kalendáře - app/routers/races.py.

Kalendář na webu je jediný pohled, který návštěvník na závody má: co se sem
nedostane, to pro veřejnost neexistuje. Testy proto hlídají hlavně to, co se
z výpisu vypadne (závod bez čísla, bez data, nepublikovaná příloha) a jak se
určuje "aktuální sezóna", podle které se kalendář filtruje.
"""
from datetime import date, timedelta

import pytest
from sqlalchemy.exc import ProgrammingError

from app import models
from app.utils import get_current_season_id


# --------------------------------------------------------------------------
# Pomocníci na testovací data
# --------------------------------------------------------------------------
def _aktualni_sezona() -> int:
    """Sezóna, do které patří dnešek - stejnou logikou jako aplikace."""
    return get_current_season_id()


def _areal(db, name: str) -> models.Areal:
    areal = models.Areal(name=name)
    db.add(areal)
    db.commit()
    db.refresh(areal)
    return areal


def _klub(db, name: str, valid: bool = True) -> models.Club:
    klub = models.Club(name=name, valid=valid)
    db.add(klub)
    db.commit()
    db.refresh(klub)
    return klub


# Odlišuje "datum jsem nezadal" (= dnes) od vědomého datum=None (závod bez data).
_DNES = object()


def _zavod(
    db,
    *,
    race_nr: str | None = "JMLP2026-01",
    datum=_DNES,
    season_id: int | None = None,
    areal_id: int | None = None,
    organizer_id: int | None = None,
    closed: bool = False,
    registration: bool = True,
    race_method_id: int = 1,
    is_live: bool = False,
) -> models.Race:
    zavod = models.Race(
        race_nr=race_nr,
        datum=date.today() if datum is _DNES else datum,
        season_id=_aktualni_sezona() if season_id is None else season_id,
        areal_id=areal_id,
        organizer_id=organizer_id,
        closed=closed,
        registration=registration,
        race_method_id=race_method_id,
        is_live=is_live,
    )
    db.add(zavod)
    db.commit()
    db.refresh(zavod)
    return zavod


def _soubor(db, cesta, original_filename: str = "Propozice.pdf") -> models.File:
    soubor = models.File(
        filename="0000-uuid.pdf",
        original_filename=original_filename,
        file_path=str(cesta),
        file_size=cesta.stat().st_size if cesta.exists() else 0,
        mime_type="application/pdf",
        file_type=models.FileTypeEnum.propozice,
    )
    db.add(soubor)
    db.commit()
    db.refresh(soubor)
    return soubor


def _priloha(
    db,
    *,
    owner_id: int,
    role: str,
    file_id: int,
    owner_type: str = "race",
    published: bool = True,
) -> models.Attachment:
    priloha = models.Attachment(
        file_id=file_id,
        owner_type=owner_type,
        owner_id=owner_id,
        role=role,
        sort_order=0,
        published=published,
        is_generated=False,
    )
    db.add(priloha)
    db.commit()
    db.refresh(priloha)
    return priloha


def _pdf(tmp_path, jmeno: str, obsah: bytes):
    cesta = tmp_path / jmeno
    cesta.write_bytes(obsah)
    return cesta


def _cisla(odpoved) -> list:
    """Čísla závodů v pořadí, v jakém je endpoint vrátil."""
    return [z["race_nr"] for z in odpoved.json()]


# --------------------------------------------------------------------------
# Číselníky pro filtry kalendáře
# --------------------------------------------------------------------------
def test_seznam_arealu_vraci_vsechny_arealy(client, db):
    _areal(db, "Přelouč")
    _areal(db, "Lipno")

    odpoved = client.get("/races/areals")

    assert odpoved.status_code == 200
    arealy = odpoved.json()
    assert {a["name"] for a in arealy} == {"Přelouč", "Lipno"}
    assert set(arealy[0]) == {"id", "name"}


def test_seznam_organizatoru_vynecha_neplatne_kluby(client, db):
    platny = _klub(db, "Lodní klub Řež", valid=True)
    _klub(db, "Zaniklý klub", valid=False)

    organizatori = client.get("/races/organizers").json()

    assert [k["name"] for k in organizatori] == ["Lodní klub Řež"]
    assert organizatori[0]["id"] == platny.id


# --------------------------------------------------------------------------
# Kalendář - obsah, řazení, filtry
# --------------------------------------------------------------------------
def test_kalendar_je_na_lomitku_a_bez_nej_neexistuje(client, db):
    # Aplikace má redirect_slashes=False, takže /races se nepřesměruje na /races/.
    _zavod(db)

    assert client.get("/races/").status_code == 200
    assert client.get("/races").status_code == 404


def test_kalendar_doplni_nazvy_arealu_i_organizatora(client, db):
    areal = _areal(db, "Přelouč")
    klub = _klub(db, "Lodní klub Řež")
    _zavod(db, race_nr="JMLP2026-01", areal_id=areal.id, organizer_id=klub.id)

    (zavod,) = client.get("/races/").json()

    assert zavod["race_nr"] == "JMLP2026-01"
    assert zavod["areal_name"] == "Přelouč"
    assert zavod["organizer_name"] == "Lodní klub Řež"
    assert zavod["areal_id"] == areal.id
    assert zavod["organizer_id"] == klub.id


def test_zavod_bez_arealu_a_organizatora_ma_nahradni_nazvy(client, db):
    _zavod(db, areal_id=None, organizer_id=None)

    (zavod,) = client.get("/races/").json()

    assert zavod["areal_name"] == "Bez areálu"
    assert zavod["organizer_name"] == "Neznámý organizátor"


def test_kalendar_prevadi_bitove_priznaky_na_booleany(client, db):
    _zavod(db, closed=True, registration=False)

    (zavod,) = client.get("/races/").json()

    # closed a registration jsou v MySQL BIT(1) - bez převodu by to byly bajty.
    assert zavod["closed"] is True
    assert zavod["registration"] is False


def test_kalendar_radi_zavody_od_nejnovejsiho(client, db):
    dnes = date.today()
    _zavod(db, race_nr="STREDNI", datum=dnes)
    _zavod(db, race_nr="NEJSTARSI", datum=dnes - timedelta(days=30))
    _zavod(db, race_nr="NEJNOVEJSI", datum=dnes + timedelta(days=30))

    assert _cisla(client.get("/races/")) == ["NEJNOVEJSI", "STREDNI", "NEJSTARSI"]


def test_nadchazejici_zavody_jdou_vzestupne_a_dnesek_se_pocita(client, db):
    dnes = date.today()
    _zavod(db, race_nr="VCERA", datum=dnes - timedelta(days=1))
    _zavod(db, race_nr="DNES", datum=dnes)
    _zavod(db, race_nr="ZA_TYDEN", datum=dnes + timedelta(days=7))

    assert _cisla(client.get("/races/", params={"upcoming": True})) == ["DNES", "ZA_TYDEN"]


def test_uplynule_zavody_jdou_sestupne_a_dnesek_mezi_ne_nepatri(client, db):
    dnes = date.today()
    _zavod(db, race_nr="DNES", datum=dnes)
    _zavod(db, race_nr="VCERA", datum=dnes - timedelta(days=1))
    _zavod(db, race_nr="LONI", datum=dnes - timedelta(days=365))

    assert _cisla(client.get("/races/", params={"past": True})) == ["VCERA", "LONI"]


def test_pri_obou_filtrech_zaroven_vyhrava_nadchazejici(client, db):
    dnes = date.today()
    _zavod(db, race_nr="VCERA", datum=dnes - timedelta(days=1))
    _zavod(db, race_nr="ZITRA", datum=dnes + timedelta(days=1))

    odpoved = client.get("/races/", params={"upcoming": True, "past": True})

    assert _cisla(odpoved) == ["ZITRA"]


def test_zavod_bez_data_je_v_kalendari_ale_v_zadnem_z_filtru(client, db):
    _zavod(db, race_nr="BEZ_DATA", datum=None)

    assert "BEZ_DATA" in _cisla(client.get("/races/"))
    assert _cisla(client.get("/races/", params={"upcoming": True})) == []
    assert _cisla(client.get("/races/", params={"past": True})) == []


def test_zavod_bez_cisla_se_v_kalendari_neukaze_ale_detail_ma(client, db):
    # race_nr NULL je rozpracovaný závod - do veřejného kalendáře nepatří,
    # přímý odkaz na detail ale funguje.
    rozpracovany = _zavod(db, race_nr=None)

    assert client.get("/races/").json() == []
    assert client.get(f"/races/{rozpracovany.id}").json()["race_nr"] is None


def test_limit_vrati_jen_nejnovejsi_zavody(client, db):
    dnes = date.today()
    for odstup, cislo in ((2, "TRETI"), (1, "DRUHY"), (0, "PRVNI")):
        _zavod(db, race_nr=cislo, datum=dnes - timedelta(days=odstup))

    assert _cisla(client.get("/races/", params={"limit": 2})) == ["PRVNI", "DRUHY"]


def test_limit_nula_zadny_zavod_neskryje(client, db):
    # CHYBA: `if limit:` bere nulu jako "nezadáno", takže limit=0 vrátí všechno.
    _zavod(db, race_nr="A")
    _zavod(db, race_nr="B", datum=date.today() - timedelta(days=1))

    assert len(client.get("/races/", params={"limit": 0}).json()) == 2


def test_zaporny_limit_shodi_dotaz_na_databazi(client, db):
    # CHYBA: limit se do SQL vkládá bez kontroly, `LIMIT -1` je syntaktická
    # chyba MySQL. V provozu z toho je HTTP 500, v testu výjimka.
    _zavod(db)

    with pytest.raises(ProgrammingError):
        client.get("/races/", params={"limit": -1})


def test_limit_neprijme_neciselnou_hodnotu(client, db):
    # Limit se skládá do SQL řetězcem, takže na typové kontrole záleží.
    _zavod(db)

    assert client.get("/races/", params={"limit": "1; DROP TABLE fuj_jmlp_race"}).status_code == 422


def test_filtr_aktualni_sezony_vynecha_starsi_rocniky(client, db):
    sezona = _aktualni_sezona()
    _zavod(db, race_nr="LETOSNI", season_id=sezona)
    _zavod(db, race_nr="LONSKY", season_id=sezona - 1, datum=date.today() - timedelta(days=365))

    assert _cisla(client.get("/races/", params={"current_season": True})) == ["LETOSNI"]
    assert set(_cisla(client.get("/races/"))) == {"LETOSNI", "LONSKY"}


def test_bez_zavodu_v_aktualni_sezone_se_vezme_nejvyssi_dostupna(client, db):
    # Přes léto (nová sezóna ještě nemá závody) by jinak byl kalendář prázdný.
    sezona = _aktualni_sezona()
    _zavod(db, race_nr="PREDLONSKY", season_id=sezona - 2, datum=date.today() - timedelta(days=730))
    _zavod(db, race_nr="LONSKY", season_id=sezona - 1, datum=date.today() - timedelta(days=365))

    assert _cisla(client.get("/races/", params={"current_season": True})) == ["LONSKY"]


# --------------------------------------------------------------------------
# Sezónní logika
# --------------------------------------------------------------------------
def test_aktualni_sezona_odpovida_dneskeu_kdyz_zadne_zavody_nejsou(client, db):
    sezona = _aktualni_sezona()

    data = client.get("/races/season/current").json()

    assert data["current_season_id"] == sezona
    assert data["current_date"] == date.today().isoformat()
    assert data["season_start"] == f"{sezona}-08-01"
    assert data["season_end"] == f"{sezona + 1}-07-31"


def test_aktualni_sezona_se_posune_na_budouci_rocnik_v_datech(client, db):
    # CHYBA: fallback bere MAX(season_id), takže dopředu založené závody
    # posunou "aktuální sezónu" do budoucnosti včetně season_start.
    sezona = _aktualni_sezona()
    _zavod(db, season_id=sezona + 3, datum=date.today() + timedelta(days=1000))

    data = client.get("/races/season/current").json()

    assert data["current_season_id"] == sezona + 3
    assert data["season_start"] == f"{sezona + 3}-08-01"


def test_sezona_se_lame_prvniho_srpna(client):
    prvni_srpen = client.get("/races/season/calculate", params={"race_date": "2026-08-01"}).json()
    posledni_cervenec = client.get("/races/season/calculate", params={"race_date": "2026-07-31"}).json()

    assert prvni_srpen["season_id"] == 2026
    assert posledni_cervenec["season_id"] == 2025
    assert prvni_srpen["season_period"] == "1.8.2026 - 31.7.2027"


def test_lednovy_zavod_patri_do_sezony_zacinajici_loni(client):
    data = client.get("/races/season/calculate", params={"race_date": "2026-01-15"}).json()

    assert data["season_id"] == 2025
    assert data["race_date"] == "2026-01-15"


def test_vypocet_sezony_odmitne_nesmyslne_datum(client):
    odpoved = client.get("/races/season/calculate", params={"race_date": "31.7.2026"})

    assert odpoved.status_code == 400
    assert "31.7.2026" in odpoved.json()["detail"]


def test_vypocet_sezony_odmitne_neexistujici_den(client):
    odpoved = client.get("/races/season/calculate", params={"race_date": "2026-02-30"})

    assert odpoved.status_code == 400


def test_vypocet_sezony_vyzaduje_datum(client):
    assert client.get("/races/season/calculate").status_code == 422


# --------------------------------------------------------------------------
# Detail závodu
# --------------------------------------------------------------------------
def test_detail_zavodu_vraci_vlastni_data_zavodu(client, db):
    areal = _areal(db, "Přelouč")
    klub = _klub(db, "Lodní klub Řež")
    zavod = _zavod(
        db,
        race_nr="JMLP2026-05",
        datum=date(2026, 5, 17),
        areal_id=areal.id,
        organizer_id=klub.id,
        closed=True,
        registration=False,
        race_method_id=2,
    )

    data = client.get(f"/races/{zavod.id}").json()

    assert data["id"] == zavod.id
    assert data["race_nr"] == "JMLP2026-05"
    assert data["datum"] == "2026-05-17"
    assert data["areal_name"] == "Přelouč"
    assert data["organizer_name"] == "Lodní klub Řež"
    assert data["closed"] is True
    assert data["registration"] is False
    assert data["race_method_id"] == 2


def test_detail_zavodu_bez_arealu_ma_nahradni_nazvy(client, db):
    zavod = _zavod(db, areal_id=None, organizer_id=None)

    data = client.get(f"/races/{zavod.id}").json()

    assert data["areal_name"] == "Bez areálu"
    assert data["organizer_name"] == "Neznámý organizátor"


def test_detail_zavodu_s_neexistujicim_arealem_nespadne(client, db):
    # MyISAM nemá cizí klíče, smazaný areál po sobě nechá viset areal_id.
    zavod = _zavod(db, areal_id=98765, organizer_id=98765)

    data = client.get(f"/races/{zavod.id}").json()

    assert data["areal_id"] == 98765
    assert data["areal_name"] == "Bez areálu"
    assert data["organizer_name"] == "Neznámý organizátor"


def test_detail_neexistujiciho_zavodu_je_404(client, db):
    odpoved = client.get("/races/424242")

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Race not found"


def test_detail_zavodu_neprozradi_ze_bezi_live(client, db):
    # CHYBA: is_live se do veřejné odpovědi nikdy nenačítá, schéma ho jen
    # dopočítá výchozí hodnotou False - i pro právě běžící závod.
    zavod = _zavod(db, is_live=True)

    assert client.get(f"/races/{zavod.id}").json()["is_live"] is False
    assert client.get("/races/").json()[0]["is_live"] is False


# --------------------------------------------------------------------------
# Propozice a výsledky (přílohy)
# --------------------------------------------------------------------------
def test_kalendar_hlasi_propozice_i_vysledky_z_priloh(client, db, tmp_path):
    zavod = _zavod(db)
    propozice = _soubor(db, _pdf(tmp_path, "p.pdf", b"%PDF propozice"), "Propozice.pdf")
    vysledky = _soubor(db, _pdf(tmp_path, "v.pdf", b"%PDF vysledky"), "Vysledky.pdf")
    _priloha(db, owner_id=zavod.id, role="propozice", file_id=propozice.id)
    _priloha(db, owner_id=zavod.id, role="vysledky", file_id=vysledky.id)

    (z_kalendare,) = client.get("/races/").json()
    detail = client.get(f"/races/{zavod.id}").json()

    for data in (z_kalendare, detail):
        assert data["proposition_file_id"] == propozice.id
        assert data["results_file_id"] == vysledky.id
        assert data["proposition_file_path"] == propozice.file_path
        assert data["results_file_path"] == vysledky.file_path


def test_nepublikovana_priloha_se_verejne_neukaze(client, db, tmp_path):
    zavod = _zavod(db)
    soubor = _soubor(db, _pdf(tmp_path, "p.pdf", b"%PDF"))
    _priloha(db, owner_id=zavod.id, role="propozice", file_id=soubor.id, published=False)

    (z_kalendare,) = client.get("/races/").json()
    detail = client.get(f"/races/{zavod.id}").json()

    assert z_kalendare["proposition_file_id"] is None
    assert z_kalendare["proposition_file_path"] is None
    assert detail["proposition_file_id"] is None


def test_priloha_jineho_vlastnika_se_do_zavodu_nepropise(client, db, tmp_path):
    # owner_id se opakuje napříč typy vlastníků, rozlišuje je až owner_type.
    zavod = _zavod(db)
    soubor = _soubor(db, _pdf(tmp_path, "p.pdf", b"%PDF"))
    _priloha(db, owner_type="post", owner_id=zavod.id, role="propozice", file_id=soubor.id)

    assert client.get(f"/races/{zavod.id}").json()["proposition_file_id"] is None


def test_dve_propozice_u_jednoho_zavodu_ho_v_kalendari_zdvoji(client, db, tmp_path):
    # CHYBA: join na přílohy počítá s nejvýše jednou propozicí, ale databáze
    # to nehlídá. Druhá publikovaná propozice vyrobí v kalendáři dva řádky.
    zavod = _zavod(db, race_nr="JMLP2026-01")
    prvni = _soubor(db, _pdf(tmp_path, "p1.pdf", b"%PDF 1"))
    druha = _soubor(db, _pdf(tmp_path, "p2.pdf", b"%PDF 2"))
    _priloha(db, owner_id=zavod.id, role="propozice", file_id=prvni.id)
    _priloha(db, owner_id=zavod.id, role="propozice", file_id=druha.id)

    kalendar = client.get("/races/").json()

    assert [z["id"] for z in kalendar] == [zavod.id, zavod.id]


def test_stazeni_propozic_a_vysledku_vrati_spravny_soubor(client, db, tmp_path):
    zavod = _zavod(db)
    propozice = _soubor(db, _pdf(tmp_path, "p.pdf", b"%PDF propozice"), "Propozice závodu.pdf")
    vysledky = _soubor(db, _pdf(tmp_path, "v.pdf", b"%PDF vysledky"), "Výsledky závodu.pdf")
    _priloha(db, owner_id=zavod.id, role="propozice", file_id=propozice.id)
    _priloha(db, owner_id=zavod.id, role="vysledky", file_id=vysledky.id)

    odpoved = client.get(f"/races/{zavod.id}/proposition")

    assert odpoved.status_code == 200
    assert odpoved.content == b"%PDF propozice"
    assert odpoved.headers["content-type"] == "application/pdf"
    # Název souboru jde do hlavičky, aby se nestáhl pod UUID jménem z disku.
    assert "Propozice" in odpoved.headers["content-disposition"]

    assert client.get(f"/races/{zavod.id}/results").content == b"%PDF vysledky"


def test_stazeni_propozic_neexistujiciho_zavodu_je_404(client, db):
    odpoved = client.get("/races/424242/proposition")

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závod nebyl nalezen"


def test_stazeni_chybejicich_propozic_i_vysledku_je_404(client, db):
    zavod = _zavod(db)

    propozice = client.get(f"/races/{zavod.id}/proposition")
    vysledky = client.get(f"/races/{zavod.id}/results")

    assert propozice.status_code == 404
    assert propozice.json()["detail"] == "Propozice nebyly nalezeny"
    assert vysledky.status_code == 404
    assert vysledky.json()["detail"] == "Výsledky nebyly nalezeny"


def test_nepublikovane_propozice_nejdou_stahnout(client, db, tmp_path):
    zavod = _zavod(db)
    soubor = _soubor(db, _pdf(tmp_path, "p.pdf", b"%PDF"))
    _priloha(db, owner_id=zavod.id, role="propozice", file_id=soubor.id, published=False)

    odpoved = client.get(f"/races/{zavod.id}/proposition")

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Propozice nebyly nalezeny"


def test_priloha_bez_souboru_na_disku_je_404_a_ne_500(client, db, tmp_path):
    zavod = _zavod(db)
    cesta = _pdf(tmp_path, "p.pdf", b"%PDF")
    soubor = _soubor(db, cesta)
    _priloha(db, owner_id=zavod.id, role="propozice", file_id=soubor.id)
    cesta.unlink()

    odpoved = client.get(f"/races/{zavod.id}/proposition")

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Soubor nebyl na disku nalezen"


# --------------------------------------------------------------------------
# Live přenos - jen veřejný ukazatel "běží / neběží"
# --------------------------------------------------------------------------
def test_live_status_bez_bezicho_zavodu_je_404(client, db):
    _zavod(db, is_live=False)

    assert client.get("/races/live/status").status_code == 404
    assert client.get("/races/live").status_code == 404


def test_live_status_vrati_bezici_zavod_a_zakaze_kesovani(client, db):
    areal = _areal(db, "Přelouč")
    _zavod(db, race_nr="JMLP2026-01", is_live=False)
    bezici = _zavod(db, race_nr="JMLP2026-02", areal_id=areal.id, is_live=True)

    odpoved = client.get("/races/live/status")

    assert odpoved.status_code == 200
    assert odpoved.json() == {
        "race_id": bezici.id,
        "race_nr": "JMLP2026-02",
        "areal_name": "Přelouč",
    }
    assert odpoved.headers["cache-control"] == "no-store"


# --------------------------------------------------------------------------
# Názvy kategorií na webu - oficiální název z adminu, nikde skládaný podruhé
# --------------------------------------------------------------------------
def _kategorie(db, name, min_year, max_year, sex, display_name=None) -> models.Category:
    kategorie = models.Category(
        name=name,
        display_name=display_name,
        min_birth_year=min_year,
        max_birth_year=max_year,
        sex=sex,
        active=True,
    )
    db.add(kategorie)
    db.commit()
    db.refresh(kategorie)
    return kategorie


def _zavodnik(db, name, surname, year, sex, club_id=None) -> models.Racer:
    zavodnik = models.Racer(name=name, surname=surname, year=year, sex=sex, club_id=club_id)
    db.add(zavodnik)
    db.commit()
    db.refresh(zavodnik)
    return zavodnik


def test_seznam_prihlasenych_nepridava_pohlavi_k_nazvu_kategorie(client, db):
    """Název z adminu už pohlaví obsahuje - jinak vznikne "Myšáci dívky - Ženy"."""
    kategorie = _kategorie(db, "U10", 2016, 2018, 2, display_name="Myšáci dívky")
    klub = _klub(db, "SK Pardubice")
    zavod = _zavod(db)
    zavodnice = _zavodnik(db, "Anna", "Holcicka", 2017, 2, club_id=klub.id)
    db.add(models.Registration(
        race_id=zavod.id, racer_id=zavodnice.id, category_id=kategorie.id))
    db.commit()

    odpoved = client.get(f"/races/{zavod.id}/registrations")

    assert odpoved.status_code == 200, odpoved.text
    zavodnici = odpoved.json()["clubs"][0]["racers"]
    assert zavodnici[0]["category_name"] == "Myšáci dívky"
    assert odpoved.json()["categories"] == [{"id": kategorie.id, "name": "Myšáci dívky"}]


def test_live_prenos_ukazuje_prejmenovanou_kategorii(client, db):
    """Startovka drží název z doby rozlosování; na webu musí být ten současný."""
    kategorie = _kategorie(db, "U10", 2016, 2018, 2, display_name="U10 dívky")
    zavod = _zavod(db, is_live=True)
    zavodnice = _zavodnik(db, "Anna", "Holcicka", 2017, 2)
    db.add(models.StartListEntry(
        race_id=zavod.id,
        racer_id=zavodnice.id,
        category_id=kategorie.id,
        start_number=1,
        racer_name="Anna",
        racer_surname="Holcicka",
        racer_year=2017,
        racer_sex=2,
        category_name="U10 - Ženy",
    ))
    db.commit()

    kategorie.display_name = "Myšáci dívky"
    db.commit()

    odpoved = client.get("/races/live")

    assert odpoved.status_code == 200, odpoved.text
    assert [k["category_name"] for k in odpoved.json()["categories"]] == ["Myšáci dívky"]
