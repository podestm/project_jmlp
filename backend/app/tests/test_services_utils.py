"""Pomocné funkce a služby - čistá logika bez HTTP.

Drží se tu pravidla, na kterých stojí zbytek aplikace: hranice sezóny,
bodování, pořadí v kategorii a přihlašování.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from jose import jwt

from app import auth, utils
from app.services import results as results_service


# ---------------------------------------------------------------------------
# Sezóna
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("den,ocekavana_sezona", [
    (date(2026, 8, 1), 2026),    # první den nové sezóny
    (date(2026, 7, 31), 2025),   # poslední den té staré
    (date(2026, 1, 17), 2025),
    (date(2026, 12, 31), 2026),
    (date(2025, 8, 1), 2025),
])
def test_hranice_sezony_je_1_srpna(den, ocekavana_sezona):
    assert utils.get_current_season_id(den) == ocekavana_sezona


def test_sezona_se_pocita_i_z_retezce():
    assert utils.calculate_season_for_date("2026-01-17") == 2025
    assert utils.calculate_season_for_date("2026-08-15") == 2026


def test_neplatne_datum_ohlasi_chybu():
    with pytest.raises(ValueError):
        utils.parse_date_string("17.1.2026")


def test_popis_sezony_obsahuje_oba_roky():
    assert utils.get_current_season(date(2026, 8, 15)) == {"year_start": 2026, "year_end": 2027}


# ---------------------------------------------------------------------------
# Formátování
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("cislo,ocekavane", [
    (1, "I"), (4, "IV"), (6, "VI"), (9, "IX"), (14, "XIV"),
    (19, "XIX"), (20, "XX"), (40, "XL"), (2026, "MMXXVI"),
])
def test_rimske_cislice(cislo, ocekavane):
    assert utils.to_roman(cislo) == ocekavane


@pytest.mark.parametrize("vstup", [None, 0, -5])
def test_rimske_cislice_prazdna_hodnota(vstup):
    assert utils.to_roman(vstup) == ""


def test_velikost_souboru_ma_citelnou_jednotku():
    assert utils.format_file_size(0) == "0 B"
    assert "KB" in utils.format_file_size(2048)
    assert "MB" in utils.format_file_size(5 * 1024 * 1024)


def test_fix_encoding_opravi_dvojite_kodovani():
    rozbite = "Petrův".encode("utf-8").decode("latin1")
    assert utils.fix_encoding(rozbite) == "Petrův"


def test_fix_encoding_necha_spravny_text():
    assert utils.fix_encoding("Němčičky") == "Němčičky"
    assert utils.fix_encoding("") == ""
    assert utils.fix_encoding(None) is None


def test_csv_safe_zneskodni_vzorec():
    """Buňka začínající =, +, - nebo @ se v Excelu vyhodnotí jako vzorec."""
    for nebezpecny in ("=1+1", "+1", "-1", "@SUM(A1)"):
        assert not utils.csv_safe(nebezpecny).startswith(nebezpecny[0])


# ---------------------------------------------------------------------------
# Výsledky
# ---------------------------------------------------------------------------

class _Radek:
    """Nejmenší podoba řádku startovky, jakou služba potřebuje."""

    def __init__(self, id, time_sum=None, dnf=False, dns=False, dsq=False, start_number=1):
        self.id = id
        self.time_sum = Decimal(str(time_sum)) if time_sum is not None else None
        self.dnf, self.dns, self.dsq = dnf, dns, dsq
        self.start_number = start_number


def test_soucet_casu_scita_obe_jizdy():
    assert results_service.compute_time_sum(
        Decimal("30.5"), Decimal("29.5"), False, False, False
    ) == Decimal("60.0")


@pytest.mark.parametrize("dnf,dns,dsq", [(True, False, False), (False, True, False), (False, False, True)])
def test_priznak_rusi_soucet(dnf, dns, dsq):
    assert results_service.compute_time_sum(
        Decimal("30"), Decimal("30"), dnf, dns, dsq
    ) is None


def test_soucet_jedine_jizdy():
    assert results_service.compute_time_sum(Decimal("30.5"), None, False, False, False) == Decimal("30.5")
    assert results_service.compute_time_sum(None, None, False, False, False) is None


def test_body_odpovidaji_tabulce():
    assert results_service.points_for_rank(1) == 100
    assert results_service.points_for_rank(2) == 80
    assert results_service.points_for_rank(30) == 1
    # Soutěžní řád JmLP: od 30. místa za každé umístění po 1 bodu.
    assert results_service.points_for_rank(31) == 1
    assert results_service.points_for_rank(35) == 1
    assert results_service.points_for_rank(None) == 0
    assert results_service.points_for_rank(0) == 0


def test_tabulka_bodu_ma_30_mist():
    assert len(results_service.POINTS_TABLE) == 30


def test_poradi_v_kategorii_podle_casu():
    poradi = results_service.rank_category([
        _Radek(1, 62.0, start_number=1),
        _Radek(2, 60.5, start_number=2),
        _Radek(3, 61.2, start_number=3),
    ])

    assert [r.row.id for r in poradi] == [2, 3, 1]
    assert [r.rank for r in poradi] == [1, 2, 3]


def test_nedokoncivsi_jdou_za_klasifikovane_a_nemaji_poradi():
    poradi = results_service.rank_category([
        _Radek(1, None, dnf=True, start_number=1),
        _Radek(2, 60.5, start_number=2),
    ])

    assert poradi[0].row.id == 2
    assert poradi[1].rank is None
    assert poradi[1].points == 0


def test_shodny_cas_dostane_stejne_poradi_i_body():
    poradi = results_service.rank_category([
        _Radek(1, 60.0, start_number=1),
        _Radek(2, 60.0, start_number=2),
        _Radek(3, 61.0, start_number=3),
    ])

    assert [r.rank for r in poradi] == [1, 1, 3]
    assert poradi[0].points == poradi[1].points


def test_prazdna_kategorie_nespadne():
    assert results_service.rank_category([]) == []


def test_stav_zavodnika_ma_prednost_dsq_pred_dnf():
    assert results_service.entry_status(_Radek(1, None, dsq=True, dnf=True)) == "DSQ"
    assert results_service.entry_status(_Radek(1, 60.0)) is None


# ---------------------------------------------------------------------------
# Přihlašování
# ---------------------------------------------------------------------------

def test_heslo_se_neuklada_v_otevrene_podobe():
    hash_hesla = auth.get_password_hash("TajneHeslo123!")
    assert "TajneHeslo123!" not in hash_hesla
    assert auth.verify_password("TajneHeslo123!", hash_hesla)
    assert not auth.verify_password("jine", hash_hesla)


def test_stejne_heslo_ma_pokazde_jiny_hash():
    assert auth.get_password_hash("stejne") != auth.get_password_hash("stejne")


def test_token_nese_identitu_a_da_se_overit():
    token = auth.create_access_token({"sub": "42", "role": "timekeeper"})
    assert auth.verify_token(token).admin_id == 42


def test_propadly_token_neprojde():
    token = auth.create_access_token({"sub": "42"}, expires_delta=timedelta(seconds=-1))
    assert auth.verify_token(token) is None


def test_podvrzeny_token_neprojde():
    assert auth.verify_token("tohle.neni.token") is None
    cizi = jwt.encode({"sub": "42", "exp": datetime.utcnow() + timedelta(minutes=5)},
                      "cizi-klic", algorithm=auth.ALGORITHM)
    assert auth.verify_token(cizi) is None


def test_token_bez_identity_neprojde():
    assert auth.verify_token(auth.create_access_token({"role": "admin"})) is None


def test_opakovane_spatne_prihlaseni_se_zablokuje():
    email = "utok@test.cz"
    auth.reset_login_attempts(email)
    try:
        for _ in range(auth.LOGIN_MAX_ATTEMPTS):
            auth.check_login_allowed(email)
            auth.register_failed_login(email)

        with pytest.raises(Exception) as chyba:
            auth.check_login_allowed(email)
        assert chyba.value.status_code == 429
    finally:
        auth.reset_login_attempts(email)


def test_uspesne_prihlaseni_pocitadlo_nuluje():
    email = "pokus@test.cz"
    auth.reset_login_attempts(email)
    auth.register_failed_login(email)
    auth.reset_login_attempts(email)

    auth.check_login_allowed(email)  # nesmí vyhodit výjimku
