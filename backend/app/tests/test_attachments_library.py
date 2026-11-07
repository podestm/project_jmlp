"""Přílohy a knihovna dokumentů přes HTTP.

Testuje se celý řetěz nahrání souboru: uložení na disk, řádek ve
fuj_jmlp_files, vazba ve fuj_jmlp_attachment, systematický název a to,
co z toho vidí administrace (knihovna, výpis příloh vlastníka).

Soubory se opravdu zapisují do uploads/documents - fixtura na konci testu
uklidí právě ty, které v testovací databázi zůstaly.
"""

import io
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

from app import models
from app.services import attachments as attachment_service
from app.services import files as file_service

PDF = b"%PDF-1.4 obsah testovaciho souboru"


@pytest.fixture(autouse=True)
def _uklid_nahranych_souboru(db):
    """Smaže z disku soubory, které test nahrál.

    Maže se jen podle řádků v TESTOVACÍ databázi, takže to nesáhne na
    soubory jiné běžící sady testů (uploads/documents je společný).
    """
    yield
    db.expire_all()
    for (file_path,) in db.query(models.File.file_path).all():
        if file_path:
            Path(file_path).unlink(missing_ok=True)


# --------------------------------------------------------------------------
# Testovací data
# --------------------------------------------------------------------------
def _zavod(db, race_nr="JMLP2026-01", datum=date(2026, 1, 17), season_id=2026):
    race = models.Race(
        closed=False,
        datum=datum,
        race_nr=race_nr,
        registration=True,
        race_method_id=1,
        season_id=season_id,
        is_live=False,
        run_count=1,
    )
    db.add(race)
    db.commit()
    db.refresh(race)
    return race


def _sezona(db, year_start=2025):
    season = models.Season(
        year_start=year_start,
        year_end=year_start + 1,
        edition=19,
        name=f"Sezóna {year_start}/{year_start + 1}",
    )
    db.add(season)
    db.commit()
    db.refresh(season)
    return season


def _klub(db, name="Ski klub Velké Meziříčí"):
    club = models.Club(name=name, valid=True)
    db.add(club)
    db.commit()
    db.refresh(club)
    return club


def _clanek(db, title="Pozvánka na závod"):
    post = models.Post(title=title, content="Text článku", published=True)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def _nahraj(
    client,
    headers,
    *,
    owner_type,
    owner_id=None,
    role=None,
    filename="soubor.pdf",
    obsah=PDF,
    content_type="application/pdf",
):
    data = {"owner_type": owner_type}
    if owner_id is not None:
        data["owner_id"] = str(owner_id)
    if role is not None:
        data["role"] = role
    return client.post(
        "/api/admin/attachments",
        data=data,
        files={"file": (filename, obsah, content_type)},
        headers=headers,
    )


def _prilohy(client, headers, owner_type, owner_id=None, role=None):
    params = {"owner_type": owner_type}
    if owner_id is not None:
        params["owner_id"] = owner_id
    if role is not None:
        params["role"] = role
    response = client.get("/api/admin/attachments", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


# --------------------------------------------------------------------------
# Nahrání souboru a připojení k vlastníkovi
# --------------------------------------------------------------------------
def test_nahrani_prilohy_zalozi_soubor_vazbu_i_data_na_disku(client, db, admin_headers):
    race = _zavod(db)

    response = _nahraj(
        client,
        admin_headers,
        owner_type="race",
        owner_id=race.id,
        role="propozice",
        filename="sken propozic.pdf",
    )

    assert response.status_code == 200, response.text
    telo = response.json()
    assert telo["owner_type"] == "race"
    assert telo["owner_id"] == race.id
    assert telo["role"] == "propozice"
    assert telo["role_label"] == "Propozice"
    assert telo["published"] is True
    assert telo["is_generated"] is False
    assert telo["sort_order"] == 0
    assert telo["file_size"] == len(PDF)
    assert telo["mime_type"] == "application/pdf"
    assert telo["download_url"] == f"/uploads/documents/{telo['filename']}"

    ulozeny = file_service.DOCUMENTS_DIR / telo["filename"]
    assert ulozeny.read_bytes() == PDF

    prilohy = _prilohy(client, admin_headers, "race", race.id)
    assert [p["id"] for p in prilohy] == [telo["id"]]


def test_soubor_na_disku_lezi_pod_uuid_ne_pod_svym_nazvem(client, db, admin_headers):
    race = _zavod(db)

    telo = _nahraj(
        client,
        admin_headers,
        owner_type="race",
        owner_id=race.id,
        role="propozice",
        filename="sken propozic.pdf",
    ).json()

    assert telo["filename"] != telo["original_filename"]
    assert telo["filename"].endswith(".pdf")
    # 32 hex znaků z uuid4().hex + přípona
    assert len(telo["filename"]) == 36


def test_nahrany_soubor_dostane_systematicky_nazev_podle_zavodu(client, db, admin_headers):
    race = _zavod(db, race_nr="JMLP2026-05")

    telo = _nahraj(
        client,
        admin_headers,
        owner_type="race",
        owner_id=race.id,
        role="propozice",
        filename="sken propozic.pdf",
    ).json()

    assert telo["original_filename"] == "JMLP2026-05_propozice.pdf"
    assert telo["title"] == "JMLP2026-05_propozice.pdf"


def test_systematicky_nazev_sezony_obsahuje_oba_roky(client, db, admin_headers):
    _sezona(db, year_start=2025)

    telo = _nahraj(
        client,
        admin_headers,
        owner_type="season",
        owner_id=2025,
        role="vysledky",
        filename="celkove.pdf",
    ).json()

    assert telo["original_filename"] == "sezona-2025-2026_vysledky.pdf"


def test_systematicky_nazev_klubu_je_bez_diakritiky(client, db, admin_headers):
    club = _klub(db, name="Ski klub Velké Meziříčí")

    telo = _nahraj(
        client,
        admin_headers,
        owner_type="club",
        owner_id=club.id,
        role="logo",
        filename="Logo klubu.PNG",
        obsah=b"\x89PNG data",
        content_type="image/png",
    ).json()

    assert telo["original_filename"] == "klub-ski-klub-velke-mezirici_logo.png"


def test_systematicky_nazev_clanku_pouzije_jeho_id(client, db, admin_headers):
    post = _clanek(db)

    telo = _nahraj(
        client,
        admin_headers,
        owner_type="post",
        owner_id=post.id,
        role="image",
        filename="fotka.jpg",
        obsah=b"JPEG",
        content_type="image/jpeg",
    ).json()

    assert telo["original_filename"] == f"clanek-{post.id}_obrazek.jpg"


def test_soubor_nahrany_do_knihovny_si_nechava_svuj_nazev(client, db, admin_headers):
    telo = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="Zápis ze schůze.pdf"
    ).json()

    assert telo["original_filename"] == "Zápis ze schůze.pdf"
    assert telo["owner_type"] == "library"
    assert telo["owner_id"] is None


