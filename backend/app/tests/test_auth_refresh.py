"""Klouzavé prodlužování přihlášení - obnova ještě platného tokenu.

Časoměřič, který se ráno přihlásil o pár hodin dřív, nesmí během závodu
vypadnout. Klient si token obnoví sám, když je online a zbývá méně než půlka
platnosti (frontend config/tokenRefresh.js).
"""
from datetime import timedelta

from jose import jwt

from app import auth


def _claims(token):
    return jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])


def test_token_nese_cas_vydani(timekeeper_user):
    claims = _claims(auth.create_access_token({"sub": str(timekeeper_user.id), "role": "timekeeper"}))
    assert claims["exp"] - claims["iat"] == auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def test_casomira_obnovi_platny_token(client, timekeeper_user):
    stary = auth.create_access_token({"sub": str(timekeeper_user.id), "role": "timekeeper"},
                                     expires_delta=timedelta(minutes=5))

    odpoved = client.post("/api/timekeeper/auth/refresh", headers={"Authorization": f"Bearer {stary}"})

    assert odpoved.status_code == 200, odpoved.text
    novy = odpoved.json()
    assert novy["expires_in"] == auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    assert _claims(novy["access_token"])["exp"] > _claims(stary)["exp"]
    assert _claims(novy["access_token"])["sub"] == str(timekeeper_user.id)


def test_vyprsely_token_obnovit_nejde(client, timekeeper_user):
    vyprsely = auth.create_access_token({"sub": str(timekeeper_user.id), "role": "timekeeper"},
                                        expires_delta=timedelta(minutes=-1))
    odpoved = client.post("/api/timekeeper/auth/refresh", headers={"Authorization": f"Bearer {vyprsely}"})
    assert odpoved.status_code == 401


def test_administrace_obnovi_jen_spravci(client, admin_headers, timekeeper_headers):
    assert client.post("/api/admin/auth/refresh", headers=admin_headers).status_code == 200
    assert client.post("/api/admin/auth/refresh", headers=timekeeper_headers).status_code == 403
