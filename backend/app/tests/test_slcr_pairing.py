"""Párování závodníků s evidencí SLČR.

Evidence se v testech nevolá - klient je nahrazený falešným se stejnými
metodami. Data odpovídají tomu, co evidence opravdu vrací (výsledky akcí
JMLP s přiřazeným členem, hledání členů bez ročníku).
"""
from datetime import date

from sqlalchemy import text

from app import models
from app.services import slcr, slcr_sync
from app.services.slcr import RacerToPair, SlcrPerson


# --------------------------------------------------------------------------
# Křížová kontrola: ID ↔ jméno + ročník
# --------------------------------------------------------------------------
THIS_YEAR = date.today().year


def _person(member_id, surname, name, year=None, race_code=None, club=None, alpine=True, age=None):
    return SlcrPerson(member_id=member_id, surname=surname, name=name, year=year,
                      race_code=race_code, club=club, alpine=alpine, slug=f"m{member_id}", age=age)


def _check(surname, name, year, slcr_id=None, results=(), members=()):
    return slcr.cross_check(RacerToPair(1, surname, name, year, slcr_id), list(results), lambda s: list(members))


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


def test_sedi_id_i_jmeno_s_rocnikem():
    result = _check("Valeská", "Viktorie", 2019, "890521", results=[_person(42073, "Valeská", "Viktorie", 2019, 890521)])
    assert (result.kind, result.person.member_id) == (slcr.KIND_OK, 42073)


def test_velikost_pismen_nerozhoduje():
    member = _person(8580, "Otipková", "Thaisy", None, 156096, age=THIS_YEAR - 2004)
    assert _check("OTIPKOVÁ", "THAISY", 2004, "156096", members=[member]).kind == slcr.KIND_OK


def test_chybi_id_jmeno_a_rocnik_najdou_clena():
    member = _person(7, "Pela", "Adam", None, 706829, age=THIS_YEAR - 2008)
    result = _check("Pela", "Adam", 2008, "-", members=[member])
    assert (result.kind, result.person.race_code) == (slcr.KIND_FILL_ID, 706829)


def test_jmeno_a_rocnik_sedi_ale_id_je_jine():
    member = _person(5, "Pola", "Jonáš", None, 777512, age=THIS_YEAR - 2004)
    result = _check("Pola", "Jonáš", 2004, "775512", members=[member])
    assert result.kind == slcr.KIND_OTHER_ID
    assert "777512" in result.note and "775512" in result.note


def test_nase_id_patri_jinemu_jmenu():
    """Žádné odhadování podobnosti: Ema není Emma - ukáže se jako nesoulad."""
    result = _check("Fabiánová", "Ema", 2019, "891586", results=[_person(44319, "Fabiánová", "Emma", 2019, 891586)])
    assert (result.kind, result.person.member_id) == (slcr.KIND_ID_MISMATCH, 44319)
    assert "nesedí jméno" in result.note


def test_nase_id_patri_jinemu_rocniku():
    result = _check("Junová", "Mariana", 2016, "891952", results=[_person(45973, "Junová", "Mariana", 2022, 891952)])
    assert result.kind == slcr.KIND_ID_MISMATCH
    assert "nesedí ročník" in result.note


def test_bez_id_se_podobne_jmeno_nepovazuje_za_shodu():
    assert _check("Fabiánová", "Ema", 2019, results=[_person(44319, "Fabiánová", "Emma", 2019, 891586)]).kind \
        == slcr.KIND_NOT_FOUND


def test_nezname_id():
    assert _check("Bečvářová", "Sophia", 2020, "89199").kind == slcr.KIND_ID_UNKNOWN


def test_vic_clenu_se_stejnym_jmenem_a_rockem():
    members = [_person(1, "Novák", "Jan", None, 700001, age=THIS_YEAR - 2010),
               _person(2, "Novák", "Jan", None, 700002, age=THIS_YEAR - 2010)]
    result = _check("Novák", "Jan", 2010, members=members)
    assert result.kind == slcr.KIND_AMBIGUOUS and len(result.alternatives) == 1


def test_vek_rozhodne_mezi_otcem_a_synem():
    """Pantůček Václav 1964 a 2007 - evidence zná jen jednoho a uvádí mu věk."""
    member = _person(14208, "Pantůček", "Václav", None, 709285, age=THIS_YEAR - 2007)
    assert _check("Pantůček", "Václav", 2007, "-", members=[member]).kind == slcr.KIND_FILL_ID
    assert _check("Pantůček", "Václav", 1964, "-", members=[member]).kind == slcr.KIND_NOT_FOUND


