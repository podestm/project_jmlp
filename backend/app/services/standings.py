"""Pořadí Jihomoravského lyžařského poháru - průběžné i celkové výsledky.

Soutěžní řád JmLP (část F - Hodnocení):

1. Do celkového hodnocení se započítá součet nejlepších bodů za umístění
   z 1 přípravného závodu a 3 závodů na sněhu.
2. Při shodě bodů rozhoduje postupně
   - počet lepších umístění v hodnocených (započtených) závodech na sněhu,
   - počet lepších umístění ve všech závodech na sněhu,
   - součet bodů ze všech závodů,
   - umístění ve finálovém závodě;
   když se neliší ani to, dělí se o místo.
3. Body z přípravného závodu se započítají jen tomu, kdo se zúčastnil
   alespoň jednoho závodu na sněhu.

Kdo zatím na sněhu nezávodil, místo v pořadí nemá: vypíše se na konci
kategorie bez pořadí. Průběžné pořadí u něj ukazuje body, které by se mu
započetly, celkové výsledky (po sezóně) už ne. V celkových výsledcích navíc
nemá místo ani ten, kdo na sněhu startoval, ale nezískal žádný bod. Tak to
dělalo pořadí, které pro JmLP vydával LIP (jeho podobu kopíruje
frontend/src/pdf/liza/standings.js); ověřeno na jeho průběžném pořadí
z 28. 1. a 23. 2. 2026 a celkových výsledcích sezóny 2025-26.

Pořadí a body v jednotlivých závodech počítá services/results.py stejně jako
pro výsledkovou listinu závodu, takže se pohár s listinami nemůže rozejít.
"""
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, Iterable, List, Optional, Sequence

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from .. import models
from ..utils import category_display_sql, convert_utf8_field, fix_encoding
from . import category_order as category_order_service
from . import results as results_service

PREP = "P"     # přípravný (suchý) závod
SNOW = "S"     # závod na sněhu
FINAL = "F"    # finálový závod (na sněhu)

COUNTED_PREP = 1
COUNTED_SNOW = 3

# race_method_id v tabulce závodů: 1 = na sněhu, 2 = suchý (přípravný)
RACE_METHOD_PREP = 2

_WORST = 10 ** 6


@dataclass(frozen=True)
class SeasonRace:
    """Závod sezóny jako sloupec pořadí."""
    id: int
    kind: str
    datum: date

    @property
    def code(self) -> str:
        """Záhlaví sloupce jako v pořadí LIP: P04.10, S17.01, F01.03."""
        return f"{self.kind}{self.datum:%d.%m}"

    @property
    def on_snow(self) -> bool:
        return self.kind in (SNOW, FINAL)


@dataclass
class RaceResult:
    """Výsledek jednoho závodníka v jednom závodě."""
    race: SeasonRace
    rank: Optional[int]
    points: int
    status: Optional[str]           # 'DSQ' | 'DNF' | None
    counted: bool = False

    @property
    def started(self) -> bool:
        """Zúčastnil se - doběhl, nebo vypadl až na trati (DSQ, DNF)."""
        return self.rank is not None or self.status in ("DSQ", "DNF")

    @property
    def label(self) -> str:
        return f"{self.rank}/{self.points}" if self.rank is not None else (self.status or "")


@dataclass
class StandingRow:
    """Řádek pořadí - jeden závodník v jedné kategorii."""
    key: Any
    surname: str
    name: str
    year: Optional[int]
    club: Optional[str]
    results: List[RaceResult] = field(default_factory=list)
    prep_points: int = 0
    snow_points: int = 0
    total: int = 0
    rank: Optional[int] = None

    @property
    def raced_on_snow(self) -> bool:
        """Zúčastnil se aspoň jednoho závodu na sněhu (i DSQ a DNF)."""
        return any(result.race.on_snow and result.started for result in self.results)

    def classified(self, final: bool = False) -> bool:
        """Má místo v pořadí. V celkových výsledcích jen s nějakým bodem."""
        return self.raced_on_snow and (self.total > 0 or not final)


def _best(results: Iterable[RaceResult], count: int) -> List[RaceResult]:
    """Nejlepší výsledky podle bodů; při shodě bodů ten dřívější.

    Počítá se i DSQ a DNF (0 bodů), když závodník víc výsledků nemá - LIP je
    v pořadí podbarvoval jako započtené a na součtu to nic nemění.
    """
    scoring = [result for result in results if result.points > 0 or result.started]
    scoring.sort(key=lambda result: (-result.points, result.race.datum, result.race.id))
    return scoring[:count]


