"""Systémové označení startovního čísla: písmeno sady + číslo dresu.

Sada 1 = A, sada 2 = B, ... (nejvýš 26 sad). Dres 12 ze sady 2 je "B12".
Označení je v databázi uložené (fuj_jmlp_race_numbers.display_number,
snapshot fuj_jmlp_race_start_list.race_number_display) a je jedinečné napříč
sadami - jako dřív systémová čísla 1-400.
"""

from __future__ import annotations

import re
from typing import Any

MAX_SETS = 26


def actual_from_code_sql(column: str) -> str:
    """SQL: číslo dresu z označení ("B12" -> 12); NULL zůstane NULL."""
    return f"CAST(SUBSTRING({column}, 2) AS UNSIGNED)"


_CODE = re.compile(r"^([A-Z])(\d{1,4})$")


def set_letter(set_number: int) -> str:
    number = int(set_number)
    if not 1 <= number <= MAX_SETS:
        raise ValueError(f"Sada {set_number} nemá písmeno (povolené 1-{MAX_SETS})")
    return chr(ord("A") + number - 1)


def race_number_code(set_number: int, actual_number: int) -> str:
    return f"{set_letter(set_number)}{int(actual_number)}"


def normalize_code(value: Any) -> str | None:
    """ "b 12" -> "B12"; prázdné -> None; jiný tvar (i samotné číslo) -> ValueError."""
    if value is None:
        return None
    text = re.sub(r"\s+", "", str(value)).upper()
    if not text:
        return None
    if not _CODE.match(text):
        raise ValueError(f"Číslo „{value}“ zadejte jako písmeno sady a číslo dresu, např. A12")
    letter, digits = _CODE.match(text).groups()
    return f"{letter}{int(digits)}"


def code_sort_key(code: str | None) -> tuple:
    """Řazení A1, A2 ... A200, B1 (ne podle textu, kde by A10 bylo před A2)."""
    match = _CODE.match(code or "")
    if not match:
        return (99, 10**9)
    return (ord(match.group(1)), int(match.group(2)))
