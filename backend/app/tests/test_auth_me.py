"""Kdo je přihlášený - /me obou sekcí vrací i roli.

Časomíra podle role ukazuje "Admin" / "Časoměřič" a přepínač do
administrace, který dostanou jen správci. Dokud role v odpovědi chyběla,
byl v časomíře každý "Časoměřič" a přepínač neviděl nikdo.
"""


def test_casomira_me_vraci_roli_spravce(client, admin_headers):
    response = client.get("/api/timekeeper/auth/me", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["role"] == "admin"


def test_casomira_me_vraci_roli_casomerice(client, timekeeper_headers):
    response = client.get("/api/timekeeper/auth/me", headers=timekeeper_headers)

    assert response.status_code == 200
    assert response.json()["role"] == "timekeeper"


def test_admin_me_vraci_roli(client, admin_headers):
    response = client.get("/api/admin/auth/me", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["role"] == "admin"


def test_me_neprozradi_heslo(client, admin_headers):
    body = client.get("/api/admin/auth/me", headers=admin_headers).json()

    assert "password_hash" not in body
    assert "password" not in body
