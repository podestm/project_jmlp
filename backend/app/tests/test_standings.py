"""Pořadí poháru - app/services/standings.py a /api/timekeeper/seasons/{id}/standings.

Výpočet je ověřený i proti pořadí, které pro JmLP vydával LIP (průběžné
28. 1. a 23. 2. 2026, celkové výsledky 2025-26): započtené body, součty i to,
kdo má a nemá místo, sedí na všech řádcích. Liší se jen pořadí při shodě
bodů, kde se teď postupuje podle soutěžního řádu (LIP to řešil jinak).
"""
from datetime import date
from pathlib import Path

import pytest

from app import models
from app.models import AttachmentOwner, AttachmentRole
from app.services.standings import (
    FINAL, PREP, SNOW, RaceResult, SeasonRace, StandingRow, rank_rows,
)

P1 = SeasonRace(id=1, kind=PREP, datum=date(2025, 10, 4))
P2 = SeasonRace(id=2, kind=PREP, datum=date(2025, 10, 11))
S1 = SeasonRace(id=3, kind=SNOW, datum=date(2026, 1, 17))
S2 = SeasonRace(id=4, kind=SNOW, datum=date(2026, 2, 7))
S3 = SeasonRace(id=5, kind=SNOW, datum=date(2026, 2, 8))
S4 = SeasonRace(id=6, kind=SNOW, datum=date(2026, 2, 21))
F1 = SeasonRace(id=7, kind=FINAL, datum=date(2026, 3, 1))


def _vysledek(race, rank=None, points=0, status=None):
    return RaceResult(race=race, rank=rank, points=points, status=status)


def _radek(jmeno, *vysledky):
    return StandingRow(key=jmeno, surname=jmeno, name="", year=2018, club=None, results=list(vysledky))


def _podle_jmena(radky):
    return {radek.surname: radek for radek in radky}


# --------------------------------------------------------------------------
# Započtené body
# --------------------------------------------------------------------------

def test_zapocte_nejlepsi_pripravny_a_tri_nejlepsi_na_snehu():
    radek = _radek(
        "Keznikl",
        _vysledek(P1, 1, 100), _vysledek(P2, 1, 100),
        _vysledek(S1, 4, 50), _vysledek(S2, 3, 60), _vysledek(S3, 2, 80), _vysledek(S4, 9, 29),
    )
    rank_rows([radek])

    assert (radek.prep_points, radek.snow_points, radek.total) == (200, 219, 290)
    # Při shodě bodů se započte dřívější závod.
    assert [v.counted for v in radek.results] == [True, False, True, True, True, False]


def test_pripravne_body_se_pocitaji_az_s_ucasti_na_snehu():
    jen_pripravne = _radek("Holop", _vysledek(P1, 2, 80), _vysledek(P2, 1, 100))
    se_snehem = _radek("Procházka", _vysledek(P1, 2, 80), _vysledek(S1, 8, 32))

    radky = _podle_jmena(rank_rows([jen_pripravne, se_snehem]))

    assert radky["Procházka"].rank == 1 and radky["Procházka"].total == 112
    # Bez závodu na sněhu nemá místo; průběžné pořadí ukáže body, které by se mu započetly.
    assert radky["Holop"].rank is None
    assert radky["Holop"].total == 100


def test_dsq_na_snehu_je_ucast_a_podbarvi_se_jako_zapocteny():
    radek = _radek("Švihálek", _vysledek(S1, status="DSQ"))

    rank_rows([radek])

    assert radek.rank == 1 and radek.total == 0
    assert radek.results[0].counted


def test_celkove_vysledky_bez_bodu_nedavaji_misto():
    s_body = _radek("Kubrický", _vysledek(F1, 15, 16))
    jen_dsq = _radek("Svoboda", _vysledek(F1, status="DSQ"))
    jen_pripravne = _radek("Ptáčník", _vysledek(P1, 4, 50))

    poradi = rank_rows([jen_pripravne, jen_dsq, s_body], final=True)

    assert [(r.surname, r.rank) for r in poradi] == [("Kubrický", 1), ("Svoboda", None), ("Ptáčník", None)]


