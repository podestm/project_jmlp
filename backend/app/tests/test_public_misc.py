"""Veřejné endpointy mimo závody.

Pokrývá app/routers/racers.py, clubs.py, posts.py, documents.py
a season_results.py - tedy všechno, co si nepřihlášený návštěvník smí přečíst.
"""
from datetime import datetime, timedelta

from pathlib import Path

import pytest
from sqlalchemy import text

from app import models
from app.utils import get_current_season_id

# Sezóna se počítá z dnešního data (1.8. - 31.7.), takže testovací data se
# zakládají relativně k ní - jinak by testy od srpna přestaly platit.
AKTUALNI_SEZONA = get_current_season_id()


# --------------------------------------------------------------------------
# Pomocníci pro zakládání testovacích dat
# --------------------------------------------------------------------------

def _klub(db, name, valid=True):
    klub = models.Club(name=name, valid=valid)
    db.add(klub)
    db.commit()
    db.refresh(klub)
    return klub


def _zavodnik(db, name, surname, year=2000, sex=1, club_id=None,
              telefon=None, email=None, slcr_id=None):
    zavodnik = models.Racer(
        name=name, surname=surname, year=year, sex=sex, club_id=club_id,
        telefon=telefon, email=email, slcr_id=slcr_id,
    )
    db.add(zavodnik)
    db.commit()
    db.refresh(zavodnik)
    return zavodnik


# Soubory založené testem - uklízí se jen tyhle, nikdy podle vzoru.
_ZALOZENE_SOUBORY = []


@pytest.fixture(autouse=True)
def _uklid_souboru():
    yield
    while _ZALOZENE_SOUBORY:
        _ZALOZENE_SOUBORY.pop().unlink(missing_ok=True)


def _soubor(db, original_filename, filename=None, file_path=None, file_size=2048, na_disku=True):
    filename = filename or original_filename
    cesta = Path(file_path or f"uploads/documents/{filename}")
    # Soubor musí na disku opravdu být: přílohy, jejichž soubor chybí, se
    # z veřejných odpovědí schválně vynechávají. Když si ho ale volající
    # připravil sám (vlastní obsah, vlastní cesta), nepřepisujeme ho.
    if na_disku and not cesta.exists():
        cesta.parent.mkdir(parents=True, exist_ok=True)
        cesta.write_bytes(b"%PDF-1.4 test")
        _ZALOZENE_SOUBORY.append(cesta)

    soubor = models.File(
        filename=filename,
        original_filename=original_filename,
        file_path=str(cesta),
        file_size=file_size,
        mime_type="application/pdf",
    )
    db.add(soubor)
    db.commit()
    db.refresh(soubor)
    return soubor


def _priloha(db, file_id, owner_type, owner_id, role, published=True, sort_order=0):
    priloha = models.Attachment(
        file_id=file_id,
        owner_type=owner_type,
        owner_id=owner_id,
        role=role,
        published=published,
        sort_order=sort_order,
    )
    db.add(priloha)
    db.commit()
    db.refresh(priloha)
    return priloha


def _sezona(db, year_start, edition=None, name=None):
    sezona = models.Season(
        year_start=year_start,
        year_end=year_start + 1,
        edition=edition,
        name=name or f"Ročník {year_start}/{year_start + 1}",
    )
    db.add(sezona)
    db.commit()
    db.refresh(sezona)
    return sezona


