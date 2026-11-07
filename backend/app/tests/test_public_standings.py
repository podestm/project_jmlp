"""Veřejné pořadí poháru - GET /season-results/{season_id}/standings.

Stejná služba jako náhled časomíry (test_standings.py), jen bez přihlášení
a ve tvaru pro stránku Výsledky.
"""

from app import models
from app.models import AttachmentOwner, AttachmentRole
from app.tests.test_standings import kategorie, sezona, sezona_s_vysledky  # noqa: F401 (fixtures)


def test_verejne_poradi_bez_prihlaseni(client, sezona_s_vysledky):
    odpoved = client.get("/season-results/2031/standings")

    assert odpoved.status_code == 200
    data = odpoved.json()
    assert data["season_label"] == "2031/32"
    assert data["edition_label"] == "XXV."
    assert data["final"] is False
    assert data["document"] is None
    assert [race["race_nr"] for race in data["races"]] == ["JMLP2031-01", "JMLP2031-02"]

    radky = data["categories"][0]["rows"]
    assert data["categories"][0]["name"] == "Přípravka dívky"
    assert [(r["surname"], r["rank"], r["total"]) for r in radky] == [
        ("Adamová", 1, 180),
        ("Bílá", 2, 60),
        ("Cejpková", None, 100),
    ]
    assert radky[0]["cells"] == [
        {"rank": 2, "points": 80, "status": None, "counted": True},
        {"rank": 1, "points": 100, "status": None, "counted": True},
    ]
    assert radky[1]["cells"][1] == {"rank": None, "points": 0, "status": "DSQ", "counted": True}
    # Jen to, co stránka potřebuje - žádná interní pole náhledu časomíry.
    assert "raced_on_snow" not in radky[0]


def test_zverejnene_celkove_vysledky_prepnou_na_final(client, db, sezona_s_vysledky):
    soubor = models.File(
        filename="poradi.pdf",
        original_filename="poradi.pdf",
        file_path="uploads/documents/poradi.pdf",
        file_type=models.FileTypeEnum.vysledky,
        file_size=10,
        mime_type="application/pdf",
    )
    db.add(soubor)
    db.commit()
    db.add(
        models.Attachment(
            file_id=soubor.id,
            owner_type=AttachmentOwner.season.value,
            owner_id=2031,
            role=AttachmentRole.vysledky.value,
            published=True,
        )
    )
    db.commit()

    data = client.get("/season-results/2031/standings").json()

    assert data["final"] is True
    assert data["document"] == {"url": "/uploads/documents/poradi.pdf", "final": True}


def test_sezona_bez_zavodu_je_prazdna(client, sezona):
    data = client.get("/season-results/2031/standings").json()
    assert data["categories"] == []
    assert data["races"] == []


def test_neznama_sezona_vrati_404(client):
    assert client.get("/season-results/1999/standings").status_code == 404


def test_stara_adresa_vysledku_sezony_dal_funguje(client, sezona):
    # /{start}/{end} zůstává – nová routa ji nesmí zastínit
    assert client.get("/season-results/2031/2032").status_code == 404
