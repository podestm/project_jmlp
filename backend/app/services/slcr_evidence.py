"""Napojení na evidenci SLČR (evidence.czech-ski.com).

Dvě různá rozhraní evidence:

* **Oficiální API pro časomíry** (`/api/v1/timekeeper/...`, hlavička
  `Auth-token` = token Měřící skupiny JMLP, `SLCR_API_TOKEN`). Umí vypsat
  akce a nahrát výsledky jako FIS XML. Závody zakládat neumí.

* **GraphQL webu evidence** (`/graphql`) - to, co volá web, když se v akci
  ručně zakládají závody. Neoficiální: SLČR ho může změnit bez ohlášení.
  Přihlašuje se jménem a heslem (`SLCR_USERNAME`, `SLCR_PASSWORD`) účtu, který
  smí v akci zakládat závody; evidence po přihlášení vrátí token v hlavičce
  `X-Authorization` a web ho posílá zpět ve stejné hlavičce.

Závody se zakládají jedním voláním `racingRacesUpdate(event, inputs)`. Posílá
se vždy celý seznam závodů akce - stávající s `id` beze změny (kromě
doplněného kodexu) a nové bez `id` - aby se nic nesmazalo, ať už evidence
seznam bere jako úplný, nebo jen jako doplnění.

Kodex nového závodu = id naší kategorie; podle něj pak import výsledků
(services/fis_xml.py) přiřadí výsledky ke správnému závodu.

Výsledky po kategoriích (zjištěno jen čtením 2026-10-12: introspekce GraphQL,
JS webu evidence, sondy GET/OPTIONS na oficiální API; nic se nezapisovalo)
--------------------------------------------------------------------------
* Oficiální API má pro výsledky jen jednu cestu: POST
  `/api/v1/timekeeper/racing/department/{d}/event/{e}/results` (GET/OPTIONS
  vrací 405 = cesta existuje). Cesta pro jeden závod (`.../race/{id}/results`
  apod.) neexistuje (404). Výsledky jedné kategorie se proto posílají jako
  FIS XML Dataset s jediným závodem (kodex = id kategorie). [jisté: cesty;
  NEOVĚŘENO naživo: že import datasetu s jedním závodem nesahá na ostatní
  závody akce a že přepíše dřívější výsledky téhož závodu]
* GraphQL `resultRaceImport(racingRace, file: UUID)` web používá jen pro
  import z Excelu podle šablony evidence (namespace `result-race-xls-import`),
  ne pro FIS XML. `resultsCreate` / `resultRaceBulkImport` jsou hromadné
  importy celé akce. Soubor (UUID) web získá nahráním `multipart` pole
  `files[]` na `POST /api/cms/files/upload?namespace=results` (odpověď je pole
  File {uuid…}). [jisté – z kódu webu] Tyhle cesty aplikace nepoužívá.
* Stav výsledků závodu: `publicRacingEvent.races[].resultRace { id state }`,
  `resultRace` je null, dokud závod výsledky nemá. ResultRaceState: Draft,
  Checked, Published, Canceled, Hidden. Čas zveřejnění evidence nevrací.
  [jisté – čteno naživo]
* Přechody podle nabídky akcí webu (tvorba výsledků): Draft → `resultRaceCheck`
  → Checked → `resultRacePublish` → Published; Published → `resultRaceDraft`
  („zrušit zveřejnění“) → Draft. Všechny berou `racingRace: Int!` a vrací
  PublicRacingRace. [jisté – z kódu webu; NEOVĚŘENO naživo: v jakém stavu
  skončí závod po importu přes oficiální API a zda kontrola neodmítne
  nespárované závodníky]
* Oprava zveřejněné kategorie: Draft → import → kontrola → zveřejnění.

Zkušební režim (SLCR_DRY_RUN=1): čtení jde do evidence naostro, zápisy
(zakládání závodů, nahrání výsledků, kontrola, zveřejnění, zrušení
zveřejnění) se neposílají – jen se zapamatují v paměti procesu a čtení akce
je do výsledku promítne, aby šel celý postup proklikat. Do restartu backendu.
"""
from __future__ import annotations

import os
import threading
from contextlib import contextmanager
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

import httpx