def _aktualita(db, title, content="Obsah aktuality", published=True, created_at=None):
    created_at = created_at or datetime(2026, 1, 1, 12, 0, 0)
    post = models.Post(
        title=title,
        content=content,
        published=published,
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def _sezona_s_dokumentem(db, year_start, role, published=True, original_filename=None, **kwargs):
    """Sezóna + jedna příloha dané role. Vrací (sezóna, soubor)."""
    sezona = _sezona(db, year_start, **kwargs)
    soubor = _soubor(db, original_filename or f"{role}-{year_start}.pdf")
    _priloha(db, soubor.id, "season", year_start, role, published=published)
    return sezona, soubor


# ==========================================================================
# /racers/search
# ==========================================================================

def test_vyhledani_zavodnika_podle_prijmeni_vrati_jen_shodu(client, db):
    _zavodnik(db, "Jan", "Novak")
    _zavodnik(db, "Petr", "Svoboda")

    data = client.get("/racers/search", params={"surname": "Nov"}).json()

    assert [(z["name"], z["surname"]) for z in data] == [("Jan", "Novak")]


def test_vyhledavani_zavodniku_nevraci_kontaktni_udaje(client, db):
    _zavodnik(db, "Jan", "Novak", telefon="777123456", email="jan@example.com")

    data = client.get("/racers/search", params={"surname": "Novak"}).json()

    assert len(data) == 1
    assert "telefon" not in data[0]
    assert "email" not in data[0]
    # Kontrola, že údaje v databázi opravdu jsou - jinak by test neověřil nic.
    assert db.execute(text("SELECT telefon FROM fuj_jmlp_racer")).scalar() == "777123456"


def test_vyhledavani_zavodniku_doplni_nazev_klubu(client, db):
    klub = _klub(db, "Motolodi Pardubice")
    _zavodnik(db, "Jan", "Novak", club_id=klub.id)
    _zavodnik(db, "Petr", "Bezklubovy")

    data = client.get("/racers/search").json()
    podle_prijmeni = {z["surname"]: z for z in data}

    assert podle_prijmeni["Novak"]["club_name"] == "Motolodi Pardubice"
    assert podle_prijmeni["Novak"]["club_id"] == klub.id
    assert podle_prijmeni["Bezklubovy"]["club_name"] is None


def test_vyhledani_podle_klubu_projde_i_pres_padesatou_shodu(client, db):
    """Filtr klubu musí být v SQL, ne až nad prvními padesáti řádky.

    Závodníci hledaného klubu jsou abecedně až za padesátkou cizích - kdyby se
    filtr aplikoval po LIMIT 50, vrátil by se prázdný seznam.
    """
    cizi = _klub(db, "Cizi klub")
    hledany = _klub(db, "Hledany klub")
    for i in range(55):
        _zavodnik(db, "Anonym", f"Aprijmeni{i:03d}", year=1980 + i % 30, club_id=cizi.id)
    _zavodnik(db, "Jan", "Zzzzz", club_id=hledany.id)

    data = client.get("/racers/search", params={"club": "Hledany"}).json()

    assert [z["surname"] for z in data] == ["Zzzzz"]


def test_vyhledavani_zavodniku_vraci_nejvys_padesat_serazenych(client, db):
    for i in range(55):
        _zavodnik(db, "Anonym", f"Prijmeni{i:03d}", year=1980 + i % 30)

    data = client.get("/racers/search").json()

    assert len(data) == 50
    prijmeni = [z["surname"] for z in data]
    assert prijmeni == sorted(prijmeni)
    # Ořez padesáti se dělá až po seřazení, takže chybí konec abecedy.
    assert prijmeni[0] == "Prijmeni000"
    assert prijmeni[-1] == "Prijmeni049"


def test_vyhledavani_orezava_historicke_mezery_ve_jmenech(client, db):
    _zavodnik(db, "  Jan", " Novak ")

    data = client.get("/racers/search", params={"name": "Jan"}).json()

    assert (data[0]["name"], data[0]["surname"]) == ("Jan", "Novak")


def test_vyhledani_podle_roku_narozeni_je_presne(client, db):
    _zavodnik(db, "Jan", "Novak", year=1990)
    _zavodnik(db, "Petr", "Svoboda", year=1991)

    data = client.get("/racers/search", params={"year": 1990}).json()

    assert [z["surname"] for z in data] == ["Novak"]


def test_vyhledani_podle_slcr_id(client, db):
    _zavodnik(db, "Jan", "Novak", slcr_id="ABC123")
    _zavodnik(db, "Petr", "Svoboda", slcr_id="XYZ999")

    data = client.get("/racers/search", params={"slcr_id": "ABC"}).json()

    assert [z["slcr_id"] for z in data] == ["ABC123"]


def test_kombinace_filtru_zavodniku_musi_platit_zaroven(client, db):
    _zavodnik(db, "Jan", "Novak", year=1990)
    _zavodnik(db, "Jan", "Svoboda", year=1990)
    _zavodnik(db, "Petr", "Novak", year=1990)
    _zavodnik(db, "Jan", "Novak", year=1991)

    data = client.get("/racers/search", params={"name": "Jan", "surname": "Novak", "year": 1990}).json()

    assert len(data) == 1
    assert (data[0]["name"], data[0]["surname"], data[0]["year"]) == ("Jan", "Novak", 1990)


def test_vyhledavani_zavodniku_bez_shody_vraci_prazdny_seznam(client, db):
    _zavodnik(db, "Jan", "Novak")

    assert client.get("/racers/search", params={"surname": "Neexistuje"}).json() == []


def test_prazdny_filtr_zavodniku_se_ignoruje(client, db):
    _zavodnik(db, "Jan", "Novak")

    # Frontend posílá prázdná políčka formuláře - nesmí to seznam vyprázdnit.
    data = client.get("/racers/search", params={"surname": "   ", "club": ""}).json()

    assert [z["surname"] for z in data] == ["Novak"]


# ==========================================================================
# /racers/
# ==========================================================================

def test_verejny_seznam_zavodniku_neobsahuje_kontakty(client, db):
    _zavodnik(db, "Jan", "Novak", telefon="777123456", email="jan@example.com")

    data = client.get("/racers/").json()

    assert len(data) == 1
    assert data[0]["surname"] == "Novak"
    assert "telefon" not in data[0]
    assert "email" not in data[0]


def test_verejny_seznam_zavodniku_hleda_ve_jmenu_i_prijmeni(client, db):
    _zavodnik(db, "Jan", "Novak")
    _zavodnik(db, "Bohumil", "Janousek")
    _zavodnik(db, "Petr", "Svoboda")

    data = client.get("/racers/", params={"q": "jan"}).json()

    assert sorted(z["surname"] for z in data) == ["Janousek", "Novak"]


def test_verejny_seznam_zavodniku_je_serazeny_podle_prijmeni(client, db):
    _zavodnik(db, "Jan", "Cerny")
    _zavodnik(db, "Petr", "Adamek")
    _zavodnik(db, "Ivo", "Bily")

    data = client.get("/racers/").json()

    assert [z["surname"] for z in data] == ["Adamek", "Bily", "Cerny"]


def test_verejny_seznam_zavodniku_klub_nedoplnuje(client, db):
    """CHYBA: RacerPublic slibuje club_name, ale /racers/ ho nikdy nevyplní.

    Endpoint nedělá JOIN na klub, takže club_name zůstává None i pro závodníka,
    který klub má. Doplněný název umí jen /racers/search.
    """
    klub = _klub(db, "Motolodi Pardubice")
    _zavodnik(db, "Jan", "Novak", club_id=klub.id)

    data = client.get("/racers/").json()

    assert data[0]["club_id"] == klub.id
    assert data[0]["club_name"] is None


# ==========================================================================
# /clubs/
# ==========================================================================

def test_seznam_klubu_vraci_jen_platne(client, db):
    _klub(db, "Platny klub", valid=True)
    _klub(db, "Zruseny klub", valid=False)

    data = client.get("/clubs/").json()

    assert [k["name"] for k in data] == ["Platny klub"]
    assert data[0]["valid"] is True


def test_seznam_klubu_je_serazeny_podle_nazvu(client, db):
    _klub(db, "Ceska Trebova")
    _klub(db, "Adamov")
    _klub(db, "Brno")

    data = client.get("/clubs/").json()

    assert [k["name"] for k in data] == ["Adamov", "Brno", "Ceska Trebova"]


def test_seznam_klubu_bez_dat_je_prazdne_pole(client):
    assert client.get("/clubs/").json() == []


# ==========================================================================
# /posts/
# ==========================================================================

def test_seznam_aktualit_vraci_jen_publikovane(client, db):
    _aktualita(db, "Verejna zprava", published=True)
    _aktualita(db, "Rozepsany koncept", published=False)

    data = client.get("/posts/").json()

    assert [p["title"] for p in data] == ["Verejna zprava"]


def test_seznam_aktualit_je_serazeny_od_nejnovejsi(client, db):
    zaklad = datetime(2026, 3, 1, 8, 0, 0)
    _aktualita(db, "Nejstarsi", created_at=zaklad)
    _aktualita(db, "Nejnovejsi", created_at=zaklad + timedelta(days=2))
    _aktualita(db, "Prostredni", created_at=zaklad + timedelta(days=1))

    data = client.get("/posts/").json()

    assert [p["title"] for p in data] == ["Nejnovejsi", "Prostredni", "Nejstarsi"]


def test_seznam_aktualit_ma_vychozi_strop_deset(client, db):
    zaklad = datetime(2026, 3, 1, 8, 0, 0)
    for i in range(12):
        _aktualita(db, f"Zprava {i:02d}", created_at=zaklad + timedelta(hours=i))

    data = client.get("/posts/").json()

    assert len(data) == 10
    assert data[0]["title"] == "Zprava 11"
    assert data[-1]["title"] == "Zprava 02"


def test_strankovani_aktualit_preskoci_a_omezi(client, db):
    zaklad = datetime(2026, 3, 1, 8, 0, 0)
    for i in range(5):
        _aktualita(db, f"Zprava {i}", created_at=zaklad + timedelta(hours=i))

    data = client.get("/posts/", params={"skip": 1, "limit": 2}).json()

    assert [p["title"] for p in data] == ["Zprava 3", "Zprava 2"]


def test_zaporne_strankovani_aktualit_skonci_chybou_serveru(db):
    """CHYBA: skip a limit se nekontrolují a záporná hodnota shodí dotaz.

    Vznikne 'LIMIT -1', což MySQL odmítne, a návštěvník dostane 500 místo 422.
    Klient z conftestu výjimku přepošle do testu, proto vlastní TestClient -
    ten odpoví stejně jako ostrý provoz.
    """
    from fastapi.testclient import TestClient

    from app.main import app

    _aktualita(db, "Zprava")

    with TestClient(app, raise_server_exceptions=False) as vlastni_client:
        assert vlastni_client.get("/posts/", params={"limit": -1}).status_code == 500
        assert vlastni_client.get("/posts/", params={"skip": -5}).status_code == 500


def test_seznam_aktualit_opravi_dvojite_kodovani(client, db):
    # Legacy data z původního webu: UTF-8 bajty přečtené jako Latin-1.
    _aktualita(db, "ZprÃ¡va o zÃ¡vodu", content="PrÅ¯bÄh")

    data = client.get("/posts/").json()

    assert data[0]["title"] == "Zpráva o závodu"


def test_aktualita_bez_priloh_ma_prazdne_odkazy_na_soubory(client, db):
    post = _aktualita(db, "Bez priloh")

    data = client.get(f"/posts/{post.id}").json()

    assert data["image_file_id"] is None
    assert data["document_file_id"] is None


def test_aktualita_vraci_odkazy_na_obrazek_i_dokument(client, db):
    post = _aktualita(db, "S prilohami")
    obrazek = _soubor(db, "foto.jpg")
    dokument = _soubor(db, "propozice.pdf")
    _priloha(db, obrazek.id, "post", post.id, "image")
    _priloha(db, dokument.id, "post", post.id, "document")

    data = client.get(f"/posts/{post.id}").json()

    assert data["image_file_id"] == obrazek.id
    assert data["document_file_id"] == dokument.id


def test_prilohy_se_neprelivaji_mezi_aktualitami(client, db):
    prvni = _aktualita(db, "Prvni", created_at=datetime(2026, 3, 2))
    druha = _aktualita(db, "Druha", created_at=datetime(2026, 3, 1))
    soubor = _soubor(db, "jen-k-prvni.pdf")
    _priloha(db, soubor.id, "post", prvni.id, "document")

    data = {p["title"]: p for p in client.get("/posts/").json()}

    assert data["Prvni"]["document_file_id"] == soubor.id
    assert data["Druha"]["document_file_id"] is None


def test_detail_nepublikovane_aktuality_vraci_404(client, db):
    post = _aktualita(db, "Koncept", published=False)

    response = client.get(f"/posts/{post.id}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Příspěvek nenalezen"


def test_detail_neexistujici_aktuality_vraci_404(client):
    assert client.get("/posts/999999").status_code == 404


def test_seznam_aktualit_nezverejni_koncepty_ani_na_pozadani(client, db):
    """Dřív šlo koncepty přečíst přes /posts/?published_only=false."""
    _aktualita(db, "Zverejnena zprava")
    _aktualita(db, "Rozepsany koncept", published=False)

    data = client.get("/posts/", params={"published_only": "false"}).json()

    assert [p["title"] for p in data] == ["Zverejnena zprava"]


# --------------------------------------------------------------------------
# Stahování příloh aktualit
# --------------------------------------------------------------------------

def test_stazeni_dokumentu_aktuality_vrati_obsah_souboru(client, db, tmp_path):
    post = _aktualita(db, "S dokumentem")
    na_disku = tmp_path / "ulozeny.pdf"
    na_disku.write_bytes(b"%PDF-1.4 obsah")
    soubor = _soubor(db, "propozice.pdf", file_path=str(na_disku))
    _priloha(db, soubor.id, "post", post.id, "document")

    response = client.get(f"/posts/{post.id}/document/download")

    assert response.status_code == 200
    assert response.content == b"%PDF-1.4 obsah"
    assert "propozice.pdf" in response.headers["content-disposition"]


def test_stazeni_dokumentu_neexistujici_aktuality_vraci_404(client):
    response = client.get("/posts/999999/document/download")

    assert response.status_code == 404
    assert response.json()["detail"] == "Příspěvek nenalezen"


def test_stazeni_dokumentu_aktuality_bez_prilohy_vraci_404(client, db):
    post = _aktualita(db, "Bez dokumentu")

    response = client.get(f"/posts/{post.id}/document/download")

    assert response.status_code == 404
    assert "dokument" in response.json()["detail"]


def test_stazeni_dokumentu_chybejiciho_na_disku_vraci_404(client, db, tmp_path):
    post = _aktualita(db, "Ztraceny soubor")
    soubor = _soubor(db, "chybi.pdf", file_path=str(tmp_path / "neexistuje.pdf"), na_disku=False)
    _priloha(db, soubor.id, "post", post.id, "document")

    response = client.get(f"/posts/{post.id}/document/download")

    assert response.status_code == 404
    assert response.json()["detail"] == "Soubor nenalezen na disku"


def test_dokument_aktuality_se_neplete_s_obrazkem(client, db, tmp_path):
    post = _aktualita(db, "Jen obrazek")
    na_disku = tmp_path / "foto.jpg"
    na_disku.write_bytes(b"JPEGDATA")
    obrazek = _soubor(db, "foto.jpg", file_path=str(na_disku))
    _priloha(db, obrazek.id, "post", post.id, "image")

    assert client.get(f"/posts/{post.id}/document/download").status_code == 404
    assert client.get(f"/posts/{post.id}/image").content == b"JPEGDATA"


def test_obrazek_aktuality_ma_etag_navazany_na_zmenu(client, db, tmp_path):
    post = _aktualita(db, "S obrazkem")
    na_disku = tmp_path / "foto.jpg"
    na_disku.write_bytes(b"JPEGDATA")
    obrazek = _soubor(db, "foto.jpg", file_path=str(na_disku))
    _priloha(db, obrazek.id, "post", post.id, "image")

    response = client.get(f"/posts/{post.id}/image")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=3600"
    assert str(obrazek.id) in response.headers["etag"]
    assert str(post.updated_at.timestamp()) in response.headers["etag"]


def test_obrazek_aktuality_bez_prilohy_vraci_404(client, db):
    post = _aktualita(db, "Bez obrazku")

    response = client.get(f"/posts/{post.id}/image")

    assert response.status_code == 404
    assert "obrázek" in response.json()["detail"]


def test_prilohy_nepublikovane_aktuality_nejdou_stahnout(client, db, tmp_path):
    """Dřív si kdo uhodl ID konceptu, stáhl jeho dokument i obrázek."""
    post = _aktualita(db, "Koncept s prilohou", published=False)
    dokument = tmp_path / "tajne.pdf"
    dokument.write_bytes(b"TAJNY OBSAH")
    obrazek = tmp_path / "tajne.jpg"
    obrazek.write_bytes(b"TAJNY OBRAZEK")
    _priloha(db, _soubor(db, "tajne.pdf", file_path=str(dokument)).id, "post", post.id, "document")
    _priloha(db, _soubor(db, "tajne.jpg", file_path=str(obrazek)).id, "post", post.id, "image")

    for url in (f"/posts/{post.id}/document/download", f"/posts/{post.id}/image"):
        response = client.get(url)
        assert response.status_code == 404
        assert response.json()["detail"] == "Příspěvek nenalezen"


def test_nezverejnena_priloha_aktuality_se_nevraci(client, db, tmp_path):
    """Skrytá příloha publikovaného příspěvku se nesmí objevit ve výpisu ani jít stáhnout."""
    post = _aktualita(db, "Publikovana zprava")
    na_disku = tmp_path / "skryty.pdf"
    na_disku.write_bytes(b"NEZVEREJNENO")
    soubor = _soubor(db, "skryty.pdf", file_path=str(na_disku))
    _priloha(db, soubor.id, "post", post.id, "document", published=False)

    assert client.get(f"/posts/{post.id}").json()["document_file_id"] is None
    assert client.get("/posts/").json()[0]["document_file_id"] is None
    assert client.get(f"/posts/{post.id}/document/download").status_code == 404


# ==========================================================================
# /documents
# ==========================================================================

def test_dokumenty_deli_aktualni_sezonu_a_archiv(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "document", original_filename="Soutezni rad.pdf")
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA - 1, "document")
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA - 2, "document")

    data = client.get("/documents").json()

    assert data["current"]["season_year_start"] == AKTUALNI_SEZONA
    assert data["current"]["is_current"] is True
    assert [g["season_year_start"] for g in data["archive"]] == [
        AKTUALNI_SEZONA - 1, AKTUALNI_SEZONA - 2,
    ]
    assert all(g["is_current"] is False for g in data["archive"])