def test_druhy_soubor_stejneho_zavodu_a_role_dostane_poradove_cislo(client, db, admin_headers):
    race = _zavod(db, race_nr="JMLP2026-01")

    prvni = _nahraj(
        client,
        admin_headers,
        owner_type="race",
        owner_id=race.id,
        role="propozice",
        filename="a.pdf",
    ).json()
    druhy = _nahraj(
        client,
        admin_headers,
        owner_type="race",
        owner_id=race.id,
        role="propozice",
        filename="b.pdf",
    ).json()

    assert prvni["original_filename"] == "JMLP2026-01_propozice.pdf"
    # Starý soubor zůstává v knihovně, takže se název nesmí zopakovat.
    assert druhy["original_filename"] == "JMLP2026-01_propozice-2.pdf"


def test_mime_typ_urcuje_pripona_ne_hlavicka_prohlizece(client, db, admin_headers):
    telo = _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="pravidla.pdf",
        content_type="text/plain",
    ).json()

    assert telo["mime_type"] == "application/pdf"


def test_u_nezname_pripony_se_pouzije_typ_z_prohlizece(client, db, admin_headers):
    docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    telo = _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="pravidla.docx",
        obsah=b"PK docx",
        content_type=docx,
    ).json()

    assert telo["mime_type"] == docx


@pytest.mark.parametrize(
    "role,ocekavany_typ",
    [
        ("propozice", "propozice"),
        ("vysledky", "vysledky"),
    ],
)
def test_role_zavodu_urcuje_typ_souboru_v_knihovne(client, db, admin_headers, role, ocekavany_typ):
    race = _zavod(db)

    _nahraj(client, admin_headers, owner_type="race", owner_id=race.id, role=role)

    response = client.get(
        "/api/admin/files", params={"file_type": ocekavany_typ}, headers=admin_headers
    )
    assert [f["file_type"] for f in response.json()] == [ocekavany_typ]


def test_prubezne_vysledky_se_v_knihovne_vedou_jako_vysledky(client, db, admin_headers):
    _sezona(db, year_start=2025)

    _nahraj(client, admin_headers, owner_type="season", owner_id=2025, role="prubezne")

    response = client.get(
        "/api/admin/files", params={"file_type": "vysledky"}, headers=admin_headers
    )
    assert len(response.json()) == 1


def test_logo_klubu_se_v_knihovne_vede_jako_obrazek(client, db, admin_headers):
    club = _klub(db)

    _nahraj(
        client,
        admin_headers,
        owner_type="club",
        owner_id=club.id,
        role="logo",
        filename="logo.png",
        obsah=b"\x89PNG",
        content_type="image/png",
    )

    response = client.get("/api/admin/files", params={"file_type": "image"}, headers=admin_headers)
    assert len(response.json()) == 1


# --------------------------------------------------------------------------
# Nahrání, které se má nepovést
# --------------------------------------------------------------------------
def test_nahrani_k_neexistujicimu_zavodu_skonci_404_a_nic_neulozi(client, db, admin_headers):
    response = _nahraj(client, admin_headers, owner_type="race", owner_id=9999, role="propozice")

    assert response.status_code == 404
    assert response.json()["detail"] == "Vlastník přílohy nebyl nalezen"
    assert db.query(models.File).count() == 0


def test_nahrani_k_neexistujici_sezone_skonci_404(client, db, admin_headers):
    _sezona(db, year_start=2025)

    response = _nahraj(client, admin_headers, owner_type="season", owner_id=2030, role="vysledky")

    assert response.status_code == 404
    assert db.query(models.File).count() == 0


def test_nahrani_bez_identifikatoru_vlastnika_skonci_400(client, db, admin_headers):
    _zavod(db)

    response = _nahraj(client, admin_headers, owner_type="race", role="propozice")

    assert response.status_code == 400
    assert response.json()["detail"] == "Chybí identifikátor vlastníka"
    assert db.query(models.File).count() == 0


def test_nahrani_s_neznamym_typem_vlastnika_skonci_400(client, db, admin_headers):
    response = _nahraj(client, admin_headers, owner_type="zavodnik", owner_id=1)

    assert response.status_code == 400
    assert "zavodnik" in response.json()["detail"]
    assert db.query(models.File).count() == 0


def test_role_mimo_povolene_pro_vlastnika_se_odmitne(client, db, admin_headers):
    race = _zavod(db)

    response = _nahraj(client, admin_headers, owner_type="race", owner_id=race.id, role="logo")

    assert response.status_code == 400
    detail = response.json()["detail"]
    # Hláška má poradit, co se smí - závod umí jen propozice a výsledky.
    assert "propozice" in detail and "vysledky" in detail
    assert db.query(models.File).count() == 0


def test_zavod_neprijme_prilohu_bez_urcene_role(client, db, admin_headers):
    race = _zavod(db)

    # Výchozí role je "document", tu ale závod nemá povolenou.
    response = _nahraj(client, admin_headers, owner_type="race", owner_id=race.id)

    assert response.status_code == 400
    assert db.query(models.Attachment).count() == 0


def test_neznama_role_skonci_400(client, db, admin_headers):
    race = _zavod(db)

    response = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="neco-jineho"
    )

    assert response.status_code == 400
    assert "neco-jineho" in response.json()["detail"]


