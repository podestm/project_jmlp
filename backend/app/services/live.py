"""Výsledky live přenosu pro veřejný web (/races/live).

Sestavení je drahé (dva dotazy a průchod celou startovkou), proto ho router volá přes krátkou
cache (services/live_cache.py) a cachuje rovnou hotový JSON.
"""

import json
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..utils import category_display_sql


def encode_json(payload: dict | None) -> bytes | None:
    """JSON jako FastAPI (kompaktní, bez NaN); None zůstane None (žádný živý závod)."""
    if payload is None:
        return None
    return json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode(
        "utf-8"
    )


def build_live_payload(db: Session) -> dict | None:
    """Sestaví výsledky běžícího závodu; None, když žádný neběží."""
    live = db.execute(
        text("""
        SELECT r.id, r.race_nr, r.datum, r.race_method_id,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        WHERE r.is_live = 1
        LIMIT 1
    """)
    ).fetchone()

    if not live:
        return None

    # Název kategorie živě z adminu; snapshot v listině je jen záloha pro
    # historická data - jinak by na webu svítil název z doby rozlosování.
    # Vyřazení ze startky (nedorazili) na web nepatří - ani do startovky, ani
    # do pořadí, které si stránka počítá z těchhle řádků.
    entries = db.execute(
        text(f"""
        SELECT sl.id, sl.start_number, CAST(SUBSTRING(sl.race_number_display, 2) AS UNSIGNED) AS race_number_actual, sl.race_number_display,
               sl.racer_name, sl.racer_surname, sl.racer_year,
               sl.club_name,
               COALESCE({category_display_sql('cat')}, sl.category_name) as category_name,
               sl.category_id,
               sl.time1, sl.time2, sl.time_sum,
               sl.dnf+0 as dnf, sl.dns+0 as dns, sl.dsq+0 as dsq,
               COALESCE(rn.set_color, 'rose') as set_color
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_race_numbers rn ON sl.race_number_id = rn.id
        LEFT JOIN fuj_jmlp_category cat ON cat.id = sl.category_id
        WHERE sl.race_id = :race_id
          AND sl.excluded = 0
        ORDER BY category_name, sl.start_number ASC
    """),
        {"race_id": live.id},
    ).fetchall()

    categories: dict = {}
    cat_order: list = []
    for e in entries:
        cat_id = e.category_id or 0
        if cat_id not in categories:
            categories[cat_id] = {
                "category_id": cat_id,
                "category_name": e.category_name or "Bez kategorie",
                "entries": [],
            }
            cat_order.append(cat_id)
        status = "DNF" if e.dnf else ("DNS" if e.dns else ("DSQ" if e.dsq else None))
        categories[cat_id]["entries"].append(
            {
                "id": e.id,
                "start_number": e.start_number,
                "race_number_actual": e.race_number_actual,
                "race_number_display": e.race_number_display,
                "racer_name": e.racer_name,
                "racer_surname": e.racer_surname,
                "racer_year": e.racer_year,
                "club_name": e.club_name,
                "set_color": e.set_color,
                "time1": float(e.time1) if e.time1 is not None else None,
                "time2": float(e.time2) if e.time2 is not None else None,
                "time_sum": float(e.time_sum) if e.time_sum is not None else None,
                "status": status,
                "points": None,
            }
        )

    result_categories = [categories[cid] for cid in cat_order]

    return {
        "race_id": live.id,
        "race_nr": live.race_nr,
        "race_date": live.datum.isoformat() if live.datum else None,
        "areal_name": live.areal_name,
        "race_method_id": live.race_method_id,
        "categories": result_categories,
        "updated_at": datetime.utcnow().isoformat(),
    }
