"""Doplnění chybějících ID závodníků z evidence SLČR.

Jediná kontrola: závodníkovi bez ID se najde člen evidence se stejným jménem
(bez ohledu na diakritiku) a ročníkem (z výsledků, jinak z věku) a doplní se
mu ID. Evidence se v testech nevolá - klient je nahrazený falešným.
"""
from datetime import date

from sqlalchemy import text

from app import models
from app.services import slcr, slcr_sync
from app.services.slcr import RacerToPair, SlcrPerson

THIS_YEAR = date.today().year


def _person(member_id, surname, name, year=None, race_code=None, age=None):
    return SlcrPerson(member_id=member_id, surname=surname, name=name, year=year,
                      race_code=race_code, slug=f"m{member_id}", age=age)


def _find(surname, name, year, results=(), members=()):
    return slcr.find_member(RacerToPair(1, surname, name, year), list(results), lambda s: list(members))


# --------------------------------------------------------------------------
# Pravidlo
# --------------------------------------------------------------------------
def test_id_zavodnika_jen_cislo():
    assert slcr.race_code_of("891586") == 891586
    assert slcr.race_code_of(" 891586 ") == 891586
    assert slcr.race_code_of("-") is None
    assert slcr.race_code_of(None) is None


def test_rocnik_podle_veku_z_evidence():
    today = date(2026, 10, 10)
    assert slcr.year_fits_age(2007, 18, today) and slcr.year_fits_age(2008, 18, today)
    assert slcr.year_fits_age(1964, 18, today) is False
    assert slcr.year_fits_age(2007, None, today) is None


def test_jmeno_a_rocnik_z_vysledku_jmlp():
    found = _find("Junová", "Viktorie", 2019, results=[_person(42067, "Junová", "Viktorie", 2019, 890520)])
    assert found.race_code == 890520


def test_jmeno_a_vek_z_karty_clena():
    member = _person(7, "Pela", "Adam", None, 706829, age=THIS_YEAR - 2008)
    assert _find("Pela", "Adam", 2008, members=[member]).race_code == 706829


def test_diakritika_a_velikost_pismen_nerozhoduji():
    member = _person(4, "Šiška", "Martin", None, 773450, age=THIS_YEAR - 2015)
    assert _find("SISKA", "martin", 2015, members=[member]).race_code == 773450


def test_jine_jmeno_neni_shoda():
    """Žádné odhady podobnosti: Ema není Emma."""
    assert _find("Fabiánová", "Ema", 2019, results=[_person(44319, "Fabiánová", "Emma", 2019, 891586)]) is None


def test_vek_rozhodne_mezi_otcem_a_synem():
    member = _person(14208, "Pantůček", "Václav", None, 709285, age=THIS_YEAR - 2007)
    assert _find("Pantůček", "Václav", 2007, members=[member]).member_id == 14208
    assert _find("Pantůček", "Václav", 1964, members=[member]) is None


def test_vic_shod_nedoplni_nic():
    members = [_person(1, "Novák", "Jan", None, 700001, age=THIS_YEAR - 2010),
               _person(2, "Novák", "Jan", None, 700002, age=THIS_YEAR - 2010)]
    assert _find("Novák", "Jan", 2010, members=members) is None


def test_clen_bez_id_nedoplni_nic():
    assert _find("Nový", "Petr", 2015, members=[_person(3, "Nový", "Petr", None, None, age=THIS_YEAR - 2015)]) is None


# --------------------------------------------------------------------------
# Běh a vrácení
# --------------------------------------------------------------------------
class FakeClient:
    def __init__(self, results=None, members=None):
        self.results = results or []
        self.members = members or {}

    def jmlp_results(self, since):
        return self.results

    def search_with_details(self, surname):
        return self.members.get(surname, [])


def _racer(db, surname, name, year, slcr_id=None):
    racer = models.Racer(surname=surname, name=name, year=year, sex=2, slcr_id=slcr_id)
    db.add(racer)
    db.commit()
    return racer.id


def _run(db, client, scope=slcr_sync.SCOPE_ALL):
    job_id = slcr_sync.start_job(db, scope, None)
    slcr_sync.run_job(job_id, scope, lambda: db.__class__(bind=db.get_bind()), lambda: client)
    db.expire_all()
    return job_id


def _slcr_id(db, racer_id):
    return db.execute(text("SELECT slcr_id FROM fuj_jmlp_racer WHERE id = :id"), {"id": racer_id}).scalar()


