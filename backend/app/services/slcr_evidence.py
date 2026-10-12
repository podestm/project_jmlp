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
"""
from __future__ import annotations

import os
import unicodedata
from dataclasses import dataclass
from datetime import date
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


class SlcrError(Exception):
    """Chyba při komunikaci s evidencí - text je pro uživatele."""


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


def plan_races(
    categories: Iterable[Dict[str, Any]],
    existing: Iterable[Dict[str, Any]],
    race_date: date,
    start_time: Optional[str] = None,
    discipline: int = DEFAULT_DISCIPLINE,
) -> List[Dict[str, Any]]:
    """Co se v akci založí, doplní nebo nechá.

    categories: naše kategorie {id, name, sex, year_from, year_to} v pořadí.
    existing: závody akce z evidence (publicRacingEvent.races).

    Vrací položky {category_id, name, action, slcr_race_id, input}:
      create - závod v akci není, založí se,
      codex  - závod je (stejný název), ale nemá náš kodex - doplní se,
      keep   - závod s kodexem už je, nic se nemění.
    """
    existing = list(existing)
    used: set = set()
    plan: List[Dict[str, Any]] = []
    for category in categories:
        found = next((race for race in existing if race["id"] not in used and _matches(race, category)), None)
        codex = str(category["id"])
        if found is not None:
            used.add(found["id"])
            action = "keep" if same_codex(found.get("codex"), category["id"]) else "codex"
            plan.append({"category_id": category["id"], "name": category["name"], "action": action,
                         "slcr_race_id": found["id"], "slcr_name": found.get("name")})
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
      category {
        __typename
        ... on PublicRacingRaceCategory { name sex yearFrom yearTo }
        ... on PublicRacingCategory { id }
      }
    }
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
    return event


def update_races(event_id: int, inputs: List[Dict[str, Any]], config: Optional[Settings] = None) -> Dict[str, Any]:
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


def upload_results(event_id: int, xml: bytes, layout: Optional[str] = None,
                   config: Optional[Settings] = None) -> Dict[str, Any]:
    """Nahraje FIS XML (dataset) do akce. Import je atomický."""
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
