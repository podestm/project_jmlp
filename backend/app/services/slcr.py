"""Párování závodníků s evidencí Svazu lyžařů ČR (evidence.czech-ski.com).

Evidence nemá zveřejněné API ani dokumentaci. Její web ale běží nad GraphQL
(https://evidence.czech-ski.com/graphql), schéma se dá zjistit introspekcí
a veřejné údaje se dají číst bez přihlášení. Je to interní API jejich webu
a může se změnit bez ohlášení - proto je všechno, co z něj čteme, jen
návrh, který potvrzuje správce.

Zdroje pro párování, od nejspolehlivějšího:
 1. Výsledky akcí JMLP zveřejněné v evidenci. U závodníků je přiřazený člen
    SLČR, jeho české číslo závodníka i ročník - stejní lidé, stejné závody.
 2. Hledání člena podle příjmení. Veřejné údaje člena mají české číslo
    závodníka (raceCode), ale většinou ne ročník.

Naše "ID závodníka" (fuj_jmlp_racer.slcr_id) je to, co závodník napsal
v přihlášce, a je to jeho odpovědnost - párování ho nikdy nepřepisuje,
jen ukáže, když nesouhlasí s evidencí.

Klub se neposuzuje. SLČR při nahrání výsledků páruje závodníky podle jména
a ročníku (klub ho nezajímá) a klub si u nás závodník vybírá ze schválených
klubů. Důležité je proto, aby jméno a ročník souhlasily s evidencí - jinak
se výsledek v SLČR ke členovi nepřiřadí.
"""
from __future__ import annotations

import logging
import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Callable, Iterable, Optional

import httpx

logger = logging.getLogger(__name__)

GRAPHQL_URL = "https://evidence.czech-ski.com/graphql"
MEMBER_URL = "https://evidence.czech-ski.com/clenove/{id}/{slug}"

# Úsek alpských disciplín (AD) - JMLP je alpský pohár.
DEPARTMENT_ALPINE = 1
DEPARTMENT_ALPINE_LABEL = "AD"

# Podle čeho se v kalendáři evidence hledají akce JMLP. Starší akce se
# jmenují celým názvem poháru, novější zkratkou.
EVENT_SEARCH_TERMS = ("JMLP", "Jihomoravský lyžařský pohár")

# Ohleduplnost k cizímu serveru: mezi dotazy krátká pauza.
REQUEST_PAUSE_SECONDS = 0.2

CONFIDENCE_HIGH = "high"
CONFIDENCE_MEDIUM = "medium"
CONFIDENCE_LOW = "low"

SOURCE_RACE_CODE = "race_code"
SOURCE_RESULTS = "results"
SOURCE_SEARCH = "search"


class SlcrError(Exception):
    """Evidence neodpověděla nebo odpověděla chybou."""


# --------------------------------------------------------------------------
# Porovnávání jmen
# --------------------------------------------------------------------------
def norm(value: Optional[str]) -> str:
    """Jméno bez diakritiky, malými písmeny, s jednou mezerou mezi slovy."""
    text = unicodedata.normalize("NFD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text).strip().lower()


def _edit_distance_at_most_one(a: str, b: str) -> bool:
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) > len(b):
        a, b = b, a
    i = j = edits = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            i += 1
            j += 1
            continue
        edits += 1
        if edits > 1:
            return False
        if len(a) == len(b):
            i += 1
        j += 1
    return edits + (len(b) - j) + (len(a) - i) <= 1


def _collapse_doubles(value: str) -> str:
    return re.sub(r"(.)\1+", r"\1", value)


def same_first_name(ours: Optional[str], theirs: Optional[str]) -> bool:
    """Shoda křestního jména i v běžných variantách zápisu.

    Ema/Emma, Matyas/Matyáš, "Viktorie Ela"/"Viktorie", Kristyna/Kristýna:
    stejná po odstranění diakritiky a zdvojených písmen, jedno je prvním
    slovem druhého, nebo se delší jména liší o jedno písmeno. Mužská
    a ženská podoba (Jan/Jana, Martin/Martina) shoda není.
    """
    a, b = norm(ours), norm(theirs)
    if not a or not b:
        return False
    if a == b or _collapse_doubles(a) == _collapse_doubles(b):
        return True
    if a.split(" ")[0] == b.split(" ")[0]:
        return True
    if a + "a" == b or b + "a" == a:
        return False
    return min(len(a), len(b)) >= 5 and _edit_distance_at_most_one(a, b)


