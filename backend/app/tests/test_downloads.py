"""Stažené soubory se musí jmenovat tak, jak je člověk nahrál.

Na disku leží pod UUID (aby se nepřepsaly a aby název nešel zneužít k útěku
z adresáře), ale prohlížeči se musí nabídnout původní název. Endpoint
/uploads/documents/{filename} to nedělal a stahoval se hash - a protože tudy
vede stahování z celé aplikace, projevilo se to všude.
"""

from pathlib import Path

import pytest

from app import models
from app.models import AttachmentOwner, AttachmentRole
from app.services import attachments as attachment_service

DOCUMENTS_DIR = Path("uploads/documents")


# Soubory, které založil test. Uklízí se JEN tyhle.
#
# Dřív tu byl úklid "smaž všechno malé v adresáři" - jenže testy běží
# v kontejneru, kde je uploads/documents ostrý svazek, takže to smazalo
# nahrané dokumenty. Nikdy neuklízet podle vzoru, vždy podle seznamu.
_ZALOZENE_SOUBORY = []


def _soubor(
    db, original="Soutěžní řád 2026-2027.pdf", mime="application/pdf", obsah=b"%PDF-1.4 test"
):
    """Založí soubor na disku i v databázi, jako by prošel nahráním."""
    import uuid

    filename = f"{uuid.uuid4().hex}{Path(original).suffix}"
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    (DOCUMENTS_DIR / filename).write_bytes(obsah)
    _ZALOZENE_SOUBORY.append(DOCUMENTS_DIR / filename)

    record = models.File(
        filename=filename,
        original_filename=original,
        file_path=str(DOCUMENTS_DIR / filename),
        file_size=len(obsah),
        mime_type=mime,
        file_type=models.FileTypeEnum.document,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _nazev_z_hlavicky(response) -> str:
    """Vytáhne název z Content-Disposition (RFC 5987 i prostý tvar)."""
    disposition = response.headers["content-disposition"]
    if "filename*=utf-8''" in disposition:
        from urllib.parse import unquote

        return unquote(disposition.split("filename*=utf-8''")[1].split(";")[0].strip('"'))
    return disposition.split('filename="')[1].split('"')[0]


@pytest.fixture(autouse=True)
def _uklid():
    yield
    while _ZALOZENE_SOUBORY:
        _ZALOZENE_SOUBORY.pop().unlink(missing_ok=True)


def test_soubor_se_stahuje_pod_svym_nazvem(client, db):
    soubor = _soubor(db)

    odpoved = client.get(f"/uploads/documents/{soubor.filename}")

    assert odpoved.status_code == 200
    assert _nazev_z_hlavicky(odpoved) == "Soutěžní řád 2026-2027.pdf"
    assert soubor.filename not in odpoved.headers["content-disposition"]


def test_stahovani_zachova_diakritiku(client, db):
    soubor = _soubor(db, original="Přihláška závodníka.pdf")

    odpoved = client.get(f"/uploads/documents/{soubor.filename}")

    assert _nazev_z_hlavicky(odpoved) == "Přihláška závodníka.pdf"


def test_typ_obsahu_odpovida_souboru(client, db):
    """Dřív se všechno vydávalo jako PDF, i obrázky."""
    obrazek = _soubor(db, original="logo klubu.png", mime="image/png", obsah=b"\x89PNG test")

    odpoved = client.get(f"/uploads/documents/{obrazek.filename}")

    assert odpoved.headers["content-type"].startswith("image/png")


def test_osirely_soubor_bez_zaznamu_se_vyda_pod_uuid(client):
    """Zbytek na disku bez řádku v databázi - jiný název o něm nikdo neví."""
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    (DOCUMENTS_DIR / "osirely-test.pdf").write_bytes(b"%PDF-1.4")
    _ZALOZENE_SOUBORY.append(DOCUMENTS_DIR / "osirely-test.pdf")

    odpoved = client.get("/uploads/documents/osirely-test.pdf")

    assert odpoved.status_code == 200
    assert "osirely-test.pdf" in odpoved.headers["content-disposition"]


def test_neexistujici_soubor_je_404(client):
    assert client.get("/uploads/documents/neexistuje.pdf").status_code == 404


def test_soubor_smi_prohlizec_drzet_natrvalo(client, db):
    """Soubor pod UUID se nemění - nová verze dokumentu dostane nový název.

    Service worker soubory nekešuje (frontend/public/sw.js), takže bez
    téhle hlavičky by se PDF stahovalo znovu při každém otevření.
    """
    soubor = _soubor(db)

    odpoved = client.get(f"/uploads/documents/{soubor.filename}")

    assert odpoved.status_code == 200
    assert odpoved.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_chybejici_soubor_si_prohlizec_neuklada(client):
    """404 natrvalo v keši by soubor schoval i poté, co se nahraje."""
    odpoved = client.get("/uploads/documents/neexistuje.pdf")

    assert odpoved.status_code == 404
    assert "immutable" not in odpoved.headers.get("cache-control", "")


@pytest.mark.parametrize(
    "cesta",
    [
        "/uploads/documents/..%2F..%2Fetc%2Fpasswd",
        "/uploads/documents/....//....//etc/passwd",
    ],
)
def test_pokus_o_utek_z_adresare_je_404(client, cesta):
    assert client.get(cesta).status_code == 404


# ---------------------------------------------------------------------------
# Ostatní stahovací cesty - musí se chovat stejně
# ---------------------------------------------------------------------------


def _zavod(db):
    zavod = models.Race(
        race_nr="JMLP2026-11",
        datum="2026-03-01",
        season_id=2025,
        closed=False,
        registration=True,
        race_method_id=1,
    )
    db.add(zavod)
    db.commit()
    db.refresh(zavod)
    return zavod


def test_propozice_zavodu_se_stahuji_pod_svym_nazvem(client, db):
    zavod = _zavod(db)
    soubor = _soubor(db, original="JMLP2026-11_propozice.pdf")
    attachment_service.attach(
        db,
        file_id=soubor.id,
        owner_type=AttachmentOwner.race.value,
        owner_id=zavod.id,
        role=AttachmentRole.propozice.value,
    )

    odpoved = client.get(f"/races/{zavod.id}/proposition")

    assert odpoved.status_code == 200
    assert _nazev_z_hlavicky(odpoved) == "JMLP2026-11_propozice.pdf"


def test_soubor_z_knihovny_se_stahuje_pod_svym_nazvem(client, db, admin_headers):
    soubor = _soubor(db, original="Pokyny pro pořadatele.pdf")

    odpoved = client.get(f"/api/admin/files/{soubor.id}/download", headers=admin_headers)

    assert odpoved.status_code == 200
    assert _nazev_z_hlavicky(odpoved) == "Pokyny pro pořadatele.pdf"