def test_dokumenty_sezony_nesou_nazev_a_odkaz_ke_stazeni(client, db):
    _sezona(db, AKTUALNI_SEZONA, edition=19, name="XIX. ročník JMLP")
    soubor = _soubor(db, "Soutezni rad.pdf", filename="sezona-rad.pdf", file_size=4096)
    priloha = _priloha(db, soubor.id, "season", AKTUALNI_SEZONA, "document")

    aktualni = client.get("/documents").json()["current"]

    assert aktualni["season_label"] == f"{AKTUALNI_SEZONA}/{AKTUALNI_SEZONA + 1}"
    assert aktualni["edition_label"] == "XIX."
    assert aktualni["name"] == "XIX. ročník JMLP"
    # Položka se identifikuje přílohou, ne souborem - jeden soubor může viset
    # u víc vlastníků a odkaz musí vést na konkrétní zařazení.
    assert aktualni["documents"] == [{
        "id": priloha.id,
        "title": "Soutezni rad.pdf",
        "original_filename": "Soutezni rad.pdf",
        "file_size": 4096,
        "url": "/uploads/documents/sezona-rad.pdf",
    }]


def test_dokumenty_bez_rocniku_nemaji_rimskou_cislici(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "document", edition=None)

    assert client.get("/documents").json()["current"]["edition_label"] is None