def race_code_of(slcr_id: Optional[str]) -> Optional[int]:
    """Naše "ID závodníka" jako české číslo závodníka, je-li to číslo."""
    text = (slcr_id or "").strip()
    return int(text) if re.fullmatch(r"\d{5,7}", text) else None


# --------------------------------------------------------------------------
# Data
# --------------------------------------------------------------------------
@dataclass
class SlcrPerson:
    """Člověk, jak ho zná evidence - z výsledků nebo z karty člena."""
    member_id: Optional[int]
    surname: str
    name: str
    year: Optional[int] = None
    race_code: Optional[int] = None
    club: Optional[str] = None
    slug: Optional[str] = None
    alpine: bool = True
    source_event: Optional[str] = None


@dataclass
class RacerToPair:
    id: int
    surname: str
    name: str
    year: Optional[int]
    slcr_id: Optional[str] = None


@dataclass
class Proposal:
    """Návrh spárování jednoho našeho závodníka."""
    person: Optional[SlcrPerson]
    confidence: Optional[str]
    source: Optional[str]
    note: str = ""
    alternatives: list = field(default_factory=list)


# --------------------------------------------------------------------------
# Párování (čistá logika, bez sítě)
# --------------------------------------------------------------------------
def _distinct_members(people: Iterable[SlcrPerson]) -> list[SlcrPerson]:
    seen = {}
    for person in people:
        key = person.member_id if person.member_id is not None else (norm(person.surname), norm(person.name), person.year)
        current = seen.get(key)
        # Záznam s číslem závodníka je užitečnější.
        if current is None or (current.race_code is None and person.race_code is not None):
            seen[key] = person
    return list(seen.values())


def propose(
    racer: RacerToPair,
    results: list[SlcrPerson],
    search: Callable[[str, str], list[SlcrPerson]],
) -> Proposal:
    """Najde člena SLČR k našemu závodníkovi (viz _propose).

    Když nic nenajde, zkusí ještě prohozené jméno a příjmení - v registru
    jsou závodníci, kterým se při přihlášce zapsalo obráceně.
    """
    proposal = _propose(racer, results, search)
    if proposal.person is not None or not racer.name:
        return proposal
    swapped = RacerToPair(racer.id, racer.name, racer.surname, racer.year, racer.slcr_id)
    other = _propose(swapped, results, search)
    if other.person is None:
        return proposal
    other.confidence = CONFIDENCE_LOW if other.confidence == CONFIDENCE_LOW else CONFIDENCE_MEDIUM
    other.note = f"jméno a příjmení jsou u nás prohozené; {other.note}"
    return other


