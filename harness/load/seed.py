"""Synthetic data for load tests (harness/load). Runs inside the backend image: python seed.py

Builds the schema from app/tests/schema.sql (production schema without data), runs the app's
migrations and inserts invented data only: one live race with a start list and partial times,
one race with open registration. Prints the ids the load scripts need as JSON.
"""

import json
import random
import re
from datetime import date
from pathlib import Path

from sqlalchemy import text

from app.database import engine
from app.migrations import run_migrations

SEASON = 2026
RACERS_ON_START_LIST = 150
CLUBS = 10


def _statements(sql: str):
    sql = re.sub(r"^--.*$", "", sql, flags=re.MULTILINE)
    for raw in sql.split(";\n"):
        statement = raw.strip()
        if statement and not statement.startswith("/*"):
            yield statement


def main() -> None:
    random.seed(42)
    with engine.begin() as conn:
        for statement in _statements(Path("schema.sql").read_text(encoding="utf-8")):
            conn.execute(text(statement))
    run_migrations()

    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO fuj_jmlp_season (year_start, year_end, edition, name, is_current, created_at, updated_at) "
                "VALUES (:y, :y1, 20, 'Zátěžový test', 1, NOW(), NOW())"
            ),
            {"y": SEASON, "y1": SEASON + 1},
        )
        categories = []
        for i, (name, oldest, youngest, sex) in enumerate(
            [
                ("Myšáci", 2018, 2021, 0),
                ("Předžáci", 2015, 2017, 0),
                ("Mladší žáci", 2013, 2014, 1),
                ("Mladší žákyně", 2013, 2014, 2),
                ("Starší žáci", 2011, 2012, 0),
                ("Dorost", 2008, 2010, 0),
            ],
            start=1,
        ):
            conn.execute(
                text(
                    "INSERT INTO fuj_jmlp_category (id, name, min_birth_year, max_birth_year, sex, active, created_at, updated_at) "
                    "VALUES (:id, :name, :oldest, :youngest, :sex, 1, NOW(), NOW())"
                ),
                {"id": i, "name": name, "oldest": oldest, "youngest": youngest, "sex": sex},
            )
            categories.append((i, name, oldest, youngest))
        for c in range(1, CLUBS + 1):
            conn.execute(
                text("INSERT INTO fuj_jmlp_club (id, name, valid) VALUES (:id, :name, 1)"),
                {"id": c, "name": f"Testovací lyžařský klub {c}"},
            )
        conn.execute(text("INSERT INTO fuj_jmlp_areal (id, name) VALUES (1, 'Testovací svah')"))

        live_race, open_race = 1, 2
        for race_id, nr, registration, is_live in (
            (live_race, f"JMLP{SEASON}-01", 0, 1),
            (open_race, f"JMLP{SEASON}-02", 1, 0),
        ):
            conn.execute(
                text(
                    "INSERT INTO fuj_jmlp_race (id, closed, datum, race_nr, registration, areal_id, "
                    "race_method_id, season_id, is_live, is_final, run_count) "
                    "VALUES (:id, 0, :datum, :nr, :reg, 1, 1, :season, :live, 0, 2)"
                ),
                {"id": race_id, "datum": date(SEASON + 1, 1, 10 * race_id), "nr": nr,
                 "reg": registration, "season": SEASON, "live": is_live},
            )

        for n in range(1, RACERS_ON_START_LIST + 1):
            cat_id, cat_name, oldest, youngest = categories[n % len(categories)]
            year = random.randint(oldest, youngest)
            club = 1 + n % CLUBS
            racer_id = conn.execute(
                text(
                    "INSERT INTO fuj_jmlp_racer (name, surname, sex, year, club_id, category_id) "
                    "VALUES (:name, :surname, :sex, :year, :club, :cat)"
                ),
                {"name": f"Závodník{n}", "surname": f"Testovací{n}", "sex": 1 + n % 2,
                 "year": year, "club": club, "cat": cat_id},
            ).lastrowid
            finished = n <= RACERS_ON_START_LIST * 2 // 3
            t1 = round(random.uniform(38, 75), 2) if finished else None
            t2 = round(t1 + random.uniform(-3, 4), 2) if finished and n % 3 else None
            conn.execute(
                text(
                    "INSERT INTO fuj_jmlp_race_start_list (race_id, racer_id, category_id, start_number, "
                    "racer_name, racer_surname, racer_year, racer_sex, club_name, category_name, "
                    "time1, time2, time_sum, dnf, dns, dsq, excluded) "
                    "VALUES (:race, :racer, :cat, :start, :name, :surname, :year, :sex, :club, :catname, "
                    ":t1, :t2, :sum, 0, 0, 0, 0)"
                ),
                {"race": live_race, "racer": racer_id, "cat": cat_id, "start": n,
                 "name": f"Závodník{n}", "surname": f"Testovací{n}", "year": year, "sex": 1 + n % 2,
                 "club": f"Testovací lyžařský klub {club}", "catname": cat_name,
                 "t1": t1, "t2": t2, "sum": (t1 + t2) if t1 and t2 else None},
            )

    print(json.dumps({"live_race_id": live_race, "open_race_id": open_race, "clubs": CLUBS,
                      "start_list": RACERS_ON_START_LIST}))


if __name__ == "__main__":
    main()