def test_nezverejnene_dokumenty_sezony_se_nevraci(client, db):
    _sezona(db, AKTUALNI_SEZONA)
    verejny = _soubor(db, "verejny.pdf")
    skryty = _soubor(db, "skryty.pdf")
    _priloha(db, verejny.id, "season", AKTUALNI_SEZONA, "document", published=True, sort_order=0)
    _priloha(db, skryty.id, "season", AKTUALNI_SEZONA, "document", published=False, sort_order=1)

    dokumenty = client.get("/documents").json()["current"]["documents"]

    assert [d["original_filename"] for d in dokumenty] == ["verejny.pdf"]


def test_sezona_jen_s_nezverejnenym_dokumentem_zmizi_uplne(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "document", published=False)
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA - 1, "document", published=True)

    data = client.get("/documents").json()

    assert data["current"] is None
    assert [g["season_year_start"] for g in data["archive"]] == [AKTUALNI_SEZONA - 1]


def test_sezona_bez_dokumentu_se_nevypisuje(client, db):
    _sezona(db, AKTUALNI_SEZONA)
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA - 1, "document")

    data = client.get("/documents").json()

    assert data["current"] is None
    assert [g["season_year_start"] for g in data["archive"]] == [AKTUALNI_SEZONA - 1]


def test_vysledkove_listiny_se_mezi_dokumenty_nepletou(client, db):
    """Do /documents patří jen obecné dokumenty sezóny, ne výsledky."""
    _sezona(db, AKTUALNI_SEZONA)
    rad = _soubor(db, "rad.pdf")
    vysledky = _soubor(db, "vysledky.pdf")
    prubezne = _soubor(db, "prubezne.pdf")
    _priloha(db, rad.id, "season", AKTUALNI_SEZONA, "document")
    _priloha(db, vysledky.id, "season", AKTUALNI_SEZONA, "vysledky")
    _priloha(db, prubezne.id, "season", AKTUALNI_SEZONA, "prubezne")

    dokumenty = client.get("/documents").json()["current"]["documents"]

    assert [d["original_filename"] for d in dokumenty] == ["rad.pdf"]