def _propose(
    racer: RacerToPair,
    results: list[SlcrPerson],
    search: Callable[[str, str], list[SlcrPerson]],
) -> Proposal:
    """Najde člena SLČR k našemu závodníkovi.

    `results` jsou závodníci z výsledků akcí JMLP v evidenci (už mají
    přiřazeného člena a ročník). `search(příjmení, jméno)` hledá v evidenci
    členy a volá se, jen když výsledky nestačí - stojí síťové dotazy.
    """
    code = race_code_of(racer.slcr_id)
    surname = norm(racer.surname)

    # 1) Naše ID závodníka mezi výsledky JMLP.
    if code is not None:
        by_code = _distinct_members(p for p in results if p.race_code == code and p.member_id)
        named = [p for p in by_code if norm(p.surname) == surname]
        if len(named) == 1:
            return Proposal(named[0], CONFIDENCE_HIGH, SOURCE_RACE_CODE, "ID závodníka i příjmení souhlasí")

    # 2) Jméno a ročník mezi výsledky JMLP.
    in_results = _distinct_members(
        p for p in results
        if p.member_id and norm(p.surname) == surname and p.year == racer.year
        and same_first_name(racer.name, p.name)
    )
    if len(in_results) == 1:
        person = in_results[0]
        exact = norm(person.name) == norm(racer.name)
        return Proposal(
            person,
            CONFIDENCE_HIGH if exact else CONFIDENCE_MEDIUM,
            SOURCE_RESULTS,
            "jméno a ročník z výsledků JMLP" if exact else f"ročník souhlasí, jméno v evidenci: {person.name}",
        )
    if len(in_results) > 1:
        return Proposal(in_results[0], CONFIDENCE_LOW, SOURCE_RESULTS,
                        "ve výsledcích JMLP je víc lidí se stejným jménem a ročníkem",
                        alternatives=in_results[1:])

    # 3) Hledání v evidenci podle příjmení.
    candidates = [
        p for p in search(racer.surname, racer.name)
        if norm(p.surname) == surname and same_first_name(racer.name, p.name)
        # Známý ročník, který nesedí, kandidáta vylučuje.
        and (p.year is None or racer.year is None or p.year == racer.year)
    ]
    candidates = _distinct_members(candidates)
    if code is not None:
        by_code = [p for p in candidates if p.race_code == code]
        if len(by_code) == 1:
            return Proposal(by_code[0], CONFIDENCE_HIGH, SOURCE_RACE_CODE, "ID závodníka i jméno souhlasí")
    if not candidates:
        return Proposal(None, None, None, "v evidenci SLČR nenalezen")

    # Klub se neposuzuje - SLČR páruje výsledky jen podle jména a ročníku
    # a klub si závodník vybírá z našich schválených klubů.
    # Alpské lyžování a přesné jméno napřed.
    candidates.sort(key=lambda p: (not p.alpine, norm(p.name) != norm(racer.name), p.year is None))
    best = candidates[0]
    if len(candidates) == 1:
        notes = ["jméno souhlasí, ročník evidence nezveřejňuje" if best.year is None else "jméno a ročník souhlasí"]
        if not best.alpine:
            notes.append("člen jiného úseku než alpských disciplín")
        confidence = CONFIDENCE_MEDIUM if best.alpine else CONFIDENCE_LOW
        return Proposal(best, confidence, SOURCE_SEARCH, "; ".join(notes))
    return Proposal(best, CONFIDENCE_LOW, SOURCE_SEARCH,
                    f"v evidenci je {len(candidates)} lidí se stejným jménem", alternatives=candidates[1:])


