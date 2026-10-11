"""Odkaz ze závodníka na kartu člena v evidenci SLČR (evidence.czech-ski.com).

Jen odkaz - nic se podle evidence neopravuje. Známé členy drží tabulka
fuj_jmlp_slcr_member (naplněná při jednorázovém pročištění registru 10. 10.
2026). Závodník je propojený, když:
 - jeho ID závodníka je české číslo závodníka známého člena, nebo
 - příjmení, jméno a ročník se se členem shodují přesně (včetně diakritiky).
"""
from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

MEMBER_URL = "https://evidence.czech-ski.com/clenove/{id}/{slug}"


def member_url(member_id: int, slug: Optional[str]) -> str:
    return MEMBER_URL.format(id=member_id, slug=slug or "clen")


def _code(slcr_id: Optional[str]) -> Optional[int]:
    value = (slcr_id or "").strip()
    return int(value) if re.fullmatch(r"\d{5,7}", value) else None


class MemberLinks:
    """Známí členové evidence, načtení jednou pro celý seznam závodníků."""

    def __init__(self, db: Session):
        self.by_code: dict[int, str] = {}
        self.by_identity: dict[tuple, str] = {}
        for row in db.execute(text(
            "SELECT member_id, slug, race_code, surname, name, year FROM fuj_jmlp_slcr_member"
        )):
            url = member_url(row.member_id, row.slug)
            if row.race_code:
                self.by_code.setdefault(row.race_code, url)
            if row.surname and row.name and row.year:
                self.by_identity.setdefault((row.surname.strip(), row.name.strip(), row.year), url)

    def url_for(self, surname: Optional[str], name: Optional[str], year: Optional[int],
                slcr_id: Optional[str]) -> Optional[str]:
        code = _code(slcr_id)
        if code is not None and code in self.by_code:
            return self.by_code[code]
        return self.by_identity.get(((surname or "").strip(), (name or "").strip(), year))
