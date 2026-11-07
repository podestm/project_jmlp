"""Metadata stránek pro vyhledávače a náhledy odkazů.

Web je SPA: titulky a Open Graph značky nastavuje v prohlížeči JavaScript
(frontend/src/seo/pageMeta.js). Boti sociálních sítí (Facebook, WhatsApp,
Slack…) JavaScript nespouštějí - nginx je proto pošle sem (/seo/preview/…)
a dostanou malou HTML stránku s hotovými značkami. Texty musí odpovídat
pageMeta.js; při změně upravit obojí.

Tady je i obsah /robots.txt a /sitemap.xml.
"""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime
from html import escape
from xml.sax.saxutils import escape as xml_escape

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..utils import fix_encoding
from . import attachments as attachment_service

CUP_NAME = "Jihomoravský lyžařský pohár"
SHORT_NAME = "JMLP"
OG_IMAGE = "/og-image.jpg"
DEFAULT_DESCRIPTION = (
    "Seriál závodů v alpském lyžování pro děti a mládež na jižní Moravě. "
    "Kalendář závodů, přihlášky, živé výsledky a průběžné pořadí poháru."
)


@dataclass(frozen=True)
class PageMeta:
    title: str
    description: str = DEFAULT_DESCRIPTION


def public_title(name: str | None = None) -> str:
    return f"{name} · {CUP_NAME}" if name else CUP_NAME


# Veřejné stránky: cesta -> metadata (stejné jako PAGE_META ve frontendu).
PAGES = {
    "/": PageMeta(public_title()),
    "/zavody": PageMeta(
        public_title("Kalendář závodů"),
        "Termíny a areály závodů Jihomoravského lyžařského poháru v aktuální sezóně, propozice a přihlášky závodníků.",
    ),
    "/vysledky": PageMeta(
        public_title("Výsledky"),
        "Průběžné a celkové pořadí Jihomoravského lyžařského poháru podle kategorií a výsledkové listiny jednotlivých závodů.",
    ),
    "/aktuality": PageMeta(
        public_title("Aktuality"),
        "Novinky a oznámení Jihomoravského lyžařského poháru: termíny, změny programu a zprávy ze závodů.",
    ),
    "/dokumenty": PageMeta(
        public_title("Dokumenty"),
        "Soutěžní řád, pokyny a další dokumenty Jihomoravského lyžařského poháru ke stažení, včetně starších ročníků.",
    ),
    "/kontakty": PageMeta(
        public_title("Kontakty"),
        "Pořadatel a soutěžní výbor Jihomoravského lyžařského poháru a e-mailové kontakty na zúčastněné kluby.",
    ),
    "/zive": PageMeta(
        public_title("Živé výsledky"),
        "Průběžné časy a pořadí právě probíhajícího závodu Jihomoravského lyžařského poháru.",
    ),
    "/ochrana-osobnich-udaju": PageMeta(
        public_title("Ochrana osobních údajů"),
        "Jak pořadatel Jihomoravského lyžařského poháru zpracovává osobní údaje závodníků a návštěvníků webu.",
    ),
}

# Stránky, jejichž obsah se mění se závody aktuální sezóny (lastmod v sitemapě).
SEASON_PAGES = ("/zavody", "/vysledky")

_HOST_RE = re.compile(r"^[a-z0-9.-]+(:\d{1,5})?$")
_LOCAL_HOSTS = ("localhost", "127.0.0.1", "backend")


def site_origin(host: str | None) -> str:
    """Kořen webu podle hlavičky Host („https://podm12.com“).

    TLS končí na proxy před kontejnery, takže schéma z požadavku je http -
    veřejný web ale běží jen na https; http zůstává jen pro lokální vývoj.
    Podivný Host (podvržený) se nahradí produkční doménou.
    """
    host = (host or "").strip().lower()
    if not _HOST_RE.match(host):
        host = "jmlp.cz"
    scheme = "http" if host.split(":")[0] in _LOCAL_HOSTS else "https"
    return f"{scheme}://{host}"


# --------------------------------------------------------------------------
# Závody
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class RaceInfo:
    id: int
    datum: date | None
    season_id: int
    areal: str | None
    organizer: str | None
    lastmod: date | None


def _date_label(value: date | None) -> str | None:
    return f"{value.day}. {value.month}. {value.year}" if value else None


def race_meta(race: RaceInfo) -> PageMeta:
    """„Kraličák, 17. 1. 2027 · JMLP“ - stejně jako raceMeta ve frontendu."""
    date_label = _date_label(race.datum)
    name = ", ".join(part for part in (race.areal or "Závod", date_label) if part)
    where = " ".join(
        part
        for part in (
            race.areal and f"v areálu {race.areal}",
            date_label and f"dne {date_label}",
        )
        if part
    )
    description = (
        f"Závod Jihomoravského lyžařského poháru{f' {where}' if where else ''}"
        f"{f', pořádá {race.organizer}' if race.organizer else ''}. Propozice, přihlášky a výsledky."
    )
    return PageMeta(f"{name} · {SHORT_NAME}", description)