def test_nepodporovany_typ_souboru_se_neulozi(client, db, admin_headers):
    response = _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="virus.exe",
        obsah=b"MZ",
        content_type="application/x-msdownload",
    )

    assert response.status_code == 400
    assert "Nepodporovaný typ souboru" in response.json()["detail"]
    assert db.query(models.File).count() == 0


def test_soubor_bez_pripony_se_neulozi(client, db, admin_headers):
    response = _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="propozice",
        obsah=b"data",
    )

    assert response.status_code == 400
    assert db.query(models.File).count() == 0


def test_prilis_velky_soubor_se_neulozi(client, db, admin_headers):
    velky = b"x" * (file_service.MAX_FILE_SIZE + 1)

    response = _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="velky.pdf",
        obsah=velky,
    )

    assert response.status_code == 400
    assert "příliš velký" in response.json()["detail"]
    assert db.query(models.File).count() == 0


def test_soubor_presne_na_limitu_projde(client, db, admin_headers):
    na_limitu = b"x" * file_service.MAX_FILE_SIZE

    telo = _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="tesne.pdf",
        obsah=na_limitu,
    ).json()

    assert telo["file_size"] == file_service.MAX_FILE_SIZE


def test_prazdny_soubor_se_neulozi(client, db, admin_headers):
    response = _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="prazdny.pdf",
        obsah=b"",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Soubor je prázdný"
    assert db.query(models.File).count() == 0


# --------------------------------------------------------------------------
# Vzájemně se vylučující role
# --------------------------------------------------------------------------
def test_nove_vysledky_zavodu_nahradi_predchozi(client, db, admin_headers):
    race = _zavod(db)

    stare = _nahraj(
        client,
        admin_headers,
        owner_type="race",
        owner_id=race.id,
        role="vysledky",
        filename="stare.pdf",
    ).json()
    nove = _nahraj(
        client,
        admin_headers,
        owner_type="race",
        owner_id=race.id,
        role="vysledky",
        filename="nove.pdf",
    ).json()

    prilohy = _prilohy(client, admin_headers, "race", race.id, role="vysledky")
    assert [p["file_id"] for p in prilohy] == [nove["file_id"]]
    # Nahrazená příloha zmizela, ale soubor zůstal v knihovně.
    assert db.query(models.File).filter(models.File.id == stare["file_id"]).count() == 1


def test_propozice_a_vysledky_zavodu_stoji_vedle_sebe(client, db, admin_headers):
    race = _zavod(db)

    _nahraj(client, admin_headers, owner_type="race", owner_id=race.id, role="propozice")
    _nahraj(client, admin_headers, owner_type="race", owner_id=race.id, role="vysledky")

    prilohy = _prilohy(client, admin_headers, "race", race.id)
    assert sorted(p["role"] for p in prilohy) == ["propozice", "vysledky"]


def test_prubezne_vysledky_sezony_nahradi_celkove(client, db, admin_headers):
    _sezona(db, year_start=2025)

    _nahraj(client, admin_headers, owner_type="season", owner_id=2025, role="vysledky")
    prubezne = _nahraj(
        client, admin_headers, owner_type="season", owner_id=2025, role="prubezne"
    ).json()

    prilohy = _prilohy(client, admin_headers, "season", 2025)
    # Sezóna má buď průběžné, nebo celkové pořadí - nikdy obojí.
    assert [(p["role"], p["file_id"]) for p in prilohy] == [("prubezne", prubezne["file_id"])]


def test_dokument_sezony_vylucnou_skupinu_nenarusi(client, db, admin_headers):
    _sezona(db, year_start=2025)

    _nahraj(client, admin_headers, owner_type="season", owner_id=2025, role="vysledky")
    _nahraj(client, admin_headers, owner_type="season", owner_id=2025, role="document")

    prilohy = _prilohy(client, admin_headers, "season", 2025)
    assert sorted(p["role"] for p in prilohy) == ["document", "vysledky"]


def test_knihovna_snese_vic_dokumentu_bez_nahrazovani(client, db, admin_headers):
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="a.pdf")
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="b.pdf")

    prilohy = _prilohy(client, admin_headers, "library")
    assert [p["sort_order"] for p in prilohy] == [0, 1]


def test_zmena_role_prilohy_obejde_vylucnost_roli(client, db, admin_headers):
    """CHYBA: PUT /attachments/{id} nekontroluje vylučující se skupiny.

    Přes upload se druhá výsledková listina závodu nedá vytvořit, přejmenováním
    role u existující přílohy ale ano - a závod pak má dvě.
    """
    race = _zavod(db)
    propozice = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()
    _nahraj(client, admin_headers, owner_type="race", owner_id=race.id, role="vysledky")

    response = client.put(
        f"/api/admin/attachments/{propozice['id']}",
        json={"role": "vysledky"},
        headers=admin_headers,
    )

    assert response.status_code == 200
    vysledky = _prilohy(client, admin_headers, "race", race.id, role="vysledky")
    assert len(vysledky) == 2  # takhle se to chová teď; správně smí být jedna


# --------------------------------------------------------------------------
# Připojení souboru, který už v knihovně je
# --------------------------------------------------------------------------
def test_pripojeni_souboru_z_knihovny_nemeni_jeho_nazev(client, db, admin_headers):
    race = _zavod(db)
    soubor = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="Soutěžní řád.pdf"
    ).json()

    response = client.post(
        "/api/admin/attachments/link",
        headers=admin_headers,
        json={
            "file_id": soubor["file_id"],
            "owner_type": "race",
            "owner_id": race.id,
            "role": "propozice",
        },
    )

    assert response.status_code == 200, response.text
    telo = response.json()
    assert telo["owner_type"] == "race"
    assert telo["role"] == "propozice"
    # Přejmenovat by soubor pod rukama tomu, kdo ho už používá.
    assert telo["original_filename"] == "Soutěžní řád.pdf"