BASE_URL = os.getenv("SLCR_BASE_URL", "https://evidence.czech-ski.com").rstrip("/")
DEPARTMENT_ALPINE = 1
AUTH_HEADER = "X-Authorization"
TIMEOUT = httpx.Timeout(30.0, connect=10.0)

# Disciplíny alpského úseku v číselníku evidence (publicRacingDiscipline).
DISCIPLINES = [
    {"id": 26, "code": "TR", "name": "Trénink"},
    {"id": 18, "code": "SL", "name": "Slalom"},
    {"id": 19, "code": "GS", "name": "Obří slalom"},
    {"id": 20, "code": "SG", "name": "Superobří slalom"},
    {"id": 21, "code": "DH", "name": "Sjezd"},
    {"id": 59, "code": "LD", "name": "Lyžařské dovednosti"},
]
DEFAULT_DISCIPLINE = 26
# Kód disciplíny FIS do XML výsledků; trénink kód FIS nemá.
FIS_CODE_BY_DISCIPLINE = {18: "SL", 19: "GS", 20: "SG", 21: "DH"}
RESULT_LAYOUTS = {
    "SL": "ALPINE_SKIING_INDIVIDUAL_SLALOM",
    "GS": "ALPINE_SKIING_INDIVIDUAL_GIANT_SLALOM",
    "SG": "ALPINE_SKIING_INDIVIDUAL_SUPER_G",
    "DH": "ALPINE_SKIING_INDIVIDUAL_DOWNHILL",
}
DEFAULT_LAYOUT = "ALPINE_SKIING_INDIVIDUAL_SLALOM"
DEFAULT_START_TIME = "10:00:00"
# Akce, které měří naše měřící skupina (v evidenci "timekeepingCompany").
# Seznam akcí z oficiálního API je celý alpský úsek – nabízíme jen naše.
OWN_TIMEKEEPING = os.getenv("SLCR_TIMEKEEPING_COMPANY", "Měřící skupina JMLP").strip()


class SlcrError(Exception):
    """Chyba při komunikaci s evidencí - text je pro uživatele."""


class SlcrBusy(SlcrError):
    """Stejný závod se do evidence právě posílá (dvojklik, dvě zařízení)."""


def dry_run() -> bool:
    """Zkušební režim: zápisy do evidence se neposílají (SLCR_DRY_RUN=1)."""
    return os.getenv("SLCR_DRY_RUN", "").strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    api_token: str
    username: str
    password: str

    @property
    def has_token(self) -> bool:
        return bool(self.api_token)

    @property
    def has_login(self) -> bool:
        return bool(self.username and self.password)


def settings() -> Settings:
    return Settings(
        api_token=os.getenv("SLCR_API_TOKEN", "").strip(),
        username=os.getenv("SLCR_USERNAME", "").strip(),
        password=os.getenv("SLCR_PASSWORD", ""),
    )


