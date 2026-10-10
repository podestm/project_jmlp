"""Doplnění chybějícího ID závodníka z evidence Svazu lyžařů ČR (evidence.czech-ski.com).

Jediná kontrola: závodníkovi, který u nás nemá ID závodníka (české číslo
závodníka v SLČR), se najde člen evidence se stejným jménem a ročníkem
a doplní se jeho ID. Nic jiného se nemění.

 - Jméno: příjmení i křestní jméno se shodují bez ohledu na diakritiku
   a velikost písmen (Bajkova = Bajková, Ema ≠ Emma).
 - Ročník: z výsledků akcí JMLP zveřejněných v evidenci, jinak dopočtený
   z věku - ročník evidence veřejně neuvádí, věk ano.
 - Doplní se jen jednoznačná shoda: přesně jeden takový člen a má ID.

Evidence nemá zveřejněné API; její web běží nad GraphQL
(https://evidence.czech-ski.com/graphql), veřejné údaje se čtou bez
přihlášení. Je to interní API jejich webu a může se změnit bez ohlášení.
"""
from __future__ import annotations

import logging
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import date
from typing import Callable, Optional

import httpx

logger = logging.getLogger(__name__)

GRAPHQL_URL = "https://evidence.czech-ski.com/graphql"
MEMBER_URL = "https://evidence.czech-ski.com/clenove/{id}/{slug}"

# Úsek alpských disciplín (AD) - JMLP je alpský pohár.
DEPARTMENT_ALPINE_LABEL = "AD"

# Podle čeho se v kalendáři evidence hledají akce JMLP. Starší akce se
# jmenují celým názvem poháru, novější zkratkou.
EVENT_SEARCH_TERMS = ("JMLP", "Jihomoravský lyžařský pohár")

# Ohleduplnost k cizímu serveru: mezi dotazy krátká pauza.
REQUEST_PAUSE_SECONDS = 0.2


class SlcrError(Exception):
    """Evidence neodpověděla nebo odpověděla chybou."""


# --------------------------------------------------------------------------
# Porovnávání
# --------------------------------------------------------------------------
def fold(value: Optional[str]) -> str:
    """Jméno bez diakritiky, malými písmeny, s jednou mezerou mezi slovy."""
    text = unicodedata.normalize("NFD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text).strip().casefold()


def same_text(ours: Optional[str], theirs: Optional[str]) -> bool:
    """Shoda jména bez ohledu na diakritiku a velikost písmen."""
    a = fold(ours)
    return bool(a) and a == fold(theirs)


def year_fits_age(year: Optional[int], age: Optional[int], today: Optional[date] = None) -> Optional[bool]:
    """Sedí ročník na věk z evidence? None = nedá se říct.

    Kdo je dnes X let, narodil se v roce (letos - X) nebo o rok dřív, podle
    toho, jestli už měl narozeniny.
    """
    if year is None or age is None:
        return None
    this_year = (today or date.today()).year
    return year in (this_year - age, this_year - age - 1)


def race_code_of(slcr_id: Optional[str]) -> Optional[int]:
    """Naše "ID závodníka" jako české číslo závodníka, je-li to číslo."""
    text = (slcr_id or "").strip()
    return int(text) if re.fullmatch(r"\d{5,7}", text) else None


# --------------------------------------------------------------------------
# Data
# --------------------------------------------------------------------------
@dataclass
class SlcrPerson:
    """Člen evidence - z výsledků JMLP nebo z karty člena."""
    member_id: Optional[int]
    surname: str
    name: str
    year: Optional[int] = None
    race_code: Optional[int] = None
    club: Optional[str] = None
    slug: Optional[str] = None
    # Věk podle evidence (veřejný, na rozdíl od ročníku) - viz year_fits_age.
    age: Optional[int] = None

    def fits_year(self, year: Optional[int]) -> bool:
        if self.year is not None and year is not None:
            return self.year == year
        return bool(year_fits_age(year, self.age))


@dataclass
class RacerToPair:
    id: int
    surname: str
    name: str
    year: Optional[int]
    slcr_id: Optional[str] = None


def find_member(
    racer: RacerToPair,
    results: list[SlcrPerson],
    search: Callable[[str], list[SlcrPerson]],
) -> Optional[SlcrPerson]:
    """Jediný člen evidence se stejným jménem a ročníkem, který má ID; jinak None.

    `results` jsou závodníci z výsledků akcí JMLP v evidenci (mají ID
    i ročník), `search(příjmení)` vrátí členy se stejným příjmením i s ID
    a věkem (stojí síťové dotazy, volá se, jen když výsledky nestačí).
    """
    def matching(people):
        found = {}
        for p in people:
            if p.member_id and same_text(racer.surname, p.surname) and same_text(racer.name, p.name) \
                    and p.fits_year(racer.year):
                found.setdefault(p.member_id, p)
                if found[p.member_id].race_code is None:
                    found[p.member_id].race_code = p.race_code
        return list(found.values())

    candidates = matching(results)
    if not candidates:
        candidates = matching(search(racer.surname))
    if len(candidates) == 1 and candidates[0].race_code:
        return candidates[0]
    return None


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
                "query($m:Int!){publicMember(member:$m){id slug name surname raceCode birthYear age homeClubName}}",
                {"m": member_id},
            )["publicMember"]
        return self._member_cache[member_id]

    def search_members(self, surname: str) -> list[SlcrPerson]:
        """Členové evidence s přesně stejným příjmením (velikost písmen nerozhoduje)."""
        key = fold(surname)
        if key in self._search_cache:
            return self._search_cache[key]
        people, page = [], 0
        while True:
            data = self.query(
                "query($i:DataGridInput!,$f:DataGridExtendedInput!){"
                "publicDataGrid(name:public_member,input:$i,filter:$f){count result}}",
                {"i": {"f": [{"name": "surname", "value": surname.strip(), "op": "like"}],
                       "perPage": 100, "page": page}, "f": {}},
            )["publicDataGrid"]
            for row in data["result"]:
                if not same_text(surname, row.get("surname")):
                    continue
                people.append(SlcrPerson(
                    member_id=row["id"],
                    slug=row.get("slug"),
                    surname=row.get("surname") or "",
                    name=row.get("name") or "",
                    year=row.get("birthYear"),
                    club=row.get("mainClub"),
                ))
            page += 1
            if len(data["result"]) < 100 or page * 100 >= data["count"]:
                break
        self._search_cache[key] = people
        return people

    def search_with_details(self, surname: str) -> list[SlcrPerson]:
        """Jako search_members, jen s ID závodníka a věkem každého člena (karta člena)."""
        people = self.search_members(surname)
        for person in people:
            if person.age is None and person.race_code is None:
                detail = self.member(person.member_id)
                person.race_code = detail.get("raceCode")
                person.year = person.year or detail.get("birthYear")
                person.age = detail.get("age")
                person.club = detail.get("homeClubName") or person.club
        return people


def member_url(member_id: Optional[int], slug: Optional[str]) -> Optional[str]:
    if not member_id:
        return None
    return MEMBER_URL.format(id=member_id, slug=slug or "clen")
