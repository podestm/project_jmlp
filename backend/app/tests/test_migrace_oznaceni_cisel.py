"""Migrace 015: systémová čísla 1-400 -> označení písmenem sady ("B12")."""
from sqlalchemy import text

from app.database import engine
from app.migrations import _m_race_number_codes


def test_prevede_ciselnik_i_startovky_podle_vazby_i_stareho_cisla(db):
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE fuj_jmlp_race_numbers MODIFY display_number INT NOT NULL"))
        conn.execute(text("ALTER TABLE fuj_jmlp_race_start_list MODIFY race_number_display INT NULL"))
        conn.execute(text("""
            INSERT INTO fuj_jmlp_race_numbers (id, set_number, set_color, actual_number, display_number, is_active)
            VALUES (1, 1, 'blue', 12, 12, 1), (2, 2, 'emerald', 12, 212, 1), (3, 2, 'emerald', 5, 205, 1)
        """))
        conn.execute(text("""
            INSERT INTO fuj_jmlp_race_start_list (id, race_id, racer_id, race_number_id, race_number_actual, race_number_display, excluded)
            VALUES (1, 1, 1, 2, 12, 212, 0),     -- vazba na číselník
                   (2, 1, 2, NULL, 5, 205, 0),   -- bez vazby, podle starého čísla
                   (3, 1, 3, NULL, 7, 999, 0),   -- číslo už neexistuje
                   (4, 1, 4, NULL, NULL, NULL, 0)
        """))

        _m_race_number_codes(conn)
        _m_race_number_codes(conn)   # podruhé nic nedělá

        cisla = conn.execute(text("SELECT id, display_number FROM fuj_jmlp_race_numbers ORDER BY id")).fetchall()
        startovka = conn.execute(text(
            "SELECT id, race_number_display FROM fuj_jmlp_race_start_list ORDER BY id")).fetchall()

    assert [tuple(r) for r in cisla] == [(1, "A12"), (2, "B12"), (3, "B5")]
    assert [tuple(r) for r in startovka] == [(1, "B12"), (2, "B5"), (3, None), (4, None)]