# --------------------------------------------------------------------------
# Shoda bodů - soutěžní řád, část F.2
# --------------------------------------------------------------------------

def test_shoda_rozhoduje_lepsi_umisteni_v_zapoctenych_zavodech_na_snehu():
    # Skutečný případ z průběžného pořadí 23. 2. 2026: obě mají 54 bodů.
    # Junová byla na sněhu 8., Matoušková nejlépe 15. -> Junová je před ní.
    matouskova = _radek("Matoušková", _vysledek(P2, 11, 24), _vysledek(S2, 17, 14), _vysledek(S3, 15, 16))
    junova = _radek("Junová", _vysledek(P1, 12, 22), _vysledek(S2, 8, 32))

    poradi = rank_rows([matouskova, junova])

    assert [(r.surname, r.rank, r.total) for r in poradi] == [("Junová", 1, 54), ("Matoušková", 2, 54)]


def test_shoda_pak_umisteni_ve_vsech_zavodech_na_snehu():
    # Započtené výsledky stejné, rozhodne čtvrtý (nezapočtený) závod na sněhu.
    lepsi = _radek("Lepší", _vysledek(S1, 1, 100), _vysledek(S2, 1, 100), _vysledek(S3, 1, 100), _vysledek(S4, 5, 45))
    horsi = _radek("Horší", _vysledek(S1, 1, 100), _vysledek(S2, 1, 100), _vysledek(S3, 1, 100), _vysledek(S4, 9, 29))

    assert [r.surname for r in rank_rows([horsi, lepsi])] == ["Lepší", "Horší"]


def test_shoda_pak_soucet_bodu_ze_vsech_zavodu():
    vic = _radek("Víc", _vysledek(P1, 1, 100), _vysledek(P2, 2, 80), _vysledek(S1, 2, 80))
    min_ = _radek("Míň", _vysledek(P1, 1, 100), _vysledek(S1, 2, 80))

    assert [r.surname for r in rank_rows([min_, vic])] == ["Víc", "Míň"]


def test_shoda_pak_umisteni_ve_finale():
    finale_lepsi = _radek("Finále", _vysledek(S1, 3, 60), _vysledek(F1, 3, 60))
    finale_horsi = _radek("Bez", _vysledek(F1, 3, 60), _vysledek(S1, 3, 60))
    # Úplně stejné výsledky -> dělené místo.
    assert [r.rank for r in rank_rows([finale_lepsi, finale_horsi])] == [1, 1]

    prvni = _radek("Prvni", _vysledek(S1, 2, 80), _vysledek(F1, 5, 45))
    druhy = _radek("Druhy", _vysledek(S1, 5, 45), _vysledek(F1, 2, 80))
    # Stejné body i umístění na sněhu (2. a 5.) -> rozhodne finále.
    assert [(r.surname, r.rank) for r in rank_rows([prvni, druhy])] == [("Druhy", 1), ("Prvni", 2)]


def test_uplna_shoda_deli_misto_a_dalsi_se_preskoci():
    a = _radek("A", _vysledek(S1, 2, 80))
    b = _radek("B", _vysledek(S2, 2, 80))
    c = _radek("C", _vysledek(S1, 4, 50))

    assert [(r.surname, r.rank) for r in rank_rows([c, b, a])] == [("A", 1), ("B", 1), ("C", 3)]


# --------------------------------------------------------------------------
# API časomíry
# --------------------------------------------------------------------------

@pytest.fixture
def sezona(db):
    sezona = models.Season(year_start=2031, year_end=2032, edition=25, name="Jihomoravský lyžařský pohár")
    db.add(sezona)
    db.commit()
    return sezona


@pytest.fixture
def kategorie(db):
    kategorie = models.Category(
        name="U10", display_name="Přípravka dívky",
        min_birth_year=2022, max_birth_year=2024, sex=2, active=True,
    )
    db.add(kategorie)
    db.commit()
    db.refresh(kategorie)
    return kategorie