def test_dokumenty_jine_sezony_se_neprimichaji(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "document", original_filename="letos.pdf")
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA - 1, "document", original_filename="loni.pdf")

    data = client.get("/documents").json()

    assert [d["original_filename"] for d in data["current"]["documents"]] == ["letos.pdf"]
    assert [d["original_filename"] for d in data["archive"][0]["documents"]] == ["loni.pdf"]


def test_dokumenty_sezony_drzi_zvolene_poradi(client, db):
    _sezona(db, AKTUALNI_SEZONA)
    druhy = _soubor(db, "druhy.pdf")
    prvni = _soubor(db, "prvni.pdf")
    _priloha(db, druhy.id, "season", AKTUALNI_SEZONA, "document", sort_order=1)
    _priloha(db, prvni.id, "season", AKTUALNI_SEZONA, "document", sort_order=0)

    dokumenty = client.get("/documents").json()["current"]["documents"]

    assert [d["original_filename"] for d in dokumenty] == ["prvni.pdf", "druhy.pdf"]


def test_dokumenty_bez_sezon_vraci_prazdny_archiv(client):
    assert client.get("/documents").json() == {"current": None, "archive": []}


def test_dokumenty_prilohy_jinych_vlastniku_se_nepocitaji(client, db):
    """owner_id sezóny je rok, u závodu ID - nesmí se potkat."""
    _sezona(db, AKTUALNI_SEZONA)
    soubor = _soubor(db, "propozice-zavodu.pdf")
    _priloha(db, soubor.id, "race", AKTUALNI_SEZONA, "document")

    assert client.get("/documents").json() == {"current": None, "archive": []}