def score_row(row: StandingRow) -> StandingRow:
    """Označí započtené výsledky a sečte body (přípravné, sníh, započtené)."""
    for result in row.results:
        result.counted = False
    prep = [result for result in row.results if not result.race.on_snow]
    snow = [result for result in row.results if result.race.on_snow]

    counted = _best(prep, COUNTED_PREP) + _best(snow, COUNTED_SNOW)
    for result in counted:
        result.counted = True

    row.prep_points = sum(result.points for result in prep)
    row.snow_points = sum(result.points for result in snow)
    row.total = sum(result.points for result in counted)
    return row


def _placings(results: Iterable[RaceResult], width: int) -> tuple:
    """Umístění od nejlepšího; chybějící doplní nejhorší hodnota.

    Porovnání takových n-tic je "počet lepších umístění" ze soutěžního řádu:
    rozhoduje lepší nejlepší umístění, při shodě druhé nejlepší atd. a kdo
    má umístění méně, je na tom hůř.
    """
    ranks = sorted(result.rank for result in results if result.rank is not None)
    return tuple(ranks[:width]) + (_WORST,) * max(0, width - len(ranks))


def _tie_break_key(row: StandingRow, width: int) -> tuple:
    snow = [result for result in row.results if result.race.on_snow]
    final_ranks = [result.rank for result in snow if result.race.kind == FINAL and result.rank is not None]
    return (
        -row.total,
        _placings((result for result in snow if result.counted), width),
        _placings(snow, width),
        -(row.prep_points + row.snow_points),
        min(final_ranks) if final_ranks else _WORST,
    )


def rank_rows(rows: Sequence[StandingRow], final: bool = False) -> List[StandingRow]:
    """Seřadí kategorii a přidělí místa.

    Nejdřív klasifikovaní podle bodů a pravidel pro shodu, plná shoda dělí
    místo (1., 2., 2., 4.). Za nimi bez pořadí: v celkových výsledcích ti, kdo
    na sněhu startovali bez bodu (podle abecedy), a nakonec ti, kdo jeli jen
    přípravné závody (podle bodů, které by se jim započetly).
    """
    for row in rows:
        score_row(row)
    width = max((len(row.results) for row in rows), default=0)
    by_name = lambda row: (row.surname.casefold(), row.name.casefold())  # noqa: E731

    classified = sorted((row for row in rows if row.classified(final)),
                        key=lambda row: (_tie_break_key(row, width), by_name(row)))
    previous_key = None
    for position, row in enumerate(classified, start=1):
        key = _tie_break_key(row, width)
        row.rank = classified[position - 2].rank if key == previous_key else position
        previous_key = key

    unclassified = sorted((row for row in rows if not row.classified(final)),
                          key=lambda row: (not row.raced_on_snow, -row.total, by_name(row)))
    for row in unclassified:
        row.rank = None
    return classified + unclassified


# ---------------------------------------------------------------------------
# Data sezóny z databáze
# ---------------------------------------------------------------------------

def _race_kind(race: models.Race) -> str:
    if race.race_method_id == RACE_METHOD_PREP:
        return PREP
    return FINAL if race.is_final else SNOW


def _load_race_rows(db: Session, race_id: int) -> List[Any]:
    """Řádky startovky závodu bez vyřazených - stejně jako výsledková listina."""
    query = text(f"""
        SELECT sl.id, sl.racer_id, sl.start_number,
               sl.time1, sl.time2, sl.time_sum, sl.dnf, sl.dns, sl.dsq,
               sl.racer_name, sl.racer_surname, sl.racer_year, sl.club_name,
               sl.category_name,
               {category_display_sql('cat')} as category_display_name,
               cat.id as cat_id
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_category cat ON sl.category_id = cat.id
        WHERE sl.race_id = :race_id
          AND sl.excluded = 0
    """)
    return list(db.execute(query, {"race_id": race_id}).fetchall())


def _clean(value: Optional[str]) -> str:
    return fix_encoding(value).strip() if value else ""


def _areal_names(db: Session, races: Sequence[models.Race]) -> Dict[int, str]:
    """Názvy areálů pro seznam zpracovaných závodů pod pořadím."""
    ids = sorted({race.areal_id for race in races if race.areal_id})
    if not ids:
        return {}
    rows = db.execute(text(f"""
        SELECT id, {convert_utf8_field('name')} as name
        FROM fuj_jmlp_areal WHERE id IN :ids
    """).bindparams(bindparam("ids", expanding=True)), {"ids": ids}).fetchall()
    return {row.id: fix_encoding(row.name) for row in rows if row.name}


def season_label(year_start: int) -> str:
    """Sezóna 2025 -> "2025-26" jako v záhlaví pořadí."""
    return f"{year_start}-{(year_start + 1) % 100:02d}"