def test_jeden_soubor_muze_slouzit_vice_vlastnikum(client, db, admin_headers):
    race = _zavod(db)
    post = _clanek(db)
    soubor = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    client.post(
        "/api/admin/attachments/link",
        headers=admin_headers,
        json={
            "file_id": soubor["file_id"],
            "owner_type": "post",
            "owner_id": post.id,
            "role": "document",
        },
    )

    knihovna = client.get("/api/admin/library", headers=admin_headers).json()
    pouziti = knihovna["files"][0]["usage_info"]
    assert [u["owner_type"] for u in pouziti] == ["race", "post"]
    assert pouziti[0]["title"].startswith("Závod JMLP2026-01")
    assert pouziti[1]["title"] == "Příspěvek: Pozvánka na závod"


def test_pripojeni_bez_file_id_skonci_400(client, db, admin_headers):
    race = _zavod(db)

    response = client.post(
        "/api/admin/attachments/link",
        headers=admin_headers,
        json={
            "owner_type": "race",
            "owner_id": race.id,
            "role": "propozice",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Chybí file_id"


def test_pripojeni_neexistujiciho_souboru_skonci_404(client, db, admin_headers):
    race = _zavod(db)

    response = client.post(
        "/api/admin/attachments/link",
        headers=admin_headers,
        json={
            "file_id": 4242,
            "owner_type": "race",
            "owner_id": race.id,
            "role": "propozice",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Soubor nebyl nalezen"
    assert db.query(models.Attachment).count() == 0


def test_pripojeni_s_roli_mimo_vlastnika_skonci_400(client, db, admin_headers):
    club = _klub(db)
    soubor = _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="image",
        filename="logo.png",
        obsah=b"\x89PNG",
        content_type="image/png",
    ).json()

    response = client.post(
        "/api/admin/attachments/link",
        headers=admin_headers,
        json={
            "file_id": soubor["file_id"],
            "owner_type": "club",
            "owner_id": club.id,
            "role": "document",
        },
    )

    assert response.status_code == 400
    assert _prilohy(client, admin_headers, "club", club.id) == []


# --------------------------------------------------------------------------
# Úpravy přílohy
# --------------------------------------------------------------------------
def test_prilohu_lze_skryt_i_znovu_zverejnit(client, db, admin_headers):
    race = _zavod(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    skryta = client.put(
        f"/api/admin/attachments/{priloha['id']}", json={"published": False}, headers=admin_headers
    ).json()
    assert skryta["published"] is False

    vracena = client.put(
        f"/api/admin/attachments/{priloha['id']}", json={"published": True}, headers=admin_headers
    ).json()
    assert vracena["published"] is True


def test_zmena_role_na_pro_vlastnika_nepovolenou_se_odmitne(client, db, admin_headers):
    race = _zavod(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    response = client.put(
        f"/api/admin/attachments/{priloha['id']}", json={"role": "logo"}, headers=admin_headers
    )

    assert response.status_code == 400
    assert _prilohy(client, admin_headers, "race", race.id)[0]["role"] == "propozice"


def test_uprava_prilohy_nemeni_nazev_souboru(client, db, admin_headers):
    race = _zavod(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    # Název je vlastnost souboru, ne přílohy - "title" v těle se ignoruje.
    telo = client.put(
        f"/api/admin/attachments/{priloha['id']}",
        json={"title": "Něco jiného"},
        headers=admin_headers,
    ).json()

    assert telo["title"] == "JMLP2026-01_propozice.pdf"


def test_uprava_neexistujici_prilohy_skonci_404(client, db, admin_headers):
    response = client.put(
        "/api/admin/attachments/999", json={"published": False}, headers=admin_headers
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Příloha nebyla nalezena"


def test_prerazeni_priloh_ulozi_nove_poradi(client, db, admin_headers):
    prvni = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="a.pdf"
    ).json()
    druha = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="b.pdf"
    ).json()
    treti = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="c.pdf"
    ).json()

    response = client.post(
        "/api/admin/attachments/reorder",
        headers=admin_headers,
        json={"attachment_ids": [treti["id"], prvni["id"], druha["id"]]},
    )

    assert response.json() == {"message": "Pořadí uloženo", "updated": 3}
    prilohy = _prilohy(client, admin_headers, "library")
    assert [p["id"] for p in prilohy] == [treti["id"], prvni["id"], druha["id"]]
    assert [p["sort_order"] for p in prilohy] == [0, 1, 2]


def test_prerazeni_s_necislenym_seznamem_skonci_400(client, db, admin_headers):
    response = client.post(
        "/api/admin/attachments/reorder", headers=admin_headers, json={"attachment_ids": "1,2,3"}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "attachment_ids musí být seznam"


def test_neciselne_poradi_prilohy_shodi_endpoint(client, db, admin_headers):
    """CHYBA: sort_order se převádí int()em bez ošetření.

    Tělo requestu je volný dict, takže validace FastAPI nečíselnou hodnotu
    pustí dál a int() spadne až v routeru - z neplatného vstupu je 500
    místo 400.
    """
    race = _zavod(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    with pytest.raises(ValueError):
        client.put(
            f"/api/admin/attachments/{priloha['id']}",
            json={"sort_order": "prvni"},
            headers=admin_headers,
        )


# --------------------------------------------------------------------------
# Odpojení a mazání přílohy
# --------------------------------------------------------------------------
def test_odpojena_priloha_vrati_soubor_do_knihovny(client, db, admin_headers):
    race = _zavod(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    response = client.delete(f"/api/admin/attachments/{priloha['id']}", headers=admin_headers)

    assert response.json() == {"message": "Příloha odpojena"}
    assert _prilohy(client, admin_headers, "race", race.id) == []
    v_knihovne = _prilohy(client, admin_headers, "library")
    assert [p["file_id"] for p in v_knihovne] == [priloha["file_id"]]
    assert (file_service.DOCUMENTS_DIR / priloha["filename"]).is_file()


def test_odpojeni_prilohy_pouzite_jinde_soubor_do_knihovny_nevraci(client, db, admin_headers):
    race = _zavod(db)
    post = _clanek(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()
    client.post(
        "/api/admin/attachments/link",
        headers=admin_headers,
        json={
            "file_id": priloha["file_id"],
            "owner_type": "post",
            "owner_id": post.id,
            "role": "document",
        },
    )

    client.delete(f"/api/admin/attachments/{priloha['id']}", headers=admin_headers)

    assert _prilohy(client, admin_headers, "library") == []
    assert len(_prilohy(client, admin_headers, "post", post.id)) == 1


def test_smazani_prilohy_i_souboru_odstrani_data_z_disku(client, db, admin_headers):
    race = _zavod(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    response = client.delete(
        f"/api/admin/attachments/{priloha['id']}",
        params={"delete_file": "true"},
        headers=admin_headers,
    )

    assert response.json() == {"message": "Příloha i soubor smazány"}
    assert db.query(models.File).count() == 0
    assert db.query(models.Attachment).count() == 0
    assert not (file_service.DOCUMENTS_DIR / priloha["filename"]).exists()


def test_smazani_souboru_pouziteho_jinde_skonci_409_ale_prilohu_uz_odpoji(
    client, db, admin_headers
):
    """CHYBA: konflikt se hlásí až po smazání přílohy.

    Endpoint odpojí přílohu a teprve pak zjistí, že soubor je použitý i jinde.
    Odpověď je 409 „smazat lze jen přílohu", takže volající čeká, že se nic
    nestalo - jenže příloha už je pryč.
    """
    race = _zavod(db)
    post = _clanek(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()
    client.post(
        "/api/admin/attachments/link",
        headers=admin_headers,
        json={
            "file_id": priloha["file_id"],
            "owner_type": "post",
            "owner_id": post.id,
            "role": "document",
        },
    )

    response = client.delete(
        f"/api/admin/attachments/{priloha['id']}",
        params={"delete_file": "true"},
        headers=admin_headers,
    )

    assert response.status_code == 409
    assert "použitý i jinde" in response.json()["detail"]
    # Soubor opravdu zůstal.
    assert db.query(models.File).count() == 1
    assert (file_service.DOCUMENTS_DIR / priloha["filename"]).is_file()
    # ...ale příloha závodu už neexistuje, i když endpoint ohlásil chybu.
    assert _prilohy(client, admin_headers, "race", race.id) == []


def test_odpojeni_neexistujici_prilohy_skonci_404(client, db, admin_headers):
    response = client.delete("/api/admin/attachments/777", headers=admin_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Příloha nebyla nalezena"


def test_vypis_priloh_neexistujiciho_vlastnika_skonci_404(client, db, admin_headers):
    response = client.get(
        "/api/admin/attachments",
        params={"owner_type": "post", "owner_id": 12345},
        headers=admin_headers,
    )

    assert response.status_code == 404


def test_filtr_role_ve_vypisu_musi_byt_pro_vlastnika_povoleny(client, db, admin_headers):
    race = _zavod(db)

    response = client.get(
        "/api/admin/attachments",
        params={"owner_type": "race", "owner_id": race.id, "role": "logo"},
        headers=admin_headers,
    )

    assert response.status_code == 400


# --------------------------------------------------------------------------
# Knihovna - výpis a filtry
# --------------------------------------------------------------------------
def test_knihovna_vraci_soubory_od_nejnovejsiho(client, db, admin_headers):
    prvni = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="prvni.pdf"
    ).json()
    druhy = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="druhy.pdf"
    ).json()

    telo = client.get("/api/admin/library", headers=admin_headers).json()

    assert telo["count"] == 2
    assert telo["total"] == 2
    assert [f["id"] for f in telo["files"]] == [druhy["file_id"], prvni["file_id"]]
    assert telo["files"][0]["original_filename"] == "druhy.pdf"


def test_knihovna_filtruje_podle_casti_nazvu(client, db, admin_headers):
    _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="propozice-kvetna.pdf",
    )
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="zapis.pdf")

    telo = client.get("/api/admin/library", params={"q": "propozice"}, headers=admin_headers).json()

    assert telo["count"] == 1
    assert telo["total"] == 2  # total je vždy celá knihovna, ne výsledek filtru
    assert telo["files"][0]["original_filename"] == "propozice-kvetna.pdf"


def test_knihovna_filtruje_podle_pripony_bez_ohledu_na_tecku(client, db, admin_headers):
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="a.pdf")
    _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="image",
        filename="b.png",
        obsah=b"\x89PNG",
        content_type="image/png",
    )

    s_teckou = client.get(
        "/api/admin/library", params={"extension": ".PNG"}, headers=admin_headers
    ).json()
    bez_tecky = client.get(
        "/api/admin/library", params={"extension": "png"}, headers=admin_headers
    ).json()

    assert [f["original_filename"] for f in s_teckou["files"]] == ["b.png"]
    assert [f["original_filename"] for f in bez_tecky["files"]] == ["b.png"]


def test_knihovna_umi_najit_soubory_nepripojene_nikam(client, db, admin_headers):
    race = _zavod(db)
    _nahraj(client, admin_headers, owner_type="race", owner_id=race.id, role="propozice")
    volny = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="volny.pdf"
    ).json()

    nepripojene = client.get(
        "/api/admin/library", params={"owner_type": "library"}, headers=admin_headers
    ).json()
    u_zavodu = client.get(
        "/api/admin/library", params={"owner_type": "race"}, headers=admin_headers
    ).json()

    assert [f["id"] for f in nepripojene["files"]] == [volny["file_id"]]
    assert [f["original_filename"] for f in u_zavodu["files"]] == ["JMLP2026-01_propozice.pdf"]


def test_knihovna_filtruje_podle_data_nahrani(client, db, admin_headers):
    soubor = _nahraj(client, admin_headers, owner_type="library", role="document").json()
    dnes = datetime.utcnow().date()

    v_rozsahu = client.get(
        "/api/admin/library",
        params={"date_from": dnes.isoformat(), "date_to": dnes.isoformat()},
        headers=admin_headers,
    ).json()
    vcerejsi = client.get(
        "/api/admin/library",
        params={"date_to": (dnes - timedelta(days=1)).isoformat()},
        headers=admin_headers,
    ).json()

    assert [f["id"] for f in v_rozsahu["files"]] == [soubor["file_id"]]
    assert vcerejsi["files"] == []


def test_knihovna_s_neznamym_typem_vlastnika_skonci_400(client, db, admin_headers):
    response = client.get(
        "/api/admin/library", params={"owner_type": "trener"}, headers=admin_headers
    )

    assert response.status_code == 400
    assert "trener" in response.json()["detail"]


# --------------------------------------------------------------------------
# Knihovna - přejmenování
# --------------------------------------------------------------------------
def test_prejmenovani_souboru_zachova_skutecnou_priponu(client, db, admin_headers):
    race = _zavod(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    response = client.put(
        f"/api/admin/library/files/{priloha['file_id']}",
        json={"name": "Propozice Pardubice.jpg"},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["original_filename"] == "Propozice Pardubice.pdf"
    # Nový název vidí i příloha - soubor má jediný název.
    assert _prilohy(client, admin_headers, "race", race.id)[0]["title"] == "Propozice Pardubice.pdf"


def test_prejmenovani_zahodi_kus_cesty_v_nazvu(client, db, admin_headers):
    soubor = _nahraj(client, admin_headers, owner_type="library", role="document").json()

    response = client.put(
        f"/api/admin/library/files/{soubor['file_id']}",
        json={"name": "../../etc/passwd"},
        headers=admin_headers,
    )

    assert response.json()["original_filename"] == "etc-passwd.pdf"


def test_prejmenovani_na_uz_obsazeny_nazev_skonci_409(client, db, admin_headers):
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="Propozice.pdf")
    druhy = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="jiny.pdf"
    ).json()

    # Kolace je case-insensitive, takže "propozice" koliduje s "Propozice".
    response = client.put(
        f"/api/admin/library/files/{druhy['file_id']}",
        json={"name": "propozice"},
        headers=admin_headers,
    )

    assert response.status_code == 409
    assert "už v knihovně je" in response.json()["detail"]
    knihovna = client.get("/api/admin/library", headers=admin_headers).json()
    assert sorted(f["original_filename"] for f in knihovna["files"]) == [
        "Propozice.pdf",
        "jiny.pdf",
    ]


def test_prejmenovani_na_stejny_nazev_projde(client, db, admin_headers):
    soubor = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="Propozice.pdf"
    ).json()

    response = client.put(
        f"/api/admin/library/files/{soubor['file_id']}",
        json={"name": "Propozice.pdf"},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["original_filename"] == "Propozice.pdf"


def test_prejmenovani_na_prazdny_nazev_skonci_400(client, db, admin_headers):
    soubor = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="puvodni.pdf"
    ).json()

    response = client.put(
        f"/api/admin/library/files/{soubor['file_id']}", json={"name": "   "}, headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Zadejte název souboru"
    knihovna = client.get("/api/admin/library", headers=admin_headers).json()
    assert knihovna["files"][0]["original_filename"] == "puvodni.pdf"


def test_prejmenovani_neexistujiciho_souboru_skonci_404(client, db, admin_headers):
    response = client.put(
        "/api/admin/library/files/321", json={"name": "cokoliv"}, headers=admin_headers
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Soubor nebyl nalezen"


# --------------------------------------------------------------------------
# Knihovna - mazání
# --------------------------------------------------------------------------
def test_smazani_nepouziteho_souboru_projde_bez_vynuceni(client, db, admin_headers):
    soubor = _nahraj(client, admin_headers, owner_type="library", role="document").json()

    response = client.delete(f"/api/admin/library/files/{soubor['file_id']}", headers=admin_headers)

    assert response.json() == {"message": "Soubor smazán"}
    assert db.query(models.File).count() == 0
    # Zmizí i vazba na knihovnu, aby nezůstala viset na neexistující soubor.
    assert db.query(models.Attachment).count() == 0
    assert not (file_service.DOCUMENTS_DIR / soubor["filename"]).exists()


def test_smazani_pouziteho_souboru_skonci_409_a_rekne_kde_je(client, db, admin_headers):
    race = _zavod(db, race_nr="JMLP2026-03", datum=date(2026, 3, 7))
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    response = client.delete(
        f"/api/admin/library/files/{priloha['file_id']}", headers=admin_headers
    )

    assert response.status_code == 409
    assert "Propozice: Závod JMLP2026-03 - 2026-03-07" in response.json()["detail"]
    assert db.query(models.File).count() == 1
    assert (file_service.DOCUMENTS_DIR / priloha["filename"]).is_file()


def test_vynucene_smazani_odstrani_soubor_i_vsechny_jeho_prilohy(client, db, admin_headers):
    race = _zavod(db)
    post = _clanek(db)
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()
    client.post(
        "/api/admin/attachments/link",
        headers=admin_headers,
        json={
            "file_id": priloha["file_id"],
            "owner_type": "post",
            "owner_id": post.id,
            "role": "document",
        },
    )

    response = client.delete(
        f"/api/admin/library/files/{priloha['file_id']}",
        params={"force": "true"},
        headers=admin_headers,
    )

    assert response.json() == {"message": "Soubor smazán"}
    assert _prilohy(client, admin_headers, "race", race.id) == []
    assert _prilohy(client, admin_headers, "post", post.id) == []
    assert not (file_service.DOCUMENTS_DIR / priloha["filename"]).exists()


def test_smazani_souboru_chybejiciho_na_disku_projde(client, db, admin_headers):
    soubor = _nahraj(client, admin_headers, owner_type="library", role="document").json()
    (file_service.DOCUMENTS_DIR / soubor["filename"]).unlink()

    response = client.delete(f"/api/admin/library/files/{soubor['file_id']}", headers=admin_headers)

    assert response.status_code == 200
    assert db.query(models.File).count() == 0


def test_smazani_neexistujiciho_souboru_skonci_404(client, db, admin_headers):
    response = client.delete("/api/admin/library/files/654", headers=admin_headers)

    assert response.status_code == 404


# --------------------------------------------------------------------------
# Knihovna - ZIP export
# --------------------------------------------------------------------------
def test_export_roztridi_soubory_do_slozek_podle_vlastnika(client, db, admin_headers):
    race = _zavod(db, race_nr="JMLP2026-02")
    _nahraj(client, admin_headers, owner_type="race", owner_id=race.id, role="propozice")
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="zapis.pdf")

    response = client.get("/api/admin/library/export.zip", headers=admin_headers)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(response.content)) as archiv:
        assert sorted(archiv.namelist()) == [
            "nezarazene/zapis.pdf",
            "zavody/JMLP2026-02_propozice.pdf",
        ]
        assert archiv.read("nezarazene/zapis.pdf") == PDF


def test_export_respektuje_filtr_vypisu(client, db, admin_headers):
    race = _zavod(db)
    _nahraj(client, admin_headers, owner_type="race", owner_id=race.id, role="propozice")
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="zapis.pdf")

    response = client.get(
        "/api/admin/library/export.zip", params={"q": "zapis"}, headers=admin_headers
    )

    with zipfile.ZipFile(io.BytesIO(response.content)) as archiv:
        assert archiv.namelist() == ["nezarazene/zapis.pdf"]


def test_export_bez_odpovidajicich_souboru_skonci_404(client, db, admin_headers):
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="zapis.pdf")

    response = client.get(
        "/api/admin/library/export.zip", params={"q": "neexistuje"}, headers=admin_headers
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Filtru neodpovídá žádný soubor"


def test_export_preskoci_soubor_chybejici_na_disku(client, db, admin_headers):
    zdravy = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="zdravy.pdf"
    ).json()
    ztraceny = _nahraj(
        client, admin_headers, owner_type="library", role="document", filename="ztraceny.pdf"
    ).json()
    (file_service.DOCUMENTS_DIR / ztraceny["filename"]).unlink()

    response = client.get("/api/admin/library/export.zip", headers=admin_headers)

    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archiv:
        assert archiv.namelist() == ["nezarazene/zdravy.pdf"]
        assert archiv.read("nezarazene/zdravy.pdf") == PDF
    # Filtr vybral oba soubory, vypadl až ten, který na disku není.
    knihovna = client.get("/api/admin/library", headers=admin_headers).json()
    assert {f["id"] for f in knihovna["files"]} == {zdravy["file_id"], ztraceny["file_id"]}


# --------------------------------------------------------------------------
# Plochý výpis souborů, stahování a statistika (documents.py)
# --------------------------------------------------------------------------
def test_vypis_souboru_filtruje_podle_typu(client, db, admin_headers):
    race = _zavod(db)
    _nahraj(client, admin_headers, owner_type="race", owner_id=race.id, role="propozice")
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="zapis.pdf")

    response = client.get(
        "/api/admin/files", params={"file_type": "propozice"}, headers=admin_headers
    )

    telo = response.json()
    assert [f["original_filename"] for f in telo] == ["JMLP2026-01_propozice.pdf"]
    assert telo[0]["usage_info"][0]["owner_type"] == "race"


