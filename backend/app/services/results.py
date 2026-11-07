"""Pořadí, body a časy - jediný zdroj pravdy.

Tahle logika byla dřív rozkopírovaná na čtyřech místech (dvakrát řazení
a přidělování pozic v routers/timekeeper/results.py, dvakrát výpočet time_sum
v routers/timekeeper/timing.py), přičemž se navzájem lišila v tom, jak řeší
shodné časy.

Protějšek na klientovi je rankEntriesByTime v
frontend/src/components/timekeeper/ResultsTable.jsx - musí zůstat v souladu,
protože offline se pořadí i body počítají tam.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

# Bodová tabulka Světového poháru FIS pro 1.-30. místo, od 31. místa 0 bodů.
POINTS_TABLE = (
    100,
    80,
    60,
    50,
    45,
    40,
    36,
    32,
    29,
    26,
    24,
    22,
    20,
    18,
    16,
    15,
    14,
    13,
    12,
    11,
    10,
    9,
    8,
    7,
    6,
    5,
    4,
    3,
    2,
    1,
)

# Nedokončivší se řadí na konec kategorie v tomhle pořadí.
# Shodné s STATUS_ORDER v ResultsTable.jsx.
STATUS_ORDER = {"DSQ": 1, "DNF": 2, "DNS": 3}

_NO_STATUS = 99
_NO_START_NUMBER = 10**9


@dataclass(frozen=True)
class RankedEntry:
    """Řádek startovní listiny s dopočítaným pořadím, body a ztrátou."""

    row: Any
    rank: int | None  # None u DNF/DNS/DSQ
    points: int  # 0 u DNF/DNS/DSQ i od 31. místa
    diff: Decimal | None  # ztráta na vítěze kategorie; None u 1. místa
    status: str | None  # 'DNF' | 'DNS' | 'DSQ' | None


def entry_status(row: Any) -> str | None:
    if getattr(row, "dsq", False):
        return "DSQ"
    if getattr(row, "dnf", False):
        return "DNF"
    if getattr(row, "dns", False):
        return "DNS"
    return None


def compute_time_sum(time1, time2, dnf: bool, dns: bool, dsq: bool) -> Decimal | None:
    """Celkový čas. Nedokončený závod nemá součet, jedno kolo se bere jak je."""
    if dnf or dns or dsq:
        return None
    if time1 is not None and time2 is not None:
        return time1 + time2
    if time1 is not None:
        return time1
    if time2 is not None:
        return time2
    return None


def points_for_rank(rank: int | None) -> int:
    """Body za umístění. Soutěžní řád: od 30. místa za každé umístění po 1 bodu."""
    if not rank or rank < 1:
        return 0
    if rank > len(POINTS_TABLE):
        return 1
    return POINTS_TABLE[rank - 1]


def entry_sort_key(row: Any) -> tuple:
    """Řazení v rámci kategorie - shodné s rankEntriesByTime na klientovi.

    Dokončivší podle času, pak nedokončivší v pořadí DSQ, DNF, DNS.
    Startovní číslo a id na konci drží pořadí stabilní i při naprosté shodě.
    """
    status = entry_status(row)
    time_sum = getattr(row, "time_sum", None)
    has_time = status is None and time_sum is not None

    return (
        0 if has_time else 1,
        Decimal(time_sum) if has_time else Decimal(0),
        STATUS_ORDER.get(status, _NO_STATUS),
        getattr(row, "start_number", None) or _NO_START_NUMBER,
        getattr(row, "id", 0),
    )


def rank_category(rows: Sequence[Any]) -> list[RankedEntry]:
    """Přidělí pořadí, body a ztrátu v rámci jedné kategorie.

    Shodný čas znamená shodné pořadí i shodné body a následující místo se
    přeskočí: dvě třetí místa -> 1., 2., 3., 3., 5. s body 100, 80, 60, 60, 45.
    """
    ordered = sorted(rows, key=entry_sort_key)

    ranked: list[RankedEntry] = []
    finished = 0
    previous_time: Decimal | None = None
    previous_rank = 0
    winner_time: Decimal | None = None

    for row in ordered:
        status = entry_status(row)
        time_sum = getattr(row, "time_sum", None)

        if status is not None or time_sum is None:
            ranked.append(RankedEntry(row=row, rank=None, points=0, diff=None, status=status))
            continue

        current_time = Decimal(time_sum)
        finished += 1

        if previous_time is not None and current_time == previous_time:
            rank = previous_rank  # shoda - stejné pořadí
        else:
            rank = finished  # další odlišný čas bere průběžný počet

        if winner_time is None:
            winner_time = current_time

        previous_time, previous_rank = current_time, rank
        ranked.append(
            RankedEntry(
                row=row,
                rank=rank,
                points=points_for_rank(rank),
                diff=None if rank == 1 else current_time - winner_time,
                status=None,
            )
        )

    return ranked


def format_time(value: Decimal | None) -> str:
    """Čas s desetinnou čárkou: 30,27"""
    return "" if value is None else f"{value:.2f}".replace(".", ",")


def format_diff(value: Decimal | None) -> str:
    """Ztráta na vítěze: +2,10"""
    return "" if value is None else f"+{value:.2f}".replace(".", ",")