# ==========================================================================
# /season-results
# ==========================================================================

def test_seznam_vysledku_vraci_jen_sezony_s_dokumentem(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "vysledky")
    _sezona(db, AKTUALNI_SEZONA - 1)

    data = client.get("/season-results/").json()

    assert [s["season_year_start"] for s in data] == [AKTUALNI_SEZONA]


def test_seznam_vysledku_je_serazeny_od_nejnovejsi(client, db):
    for rok in (AKTUALNI_SEZONA - 2, AKTUALNI_SEZONA, AKTUALNI_SEZONA - 1):
        _sezona_s_dokumentem(db, rok, "vysledky")

    data = client.get("/season-results/").json()

    assert [s["season_year_start"] for s in data] == [
        AKTUALNI_SEZONA, AKTUALNI_SEZONA - 1, AKTUALNI_SEZONA - 2,
    ]


def test_celkove_vysledky_maji_priznak_final(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "vysledky")

    assert client.get("/season-results/current").json()["final_results"] == 1


def test_prubezne_poradi_neni_oznaceno_jako_celkove(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "prubezne")

    assert client.get("/season-results/current").json()["final_results"] == 0


def test_vysledky_aktualni_sezony_popisuji_soubor(client, db):
    _sezona(db, AKTUALNI_SEZONA, edition=19, name="XIX. ročník JMLP")
    soubor = _soubor(db, "Celkove vysledky.pdf", filename="sezona-vysledky.pdf")
    _priloha(db, soubor.id, "season", AKTUALNI_SEZONA, "vysledky")

    data = client.get("/season-results/current").json()

    assert data["document_id"] == soubor.id
    assert data["document_filename"] == "sezona-vysledky.pdf"
    assert data["document_original_filename"] == "Celkove vysledky.pdf"
    assert data["document_file_path"] == "uploads/documents/sezona-vysledky.pdf"
    assert data["edition"] == 19
    assert data["edition_label"] == "XIX."
    assert data["season_year_end"] == AKTUALNI_SEZONA + 1