def test_neznamy_typ_ve_filtru_vrati_vsechny_soubory(client, db, admin_headers):
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="a.pdf")
    _nahraj(client, admin_headers, owner_type="library", role="document", filename="b.pdf")

    # Neznámý typ se mlčky ignoruje - filtr neplatí, vrátí se všechno.
    response = client.get("/api/admin/files", params={"file_type": "neco"}, headers=admin_headers)

    assert len(response.json()) == 2


def test_stazeni_souboru_pouzije_jeho_nazev_ne_uuid(client, db, admin_headers):
    race = _zavod(db, race_nr="JMLP2026-04")
    priloha = _nahraj(
        client, admin_headers, owner_type="race", owner_id=race.id, role="propozice"
    ).json()

    response = client.get(f"/api/admin/files/{priloha['file_id']}/download", headers=admin_headers)

    assert response.status_code == 200
    assert response.content == PDF
    assert "JMLP2026-04_propozice.pdf" in response.headers["content-disposition"]
    assert response.headers["content-type"] == "application/pdf"


def test_stazeni_souboru_chybejiciho_na_disku_skonci_404(client, db, admin_headers):
    soubor = _nahraj(client, admin_headers, owner_type="library", role="document").json()
    (file_service.DOCUMENTS_DIR / soubor["filename"]).unlink()

    response = client.get(f"/api/admin/files/{soubor['file_id']}/download", headers=admin_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Soubor nenalezen na disku"


def test_stazeni_neexistujiciho_souboru_skonci_404(client, db, admin_headers):
    response = client.get("/api/admin/files/999/download", headers=admin_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Soubor nenalezen"


def test_statistika_uloziste_scita_velikosti_a_hlida_disk(client, db, admin_headers):
    _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="a.pdf",
        obsah=b"x" * 2048,
    )
    ztraceny = _nahraj(
        client,
        admin_headers,
        owner_type="library",
        role="document",
        filename="b.pdf",
        obsah=b"y" * 1024,
    ).json()
    (file_service.DOCUMENTS_DIR / ztraceny["filename"]).unlink()

    telo = client.get("/api/admin/files/storage-stats", headers=admin_headers).json()

    assert telo["file_count"] == 2
    assert telo["total_size_bytes"] == 3072
    assert telo["total_size_formatted"] == "3.0 KB"
    assert telo["existing_files"] == 1
    assert telo["missing_files"] == 1


def test_statistika_prazdneho_uloziste_je_nulova(client, db, admin_headers):
    telo = client.get("/api/admin/files/storage-stats", headers=admin_headers).json()

    assert telo == {
        "total_size_bytes": 0,
        "total_size_formatted": "0 B",
        "file_count": 0,
        "existing_files": 0,
        "missing_files": 0,
    }


# --------------------------------------------------------------------------
# Oprávnění
# --------------------------------------------------------------------------
@pytest.mark.parametrize(
    "metoda,cesta",
    [
        ("get", "/api/admin/attachments?owner_type=library"),
        ("post", "/api/admin/attachments/link"),
        ("put", "/api/admin/attachments/1"),
        ("delete", "/api/admin/attachments/1"),
        ("post", "/api/admin/attachments/reorder"),
        ("get", "/api/admin/library"),
        ("put", "/api/admin/library/files/1"),
        ("delete", "/api/admin/library/files/1"),
        ("get", "/api/admin/library/export.zip"),
        ("get", "/api/admin/files"),
        ("get", "/api/admin/files/storage-stats"),
        ("get", "/api/admin/files/1/download"),
    ],
)
def test_casomeric_do_priloh_ani_do_knihovny_nesmi(client, timekeeper_headers, metoda, cesta):
    response = client.request(metoda, cesta, json={}, headers=timekeeper_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Nemáte oprávnění k této akci"


def test_bez_prihlaseni_nelze_nahravat_ani_cist_knihovnu(client, db):
    _zavod(db)

    nahrani = _nahraj(client, {}, owner_type="library", role="document")
    vypis = client.get("/api/admin/library")

    assert nahrani.status_code == 403
    assert vypis.status_code == 403
    assert db.query(models.File).count() == 0


def test_neplatny_token_neprojde(client, db):
    hlavicky = {"Authorization": "Bearer nesmysl"}

    response = client.get("/api/admin/library", headers=hlavicky)

    assert response.status_code == 401
    assert db.query(models.File).count() == 0


# --------------------------------------------------------------------------
# Vazby souborů mimo endpointy příloh (services/attachments.py)
#
# Tyhle funkce používají závody, články a sezóny místo dřívějších sloupců
# *_file_id - přes /api/admin/attachments se na ně nedostane.
# --------------------------------------------------------------------------
def _soubor(db, original_filename="dokument.pdf", obsah=PDF):
    return file_service.store_document_bytes(
        db,
        content=obsah,
        original_filename=original_filename,
        file_type=models.FileTypeEnum.document,
    )


def test_sync_single_nahradi_predchozi_soubor_stejne_role(db):
    race = _zavod(db)
    stary = _soubor(db, "stare-vysledky.pdf")
    novy = _soubor(db, "nove-vysledky.pdf")

    attachment_service.sync_single(
        db, owner_type="race", owner_id=race.id, role="vysledky", file_id=stary.id
    )
    attachment_service.sync_single(
        db, owner_type="race", owner_id=race.id, role="vysledky", file_id=novy.id
    )

    prilohy = attachment_service.list_for_owner(db, "race", race.id)
    assert [p["file_id"] for p in prilohy] == [novy.id]


def test_sync_single_s_prazdnym_file_id_prilohu_odpoji(db):
    race = _zavod(db)
    soubor = _soubor(db)
    attachment_service.sync_single(
        db, owner_type="race", owner_id=race.id, role="propozice", file_id=soubor.id
    )

    vysledek = attachment_service.sync_single(
        db, owner_type="race", owner_id=race.id, role="propozice", file_id=None
    )

    assert vysledek is None
    assert attachment_service.list_for_owner(db, "race", race.id) == []
    # Soubor se odpojením nemaže.
    assert db.query(models.File).filter(models.File.id == soubor.id).count() == 1


def test_sync_single_stejny_soubor_podruhe_nepripoji(db):
    race = _zavod(db)
    soubor = _soubor(db)

    prvni = attachment_service.sync_single(
        db, owner_type="race", owner_id=race.id, role="propozice", file_id=soubor.id
    )
    druha = attachment_service.sync_single(
        db, owner_type="race", owner_id=race.id, role="propozice", file_id=soubor.id
    )

    assert druha.id == prvni.id
    assert db.query(models.Attachment).count() == 1


def test_detach_owner_odpoji_vsechny_prilohy_ale_soubory_nechava(db):
    race = _zavod(db)
    propozice = _soubor(db, "propozice.pdf")
    vysledky = _soubor(db, "vysledky.pdf")
    for role, soubor in (("propozice", propozice), ("vysledky", vysledky)):
        attachment_service.attach(
            db, file_id=soubor.id, owner_type="race", owner_id=race.id, role=role
        )

    odpojeno = attachment_service.detach_owner(db, "race", race.id)

    assert odpojeno == 2
    assert attachment_service.list_for_owner(db, "race", race.id) == []
    assert db.query(models.File).count() == 2


def test_apply_post_documents_doplni_obrazek_i_dokument(db):
    post = _clanek(db)
    bez_priloh = _clanek(db, title="Holý článek")
    obrazek = _soubor(db, "fotka.jpg")
    dokument = _soubor(db, "pozvanka.pdf")
    attachment_service.attach(
        db, file_id=obrazek.id, owner_type="post", owner_id=post.id, role="image"
    )
    attachment_service.attach(
        db, file_id=dokument.id, owner_type="post", owner_id=post.id, role="document"
    )

    attachment_service.apply_post_documents(db, [post, bez_priloh])

    assert post.image_file_id == obrazek.id
    assert post.document_file_id == dokument.id
    assert bez_priloh.image_file_id is None
    assert bez_priloh.document_file_id is None


def test_race_document_file_vraci_jen_zverejneny_soubor(db):
    race = _zavod(db)
    soubor = _soubor(db, "vysledky.pdf")
    priloha = attachment_service.attach(
        db, file_id=soubor.id, owner_type="race", owner_id=race.id, role="vysledky"
    )

    assert attachment_service.race_document_file(db, race.id, "vysledky").id == soubor.id

    priloha.published = False
    db.commit()

    # Skrytá příloha se veřejně nenabízí ke stažení.
    assert attachment_service.race_document_file(db, race.id, "vysledky") is None


def test_first_for_owner_vraci_aktualni_logo_klubu(db):
    club = _klub(db)
    prvni = _soubor(db, "logo-stare.png")
    druhy = _soubor(db, "logo-nove.png")
    attachment_service.attach(
        db, file_id=prvni.id, owner_type="club", owner_id=club.id, role="logo"
    )
    attachment_service.attach(
        db, file_id=druhy.id, owner_type="club", owner_id=club.id, role="logo"
    )

    logo = attachment_service.first_for_owner(db, "club", club.id, "logo")

    # Logo je vylučující role, takže druhé nahrazuje první.
    assert logo["file_id"] == druhy.id


def test_vygenerovana_priloha_je_oznacena(db, client, admin_headers):
    race = _zavod(db)
    soubor = _soubor(db, "vysledky.pdf")

    attachment_service.attach(
        db,
        file_id=soubor.id,
        owner_type="race",
        owner_id=race.id,
        role="vysledky",
        is_generated=True,
    )

    priloha = _prilohy(client, admin_headers, "race", race.id)[0]
    assert priloha["is_generated"] is True