def test_cizi_id_od_rodice():
    """Dítě zadalo ID rodiče - ID patří jinému ročníku."""
    parent = _person(9, "Arnold", "Franziska", None, 808853, age=52)
    result = _check("Arnold", "Franziska", 2014, "808853", members=[parent])
    assert result.kind == slcr.KIND_ID_MISMATCH


# --------------------------------------------------------------------------
# Ukládání návrhů a rozhodnutí správce
# --------------------------------------------------------------------------
class FakeClient:
    def __init__(self, results=None, members=None):
        self.results = results or []
        self.members = members or {}

    def jmlp_results(self, since):
        return self.results

    def search_with_details(self, surname):
        return self.members.get(surname, [])


def _racer(db, surname, name, year, slcr_id=None, club=None):
    club_id = None
    if club:
        klub = models.Club(name=club, valid=True)
        db.add(klub)
        db.commit()
        club_id = klub.id
    racer = models.Racer(surname=surname, name=name, year=year, sex=2, slcr_id=slcr_id, club_id=club_id)
    db.add(racer)
    db.commit()
    return racer.id


def _run(db, client, scope=slcr_sync.SCOPE_ALL):
    job_id = slcr_sync.start_job(db, scope, None)
    slcr_sync.run_job(job_id, scope, lambda: db.__class__(bind=db.get_bind()), lambda: client)
    db.expire_all()
    return job_id


def _status(db, racer_id):
    return db.execute(text("SELECT status, member_id FROM fuj_jmlp_racer_slcr WHERE racer_id = :id"),
                      {"id": racer_id}).mappings().first()


def test_nacteni_ulozi_navrhy_a_dokonci_beh(db):
    found = _racer(db, "Fabiánová", "Ema", 2019, "891586", "Ski team Victoria Brno")
    missing = _racer(db, "Neznámá", "Eva", 2010)
    client = FakeClient(results=[_person(44319, "Fabiánová", "Emma", 2019, 891586, "Ski klub Victoria Brno")])

    job_id = _run(db, client)

    assert dict(_status(db, found)) == {"status": "suggested", "member_id": 44319}
    assert _status(db, missing)["status"] == "not_found"
    job = slcr_sync.last_job(db)
    assert job["id"] == job_id and job["finished_at"] is not None and job["error"] is None
    assert (job["total"], job["done"]) == (2, 2)


def test_rozhodnuti_spravce_dalsi_nacteni_neprepise(db):
    confirmed = _racer(db, "Valeská", "Viktorie", 2019, "890521")
    rejected = _racer(db, "Junová", "Viktorie", 2019)
    client = FakeClient(results=[
        _person(42073, "Valeská", "Viktorie", 2019, 890521),
        _person(42067, "Junová", "Viktorie", 2019, 890520),
    ])
    _run(db, client)
    slcr_sync.confirm(db, confirmed, None)
    slcr_sync.reject(db, rejected, None)

    _run(db, client)

    assert _status(db, confirmed)["status"] == "confirmed"
    assert _status(db, rejected)["status"] == "rejected"


