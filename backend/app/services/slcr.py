"""Křížová kontrola závodníků s evidencí Svazu lyžařů ČR (evidence.czech-ski.com).

Evidence nemá zveřejněné API ani dokumentaci. Její web ale běží nad GraphQL
(https://evidence.czech-ski.com/graphql), schéma se dá zjistit introspekcí
a veřejné údaje se dají číst bez přihlášení. Je to interní API jejich webu
a může se změnit bez ohlášení.

Párování je jen křížová kontrola dvou klíčů, bez odhadování podobnosti:
 1. ID závodníka (české číslo závodníka v SLČR): komu v evidenci patří a sedí
    k němu naše jméno a ročník?
 2. Jméno + ročník (podle nich SLČR páruje nahrané výsledky): kdo je to
    v evidenci a sedí jeho ID s naším?
Jména se porovnávají přesně, jen bez ohledu na velikost písmen. Ročník bere
evidence z výsledků akcí JMLP, jinak se dopočítá z věku (ten je veřejný,
ročník ne). Klub se neposuzuje.

Kde člena v evidenci hledáme: výsledky akcí JMLP zveřejněné v evidenci
(mají člena, ID i ročník) a členové se stejným příjmením. Podle ID samotného
evidence hledat neumí.
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date
from typing import Callable, Iterable, Optional

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

# Výsledky křížové kontroly.
KIND_OK = "ok"                    # ID i jméno s ročníkem ukazují na stejného člena
KIND_FILL_ID = "fill_id"          # ID nemáme, jméno a ročník najdou člena s ID
KIND_OTHER_ID = "other_id"        # jméno a ročník najdou člena s jiným ID než naše
KIND_ID_MISMATCH = "id_mismatch"  # naše ID patří členovi s jiným jménem nebo ročníkem
KIND_ID_UNKNOWN = "id_unknown"    # naše ID v evidenci nenajdu a jméno s ročníkem také ne
KIND_AMBIGUOUS = "ambiguous"      # víc členů se stejným jménem i ročníkem
KIND_NOT_FOUND = "not_found"      # bez ID a nikdo nesedí - nečlen SLČR

# Co jde potvrdit bez přemýšlení: nic se nemění, nebo se jen doplní ID.
CLEAR_KINDS = (KIND_OK, KIND_FILL_ID)


class SlcrError(Exception):
    """Evidence neodpověděla nebo odpověděla chybou."""


# --------------------------------------------------------------------------
# Porovnávání
# --------------------------------------------------------------------------
def same_text(ours: Optional[str], theirs: Optional[str]) -> bool:
    """Přesná shoda jména - jen bez ohledu na velikost písmen a mezery okolo."""
    a = re.sub(r"\s+", " ", ours or "").strip().casefold()
    b = re.sub(r"\s+", " ", theirs or "").strip().casefold()
    return bool(a) and a == b


def year_fits_age(year: Optional[int], age: Optional[int], today: Optional[date] = None) -> Optional[bool]:
    """Sedí ročník na věk z evidence? None = nedá se říct.

    Evidence ročník veřejně neuvádí, věk ano. Kdo je dnes X let, narodil se
    v roce (letos - X) nebo o rok dřív, podle toho, jestli už měl narozeniny.
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
    # Věk podle evidence (veřejný, na rozdíl od ročníku) - viz year_fits_age.
    age: Optional[int] = None

    def fits_year(self, year: Optional[int]) -> Optional[bool]:
        if self.year is not None and year is not None:
            return self.year == year
        return year_fits_age(year, self.age)

    def year_label(self) -> Optional[str]:
        if self.year is not None:
            return str(self.year)
        if self.age is not None:
            this_year = date.today().year
            return f"{this_year - self.age - 1}/{this_year - self.age}"
        return None


@dataclass
class RacerToPair:
    id: int
    surname: str
    name: str
    year: Optional[int]
    slcr_id: Optional[str] = None


@dataclass
class Proposal:
    """Výsledek křížové kontroly jednoho našeho závodníka."""
    person: Optional[SlcrPerson]
    kind: str
    note: str = ""
    alternatives: list = field(default_factory=list)


