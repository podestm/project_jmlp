"""Aktuální sezóna.

Aktuální je ta sezóna, kterou správce označil ve správě sezón
(fuj_jmlp_season.is_current). Dokud není označená žádná, platí sezóna podle
data (hranice 1. 8., utils.get_current_season_id).

Tady se odpovídá na otázku "která sezóna je teď"; ke které sezóně patří závod
podle data, řeší dál utils.calculate_season_for_date.
"""
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..utils import get_current_season_id


def flagged_season_id(db: Session) -> Optional[int]:
    """year_start sezóny označené jako aktuální, nebo None."""
    return db.execute(text(
        "SELECT year_start FROM fuj_jmlp_season WHERE is_current = 1 "
        "ORDER BY year_start DESC LIMIT 1"
    )).scalar()


def current_season_id(db: Session) -> int:
    """year_start aktuální sezóny: označená, jinak podle dnešního data."""
    flagged = flagged_season_id(db)
    return flagged if flagged is not None else get_current_season_id()


def set_current_season(db: Session, season_pk: int) -> None:
    """Označí sezónu (podle id) jako jedinou aktuální.

    Jediný UPDATE: MyISAM nemá transakce, ale příkaz zamkne celou tabulku,
    takže nikdo nezahlédne stav se dvěma ani s žádnou aktuální sezónou.
    """
    db.execute(
        text("UPDATE fuj_jmlp_season SET is_current = (id = :id)"),
        {"id": season_pk},
    )
    db.commit()
