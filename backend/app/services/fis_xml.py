"""Výsledky závodu ve formátu FIS XML pro evidenci SLČR.

Evidence SLČR (evidence.czech-ski.com) přijímá výsledky jako FIS XML -
oficiální API pro časomíry (POST /api/v1/timekeeper/racing/department/{d}/
event/{e}/results) i ruční import ve webu. Struktura je převzatá z jejich
vlastního exportu výsledků závodu (/api/public/export/result/race/{id}.xml),
takže to, co odsud vyjde, má stejný tvar jako to, co evidence sama vydává:

    Fisresults
      Raceheader (Sector="AL", Gender="W"|"M")  sezóna, stát, disciplína,
                                                kategorie, datum, akce, místo
      AL_race
        AL_raceinfo     činovníci, časomíra
        AL_classified   AL_ranked Status="QLF": pořadí, startovní číslo,
                        závodník, časy kol a součet
        AL_notclassified  AL_notranked Status="DNF"|"DNS"|"DSQ" bez časů

Jeden <Fisresults> = jeden závod = jedna kategorie (v evidenci má každá
kategorie vlastní závod v rámci akce). Celý závod JMLP jde jako "FIS XML
Dataset": kořenový prvek a v něm jeden <Fisresults> za kategorií - tak ho
evidence načte (ověřeno importem 12. 10. 2026; varianta s několika závody
v jednom <Fisresults> neprojde). Výsledky přiřadí k závodu v akci podle
<Codex> (sloupec "Kodex" u závodu), takže se v evidenci nezakládají závody
navíc. Do <Fiscode> jde české číslo závodníka - při nahrání zvolit
"České číslo závodníka" (athleteCodeType=RACE_CODE).
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from xml.etree import ElementTree as ET

from .results import RankedEntry

NATION = "CZE"
TIMING_BY = "Měřící skupina JMLP"
DATA_PROCESSING_BY = "jmlp.cz"

# Disciplíny FIS pro alpské lyžování. Prázdná = evidence si doplní sama
# (suché závody JMLP vede jako "Trénink", ten FIS kód nemá).
DISCIPLINES = ("SL", "GS", "SG", "DH", "AC", "PSL", "PGS")


@dataclass
class RaceHeader:
    race_date: date
    event_name: str
    place: str
    discipline: str = ""
    race_director: str | None = None
    technical_delegate: str | None = None


@dataclass
class CategoryResults:
    name: str
    sex: int | None  # 1 muži, 2 ženy
    ranked: list[RankedEntry] = field(default_factory=list)
    # Kodex závodu v evidenci (sloupec "Kodex" u závodu). Stálé číslo
    # kategorie - podle něj má import přiřadit soubor k existujícímu závodu
    # místo zakládání nového bez názvu.
    codex: str | None = None


def fis_season(race_date: date) -> int:
    """Sezóna FIS se jmenuje rokem, ve kterém končí (říjen 2026 = 2027)."""
    return race_date.year + 1 if race_date.month >= 7 else race_date.year


def format_fis_time(value) -> str:
    """Čas jako v exportu evidence: 29.20, 1:25.10; bez času 0.00."""
    if value is None:
        return "0.00"
    hundredths = int((Decimal(str(value)) * 100).quantize(Decimal("1")))
    minutes, rest = divmod(hundredths, 6000)
    seconds = f"{rest // 100}.{rest % 100:02d}"
    if minutes:
        return f"{minutes}:{int(rest // 100):02d}.{rest % 100:02d}"
    return seconds


def _gender(sex) -> str:
    return "W" if sex is not None and int(sex) == 2 else "M"


def _race_code(slcr_id) -> str:
    text = (str(slcr_id) if slcr_id is not None else "").strip()
    return text if re.fullmatch(r"\d{5,7}", text) else ""


def _bib(row) -> str:
    bib = getattr(row, "race_number_actual", None)
    if bib is None:
        bib = getattr(row, "start_number", None)
    return "" if bib is None else str(bib)


def _split_name(full_name: str | None) -> tuple[str, str]:
    """ "Markéta Slováčková" -> ("Slováčková", "Markéta")."""
    parts = (full_name or "").split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[-1], " ".join(parts[:-1])


def _sub(parent: ET.Element, tag: str, text: str | None = None, **attrs) -> ET.Element:
    element = ET.SubElement(parent, tag, attrs)
    if text is not None:
        element.text = str(text)
    return element


def _clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _competitor(parent: ET.Element, row, sex) -> None:
    competitor = _sub(parent, "Competitor")
    _sub(competitor, "Fiscode", _race_code(getattr(row, "slcr_id", None)))
    _sub(competitor, "Lastname", _clean(row.racer_surname))
    _sub(competitor, "Firstname", _clean(row.racer_name))
    _sub(competitor, "Gender", _gender(getattr(row, "racer_sex", None) or sex))
    _sub(competitor, "Nation", NATION)
    if getattr(row, "racer_year", None):
        _sub(competitor, "Yearofbirth", str(row.racer_year))
    club = _clean(getattr(row, "club_name", None))
    if club:
        _sub(competitor, "Clubname", club)


XML_DECLARATION = b'<?xml version="1.0" encoding="utf-8"?>\n'
DATASET_ROOT = "Fisresultsdataset"


def build_race_xml(header: RaceHeader, category: CategoryResults) -> bytes:
    """FIS XML jednoho závodu (jedné kategorie)."""
    root = _race_element(header, category)
    ET.indent(root, space="  ")
    return XML_DECLARATION + ET.tostring(root, encoding="utf-8") + b"\n"


def build_dataset_xml(header: RaceHeader, categories: Iterable[CategoryResults]) -> bytes:
    """FIS XML Dataset - všechny kategorie závodu v jednom souboru."""
    root = ET.Element(DATASET_ROOT)
    for category in categories:
        root.append(_race_element(header, category))
    ET.indent(root, space="  ")
    return XML_DECLARATION + ET.tostring(root, encoding="utf-8") + b"\n"


def _race_element(header: RaceHeader, category: CategoryResults) -> ET.Element:
    root = ET.Element("Fisresults")
    race_header = _sub(root, "Raceheader", Sector="AL", Gender=_gender(category.sex))
    _sub(race_header, "Season", str(fis_season(header.race_date)))
    if category.codex:
        _sub(race_header, "Codex", str(category.codex))
    _sub(race_header, "Nation", NATION)
    _sub(race_header, "Discipline", header.discipline or "")
    _sub(race_header, "Category", _clean(category.name))
    _sub(race_header, "Type", "official")
    race_date = _sub(race_header, "Racedate")
    _sub(race_date, "Day", str(header.race_date.day))
    _sub(race_date, "Month", str(header.race_date.month))
    _sub(race_date, "Year", str(header.race_date.year))
    _sub(race_header, "Eventname", _clean(header.event_name))
    _sub(race_header, "Place", _clean(header.place))

    al_race = _sub(root, "AL_race")
    info = _sub(al_race, "AL_raceinfo")
    for function, person in (
        ("TechnicalDelegate", header.technical_delegate),
        ("RaceDirector", header.race_director),
    ):
        if not _clean(person):
            continue
        last, first = _split_name(_clean(person))
        jury = _sub(info, "Jury", Function=function)
        _sub(jury, "Lastname", last)
        _sub(jury, "Firstname", first)
        _sub(jury, "Nation", NATION)
    _sub(info, "Timingby", TIMING_BY)
    _sub(info, "Dataprocessingby", DATA_PROCESSING_BY)

    classified = _sub(al_race, "AL_classified")
    not_classified = _sub(al_race, "AL_notclassified")
    any_not_classified = False
    for item in category.ranked:
        row = item.row
        if item.rank is not None:
            ranked = _sub(classified, "AL_ranked", Status="QLF")
            _sub(ranked, "Rank", str(item.rank))
            _sub(ranked, "Bib", _bib(row))
            _competitor(ranked, row, category.sex)
            result = _sub(ranked, "AL_result")
            _sub(result, "Timerun1", format_fis_time(row.time1))
            _sub(result, "Timerun2", format_fis_time(row.time2))
            _sub(result, "Totaltime", format_fis_time(row.time_sum))
        elif item.status in ("DNF", "DNS", "DSQ"):
            any_not_classified = True
            not_ranked = _sub(not_classified, "AL_notranked", Status=item.status)
            _sub(not_ranked, "Bib", _bib(row))
            _competitor(not_ranked, row, category.sex)
            _sub(not_ranked, "AL_result")
        # Bez času i bez příznaku (ještě nejel) se do výsledků nepíše.
    if not any_not_classified:
        # Evidence ve svém exportu prázdný blok píše takhle.
        _sub(not_classified, "AL_notranked")
    return root


def unfinished_count(categories: Iterable[CategoryResults]) -> int:
    """Kolik startujících nemá čas ani příznak (do XML se nedostanou)."""
    return sum(
        1 for c in categories for item in c.ranked if item.rank is None and item.status is None
    )