def season_standings(
    db: Session, season_id: int, final: bool = False, today: Optional[date] = None
) -> Dict[str, Any]:
    """Pořadí poháru za sezónu po kategoriích (final = celkové výsledky).

    Sloupec dostane každý závod sezóny, který už má v aplikaci výsledky.
    Závody, které už proběhly, ale výsledky v aplikaci nemají (měřené jen
    v LiZe), se vrátí zvlášť - pořadí bez nich není úplné a obrazovka na to
    musí upozornit.
    """
    today = today or date.today()
    races = (db.query(models.Race)
             .filter(models.Race.season_id == season_id)
             .order_by(models.Race.datum, models.Race.id)
             .all())

    columns: List[SeasonRace] = []
    missing: List[Dict[str, Any]] = []
    # (kategorie, závodník) -> řádek
    rows: Dict[tuple, StandingRow] = {}
    category_names: Dict[int, str] = {}
    last_race_with_results: Optional[models.Race] = None

    for race in races:
        season_race = SeasonRace(id=race.id, kind=_race_kind(race), datum=race.datum)
        race_rows = _load_race_rows(db, race.id)

        by_category: Dict[int, List[Any]] = {}
        for row in race_rows:
            by_category.setdefault(row.cat_id or 0, []).append(row)

        results_found = False
        for cat_id, category_rows in by_category.items():
            for ranked in results_service.rank_category(category_rows):
                if ranked.rank is None and ranked.status not in ("DSQ", "DNF"):
                    continue        # bez výsledku (nestartoval, DNS)
                results_found = True
                source = ranked.row
                category_names[cat_id] = (
                    source.category_display_name or _clean(source.category_name) or "Bez kategorie"
                )
                key = (cat_id, source.racer_id or f"entry-{source.id}")
                standing = rows.get(key)
                if standing is None:
                    standing = rows[key] = StandingRow(
                        key=key, surname="", name="", year=None, club=None)
                # Jméno a klub z posledního závodu - závody jdou podle data.
                standing.surname = _clean(source.racer_surname)
                standing.name = _clean(source.racer_name)
                standing.year = source.racer_year
                standing.club = _clean(source.club_name) or None
                standing.results.append(RaceResult(
                    race=season_race, rank=ranked.rank, points=ranked.points, status=ranked.status))

        if results_found:
            columns.append(season_race)
            last_race_with_results = race
        elif race.datum and race.datum <= today:
            missing.append({"id": race.id, "race_nr": race.race_nr, "datum": race.datum.isoformat()})

    rank_map = (category_order_service.category_rank_map(last_race_with_results, db)
                if last_race_with_results else {})
    grouped: Dict[int, List[StandingRow]] = {}
    for (cat_id, _), standing in rows.items():
        grouped.setdefault(cat_id, []).append(standing)

    categories = []
    for cat_id in sorted(grouped, key=lambda cid: (rank_map.get(cid, _WORST), category_names.get(cid, ""))):
        ranked_rows = rank_rows(grouped[cat_id], final=final)
        categories.append({
            "category_id": cat_id,
            "name": category_names.get(cat_id, "Bez kategorie"),
            "rows": [_serialize_row(row, columns) for row in ranked_rows],
        })

    season = db.query(models.Season).filter(models.Season.year_start == season_id).first()
    by_id = {race.id: race for race in races}
    areals = _areal_names(db, [by_id[column.id] for column in columns])
    return {
        "season_id": season_id,
        "final": final,
        "season_label": season_label(season_id),
        "cup_name": (season.name if season and season.name else "Jihomoravský lyžařský pohár"),
        "races": [{"id": race.id, "code": race.code, "kind": race.kind, "datum": race.datum.isoformat(),
                   "race_nr": by_id[race.id].race_nr,
                   "areal_name": areals.get(by_id[race.id].areal_id)}
                  for race in columns],
        "races_without_results": missing,
        "categories": categories,
    }


def _serialize_row(row: StandingRow, columns: Sequence[SeasonRace]) -> Dict[str, Any]:
    by_race = {result.race.id: result for result in row.results}
    cells = []
    for race in columns:
        result = by_race.get(race.id)
        cells.append(None if result is None else {
            "text": result.label,
            "counted": result.counted,
            "kind": race.kind,
        })
    return {
        "rank": row.rank,
        "surname": row.surname,
        "name": row.name,
        "year": row.year,
        "club": row.club,
        "cells": cells,
        "prep_points": row.prep_points,
        "snow_points": row.snow_points,
        "total": row.total,
        "raced_on_snow": row.raced_on_snow,
    }
