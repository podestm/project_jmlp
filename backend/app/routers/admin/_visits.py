"""Sdílené dotazy pro statistiku návštěv (dashboard + stats)."""
from datetime import datetime, timedelta
from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.orm import Session


def daily_visits(db: Session, days: int) -> List[Dict[str, Any]]:
    """Návštěvy po dnech za posledních `days` dní.

    Jeden agregační dotaz místo dvou dotazů na každý den. Dny bez návštěv
    jsou doplněny nulami, takže graf má vždy plnou řadu.
    """
    today = datetime.now().date()
    start = today - timedelta(days=days - 1)

    rows = db.execute(text("""
        SELECT DATE(visited_at) as visit_date,
               COUNT(*) as visits,
               COUNT(DISTINCT ip_address) as unique_ips
        FROM fuj_jmlp_visitor_log
        WHERE visited_at >= :start
        GROUP BY DATE(visited_at)
    """), {"start": datetime.combine(start, datetime.min.time())}).fetchall()

    by_date = {row.visit_date: (row.visits, row.unique_ips) for row in rows}

    data = []
    for i in range(days):
        d = start + timedelta(days=i)
        visits, unique_ips = by_date.get(d, (0, 0))
        data.append({
            "date": d.strftime("%d.%m"),
            "visits": visits,
            "unique": unique_ips,
            "fullDate": d.isoformat(),
        })
    return data
