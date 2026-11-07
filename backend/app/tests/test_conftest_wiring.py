"""Ověřuje, že testovací vybavení samo funguje.

Bez toho by se selhání conftestu projevilo jako záhadné chyby v úplně jiných
testech - a hledalo by se to dlouho.
"""

from sqlalchemy import text

from .conftest import TEST_DB


def test_bezi_proti_testovaci_databazi(db):
    assert db.execute(text("SELECT DATABASE()")).scalar() == TEST_DB
    assert TEST_DB.startswith("jmlpcz_test")


def test_schema_obsahuje_klicove_tabulky(db):
    tables = {row[0] for row in db.execute(text("SHOW TABLES"))}
    assert {"fuj_jmlp_race", "fuj_jmlp_attachment", "fuj_jmlp_season", "fuj_jmlp_files"} <= tables


def test_tabulky_jsou_mezi_testy_prazdne(db):
    assert db.execute(text("SELECT COUNT(*) FROM fuj_jmlp_race")).scalar() == 0


def test_verejny_endpoint_odpovida(client):
    assert client.get("/").status_code == 200


def test_admin_endpoint_bez_tokenu_odmita(client):
    assert client.get("/api/admin/seasons").status_code in (401, 403)


def test_admin_endpoint_s_tokenem_projde(client, admin_headers):
    response = client.get("/api/admin/seasons", headers=admin_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_timekeeper_token_nesmi_do_administrace(client, timekeeper_headers):
    response = client.get("/api/admin/seasons", headers=timekeeper_headers)
    assert response.status_code in (401, 403)