def test_beh_doplni_chybejici_id_a_vyplnena_nemeni(db):
    missing = _racer(db, "Valeská", "Viktorie", 2019, "-")
    has_id = _racer(db, "Pola", "Jonáš", 2004, "775512")
    nobody = _racer(db, "Neznámá", "Eva", 2010)
    client = FakeClient(
        results=[_person(42073, "Valeská", "Viktorie", 2019, 890521)],
        members={"Pola": [_person(5, "Pola", "Jonáš", None, 777512, age=THIS_YEAR - 2004)]},
    )

    job_id = _run(db, client)

    assert _slcr_id(db, missing) == "890521"
    assert _slcr_id(db, has_id) == "775512"
    assert _slcr_id(db, nobody) is None
    job = slcr_sync.last_job(db)
    assert job["id"] == job_id and job["finished_at"] is not None and job["error"] is None
    assert (job["total"], job["done"]) == (2, 2)  # jen závodníci bez ID


def test_id_ktere_uz_ma_jiny_zavodnik_se_nedoplni(db):
    """Stejné ID u jiného našeho závodníka - nejspíš duplicita, nechat na člověku."""
    _racer(db, "Valeská", "Viki", 2019, "890521")
    missing = _racer(db, "Valeská", "Viktorie", 2019)
    _run(db, FakeClient(results=[_person(42073, "Valeská", "Viktorie", 2019, 890521)]))
    assert _slcr_id(db, missing) is None


def test_vracene_id_se_znovu_nedoplni(db):
    racer = _racer(db, "Valeská", "Viktorie", 2019, "-")
    client = FakeClient(results=[_person(42073, "Valeská", "Viktorie", 2019, 890521)])
    _run(db, client)

    slcr_sync.undo(db, racer)
    db.expire_all()
    assert _slcr_id(db, racer) == "-"

    _run(db, client)
    assert _slcr_id(db, racer) == "-"


def test_spadly_beh_se_zapise_jako_chyba(db):
    _racer(db, "Novák", "Jan", 2010)

    class Broken(FakeClient):
        def jmlp_results(self, since):
            raise slcr.SlcrError("Evidence SLČR neodpověděla: timeout")

    _run(db, Broken())
    job = slcr_sync.last_job(db)
    assert job["finished_at"] is not None
    assert "neodpověděla" in job["error"]


# --------------------------------------------------------------------------
# API administrace
# --------------------------------------------------------------------------
def test_api_spusteni_prehled_a_vraceni(client, db, admin_headers, monkeypatch):
    racer = _racer(db, "Valeská", "Viktorie", 2019, "-")
    _racer(db, "Neznámá", "Eva", 2010)
    monkeypatch.setattr(slcr, "SlcrClient",
                        lambda: FakeClient(results=[_person(42073, "Valeská", "Viktorie", 2019, 890521)]))

    assert client.post("/api/admin/slcr/sync", json={"scope": "all"}, headers=admin_headers).status_code == 202

    # TestClient pustí úlohu na pozadí hned po odpovědi.
    summary = client.get("/api/admin/slcr/summary", headers=admin_headers).json()
    assert summary["running"] is False and summary["job"]["error"] is None
    assert summary["counts"] == {"filled": 1, "filled_last_run": 1, "missing": 1}

    [item] = client.get("/api/admin/slcr/filled", headers=admin_headers).json()
    assert item["racer"]["slcr_id"] == "890521"
    assert item["changes"] == [{"field": "slcr_id", "label": "ID závodníka", "old": "-", "new": "890521"}]
    assert item["slcr"]["url"] == "https://evidence.czech-ski.com/clenove/42073/m42073"

    assert client.post(f"/api/admin/slcr/filled/{racer}/undo", headers=admin_headers).status_code == 200
    db.expire_all()
    assert _slcr_id(db, racer) == "-"
    assert client.get("/api/admin/slcr/filled", headers=admin_headers).json() == []


def test_api_druhy_beh_behem_behu_odmitne(client, db, admin_headers):
    slcr_sync.start_job(db, slcr_sync.SCOPE_ACTIVE, None)
    assert client.post("/api/admin/slcr/sync", json={"scope": "active"}, headers=admin_headers).status_code == 409


def test_api_neznamy_rozsah(client, admin_headers):
    assert client.post("/api/admin/slcr/sync", json={"scope": "vse"}, headers=admin_headers).status_code == 400


def test_api_jen_pro_spravce(client, timekeeper_headers):
    assert client.get("/api/admin/slcr/summary", headers=timekeeper_headers).status_code == 403


def test_smazany_zavodnik_zmizi(client, db, admin_headers):
    racer = _racer(db, "Valeská", "Viktorie", 2019)
    _run(db, FakeClient(results=[_person(42073, "Valeská", "Viktorie", 2019, 890521)]))
    assert client.delete(f"/api/admin/racers/{racer}", headers=admin_headers).status_code == 200
    assert db.execute(text("SELECT COUNT(*) FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"),
                      {"id": racer}).scalar() == 0