# --------------------------------------------------------------------------
# Křížová kontrola (čistá logika, bez sítě)
# --------------------------------------------------------------------------
def _distinct(people: Iterable[SlcrPerson]) -> list[SlcrPerson]:
    """Jeden záznam na člena; přednost má ten s ročníkem a ID (z výsledků)."""
    seen: dict = {}
    for person in people:
        if person.member_id is None:
            continue
        current = seen.get(person.member_id)
        if current is None:
            seen[person.member_id] = person
            continue
        if current.year is None and person.year is not None:
            current.year = person.year
        if current.race_code is None and person.race_code is not None:
            current.race_code = person.race_code
        if current.age is None and person.age is not None:
            current.age = person.age
    return list(seen.values())


def _who(person: SlcrPerson) -> str:
    year = person.year_label()
    return f"{person.surname} {person.name}" + (f" ({year})" if year else "")


def cross_check(
    racer: RacerToPair,
    results: list[SlcrPerson],
    search: Callable[[str], list[SlcrPerson]],
) -> Proposal:
    """Křížová kontrola: naše ID proti evidenci a naše jméno + ročník proti evidenci.

    `results` jsou závodníci z výsledků akcí JMLP v evidenci (mají člena, ID
    i ročník). `search(příjmení)` vrátí členy evidence se stejným příjmením
    i s jejich ID a věkem - stojí síťové dotazy.
    """
    code = race_code_of(racer.slcr_id)
    same_surname = [p for p in results if same_text(racer.surname, p.surname)]
    if not same_surname or code is not None and not any(p.race_code == code for p in same_surname):
        same_surname = same_surname + search(racer.surname)
    people = _distinct(same_surname)

    # 1) Komu patří naše ID.
    by_code = next((p for p in people if code is not None and p.race_code == code), None)
    # 2) Kdo má naše jméno a ročník.
    by_name = [
        p for p in people
        if same_text(racer.surname, p.surname) and same_text(racer.name, p.name) and p.fits_year(racer.year)
    ]

    if by_code is not None:
        name_ok = same_text(racer.surname, by_code.surname) and same_text(racer.name, by_code.name)
        year_ok = by_code.fits_year(racer.year)
        if name_ok and year_ok:
            return Proposal(by_code, KIND_OK, "ID, jméno i ročník sedí")
        if year_ok is None and name_ok:
            return Proposal(by_code, KIND_OK, "ID a jméno sedí, ročník evidence neuvádí")
        if len(by_name) == 1 and by_name[0].member_id != by_code.member_id:
            other = by_name[0]
            return Proposal(other, KIND_OTHER_ID,
                            f"naše ID {code} patří v evidenci členovi {_who(by_code)}; "
                            f"člen se stejným jménem a ročníkem má ID {other.race_code or '–'}",
                            alternatives=[by_code])
        what = "jméno" if not name_ok and year_ok else ("ročník" if name_ok else "jméno a ročník")
        return Proposal(by_code, KIND_ID_MISMATCH, f"naše ID patří v evidenci členovi {_who(by_code)} - nesedí {what}")

    if len(by_name) > 1:
        return Proposal(by_name[0], KIND_AMBIGUOUS,
                        f"v evidenci je {len(by_name)} členů se stejným jménem a ročníkem",
                        alternatives=by_name[1:])
    if len(by_name) == 1:
        person = by_name[0]
        if code is None:
            if person.race_code is None:
                return Proposal(person, KIND_OK, "jméno a ročník sedí, člen nemá ID závodníka")
            return Proposal(person, KIND_FILL_ID, "jméno a ročník sedí, u nás chybí ID")
        return Proposal(person, KIND_OTHER_ID,
                        f"jméno a ročník sedí, ale v evidenci má ID {person.race_code or '–'}, u nás {code}")

    if code is not None:
        return Proposal(None, KIND_ID_UNKNOWN, f"ID {code} v evidenci nenalezeno a jméno s ročníkem také ne")
    return Proposal(None, KIND_NOT_FOUND, "v evidenci SLČR nenalezen")


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
                "query($m:Int!){publicMember(member:$m){id slug name surname raceCode birthYear age homeClubName}}",
                {"m": member_id},
            )["publicMember"]
        return self._member_cache[member_id]

    def search_members(self, surname: str) -> list[SlcrPerson]:
        """Členové evidence s přesně stejným příjmením (velikost písmen nerozhoduje)."""
        key = (surname or "").strip().casefold()
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
