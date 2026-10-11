"""robots.txt, sitemap.xml a náhledy odkazů pro boty - app/routers/seo.py.

Web je SPA; boti sociálních sítí JavaScript nespouštějí, takže titulek
a Open Graph značky závodu jim musí poskládat server. Adresy v robots.txt,
sitemapě i značkách se berou z hlavičky Host - stejný kód běží na
jmlp.cz i na testovacím podm12.com.
"""
from datetime import date, datetime, timedelta
from xml.etree import ElementTree

from app import models
from app.services import seo

NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def _zavod(db, *, datum, race_nr="JMLP2026-01", season_id=2026, areal=None, organizer=None):
    areal_id = organizer_id = None
    if areal:
        a = models.Areal(name=areal)
        db.add(a)
        db.commit()
        areal_id = a.id
    if organizer:
        o = models.Club(name=organizer, valid=True)
        db.add(o)
        db.commit()
        organizer_id = o.id
    zavod = models.Race(race_nr=race_nr, datum=datum, season_id=season_id, areal_id=areal_id,
                        organizer_id=organizer_id, closed=False, registration=True, race_method_id=1)
    db.add(zavod)
    db.commit()
    db.refresh(zavod)
    return zavod


def _vysledky(db, race_id, uploaded_at, published=True):
    soubor = models.File(filename="x.pdf", original_filename="Výsledky.pdf", file_path="/tmp/x.pdf",
                         file_size=1, mime_type="application/pdf",
                         file_type=models.FileTypeEnum.vysledky, uploaded_at=uploaded_at)
    db.add(soubor)
    db.commit()
    db.add(models.Attachment(file_id=soubor.id, owner_type="race", owner_id=race_id, role="vysledky",
                             sort_order=0, published=published, is_generated=False))
    db.commit()


def test_robots_txt_bere_domenu_z_pozadavku(client):
    odpoved = client.get("/robots.txt", headers={"Host": "podm12.com"})
    assert odpoved.status_code == 200
    assert odpoved.headers["content-type"].startswith("text/plain")
    text = odpoved.text
    for radek in ("User-agent: *", "Disallow: /admin", "Disallow: /timekeeper", "Disallow: /api/",
                  "Sitemap: https://podm12.com/sitemap.xml"):
        assert radek in text


def test_podvrzeny_host_nepronikne_do_adres():
    assert seo.site_origin('evil.com"><script>') == "https://jmlp.cz"
    assert seo.site_origin("JMLP.cz") == "https://jmlp.cz"
    assert seo.site_origin("localhost:8000") == "http://localhost:8000"


def test_sitemap_stranky_a_zavody_s_lastmod(client, db):
    dnes = date.today()
    odjety = _zavod(db, datum=dnes - timedelta(days=30), season_id=2026)
    _vysledky(db, odjety.id, datetime.combine(dnes - timedelta(days=28), datetime.min.time()))
    budouci = _zavod(db, datum=dnes + timedelta(days=30), race_nr="JMLP2026-02", season_id=2026)
    bez_cisla = _zavod(db, datum=dnes, race_nr=None)
    db.add(models.Season(year_start=2026, year_end=2027, edition=21, name="2026/2027", is_current=True))
    db.commit()

    odpoved = client.get("/sitemap.xml", headers={"Host": "jmlp.cz"})
    assert odpoved.status_code == 200
    assert "xml" in odpoved.headers["content-type"]
    urls = {
        u.find("s:loc", NS).text: getattr(u.find("s:lastmod", NS), "text", None)
        for u in ElementTree.fromstring(odpoved.content).findall("s:url", NS)
    }

    for cesta in ("/", "/zavody", "/vysledky", "/aktuality", "/dokumenty", "/kontakty", "/zive",
                  "/ochrana-osobnich-udaju"):
        assert f"https://jmlp.cz{cesta}" in urls
    assert not any("/admin" in u or "/timekeeper" in u for u in urls)
    # Odjetý závod: novější z data konání a nahrání výsledků.
    assert urls[f"https://jmlp.cz/zavod/{odjety.id}"] == (dnes - timedelta(days=28)).isoformat()
    # Budoucí závod je v sitemapě, ale bez lastmod v budoucnosti.
    assert urls[f"https://jmlp.cz/zavod/{budouci.id}"] is None
    assert f"https://jmlp.cz/zavod/{bez_cisla.id}" not in urls
    # Kalendář a výsledky aktuální sezóny se mění se závody.
    assert urls["https://jmlp.cz/zavody"] == (dnes - timedelta(days=28)).isoformat()
    assert urls["https://jmlp.cz/kontakty"] is None


def test_nahled_zavodu_pro_bota(client, db):
    zavod = _zavod(db, datum=date(2027, 1, 17), areal="Kraličák", organizer="SKI KLUB JUNIOR BRNO")

    odpoved = client.get(f"/seo/preview/zavod/{zavod.id}", headers={"Host": "podm12.com"})
    assert odpoved.status_code == 200
    html = odpoved.text
    assert "<title>Kraličák, 17. 1. 2027 · JMLP</title>" in html
    assert '<meta property="og:title" content="Kraličák, 17. 1. 2027 · JMLP">' in html
    assert ("Závod Jihomoravského lyžařského poháru v areálu Kraličák dne 17. 1. 2027, "
            "pořádá SKI KLUB JUNIOR BRNO. Propozice, přihlášky a výsledky.") in html
    assert f'<meta property="og:url" content="https://podm12.com/zavod/{zavod.id}">' in html
    assert '<meta property="og:image" content="https://podm12.com/og-image.jpg">' in html
    assert '<meta property="og:locale" content="cs_CZ">' in html


def test_nahled_hlavnich_stranek_a_neznamy_zavod(client):
    uvod = client.get("/seo/preview/", headers={"Host": "jmlp.cz"})
    assert uvod.status_code == 200
    assert "<title>Jihomoravský lyžařský pohár</title>" in uvod.text
    assert '<meta property="og:url" content="https://jmlp.cz/">' in uvod.text

    kontakty = client.get("/seo/preview/kontakty", headers={"Host": "jmlp.cz"})
    assert "<title>Kontakty · Jihomoravský lyžařský pohár</title>" in kontakty.text

    assert client.get("/seo/preview/zavod/999999").status_code == 404
    assert client.get("/seo/preview/admin").status_code == 404


def test_nahled_escapuje_nazvy(client, db):
    zavod = _zavod(db, datum=date(2027, 1, 17), areal='Areál "<b>"')
    html = client.get(f"/seo/preview/zavod/{zavod.id}").text
    assert "<b>" not in html
    assert "Areál &quot;&lt;b&gt;&quot;" in html