def test_odmitnuty_navrh_se_vrati_jen_s_jinym_clenem(db):
    racer = _racer(db, "Junová", "Viktorie", 2019)
    _run(db, FakeClient(results=[_person(42067, "Junová", "Viktorie", 2019)]))
    slcr_sync.reject(db, racer, None)

    _run(db, FakeClient(results=[_person(50000, "Junová", "Viktorie", 2019)]))

    assert dict(_status(db, racer)) == {"status": "suggested", "member_id": 50000}


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
def test_api_prehled_navrhy_a_rozhodnuti(client, db, admin_headers):
    racer = _racer(db, "Jaroš", "David", 2018, "778975", "Ski team Victoria Brno")
    _run(db, FakeClient(members={"Jaroš": [_person(43580, "Jaroš", "David", None, 778475, age=THIS_YEAR - 2018)]}))

    summary = client.get("/api/admin/slcr/summary", headers=admin_headers).json()
    assert summary["counts"]["suggested"] == 1
    assert summary["running"] is False

    [item] = client.get("/api/admin/slcr/pairs?status=suggested", headers=admin_headers).json()
    assert item["racer"]["slcr_id"] == "778975"
    assert item["slcr"]["race_code"] == 778475
    assert item["slcr"]["url"] == "https://evidence.czech-ski.com/clenove/43580/m43580"
    # Jiné číslo v ID závodníka - upozornění a v náhledu, co se změní.
    assert item["flags"]["code_mismatch"] is True
    assert item["changes"] == [{"field": "slcr_id", "label": "ID závodníka", "old": "778975", "new": "778475"}]

    # Potvrzení opraví náš záznam podle evidence.
    response = client.post(f"/api/admin/slcr/pairs/{racer}/confirm", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["changes"][0]["new"] == "778475"
    assert _status(db, racer)["status"] == "confirmed"
    assert _racer_row(db, racer)["slcr_id"] == "778475"

    # Vrátit vezme zpět i opravu záznamu.
    assert client.post(f"/api/admin/slcr/pairs/{racer}/undo", headers=admin_headers).status_code == 200
    db.expire_all()
    assert _status(db, racer)["status"] == "suggested"
    assert _racer_row(db, racer)["slcr_id"] == "778975"


def test_api_jeden_clen_nejde_potvrdit_u_dvou_zavodniku(client, db, admin_headers):
    """Šíbal Marek 2005 a 1989 zadali oba ID 778290."""
    first = _racer(db, "Šibal", "Marek", 2005, "778290")
    second = _racer(db, "Šibal", "Marek", 1989, "778290")
    _run(db, FakeClient(members={"Šibal": [_person(43253, "Šibal", "Marek", None, 778290, age=THIS_YEAR - 2005)]}))

    items = {i["racer_id"]: i for i in client.get("/api/admin/slcr/pairs", headers=admin_headers).json()}
    assert items[first]["kind"] == "ok" and items[second]["kind"] == "id_mismatch"
    assert items[first]["flags"]["shared_member"] and items[second]["flags"]["shared_member"]

    assert client.post(f"/api/admin/slcr/pairs/{first}/confirm", headers=admin_headers).status_code == 200
    response = client.post(f"/api/admin/slcr/pairs/{second}/confirm", headers=admin_headers)
    assert response.status_code == 409


def test_api_druhe_nacteni_behem_behu_odmitne(client, db, admin_headers):
    slcr_sync.start_job(db, slcr_sync.SCOPE_ACTIVE, None)
    response = client.post("/api/admin/slcr/sync", json={"scope": "active"}, headers=admin_headers)
    assert response.status_code == 409


def test_api_spusteni_nacteni(client, db, admin_headers, monkeypatch):
    racer = _racer(db, "Novák", "Jan", 2010)
    monkeypatch.setattr(slcr, "SlcrClient", lambda: FakeClient())

    response = client.post("/api/admin/slcr/sync", json={"scope": "all"}, headers=admin_headers)
    assert response.status_code == 202

    # TestClient pustí úlohu na pozadí hned po odpovědi.
    summary = client.get("/api/admin/slcr/summary", headers=admin_headers).json()
    assert summary["running"] is False
    assert summary["job"]["finished_at"] is not None and summary["job"]["error"] is None
    assert summary["counts"]["not_found"] == 1
    db.expire_all()
    assert _status(db, racer)["status"] == "not_found"


def test_api_neznamy_rozsah(client, admin_headers):
    assert client.post("/api/admin/slcr/sync", json={"scope": "vse"}, headers=admin_headers).status_code == 400


def test_api_jen_pro_spravce(client, timekeeper_headers):
    assert client.get("/api/admin/slcr/summary", headers=timekeeper_headers).status_code == 403


def test_smazany_zavodnik_zmizi_z_parovani(client, db, admin_headers):
    racer = _racer(db, "Novák", "Jan", 2010)
    _run(db, FakeClient())
    assert client.delete(f"/api/admin/racers/{racer}", headers=admin_headers).status_code == 200
    assert _status(db, racer) is None


def _racer_row(db, racer_id):
    return db.execute(text("SELECT name, surname, year, slcr_id, category_id FROM fuj_jmlp_racer WHERE id = :id"),
                      {"id": racer_id}).mappings().first()


def _kategorie(db, name, sex, od, do):
    kategorie = models.Category(name=name, sex=sex, min_birth_year=od, max_birth_year=do, active=True)
    db.add(kategorie)
    db.commit()
    return kategorie.id


def test_potvrzeni_prevezme_jmeno_rocnik_a_id_z_evidence(client, db, admin_headers):
    """SLČR páruje nahrané výsledky podle jména a ročníku - náš záznam se srovná s evidencí."""
    predzacky = _kategorie(db, "U12 Předžactvo", 2, 2015, 2016)
    mysaci = _kategorie(db, "U8 Myšáci", 2, 2019, 2026)
    ema = _racer(db, "Fabiánová", "Ema", 2019, "891586")
    junova = _racer(db, "Junová", "Mariana", 2016, "891952")
    db.execute(text("UPDATE fuj_jmlp_racer SET category_id = :c WHERE id = :id"), {"c": predzacky, "id": junova})
    db.commit()
    _run(db, FakeClient(results=[
        _person(44319, "Fabiánová", "Emma", 2019, 891586),
        _person(45973, "Junová", "Mariana", 2022, 891952),
    ]))

    items = {i["racer"]["surname"]: i for i in client.get("/api/admin/slcr/pairs", headers=admin_headers).json()}
    assert {c["field"]: (c["old"], c["new"]) for c in items["Fabiánová"]["changes"]} == {"name": ("Ema", "Emma")}
    assert items["Junová"]["changes"] == [{"field": "year", "label": "ročník", "old": 2016, "new": 2022}]

    for racer in (ema, junova):
        assert client.post(f"/api/admin/slcr/pairs/{racer}/confirm", headers=admin_headers).status_code == 200
    db.expire_all()
    assert dict(_racer_row(db, ema)) | {"category_id": None} == {
        "name": "Emma", "surname": "Fabiánová", "year": 2019, "slcr_id": "891586", "category_id": None}
    # Nový ročník = nová kategorie.
    assert _racer_row(db, junova)["year"] == 2022
    assert _racer_row(db, junova)["category_id"] == mysaci

    [confirmed] = [i for i in client.get("/api/admin/slcr/pairs?status=confirmed", headers=admin_headers).json()
                   if i["racer_id"] == junova]
    assert confirmed["changes"] == []
    assert confirmed["applied"] == [{"field": "year", "label": "ročník", "old": 2016}]


def test_potvrzeni_ktere_by_vytvorilo_duplicitu_neprojde(client, db, admin_headers):
    viki = _racer(db, "Bezděková", "Viki", 2012)
    _racer(db, "Bezděková", "Viktorie", 2012)
    # Návrh, který by Viki přejmenoval na Viktorii - ta už v registru je.
    db.execute(text("""REPLACE INTO fuj_jmlp_racer_slcr (racer_id, status, member_id, slcr_surname, slcr_name, race_code)
                       VALUES (:id, 'suggested', 9, 'Bezděková', 'Viktorie', 886000)"""), {"id": viki})
    db.commit()

    response = client.post(f"/api/admin/slcr/pairs/{viki}/confirm", headers=admin_headers)

    assert response.status_code == 409
    assert "nejdřív je slučte" in response.json()["detail"]
    db.expire_all()
    assert _status(db, viki)["status"] == "suggested"
    assert _racer_row(db, viki)["name"] == "Viki"


def test_prevzeti_u_drive_potvrzenych(client, db, admin_headers):
    racer = _racer(db, "Pola", "Jonáš", 2004, "775512")
    _run(db, FakeClient(members={"Pola": [_person(5, "Pola", "Jonáš", None, 777512, age=THIS_YEAR - 2004)]}))
    # Potvrzeno dřív, než potvrzení opravovalo záznam.
    db.execute(text("UPDATE fuj_jmlp_racer_slcr SET status = 'confirmed' WHERE racer_id = :id"), {"id": racer})
    db.commit()
    assert client.get("/api/admin/slcr/summary", headers=admin_headers).json()["counts"]["pending_apply"] == 1

    result = client.post("/api/admin/slcr/apply-confirmed", headers=admin_headers).json()

    assert result == {"processed": 1, "changed": 1, "failed": []}
    db.expire_all()
    assert _racer_row(db, racer)["slcr_id"] == "777512"
    assert client.get("/api/admin/slcr/summary", headers=admin_headers).json()["counts"]["pending_apply"] == 0