def test_aktualni_sezona_bez_dokumentu_vraci_404(client, db):
    _sezona(db, AKTUALNI_SEZONA)

    response = client.get("/season-results/current")

    assert response.status_code == 404
    assert f"{AKTUALNI_SEZONA}/{AKTUALNI_SEZONA + 1}" in response.json()["detail"]


def test_neexistujici_aktualni_sezona_vraci_404(client):
    assert client.get("/season-results/current").status_code == 404


def test_nezverejnene_vysledky_sezony_se_nevraci(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "vysledky", published=False)

    assert client.get("/season-results/current").status_code == 404
    assert client.get("/season-results/").json() == []


def test_vysledky_konkretni_sezony_podle_let(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "vysledky", original_filename="letos.pdf")
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA - 1, "vysledky", original_filename="loni.pdf")

    data = client.get(f"/season-results/{AKTUALNI_SEZONA - 1}/{AKTUALNI_SEZONA}").json()

    assert data["season_year_start"] == AKTUALNI_SEZONA - 1
    assert data["document_original_filename"] == "loni.pdf"


def test_vysledky_neexistujici_sezony_vraci_404(client, db):
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "vysledky")

    response = client.get("/season-results/1999/2000")

    assert response.status_code == 404
    assert "1999/2000" in response.json()["detail"]