def _zavod(db, nr, datum, method):
    zavod = models.Race(race_nr=nr, datum=datum, season_id=2031, closed=False,
                        registration=False, race_method_id=method, is_live=False)
    db.add(zavod)
    db.commit()
    db.refresh(zavod)
    return zavod


def _zavodnik(db, name, surname):
    zavodnik = models.Racer(name=name, surname=surname, year=2023, sex=2)
    db.add(zavodnik)
    db.commit()
    db.refresh(zavodnik)
    return zavodnik


def _start(db, zavod, zavodnik, kategorie, number, time=None, dsq=False):
    db.add(models.StartListEntry(
        race_id=zavod.id, racer_id=zavodnik.id, category_id=kategorie.id, start_number=number,
        racer_name=zavodnik.name, racer_surname=zavodnik.surname, racer_year=zavodnik.year,
        racer_sex=2, club_name="Ski klub", category_name=kategorie.display_name, category_sex=2,
        time1=time, time_sum=time, dsq=dsq,
    ))
    db.commit()


@pytest.fixture
def sezona_s_vysledky(db, sezona, kategorie):
    pripravny = _zavod(db, "JMLP2031-01", date(2031, 10, 4), method=2)
    snih = _zavod(db, "JMLP2031-02", date(2032, 1, 17), method=1)
    _zavod(db, "JMLP2031-03", date(2032, 1, 24), method=1)   # proběhl, výsledky jen v LiZe
    _zavod(db, "JMLP2031-04", date(2032, 3, 1), method=1)    # teprve bude

    anna, bara, cilka = _zavodnik(db, "Anna", "Adamová"), _zavodnik(db, "Bára", "Bílá"), _zavodnik(db, "Cilka", "Cejpková")
    _start(db, pripravny, anna, kategorie, 1, time=30.0)
    _start(db, pripravny, bara, kategorie, 2, time=31.0)
    _start(db, pripravny, cilka, kategorie, 3, time=29.0)
    _start(db, snih, anna, kategorie, 1, time=40.0)
    _start(db, snih, bara, kategorie, 2, dsq=True)
    return pripravny, snih


def test_api_vrati_poradi_po_kategoriich(client, timekeeper_headers, sezona_s_vysledky, monkeypatch):
    import app.services.standings as standings_service
    monkeypatch.setattr(standings_service, "date", type("D", (), {"today": staticmethod(lambda: date(2032, 2, 1))}))

    odpoved = client.get("/api/timekeeper/seasons/2031/standings", headers=timekeeper_headers)

    assert odpoved.status_code == 200
    data = odpoved.json()
    assert data["season_label"] == "2031-32"
    assert [race["code"] for race in data["races"]] == ["P04.10", "S17.01"]
    assert [race["race_nr"] for race in data["races_without_results"]] == ["JMLP2031-03"]

    radky = data["categories"][0]["rows"]
    assert data["categories"][0]["name"] == "Přípravka dívky"
    assert [(r["surname"], r["rank"], r["total"]) for r in radky] == [
        ("Adamová", 1, 180),        # 2/80 + 1/100
        ("Bílá", 2, 60),            # 3/60 + DSQ na sněhu
        ("Cejpková", None, 100),    # jen přípravný závod - bez místa
    ]
    assert radky[0]["cells"] == [
        {"text": "2/80", "counted": True, "kind": "P"},
        {"text": "1/100", "counted": True, "kind": "S"},
    ]
    assert radky[1]["cells"][1] == {"text": "DSQ", "counted": True, "kind": "S"}


def test_api_celkove_vysledky(client, timekeeper_headers, sezona_s_vysledky):
    data = client.get("/api/timekeeper/seasons/2031/standings?final=true", headers=timekeeper_headers).json()

    assert data["final"] is True
    assert [(r["surname"], r["rank"]) for r in data["categories"][0]["rows"]] == [
        ("Adamová", 1), ("Bílá", 2), ("Cejpková", None),
    ]


