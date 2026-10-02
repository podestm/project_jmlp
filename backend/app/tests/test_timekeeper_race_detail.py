"""Hlavičkové údaje závodu - app/routers/timekeeper/races.py.

Údaje o kolech (stavitel trati, branky, čas startu) se ukládají pro obě kola
a závod si nikde nedrží, na kolik kol se jede: jedna kategorie může jet obě
kola a jiná jen jedno. Listina se proto řídí naměřenými daty a do hlavičky se
tiskne jen to kolo, které je vyplněné (viz frontend/src/pdf/resultsPdf.js).
"""
from datetime import date

import pytest

from app import models
from app.utils import get_current_season_id

AKTUALNI_SEZONA = get_current_season_id()


@pytest.fixture
def zavod(db):
    zavod = models.Race(
        race_nr="JMLP2026-03",
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


def _uloz(client, zavod, hlavicky, telo):
    odpoved = client.put(f"/api/timekeeper/races/{zavod.id}/detail",
                         json=telo, headers=hlavicky)
    assert odpoved.status_code == 200, odpoved.text
    return odpoved.json()


def test_ulozi_udaje_obou_kol(client, zavod, timekeeper_headers):
    ulozeno = _uloz(client, zavod, timekeeper_headers, {
        "race_director": "Jan Ředitel",
        "runs": [
            {"run_number": 1, "course_setter": "Stavitel A", "gates_count": 12},
            {"run_number": 2, "course_setter": "Stavitel B", "gates_count": 14},
        ],
    })

    assert ulozeno["race_director"] == "Jan Ředitel"
    assert [kolo["run_number"] for kolo in ulozeno["runs"]] == [1, 2]
    assert ulozeno["runs"][1]["course_setter"] == "Stavitel B"


def test_druhe_kolo_zustane_ulozene_i_po_dalsim_ulozeni(client, zavod, timekeeper_headers):
    """Dřív se kolo nad rámec "počtu kol" mazalo - a počet kol už se nenastavuje."""
    _uloz(client, zavod, timekeeper_headers, {
        "runs": [
            {"run_number": 1, "course_setter": "Stavitel A"},
            {"run_number": 2, "course_setter": "Stavitel B"},
        ],
    })

    ulozeno = _uloz(client, zavod, timekeeper_headers, {"chief_timekeeper": "Karel Čas"})

    assert [kolo["run_number"] for kolo in ulozeno["runs"]] == [1, 2]
    assert ulozeno["runs"][1]["course_setter"] == "Stavitel B"


def test_pocet_kol_se_zavodu_nenastavuje(client, zavod, timekeeper_headers):
    """Starší klient může run_count ještě posílat - musí se tiše ignorovat."""
    ulozeno = _uloz(client, zavod, timekeeper_headers, {
        "run_count": 1,
        "runs": [
            {"run_number": 1, "course_setter": "Stavitel A"},
            {"run_number": 2, "course_setter": "Stavitel B"},
        ],
    })

    assert "run_count" not in ulozeno
    assert [kolo["run_number"] for kolo in ulozeno["runs"]] == [1, 2]


def test_detail_neexistujiciho_zavodu_vrati_404(client, timekeeper_headers):
    odpoved = client.get("/api/timekeeper/races/9999/detail", headers=timekeeper_headers)

    assert odpoved.status_code == 404
    assert odpoved.json()["detail"] == "Závod nenalezen"


def test_detail_nese_obrazek_sponzoru(client, db, zavod, timekeeper_headers):
    """Výsledková listina tiskne pod posledním řádkem pruh sponzorů nahraný u závodu."""
    bez = client.get(f"/api/timekeeper/races/{zavod.id}/detail", headers=timekeeper_headers).json()
    assert bez["sponsors_url"] is None

    soubor = models.File(
        filename="sponzori-abc.png", original_filename="sponzori.png",
        file_path="uploads/documents/sponzori-abc.png", file_size=10,
        mime_type="image/png", file_type=models.FileTypeEnum.image,
    )
    db.add(soubor)
    db.commit()
    db.add(models.Attachment(file_id=soubor.id, owner_type="race", owner_id=zavod.id,
                             role="sponzori", published=True, sort_order=0))
    db.commit()

    detail = client.get(f"/api/timekeeper/races/{zavod.id}/detail", headers=timekeeper_headers).json()
    assert detail["sponsors_url"] == "/uploads/documents/sponzori-abc.png"