def test_koncovy_rok_v_ceste_se_neoveruje(client, db):
    """CHYBA: /season-results/{od}/{do} hledá sezónu jen podle prvního roku.

    Nesmyslná dvojice let vrátí data sezóny, která k ní nepatří.
    """
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "vysledky", original_filename="letos.pdf")

    data = client.get(f"/season-results/{AKTUALNI_SEZONA}/1234").json()

    assert data["season_year_start"] == AKTUALNI_SEZONA
    assert data["season_year_end"] == AKTUALNI_SEZONA + 1


def test_obecny_dokument_sezony_se_nevydava_za_vysledky(client, db):
    """Sezóna, která má jen soutěžní řád (role 'document'), výsledky nemá.

    Dřív se tvářila, že má průběžné pořadí, a kalendář pod tlačítkem
    "Průběžné výsledky" nabízel ke stažení soutěžní řád - na ostrém webu
    sezóna 2026/27 a několik starších.
    """
    _sezona_s_dokumentem(db, AKTUALNI_SEZONA, "document", original_filename="Soutezni rad.pdf")

    assert client.get("/season-results/current").status_code == 404
    assert client.get("/season-results/").json() == []


@pytest.mark.parametrize("role, rad_je_prvni", [
    ("vysledky", False),  # soutěžní řád přidaný až po výsledcích
    ("prubezne", True),   # řád nahraný na začátku sezóny, pořadí přibylo později
])
def test_obecny_dokument_vysledky_nezastini(client, db, role, rad_je_prvni):
    """Na pořadí příloh nezáleží - soutěžní řád výsledky nezastíní, ani když je první."""
    _sezona(db, AKTUALNI_SEZONA)
    rad = _soubor(db, "rad.pdf")
    vysledky = _soubor(db, f"{role}.pdf")
    _priloha(db, rad.id, "season", AKTUALNI_SEZONA, "document", sort_order=0 if rad_je_prvni else 1)
    _priloha(db, vysledky.id, "season", AKTUALNI_SEZONA, role, sort_order=1 if rad_je_prvni else 0)

    data = client.get("/season-results/current").json()

    assert data["document_id"] == vysledky.id
    assert data["final_results"] == (1 if role == "vysledky" else 0)