def _as_date(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    return value


def _lastmod(datum: date | None, *uploads, today: date) -> date | None:
    """Poslední změna stránky závodu: odjetý závod (den konání) nebo
    nahrání propozic či výsledků - podle toho, co je novější. Budoucí
    datum se nepočítá, závod bez obojího lastmod nemá."""
    candidates = [d for d in (_as_date(u) for u in uploads) if d]
    if datum and datum <= today:
        candidates.append(datum)
    candidates = [d for d in candidates if d <= today]
    return max(candidates) if candidates else None


_RACE_SQL = f"""
    SELECT r.id, r.datum, r.season_id,
           CONVERT(CONVERT(a.name USING binary) USING utf8mb4) AS areal_name,
           CONVERT(CONVERT(o.name USING binary) USING utf8mb4) AS organizer_name,
           fp.uploaded_at AS proposition_uploaded_at,
           fr.uploaded_at AS results_uploaded_at
    FROM fuj_jmlp_race r
    LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
    LEFT JOIN fuj_jmlp_club o ON r.organizer_id = o.id
    {attachment_service.race_document_joins(published_only=True)}
    WHERE r.race_nr IS NOT NULL
"""


def _known(value: str | None) -> str | None:
    value = fix_encoding(value) if value else None
    return value or None


def _race_info(row, today: date) -> RaceInfo:
    return RaceInfo(
        id=row.id,
        datum=row.datum,
        season_id=row.season_id,
        areal=_known(row.areal_name),
        organizer=_known(row.organizer_name),
        lastmod=_lastmod(
            row.datum, row.proposition_uploaded_at, row.results_uploaded_at, today=today
        ),
    )


def public_races(db: Session, today: date | None = None) -> list[RaceInfo]:
    """Závody, které web ukazuje (s číslem závodu, jako GET /races/)."""
    today = today or date.today()
    rows = db.execute(text(_RACE_SQL + " ORDER BY r.datum DESC, r.id DESC")).fetchall()
    return [_race_info(row, today) for row in rows]


def public_race(db: Session, race_id: int, today: date | None = None) -> RaceInfo | None:
    row = db.execute(text(_RACE_SQL + " AND r.id = :race_id"), {"race_id": race_id}).fetchone()
    return _race_info(row, today or date.today()) if row else None


# --------------------------------------------------------------------------
# Náhled pro boty
# --------------------------------------------------------------------------
_RACE_PATH = re.compile(r"^/zavod/(\d+)/?$")


def preview_meta(db: Session, path: str) -> PageMeta | None:
    """Metadata veřejné stránky, nebo None, když stránka neexistuje."""
    path = "/" + path.strip("/")
    if path in PAGES:
        return PAGES[path]
    match = _RACE_PATH.match(path)
    if match:
        race = public_race(db, int(match.group(1)))
        return race_meta(race) if race else None
    return None


NOT_FOUND = PageMeta(public_title("Stránka nenalezena"))


def preview_html(meta: PageMeta, url: str, origin: str) -> str:
    """Malá HTML stránka s titulkem a značkami Open Graph / Twitter."""
    title, description = escape(meta.title), escape(meta.description)
    url, image = escape(url), escape(f"{origin}{OG_IMAGE}")
    return f"""<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="cs_CZ">
<meta property="og:site_name" content="{escape(CUP_NAME)}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Znak Jihomoravského lyžařského poháru a závodník na trati">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{image}">
</head>
<body>
<h1>{title}</h1>
<p>{description}</p>
<p><a href="{url}">{url}</a></p>
</body>
</html>
"""


# --------------------------------------------------------------------------
# robots.txt a sitemap.xml
# --------------------------------------------------------------------------
def robots_txt(origin: str) -> str:
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin\n"
        "Disallow: /timekeeper\n"
        "Disallow: /api/\n"
        "\n"
        f"Sitemap: {origin}/sitemap.xml\n"
    )


def _url_entry(loc: str, lastmod: date | None) -> str:
    lastmod_tag = f"<lastmod>{lastmod.isoformat()}</lastmod>" if lastmod else ""
    return f"  <url><loc>{xml_escape(loc)}</loc>{lastmod_tag}</url>"


def sitemap_xml(origin: str, races: Iterable[RaceInfo], current_season_id: int) -> str:
    """Veřejné stránky a všechny závody. Kalendář a výsledky mají lastmod
    podle nejnovější změny závodu aktuální sezóny."""
    races = list(races)
    season_dates = [r.lastmod for r in races if r.season_id == current_season_id and r.lastmod]
    season_lastmod = max(season_dates) if season_dates else None
    entries = [
        _url_entry(f"{origin}{path}", season_lastmod if path in SEASON_PAGES else None)
        for path in PAGES
    ]
    entries += [_url_entry(f"{origin}/zavod/{race.id}", race.lastmod) for race in races]
    body = "\n".join(entries)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n"
        "</urlset>\n"
    )