# ---------------------------------------------------------------------------
# Čisté funkce - plán závodů
# ---------------------------------------------------------------------------
def fold(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    return "".join(ch for ch in text if not unicodedata.combining(ch)).lower().strip()


def racing_sex(sex: Optional[int]) -> str:
    if sex == 2:
        return "Female"
    if sex == 1:
        return "Male"
    return "Both"


def _id_of(value: Any) -> Optional[int]:
    return value.get("id") if isinstance(value, dict) else None


def existing_race_input(race: Dict[str, Any]) -> Dict[str, Any]:
    """Stávající závod akce jako RacingRaceInput - beze změny."""
    category = race.get("category") or {}
    if category.get("__typename") == "PublicRacingCategory":
        category_input = {"codebook": category.get("id")}
    else:
        category_input = {"manual": {
            "name": category.get("name") or race.get("name") or "",
            "sex": category.get("sex") or race.get("sex") or "Both",
            "yearFrom": category.get("yearFrom"),
            "yearTo": category.get("yearTo"),
        }}
    return {
        "id": race["id"],
        "type": _id_of(race.get("type")),
        "discipline": _id_of(race.get("discipline")),
        "technique": _id_of(race.get("technique")),
        "category": category_input,
        "name": race.get("name") or "",
        "code": race.get("code"),
        "codex": race.get("codex"),
        "date": race.get("date"),
        "startTime": race.get("startTime"),
        "distance": race.get("distance"),
        "state": race.get("state") or "Published",
        "registrationLimit": race.get("registrationLimit"),
        "documents": [
            {"id": doc.get("id"), "variant": doc.get("variant"), "file": (doc.get("file") or {}).get("uuid")}
            for doc in race.get("documents") or []
        ],
    }


def same_codex(codex: Any, category_id: Any) -> bool:
    """Evidence kodex doplní nulami na 4 číslice ("20" se uloží jako "0020")."""
    text = str(codex or "").strip()
    return text.isdigit() and int(text) == int(category_id)


def _matches(race: Dict[str, Any], category: Dict[str, Any]) -> bool:
    if same_codex(race.get("codex"), category["id"]):
        return True
    wanted = fold(category["name"])
    names = {fold(race.get("name")), fold((race.get("category") or {}).get("name"))}
    return wanted in names


SKIP_REASON = "Na startovní listině nikdo není"


def plan_races(
    categories: Iterable[Dict[str, Any]],
    existing: Iterable[Dict[str, Any]],
    race_date: date,
    start_time: Optional[str] = None,
    discipline: int = DEFAULT_DISCIPLINE,
) -> List[Dict[str, Any]]:
    """Co se v akci založí, doplní nebo nechá.

    categories: naše kategorie {id, name, sex, year_from, year_to, entries}
    v pořadí; entries = počet závodníků na startovce (chybí = neznámý).
    existing: závody akce z evidence (publicRacingEvent.races).

    Vrací položky {category_id, name, action, slcr_race_id, input}:
      create - závod v akci není, založí se,
      codex  - závod je (stejný název), ale nemá náš kodex - doplní se,
      keep   - závod s kodexem už je, nic se nemění,
      skip   - na startovce nikdo není, nezakládá se (reason = proč).
    """
    existing = list(existing)
    used: set = set()
    plan: List[Dict[str, Any]] = []
    for category in categories:
        found = next((race for race in existing if race["id"] not in used and _matches(race, category)), None)
        codex = str(category["id"])
        empty = category.get("entries") == 0
        if found is not None:
            used.add(found["id"])
            action = "keep" if same_codex(found.get("codex"), category["id"]) else "codex"
            if action == "codex" and empty:
                action = "skip"
            plan.append({"category_id": category["id"], "name": category["name"], "action": action,
                         "slcr_race_id": found["id"], "slcr_name": found.get("name"),
                         **({"reason": SKIP_REASON} if action == "skip" else {})})
            continue
        if empty:
            plan.append({"category_id": category["id"], "name": category["name"], "action": "skip",
                         "slcr_race_id": None, "reason": SKIP_REASON})
            continue
        years = sorted(y for y in (category.get("year_from"), category.get("year_to")) if y is not None)
        plan.append({
            "category_id": category["id"], "name": category["name"], "action": "create", "slcr_race_id": None,
            "input": {
                "discipline": discipline,
                "category": {"manual": {
                    "name": category["name"],
                    "sex": racing_sex(category.get("sex")),
                    "yearFrom": years[0] if years else None,
                    "yearTo": years[-1] if years else None,
                }},
                "name": category["name"],
                "codex": codex,
                "date": race_date.isoformat(),
                "startTime": start_time or DEFAULT_START_TIME,
                "state": "Published",
                "documents": [],
            },
        })
    return plan


def build_inputs(existing: Iterable[Dict[str, Any]], plan: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Celý seznam závodů akce pro racingRacesUpdate: stávající + nové."""
    codex_by_race = {item["slcr_race_id"]: str(item["category_id"]) for item in plan if item["action"] == "codex"}
    inputs = []
    for race in existing:
        data = existing_race_input(race)
        if race["id"] in codex_by_race:
            data["codex"] = codex_by_race[race["id"]]
        inputs.append(data)
    inputs.extend(item["input"] for item in plan if item["action"] == "create")
    return inputs


# ---------------------------------------------------------------------------
# Komunikace s evidencí
# ---------------------------------------------------------------------------
EVENT_QUERY = """
query Event($event: Int!) {
  publicRacingEvent(event: $event) {
    id name place categoryMode
    date { from to }
    races {
      id name code codex sex date startTime distance state registrationLimit
      type { id } discipline { id name } technique { id }
      documents { id variant file { uuid } }
      resultRace { id state }
      category {
        __typename
        ... on PublicRacingRaceCategory { name sex yearFrom yearTo }
        ... on PublicRacingCategory { id }
      }
    }
  }
}
"""

EVENT_OWNER_QUERY = """
query EventOwner($event: Int!) {
  publicRacingEvent(event: $event) {
    id
    timekeepingCompany { id name }
    region { name }
  }
}
"""

LOGIN_MUTATION = """
mutation Login($username: String!, $password: String!) {
  authLogin(username: $username, password: $password) {
    id fullName
    identityOptions { id label type manager }
  }
}
"""

RACES_UPDATE_MUTATION = """
mutation RacesUpdate($event: Int!, $inputs: [RacingRaceInput!]!) {
  racingRacesUpdate(event: $event, inputs: $inputs) { id races { id name codex } }
}
"""


def _graphql(client: httpx.Client, query: str, variables: Dict[str, Any],
             token: Optional[str] = None) -> tuple[Dict[str, Any], httpx.Response]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers[AUTH_HEADER] = token
    try:
        response = client.post(f"{BASE_URL}/graphql", json={"query": query, "variables": variables}, headers=headers)
    except httpx.HTTPError as exc:
        raise SlcrError(f"Evidence SLČR neodpovídá ({exc.__class__.__name__})") from exc
    if response.status_code >= 500:
        raise SlcrError(f"Evidence SLČR vrátila chybu {response.status_code}")
    try:
        payload = response.json()
    except ValueError as exc:
        raise SlcrError(f"Evidence SLČR vrátila neočekávanou odpověď ({response.status_code})") from exc
    errors = payload.get("errors") or []
    if errors:
        message = "; ".join(str(error.get("message") or error) for error in errors[:3])
        raise SlcrError(f"Evidence SLČR: {message}")
    return payload.get("data") or {}, response


IDENTITY_COOKIE = "identity"
# Pořadí, ve kterém se vybírá role účtu, když jich má víc.
IDENTITY_PREFERENCE = ("Team", "Timekeeper", "Section", "Area", "Admin", "Person")


def pick_identity(options: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Role, pod kterou aplikace v evidenci jedná: SLCR_IDENTITY (popisek
    nebo id z evidence), jinak klub, pak měřící skupina; správcovská přednostně."""
    wanted = os.getenv("SLCR_IDENTITY", "").strip()
    if wanted:
        for option in options:
            if wanted in (option.get("label"), option.get("id")):
                return option
    def rank(option):
        kind = option.get("type")
        order = IDENTITY_PREFERENCE.index(kind) if kind in IDENTITY_PREFERENCE else len(IDENTITY_PREFERENCE)
        return (order, not option.get("manager"))
    return min(options, key=rank) if options else None


def _login(client: httpx.Client, config: Settings) -> Optional[str]:
    if not config.has_login:
        raise SlcrError("Chybí přihlášení do evidence (SLCR_USERNAME a SLCR_PASSWORD v .env)")
    try:
        data, response = _graphql(client, LOGIN_MUTATION, {"username": config.username, "password": config.password})
    except SlcrError as exc:
        raise SlcrError(f"Přihlášení do evidence se nepovedlo - {exc}") from exc
    # Za koho uživatel jedná (klub, měřící skupina...) - web to drží v cookie
    # "identity" a bez ní evidence úpravy odmítne ("Missing identity cookie").
    identity = pick_identity((data.get("authLogin") or {}).get("identityOptions") or [])
    if identity:
        client.cookies.set(IDENTITY_COOKIE, identity["id"], domain=httpx.URL(BASE_URL).host)
    # Evidence vrací token v cookie X-Authorization; web ho pak posílá
    # v hlavičce stejného jména. Cookie si navíc drží i klient.
    return response.headers.get(AUTH_HEADER) or client.cookies.get(AUTH_HEADER)


def fetch_event(event_id: int, config: Optional[Settings] = None, login: bool = True) -> Dict[str, Any]:
    """Akce s jejími závody. S přihlášením (je-li nastavené) - jen tak je vidět kodex."""
    config = config or settings()
    with httpx.Client(timeout=TIMEOUT) as client:
        token = _login(client, config) if login and config.has_login else None
        event = _graphql(client, EVENT_QUERY, {"event": int(event_id)}, token)[0].get("publicRacingEvent")
    if not event:
        raise SlcrError(f"Akce {event_id} v evidenci není")
    return _DRY.overlay(event) if dry_run() else event


def update_races(event_id: int, inputs: List[Dict[str, Any]], config: Optional[Settings] = None) -> Dict[str, Any]:
    if dry_run():
        return _DRY.update_races(int(event_id), inputs)
    config = config or settings()
    with httpx.Client(timeout=TIMEOUT) as client:
        token = _login(client, config)
        data, _ = _graphql(client, RACES_UPDATE_MUTATION, {"event": int(event_id), "inputs": inputs}, token)
    return data.get("racingRacesUpdate") or {}


def _api_headers(config: Settings, content_type: Optional[str] = None) -> Dict[str, str]:
    if not config.has_token:
        raise SlcrError("Chybí token časomíry (SLCR_API_TOKEN v .env)")
    headers = {"Auth-token": config.api_token, "Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _api_error(response: httpx.Response) -> SlcrError:
    detail = ""
    try:
        body = response.json()
        detail = body.get("message") or body.get("error") or body.get("detail") or str(body)
    except ValueError:
        detail = response.text[:500]
    if response.status_code in (401, 403):
        return SlcrError(f"Evidence odmítla token časomíry ({response.status_code}) {detail}".strip())
    return SlcrError(f"Evidence SLČR vrátila {response.status_code}: {detail}".strip())


def _event_summary(item: Dict[str, Any]) -> Dict[str, Any]:
    date_value = item.get("date")
    if isinstance(date_value, dict):
        date_value = date_value.get("from") or date_value.get("start")
    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "place": item.get("place"),
        "date": date_value or item.get("dateFrom"),
    }


def list_events(date_from: date, date_to: date, config: Optional[Settings] = None) -> List[Dict[str, Any]]:
    """Akce alpského úseku v rozsahu dat (oficiální API)."""
    config = config or settings()
    params = {"department": DEPARTMENT_ALPINE, "dateFrom": date_from.isoformat(), "dateTo": date_to.isoformat()}
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            response = client.get(f"{BASE_URL}/api/v1/timekeeper/racing/event", params=params,
                                  headers=_api_headers(config))
    except httpx.HTTPError as exc:
        raise SlcrError(f"Evidence SLČR neodpovídá ({exc.__class__.__name__})") from exc
    if response.status_code != 200:
        raise _api_error(response)
    body = response.json()
    items = body if isinstance(body, list) else (body.get("items") or body.get("data") or body.get("result") or [])
    return [_event_summary(item) for item in items if isinstance(item, dict)]


def is_own_event(owner: Dict[str, Any], own: str = OWN_TIMEKEEPING) -> bool:
    """Akci měří naše měřící skupina – podle názvu (bez diakritiky) nebo id."""
    company = (owner or {}).get("timekeepingCompany") or {}
    if not own or not company:
        return False
    return fold(own) in (fold(company.get("name")), fold(company.get("id")))


def own_events(events: List[Dict[str, Any]], config: Optional[Settings] = None) -> List[Dict[str, Any]]:
    """Z akcí alpského úseku nechá jen ty, které měří naše měřící skupina.
    Měřící firmu vrací jen GraphQL webu evidence, proto se dotáže po akcích
    (kolem data závodu jich je jen pár)."""
    config = config or settings()
    if not events:
        return []
    with httpx.Client(timeout=TIMEOUT) as client:
        token = _login(client, config) if config.has_login else None
        owners = {}
        for event in events:
            data, _ = _graphql(client, EVENT_OWNER_QUERY, {"event": int(event["id"])}, token)
            owners[event["id"]] = data.get("publicRacingEvent") or {}
    return [event for event in events if is_own_event(owners.get(event["id"]))]


def upload_results(event_id: int, xml: bytes, layout: Optional[str] = None,
                   config: Optional[Settings] = None) -> Dict[str, Any]:
    """Nahraje FIS XML (dataset) do akce. Import je atomický."""
    if dry_run():
        return {"message": "Zkušební režim: výsledky se do evidence neposlaly.", "dry_run": True}
    config = config or settings()
    params = {"athleteCodeType": "RACE_CODE"}
    if layout:
        params["layout"] = layout
    url = f"{BASE_URL}/api/v1/timekeeper/racing/department/{DEPARTMENT_ALPINE}/event/{int(event_id)}/results"
    try:
        with httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            response = client.post(url, params=params, content=xml,
                                   headers=_api_headers(config, "application/xml"))
    except httpx.HTTPError as exc:
        raise SlcrError(f"Evidence SLČR neodpovídá ({exc.__class__.__name__})") from exc
    if response.status_code >= 300:
        raise _api_error(response)
    try:
        return response.json()
    except ValueError:
        return {"message": response.text[:2000]}


# ---------------------------------------------------------------------------
# Výsledky jedné kategorie (= jednoho závodu akce)
# ---------------------------------------------------------------------------
STATE_LABELS = {
    "Draft": "rozpracované",
    "Checked": "zkontrolované",
    "Published": "zveřejněné",
    "Canceled": "zrušené",
    "Hidden": "skryté",
}

RESULT_STATE_QUERY = """
query ResultStates($event: Int!) {
  publicRacingEvent(event: $event) { id races { id resultRace { id state } } }
}
"""

# resultRaceCheck / resultRacePublish / resultRaceDraft - stejný tvar.
RESULT_MUTATION = """
mutation ResultRace($race: Int!) {
  %s(racingRace: $race) { id resultRace { id state } }
}
"""
RESULT_MUTATIONS = ("resultRaceCheck", "resultRacePublish", "resultRaceDraft")


def find_race(races: Iterable[Dict[str, Any]], category_id: int) -> Optional[Dict[str, Any]]:
    """Závod akce s kodexem naší kategorie."""
    return next((race for race in races if same_codex(race.get("codex"), category_id)), None)


def result_state(race: Optional[Dict[str, Any]]) -> Optional[str]:
    return ((race or {}).get("resultRace") or {}).get("state")


def _read_state(client: httpx.Client, token: Optional[str], event_id: int, race_id: int) -> Optional[str]:
    event = _graphql(client, RESULT_STATE_QUERY, {"event": int(event_id)}, token)[0].get("publicRacingEvent") or {}
    race = next((item for item in event.get("races") or [] if item.get("id") == race_id), None)
    if race is None:
        raise SlcrError(f"Závod {race_id} v akci {event_id} v evidenci není")
    return result_state(race)


def _change_state(client: httpx.Client, token: Optional[str], mutation: str, race_id: int) -> Optional[str]:
    assert mutation in RESULT_MUTATIONS
    data, _ = _graphql(client, RESULT_MUTATION % mutation, {"race": int(race_id)}, token)
    return result_state(data.get(mutation))


def _not_published(state: Optional[str]) -> SlcrError:
    label = STATE_LABELS.get(state or "", state or "bez výsledků")
    return SlcrError(f"Výsledky jsou v evidenci, ale zůstaly {label} - dokončete zveřejnění přímo v evidenci.")


def publish_race_results(event_id: int, race_id: int, xml: bytes, layout: Optional[str] = None,
                         config: Optional[Settings] = None) -> str:
    """Pošle výsledky jednoho závodu a zveřejní je. Vrací konečný stav.

    Už zveřejněný závod se nejdřív vrátí do rozpracovaných (oprava), pak se
    výsledky nahrají znovu, zkontrolují a zveřejní.
    """
    with race_lock(race_id):
        if dry_run():
            return _DRY.publish(int(race_id))
        config = config or settings()
        with httpx.Client(timeout=TIMEOUT) as client:
            token = _login(client, config)
            state = _read_state(client, token, event_id, race_id)
            if state in ("Canceled", "Hidden"):
                raise SlcrError(f"Výsledky závodu jsou v evidenci {STATE_LABELS[state]} - "
                                "to se dá změnit jen přímo v evidenci.")
            if state == "Published":
                _change_state(client, token, "resultRaceDraft", race_id)
        try:
            upload_results(event_id, xml, layout, config)
        except SlcrError as exc:
            if state == "Published":
                raise SlcrError(f"{exc} Pozor: dřívější výsledky kategorie teď v evidenci nejsou zveřejněné.") from exc
            raise
        with httpx.Client(timeout=TIMEOUT) as client:
            token = _login(client, config)
            state = _read_state(client, token, event_id, race_id)
            if state is None:
                raise SlcrError("Evidence výsledky k závodu nepřiřadila - zkontrolujte kodex závodu v akci.")
            if state == "Draft":
                state = _change_state(client, token, "resultRaceCheck", race_id)
            if state == "Checked":
                state = _change_state(client, token, "resultRacePublish", race_id)
        if state != "Published":
            raise _not_published(state)
        _PUBLISHED_AT[int(race_id)] = datetime.now(timezone.utc)
        return state


# Kdy aplikace závod naposledy zveřejnila (evidence čas nevrací). Jen do
# restartu backendu - po něm panel řekne jen „Zveřejněno“.
_PUBLISHED_AT: Dict[int, datetime] = {}
_BUSY: set = set()
_BUSY_LOCK = threading.Lock()


def published_at(race_id: Optional[int]) -> Optional[datetime]:
    return _PUBLISHED_AT.get(race_id) if race_id is not None else None


@contextmanager
def race_lock(race_id: int):
    """Jeden závod se do evidence posílá jen jednou naráz."""
    race_id = int(race_id)
    with _BUSY_LOCK:
        if race_id in _BUSY:
            raise SlcrBusy("Výsledky téhle kategorie se do evidence právě posílají - počkejte na dokončení.")
        _BUSY.add(race_id)
    try:
        yield
    finally:
        with _BUSY_LOCK:
            _BUSY.discard(race_id)


class _DryStore:
    """Zkušební režim: co by se do evidence zapsalo, drží se jen v paměti."""

    def __init__(self):
        self.lock = threading.Lock()
        self.races: Dict[int, List[Dict[str, Any]]] = {}
        self.results: Dict[int, str] = {}
        self.next_id = -1

    def reset(self) -> None:
        with self.lock:
            self.races.clear()
            self.results.clear()
            self.next_id = -1

    def _fake_race(self, data: Dict[str, Any]) -> Dict[str, Any]:
        manual = (data.get("category") or {}).get("manual") or {}
        race = {key: data.get(key) for key in ("name", "code", "codex", "date", "startTime", "distance",
                                               "state", "registrationLimit")}
        race.update({
            "id": data.get("id") or self.next_id,
            "sex": manual.get("sex") or "Both",
            "type": None, "technique": None, "documents": [],
            "discipline": {"id": data.get("discipline")},
            "category": {"__typename": "PublicRacingRaceCategory", **manual},
        })
        if not data.get("id"):
            self.next_id -= 1
        return race

    def update_races(self, event_id: int, inputs: List[Dict[str, Any]]) -> Dict[str, Any]:
        with self.lock:
            self.races[event_id] = [self._fake_race(item) for item in inputs]
            races = self.races[event_id]
        return {"id": event_id, "races": [{"id": r["id"], "name": r["name"], "codex": r["codex"]} for r in races],
                "dry_run": True}

    def publish(self, race_id: int) -> str:
        with self.lock:
            self.results[race_id] = "Published"
        _PUBLISHED_AT[race_id] = datetime.now(timezone.utc)
        return "Published"

    def overlay(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Akce z evidence tak, jak by vypadala po zkušebních zápisech."""
        with self.lock:
            stored = {race["id"]: race for race in self.races.get(int(event.get("id") or 0), [])}
            results = dict(self.results)
        races = []
        for race in event.get("races") or []:
            if race["id"] in stored:
                race = {**race, "codex": stored[race["id"]].get("codex")}
            races.append(race)
        races.extend(race for race_id, race in stored.items() if race_id < 0)
        races = [{**race, "resultRace": {"id": race["id"], "state": results[race["id"]]}}
                 if race["id"] in results else race for race in races]
        return {**event, "races": races}


_DRY = _DryStore()