def test_neznama_sezona_vrati_404(client, timekeeper_headers):
    assert client.get("/api/timekeeper/seasons/1999/standings", headers=timekeeper_headers).status_code == 404


def test_zverejneni_nahradi_dosavadni_vysledky_sezony(client, db, timekeeper_headers, sezona):
    vytvorene = []
    try:
        def zverejnit(final):
            odpoved = client.post(
                f"/api/timekeeper/seasons/2031/standings/publish?final={str(final).lower()}",
                headers=timekeeper_headers,
                files={"file": ("poradi.pdf", b"%PDF-1.4 poradi", "application/pdf")},
            )
            assert odpoved.status_code == 200, odpoved.text
            file_id = odpoved.json()["file_id"]
            soubor = db.query(models.File).filter(models.File.id == file_id).one()
            vytvorene.append(Path(soubor.file_path))
            return file_id

        def prilohy_sezony():
            db.expire_all()
            return [(p.role, p.file_id, p.published) for p in db.query(models.Attachment).filter(
                models.Attachment.owner_type == AttachmentOwner.season.value,
                models.Attachment.owner_id == 2031,
            ).all()]

        prubezne_id = zverejnit(final=False)
        assert prilohy_sezony() == [(AttachmentRole.prubezne.value, prubezne_id, True)]

        celkove_id = zverejnit(final=True)
        assert prilohy_sezony() == [(AttachmentRole.vysledky.value, celkove_id, True)]
        # Dřívější vygenerované pořadí se smaže i s diskem.
        assert db.query(models.File).filter(models.File.id == prubezne_id).first() is None
        assert not vytvorene[0].exists()
    finally:
        for cesta in vytvorene:
            cesta.unlink(missing_ok=True)


# --------------------------------------------------------------------------
# Finálový závod
# --------------------------------------------------------------------------

def test_finale_se_oznaci_v_administraci_a_v_poradi_je_sloupec_f(client, db, admin_headers, timekeeper_headers, sezona, kategorie):
    odpoved = client.post("/api/admin/races", headers=admin_headers, json={
        "datum": "2032-03-01", "race_nr": "JMLP2031-05", "season_id": 2031,
        "race_method_id": 1, "is_final": True, "registration": False,
    })
    assert odpoved.status_code == 200, odpoved.text
    finale = odpoved.json()
    assert finale["is_final"] is True

    zavodnik = _zavodnik(db, "Dana", "Dlouhá")
    zavod = db.query(models.Race).filter(models.Race.id == finale["id"]).one()
    _start(db, zavod, zavodnik, kategorie, 1, time=50.0)

    data = client.get("/api/timekeeper/seasons/2031/standings", headers=timekeeper_headers).json()
    assert [race["code"] for race in data["races"]] == ["F01.03"]
    assert data["categories"][0]["rows"][0]["cells"] == [{"text": "1/100", "counted": True, "kind": "F"}]

    seznam = client.get("/api/admin/races", headers=admin_headers).json()
    assert next(r for r in seznam if r["id"] == finale["id"])["is_final"] is True


def test_suchy_zavod_finalem_byt_nemuze(client, admin_headers, sezona):
    vytvoreny = client.post("/api/admin/races", headers=admin_headers, json={
        "datum": "2031-10-04", "race_nr": "JMLP2031-01", "season_id": 2031,
        "race_method_id": 2, "is_final": True, "registration": False,
    }).json()
    assert vytvoreny["is_final"] is False

    na_snehu = client.post("/api/admin/races", headers=admin_headers, json={
        "datum": "2032-03-01", "race_nr": "JMLP2031-05", "season_id": 2031,
        "race_method_id": 1, "is_final": True, "registration": False,
    }).json()
    # Přepnutí finále na suchý závod finále zruší.
    upraveny = client.put(f"/api/admin/races/{na_snehu['id']}", headers=admin_headers,
                          json={"race_method_id": 2}).json()
    assert upraveny["is_final"] is False
