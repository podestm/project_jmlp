"""Společné vybavení testů.

Testy běží proti SKUTEČNÉMU MySQL, ne proti SQLite. Většina routerů píše
raw SQL s MySQL syntaxí (BIT(1), ON DUPLICATE KEY, DATE_FORMAT), takže na
jiném enginu by testy buď spadly, nebo - hůř - prošly a nic neověřily.

Schéma se načítá ze schema.sql, což je export produkčního schématu bez dat.
Díky tomu testy vidí přesně ty sloupce, se kterými raw SQL počítá.
"""
import os
import re
from pathlib import Path

import pytest
from sqlalchemy import text

# Musí být nastavené DŘÍV, než se naimportuje app.database - ta čte proměnnou
# při importu a připojila by se na ostrou databázi.
_ADMIN_URL = os.environ.get("DATABASE_URL", "mysql+pymysql://app:app@db:3306/jmlpcz?charset=utf8mb4")
# Vlastní databáze na běh dovoluje pouštět víc sad testů souběžně, aniž by si
# navzájem maly tabulky. Název musí začínat jmlpcz_test - jen na ty má
# uživatel aplikace práva.
TEST_DB = os.environ.get("JMLP_TEST_DB", "jmlpcz_test")
assert TEST_DB.startswith("jmlpcz_test"), "Testovací databáze musí začínat 'jmlpcz_test'"
os.environ["DATABASE_URL"] = re.sub(r"/[^/?]+(\?|$)", f"/{TEST_DB}\\1", _ADMIN_URL)

from app import auth, models  # noqa: E402
from app.database import engine, SessionLocal  # noqa: E402
from app.main import app  # noqa: E402

SCHEMA_SQL = Path(__file__).with_name("schema.sql")

# Pořadí nehraje roli (MyISAM, žádné cizí klíče), ale výčet ano - mazat se smí
# jen tabulky testovací databáze.
TABLES = [
    "fuj_jmlp_admin", "fuj_jmlp_areal", "fuj_jmlp_attachment", "fuj_jmlp_category",
    "fuj_jmlp_club", "fuj_jmlp_files", "fuj_jmlp_posts", "fuj_jmlp_race",
    "fuj_jmlp_race_numbers", "fuj_jmlp_race_registration", "fuj_jmlp_race_run",
    "fuj_jmlp_race_start_list", "fuj_jmlp_racer", "fuj_jmlp_season",
    "fuj_jmlp_slcr_member",
    "fuj_jmlp_timekeeper_idempotency", "fuj_jmlp_visitor_log",
]


def _statements(sql: str):
    """Rozdělí dump na příkazy. Řádkové komentáře a podmíněné /*! */ bloky pryč."""
    sql = re.sub(r"^--.*$", "", sql, flags=re.MULTILINE)
    for raw in sql.split(";\n"):
        statement = raw.strip()
        if statement and not statement.startswith("/*"):
            yield statement


@pytest.fixture(scope="session", autouse=True)
def _schema():
    """Postaví schéma v testovací databázi.

    Databáze samotná se nezakládá ani neruší - uživatel aplikace na to
    schválně nemá práva, aby se přes ni nedalo sáhnout na ostrá data.
    Založí se jednou příkazem:
        CREATE DATABASE jmlpcz_test CHARACTER SET utf8mb4;
        GRANT ALL PRIVILEGES ON jmlpcz_test.* TO 'app'@'%';
    """
    with engine.begin() as conn:
        current = conn.execute(text("SELECT DATABASE()")).scalar()
        assert current == TEST_DB, (
            f"Testy běží proti databázi {current!r} místo {TEST_DB!r} - přerušeno, "
            "aby se nesmazala ostrá data."
        )

        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        for (name,) in list(conn.execute(text("SHOW TABLES"))):
            conn.execute(text(f"DROP TABLE IF EXISTS `{name}`"))
        for statement in _statements(SCHEMA_SQL.read_text(encoding="utf-8")):
            conn.execute(text(statement))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

    yield

    engine.dispose()


@pytest.fixture(autouse=True)
def _clean_tables():
    """Každý test začíná s prázdnými tabulkami."""
    with engine.begin() as conn:
        for table in TABLES:
            conn.execute(text(f"TRUNCATE TABLE {table}"))
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    with TestClient(app) as test_client:
        yield test_client


TEST_PASSWORD = "Heslo123!"


def _make_admin(db, email: str, role: str) -> models.AdminUser:
    user = models.AdminUser(
        email=email,
        password_hash=auth.get_password_hash(TEST_PASSWORD),
        full_name=f"Test {role}",
        is_active=True,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers_for(user: models.AdminUser) -> dict:
    # `sub` je ID, ne e-mail - viz auth.verify_token.
    token = auth.create_access_token({"sub": str(user.id), "role": user.role})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_user(db):
    return _make_admin(db, "admin@test.cz", "admin")


@pytest.fixture
def timekeeper_user(db):
    return _make_admin(db, "casomeric@test.cz", "timekeeper")


@pytest.fixture
def admin_headers(admin_user):
    return _headers_for(admin_user)


@pytest.fixture
def timekeeper_headers(timekeeper_user):
    return _headers_for(timekeeper_user)