# --------------------------------------------------------------------------
# Evidence SLČR - čtení veřejných údajů
# --------------------------------------------------------------------------
class SlcrClient:
    def __init__(self, http: Optional[httpx.Client] = None, pause: float = REQUEST_PAUSE_SECONDS):
        self.http = http or httpx.Client(timeout=30.0, headers={"User-Agent": "jmlp.cz parovani zavodniku"})
        self.pause = pause
        self._member_cache: dict[int, dict] = {}
        self._search_cache: dict[str, list[SlcrPerson]] = {}

    def query(self, query: str, variables: Optional[dict] = None) -> dict:
        try:
            response = self.http.post(GRAPHQL_URL, json={"query": query, "variables": variables or {}})
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise SlcrError(f"Evidence SLČR neodpověděla: {exc}") from exc
        finally:
            if self.pause:
                time.sleep(self.pause)
        if payload.get("errors"):
            raise SlcrError(f"Evidence SLČR vrátila chybu: {payload['errors'][0].get('message')}")
        return payload["data"]

    # -- akce JMLP a jejich výsledky ---------------------------------------
    def jmlp_event_ids(self, since: str) -> list[int]:
        """Akce JMLP v kalendáři evidence od data `since` (YYYY-MM-DD)."""
        found = {}
        for term in EVENT_SEARCH_TERMS:
            for tab in ("past", "future"):
                page = 0
                while True:
                    data = self.query(
                        "query($i:DataGridInput!,$f:AppDataGridExtendedInput!){"
                        "appPublicDataGrid(name:public_racing_event,input:$i,filter:$f){count result}}",
                        {"i": {"f": [], "search": term, "tab": tab, "perPage": 50, "page": page,
                               "s": {"name": "dateFrom", "dir": "desc"}}, "f": {}},
                    )["appPublicDataGrid"]
                    rows = data["result"]
                    older = False
                    for row in rows:
                        info = row.get("name") or {}
                        state = row.get("state") or {}
                        date_from = state.get("dateFrom") or ""
                        if info.get("departmentShortcut") != DEPARTMENT_ALPINE_LABEL:
                            continue
                        if date_from and date_from < since:
                            older = True
                            continue
                        found[row["id"]] = info.get("name")
                    page += 1
                    if older or len(rows) < 50 or page * 50 >= data["count"]:
                        break
        return sorted(found)

    def event_results(self, event_id: int) -> list[SlcrPerson]:
        data = self.query(
            "query($e:Int!){publicRacingEvent(event:$e){name date{from} races{resultRace{state "
            "athleteResults{athlete{name surname yearOfBirth raceCode clubName member{id slug}}}}}}}",
            {"e": event_id},
        )["publicRacingEvent"]
        label = data.get("name")
        people = []
        for race in data.get("races") or []:
            result = race.get("resultRace") or {}
            if result.get("state") != "Published":
                continue
            for item in result.get("athleteResults") or []:
                athlete = item.get("athlete") or {}
                member = athlete.get("member") or {}
                people.append(SlcrPerson(
                    member_id=member.get("id"),
                    slug=member.get("slug"),
                    surname=athlete.get("surname") or "",
                    name=athlete.get("name") or "",
                    year=athlete.get("yearOfBirth"),
                    race_code=athlete.get("raceCode"),
                    club=athlete.get("clubName"),
                    source_event=label,
                ))
        return people

    def jmlp_results(self, since: str) -> list[SlcrPerson]:
        people = []
        for event_id in self.jmlp_event_ids(since):
            people.extend(self.event_results(event_id))
        return people

    # -- členové -------------------------------------------------------------
    def member(self, member_id: int) -> dict:
        if member_id not in self._member_cache:
            self._member_cache[member_id] = self.query(
                "query($m:Int!){publicMember(member:$m){id slug name surname raceCode birthYear homeClubName}}",
                {"m": member_id},
            )["publicMember"]
        return self._member_cache[member_id]

    def search_members(self, surname: str) -> list[SlcrPerson]:
        """Členové evidence se shodným příjmením (bez ohledu na diakritiku)."""
        key = norm(surname)
        if key in self._search_cache:
            return self._search_cache[key]
        data = self.query(
            "query($i:DataGridInput!,$f:DataGridExtendedInput!){"
            "publicDataGrid(name:public_member,input:$i,filter:$f){count result}}",
            {"i": {"f": [{"name": "surname", "value": surname.strip(), "op": "like"}],
                   "perPage": 100, "page": 0}, "f": {}},
        )["publicDataGrid"]
        people = []
        for row in data["result"]:
            if norm(row.get("surname")) != key:
                continue
            labels = {d.get("label") for d in row.get("departments") or []}
            people.append(SlcrPerson(
                member_id=row["id"],
                slug=row.get("slug"),
                surname=row.get("surname") or "",
                name=row.get("name") or "",
                year=row.get("birthYear"),
                club=row.get("mainClub"),
                alpine=DEPARTMENT_ALPINE_LABEL in labels,
            ))
        self._search_cache[key] = people
        return people

    def search_with_codes(self, surname: str, first_name: Optional[str]) -> list[SlcrPerson]:
        """Jako search_members, jen kandidátům se shodným jménem doplní číslo závodníka."""
        people = self.search_members(surname)
        for person in people:
            if person.race_code is None and same_first_name(first_name, person.name):
                detail = self.member(person.member_id)
                person.race_code = detail.get("raceCode")
                person.year = person.year or detail.get("birthYear")
                person.club = detail.get("homeClubName") or person.club
        return people


def member_url(member_id: Optional[int], slug: Optional[str]) -> Optional[str]:
    if not member_id:
        return None
    return MEMBER_URL.format(id=member_id, slug=slug or "clen")
