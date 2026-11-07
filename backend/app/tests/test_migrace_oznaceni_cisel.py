"""Migrace 016 a 017: systémová čísla 1-400 -> označení písmenem sady ("B12")
a zrušení samostatného čísla dresu (je obsažené v označení)."""

from sqlalchemy import text

from app.database import engine
from app.migrations import _m_drop_actual_numbers, _m_race_number_codes


def _stare_schema(conn):
    """Schéma před migracemi: číselné systémové číslo a sloupce s dresem."""
    conn.execute(text("ALTER TABLE fuj_jmlp_race_numbers MODIFY display_number INT NOT NULL"))
    conn.execute(
        text("ALTER TABLE fuj_jmlp_race_numbers ADD COLUMN actual_number INT NOT NULL DEFAULT 0")
    )
    conn.execute(
        text(
            "ALTER TABLE fuj_jmlp_race_numbers ADD UNIQUE KEY unique_set_actual (set_number, actual_number)"
        )
    )
    conn.execute(text("ALTER TABLE fuj_jmlp_race_start_list MODIFY race_number_display INT NULL"))
    conn.execute(
        text("ALTER TABLE fuj_jmlp_race_start_list ADD COLUMN race_number_actual INT NULL")
    )


def _sloupce(conn, table):
    return {row[0] for row in conn.execute(text(f"SHOW COLUMNS FROM {table}"))}


def test_prevede_oznaceni_a_zrusi_sloupce_s_dresem(db):
    with engine.begin() as conn:
        _stare_schema(conn)
        conn.execute(
            text("""
            INSERT INTO fuj_jmlp_race_numbers (id, set_number, set_color, actual_number, display_number, is_active)
            VALUES (1, 1, 'blue', 12, 12, 1), (2, 2, 'emerald', 12, 212, 1), (3, 2, 'emerald', 5, 205, 1)
        """)
        )
        conn.execute(
            text("""
            INSERT INTO fuj_jmlp_race_start_list
                (id, race_id, racer_id, race_number_id, race_number_actual, race_number_display, excluded)
            VALUES (1, 1, 1, 2, 12, 212, 0),     -- vazba na číselník
                   (2, 1, 2, NULL, 5, 205, 0),   -- bez vazby, podle starého čísla
                   (3, 1, 3, NULL, NULL, 999, 0), -- číslo už neexistuje
                   (4, 1, 4, NULL, NULL, NULL, 0)
        """)
        )

        for _ in range(2):  # podruhé nic nedělají
            _m_race_number_codes(conn)
            _m_drop_actual_numbers(conn)

        cisla = conn.execute(
            text("SELECT id, display_number FROM fuj_jmlp_race_numbers ORDER BY id")
        ).fetchall()
        startovka = conn.execute(
            text("SELECT id, race_number_display FROM fuj_jmlp_race_start_list ORDER BY id")
        ).fetchall()
        sloupce_cisel = _sloupce(conn, "fuj_jmlp_race_numbers")
        sloupce_startovky = _sloupce(conn, "fuj_jmlp_race_start_list")

    assert [tuple(r) for r in cisla] == [(1, "A12"), (2, "B12"), (3, "B5")]
    assert [tuple(r) for r in startovka] == [(1, "B12"), (2, "B5"), (3, None), (4, None)]
    assert "actual_number" not in sloupce_cisel
    assert "race_number_actual" not in sloupce_startovky


def test_dres_neodpovidajici_oznaceni_sloupec_nesmaze(db):
    with engine.begin() as conn:
        _stare_schema(conn)
        conn.execute(
            text("""
            INSERT INTO fuj_jmlp_race_numbers (id, set_number, set_color, actual_number, display_number, is_active)
            VALUES (1, 1, 'blue', 12, 12, 1)
        """)
        )
        conn.execute(
            text("""
            INSERT INTO fuj_jmlp_race_start_list (id, race_id, racer_id, race_number_actual, race_number_display, excluded)
            VALUES (1, 1, 1, 7, NULL, 0)   -- dres bez označení
        """)
        )
        _m_race_number_codes(conn)
        _m_drop_actual_numbers(conn)
        sloupce_startovky = _sloupce(conn, "fuj_jmlp_race_start_list")
        # úklid pro další testy: schéma jako po migraci
        conn.execute(text("ALTER TABLE fuj_jmlp_race_start_list DROP COLUMN race_number_actual"))

    assert "race_number_actual" in sloupce_startovky
