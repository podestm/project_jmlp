"""Výsledky ve formátu FIS XML pro evidenci SLČR.

Tvar odpovídá exportu evidence (/api/public/export/result/race/{id}.xml):
Raceheader, AL_raceinfo, AL_classified s AL_ranked Status="QLF",
AL_notclassified s DNF/DNS/DSQ bez časů.
"""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from xml.etree import ElementTree as ET

from app.services import fis_xml
from app.services.results import rank_category


def _row(id, surname, time1=None, time2=None, dnf=False, dns=False, dsq=False, **extra):
    t1 = Decimal(str(time1)) if time1 is not None else None
    t2 = Decimal(str(time2)) if time2 is not None else None
    total = None if (dnf or dns or dsq) else (t1 + t2 if t1 is not None and t2 is not None else (t1 or t2))
    data = dict(id=id, start_number=id, race_number_actual=id + 100, racer_surname=surname, racer_name="Anna",
                racer_year=2017, racer_sex=2, club_name="SK Test", slcr_id="891586",
                time1=t1, time2=t2, time_sum=total, dnf=dnf, dns=dns, dsq=dsq)
    data.update(extra)
    return SimpleNamespace(**data)


def _header():
    return fis_xml.RaceHeader(race_date=date(2026, 10, 3), event_name="JMLP Brno - Kohoutovice",
                              place="Brno - Kohoutovice", discipline="SL",
                              race_director="Markéta Slováčková", technical_delegate="Roman Keznikl")


def test_casy_ve_formatu_evidence():
    assert fis_xml.format_fis_time(Decimal("29.2")) == "29.20"
    assert fis_xml.format_fis_time(Decimal("85.1")) == "1:25.10"
    assert fis_xml.format_fis_time(Decimal("125.05")) == "2:05.05"
    assert fis_xml.format_fis_time(None) == "0.00"


def test_sezona_fis_podle_konce():
    assert fis_xml.fis_season(date(2026, 10, 3)) == 2027
    assert fis_xml.fis_season(date(2027, 2, 7)) == 2027


def test_zavod_jedne_kategorie():
    rows = [_row(1, "Pomala", 31.5, 32.0), _row(2, "Rychla", 30.0, 30.1),
            _row(3, "Vypadla", 29.0, dnf=True), _row(4, "Bez", slcr_id="-"), _row(5, "Disk", 28.0, dsq=True)]
    xml = fis_xml.build_race_xml(_header(), fis_xml.CategoryResults("Přípravka dívky", 2, rank_category(rows), codex="8"))

    assert xml.startswith(b'<?xml version="1.0" encoding="utf-8"?>')
    root = ET.fromstring(xml)
    header = root.find("Raceheader")
    assert header.attrib == {"Sector": "AL", "Gender": "W"}
    assert [child.tag for child in header][:3] == ["Season", "Codex", "Nation"]
    assert [header.findtext(t) for t in ("Season", "Codex", "Nation", "Discipline", "Category", "Type")] == \
        ["2027", "8", "CZE", "SL", "Přípravka dívky", "official"]
    assert [header.findtext(f"Racedate/{t}") for t in ("Day", "Month", "Year")] == ["3", "10", "2026"]
    jury = {j.get("Function"): (j.findtext("Lastname"), j.findtext("Firstname")) for j in root.iter("Jury")}
    assert jury == {"TechnicalDelegate": ("Keznikl", "Roman"), "RaceDirector": ("Slováčková", "Markéta")}

    ranked = root.findall("AL_race/AL_classified/AL_ranked")
    assert [(r.findtext("Rank"), r.findtext("Competitor/Lastname")) for r in ranked] == [("1", "Rychla"), ("2", "Pomala")]
    first = ranked[0]
    assert first.get("Status") == "QLF"
    assert first.findtext("Bib") == "102"
    assert first.findtext("Competitor/Fiscode") == "891586"
    assert first.findtext("Competitor/Gender") == "W"
    assert [first.findtext(f"AL_result/{t}") for t in ("Timerun1", "Timerun2", "Totaltime")] == ["30.00", "30.10", "1:00.10"]

    not_ranked = root.findall("AL_race/AL_notclassified/AL_notranked")
    assert [(n.get("Status"), n.findtext("Competitor/Lastname")) for n in not_ranked] == [("DSQ", "Disk"), ("DNF", "Vypadla")]
    assert not_ranked[0].find("AL_result") is not None and len(not_ranked[0].find("AL_result")) == 0
    # Kdo ještě nejel (bez času i příznaku), ve výsledcích není.
    assert "Bez" not in xml.decode()


def test_kategorie_bez_nedokoncenych_ma_prazdny_blok_jako_evidence():
    xml = fis_xml.build_race_xml(_header(), fis_xml.CategoryResults("Junioři", 1, rank_category([_row(1, "A", 30)])))
    root = ET.fromstring(xml)
    assert root.find("Raceheader").get("Gender") == "M"
    assert [len(n) for n in root.findall("AL_race/AL_notclassified/AL_notranked")] == [0]
