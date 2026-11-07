"""Pořadí kategorií v rámci závodu.

Časoměřič si pořadí kategorií nastavuje ve startovní listině
(fuj_jmlp_race.timekeeper_category_order). Startovka i časomíra ho respektovaly,
výsledky ne - tištěná listina by tak měla jiné pořadí než obrazovka. Proto je
logika tady a používají ji obě strany.
"""

import json

from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import models


def default_category_order(db: Session) -> list[int]:
    """Výchozí pořadí: nejmladší první, ženy před muži."""
    query = text("""
        SELECT id
        FROM fuj_jmlp_category
        WHERE active = 1
        ORDER BY min_birth_year DESC, sex DESC
    """)
    return [int(row.id) for row in db.execute(query).fetchall()]


def effective_category_order(race: models.Race, db: Session) -> list[int]:
    """Pořadí nastavené u závodu, doplněné o kategorie, které v něm chybí."""
    if race is not None and race.timekeeper_category_order:
        try:
            stored = json.loads(race.timekeeper_category_order)
        except json.JSONDecodeError:
            stored = None

        if isinstance(stored, list):
            normalized = []
            for item in stored:
                try:
                    normalized.append(int(item))
                except (TypeError, ValueError):
                    continue
            if normalized:
                default_order = default_category_order(db)
                missing = [cat_id for cat_id in default_order if cat_id not in normalized]
                return normalized + missing

    return default_category_order(db)


def category_rank_map(race: models.Race, db: Session) -> dict[int, int]:
    """Mapa category_id -> pozice v pořadí."""
    return {cat_id: index for index, cat_id in enumerate(effective_category_order(race, db))}
