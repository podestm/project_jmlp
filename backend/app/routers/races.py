from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..models import AttachmentRole
from ..services import attachments as attachment_service
from ..services import live as live_service
from ..services import seasons as season_service
from ..services.live_cache import live_results
from ..utils import (
    EDITION_BASE_YEAR,
    calculate_season_for_date,
    category_display_sql,
    get_current_season_id,
    to_roman,
)

router = APIRouter(prefix="/races", tags=["races"])


def get_current_season_filter(db: Session) -> int:
    """
    Získá aktuální season_id pro filtrování závodů.

    Rozhoduje sezóna označená ve správě jako aktuální. Bez ní se vezme
    sezóna podle data, a když v ní ještě nejsou závody, poslední se závody.
    """
    flagged = season_service.flagged_season_id(db)
    if flagged is not None:
        return flagged

    current_season = get_current_season_id()

    # Ověříme, že tato sezóna existuje v databázi
    result = db.execute(
        text("SELECT COUNT(*) as count FROM fuj_jmlp_race WHERE season_id = :season_id"),
        {"season_id": current_season},
    ).fetchone()

    if result.count > 0:
        return current_season
    else:
        # Pokud aktuální sezóna neexistuje, vezmi nejvyšší dostupnou
        result = db.execute(
            text("SELECT MAX(season_id) as max_season FROM fuj_jmlp_race")
        ).fetchone()
        return result.max_season if result.max_season else current_season


# Helper endpoints for dropdowns - must be before parametrized routes
@router.get("/areals", response_model=list[schemas.Areal])
def list_areals(db: Session = Depends(get_db)):
    """List all areals for dropdown selection."""
    areals = db.query(models.Areal).all()
    return areals


@router.get("/organizers", response_model=list[schemas.Club])
def list_organizers(db: Session = Depends(get_db)):
    """List all clubs that can be organizers."""
    clubs = db.query(models.Club).filter(models.Club.valid == True).all()
    return clubs


@router.get("/", response_model=list[schemas.Race])
def list_races(
    current_season: bool = False,
    upcoming: bool = False,
    past: bool = False,
    limit: int = None,
    db: Session = Depends(get_db),
):
    # Sestavíme SQL dotaz s filtry
    base_query = f"""
        SELECT r.id, r.closed+0 as closed, r.datum, r.race_nr,
               r.registration+0 as registration, r.areal_id,
               r.organizer_id, r.race_method_id, r.season_id,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name,
               CONVERT(CONVERT(o.name USING binary) USING utf8mb4) as organizer_name,
               {attachment_service.RACE_DOCUMENT_COLUMNS}
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        LEFT JOIN fuj_jmlp_club o ON r.organizer_id = o.id
        {attachment_service.race_document_joins(published_only=True)}
        WHERE r.race_nr IS NOT NULL
    """

    # Přidáme filtry
    if current_season:
        # Dynamicky určíme aktuální sezónu podle data
        current_season_id = get_current_season_filter(db)
        base_query += f" AND r.season_id = {current_season_id}"

    if upcoming:
        # Pouze nadcházející závody
        base_query += " AND r.datum >= CURDATE()"
        base_query += " ORDER BY r.datum ASC"
    elif past:
        # Pouze uplynulé závody
        base_query += " AND r.datum < CURDATE()"
        base_query += " ORDER BY r.datum DESC"
    else:
        base_query += " ORDER BY r.datum DESC"

    # Přidáme LIMIT pokud je zadán
    if limit:
        base_query += f" LIMIT {limit}"

    # Používáme raw SQL pro správné čtení bit hodnot a načítání areálu
    result = db.execute(text(base_query)).fetchall()

    races = []
    for row in result:
        race_data = {
            "id": row.id,
            "closed": bool(row.closed),
            "datum": row.datum,
            "race_nr": row.race_nr,
            "registration": bool(row.registration),
            "proposition_file_id": row.proposition_file_id,
            "results_file_id": row.results_file_id,
            "proposition_file_path": row.proposition_file_path,
            "results_file_path": row.results_file_path,
            "areal_id": row.areal_id,
            "areal_name": row.areal_name or "Bez areálu",
            "organizer_id": row.organizer_id,
            "organizer_name": row.organizer_name or "Neznámý organizátor",
            "race_method_id": row.race_method_id,
            "season_id": row.season_id,
        }
        races.append(race_data)

    return races


# Live race public endpoints (must be before /{race_id} to avoid routing conflicts)
@router.get("/live/status")
def get_live_race_status(response: Response, db: Session = Depends(get_db)):
    """
    Lightweight "is anything live right now" check. 404 if nothing is live.

    Every visitor polls this from the navigation banner, so it must not carry
    the full start list the way /races/live does - one indexed row read only.
    """
    response.headers["Cache-Control"] = "no-store"
    live = db.execute(
        text("""
        SELECT r.id, r.race_nr,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        WHERE r.is_live = 1
        LIMIT 1
    """)
    ).fetchone()

    if not live:
        raise HTTPException(status_code=404, detail="No live race")

    return {
        "race_id": live.id,
        "race_nr": live.race_nr,
        "areal_name": live.areal_name or "Bez areálu",
    }


@router.get("/live")
def get_live_race(response: Response, db: Session = Depends(get_db)):
    """Returns currently live race with live results. 404 if no race is live."""
    # NOTE: nginx is configured to pass through Cache-Control headers (see nginx.conf:84).
    # This endpoint intentionally sets "no-store" here to ensure live data is never cached
    # by clients or intermediate proxies. If nginx cache policy changes, keep this behavior.
    response.headers["Cache-Control"] = "no-store"
    # Hotový JSON se sestavuje nejvýš jednou za 2 s na worker (services/live_cache.py, PERF-01).
    # Cachuje se už zakódovaný: převod na JSON byl na každý požadavek druhý největší náklad.
    body = live_results.get(lambda: live_service.encode_json(live_service.build_live_payload(db)))
    if body is None:
        raise HTTPException(status_code=404, detail="No live race")
    return Response(content=body, media_type="application/json", headers=dict(response.headers))


# Season-related endpoints (must be before /{race_id} to avoid routing conflicts)
@router.get("/season/current")
def get_current_season(db: Session = Depends(get_db)):
    """
    Vrátí aktuální sezónu (označenou ve správě sezón, jinak podle data)
    i s ročníkem - podle ní web, administrace i časomíra volí výchozí sezónu.
    """
    current_season_id = get_current_season_filter(db)
    current_date = date.today()
    season = db.query(models.Season).filter(models.Season.year_start == current_season_id).first()
    edition = season.edition if season and season.edition else current_season_id - EDITION_BASE_YEAR

    return {
        "current_season_id": current_season_id,
        "edition": edition,
        "edition_label": f"{to_roman(edition)}.",
        "name": season.name if season else None,
        "is_set": bool(season and season.is_current),
        "season_logic": f"Sezóna {current_season_id} (začíná 1.8.{current_season_id})",
        "current_date": current_date,
        "season_start": date(current_season_id, 8, 1),
        "season_end": date(current_season_id + 1, 7, 31),
    }


@router.get("/season/calculate")
def calculate_season_for_date_endpoint(race_date: str):
    """
    Vypočítá správné season_id pro zadané datum závodu.

    Args:
        race_date: Datum ve formátu YYYY-MM-DD

    Returns:
        season_id a informace o sezóně
    """
    try:
        season_id = calculate_season_for_date(race_date)

        return {
            "race_date": race_date,
            "season_id": season_id,
            "season_logic": f"Závod dne {race_date} patří do sezóny {season_id}",
            "season_period": f"1.8.{season_id} - 31.7.{season_id + 1}",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{race_id}", response_model=schemas.Race)
def get_race(race_id: int, db: Session = Depends(get_db)):
    # Použijeme raw SQL pro správné čtení bit hodnot
    result = db.execute(
        text(f"""
        SELECT r.id, r.closed+0 as closed, r.datum, r.race_nr,
               r.registration+0 as registration, r.areal_id,
               r.organizer_id, r.race_method_id, r.season_id,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name,
               CONVERT(CONVERT(o.name USING binary) USING utf8mb4) as organizer_name,
               {attachment_service.RACE_DOCUMENT_COLUMNS}
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        LEFT JOIN fuj_jmlp_club o ON r.organizer_id = o.id
        {attachment_service.race_document_joins(published_only=True)}
        WHERE r.id = :race_id
    """),
        {"race_id": race_id},
    ).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Race not found")

    # Vytvoříme race object z raw dat
    race_data = {
        "id": result.id,
        "closed": bool(result.closed),
        "datum": result.datum,
        "race_nr": result.race_nr,
        "registration": bool(result.registration),
        "proposition_file_id": result.proposition_file_id,
        "results_file_id": result.results_file_id,
        "proposition_file_path": result.proposition_file_path,
        "results_file_path": result.results_file_path,
        "areal_id": result.areal_id,
        "areal_name": result.areal_name or "Bez areálu",
        "organizer_id": result.organizer_id,
        "organizer_name": result.organizer_name or "Neznámý organizátor",
        "race_method_id": result.race_method_id,
        "season_id": result.season_id,
    }

    return race_data


@router.get("/{race_id}/registrations")
def get_registrations(race_id: int, db: Session = Depends(get_db)):
    """Vrátí detailní seznam všech registrovaných závodníků seskupených podle klubů"""
    result = db.execute(
        text(
            """
        SELECT 
            CONVERT(CONVERT(r.name USING binary) USING utf8mb4) as firstName,
            CONVERT(CONVERT(r.surname USING binary) USING utf8mb4) as lastName,
            r.sex,
            r.year as birthYear,
            r.slcr_id as idSlcr,
            CONVERT(CONVERT(c.name USING binary) USING utf8mb4) as club_name,
            c.id as club_id,
            rr.registered_at,
            {category_display} as category_name,
            cat.id as category_id,
            cat.sex as category_sex,
            cat.min_birth_year as category_min_year
        FROM fuj_jmlp_race_registration rr
        JOIN fuj_jmlp_racer r ON rr.racer_id = r.id
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        LEFT JOIN fuj_jmlp_category cat ON rr.category_id = cat.id
        WHERE rr.race_id = :race_id
        ORDER BY c.name ASC, r.surname ASC, r.name ASC
    """.format(category_display=category_display_sql("cat"))
        ),
        {"race_id": race_id},
    ).fetchall()

    # Group by clubs
    clubs = {}
    categories = set()  # Pro sběr unikátních kategorií
    for row in result:
        club_name = row.club_name or "Bez klubu"
        if club_name not in clubs:
            clubs[club_name] = {"club_name": club_name, "racers": []}

        # Přidáme kategorii do setu (název už je zobrazovaný, viz category_display_sql)
        if row.category_name:
            categories.add(
                (
                    row.category_id,
                    row.category_name,
                    row.category_min_year or 0,
                    row.category_sex or 0,
                )
            )

        clubs[club_name]["racers"].append(
            {
                "firstName": row.firstName,
                "lastName": row.lastName,
                "sex": "M" if row.sex == 1 else ("Z" if row.sex == 2 else ""),
                "birthYear": row.birthYear,
                "idSlcr": row.idSlcr,
                "registered_at": row.registered_at,
                # Název je už zobrazovaný (category_display_sql doplní pohlaví jen
                # kategoriím bez vlastního názvu) - přidat ho znovu by dalo
                # "Myšáci dívky - Ženy".
                "category_name": row.category_name,
                "category_id": row.category_id,
            }
        )

    # Convert to list and add counts
    club_list = []
    total_racers = 0
    for club_data in clubs.values():
        club_data["racer_count"] = len(club_data["racers"])
        club_list.append(club_data)
        total_racers += club_data["racer_count"]

    # Sort by racer count descending, then by club name
    club_list.sort(key=lambda x: (-x["racer_count"], x["club_name"]))

    # Seznam kategorií pro filtry - v pořadí závodu: nejmladší první, ženy
    # před muži (stejně jako category_order.default_category_order).
    category_list = [
        {"id": cat_id, "name": cat_name}
        for cat_id, cat_name, _, _ in sorted(categories, key=lambda x: (-x[2], -x[3], x[1]))
    ]

    return {"clubs": club_list, "total_racers": total_racers, "categories": category_list}


# ============================================================================
# PUBLIC DOCUMENT DOWNLOAD ENDPOINTS (fuj_jmlp_files table)
# ============================================================================
def _race_document_response(race_id: int, role: str, missing_detail: str, db: Session):
    """Stažení dokumentu závodu (propozice / výsledky) - veřejně."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nebyl nalezen")

    file_record = attachment_service.race_document_file(db, race_id, role)
    if not file_record:
        raise HTTPException(status_code=404, detail=missing_detail)

    file_path = Path(file_record.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Soubor nebyl na disku nalezen")

    return FileResponse(
        path=str(file_path),
        filename=file_record.original_filename,
        media_type=file_record.mime_type or "application/octet-stream",
    )


@router.get("/{race_id}/proposition")
def download_race_proposition(race_id: int, db: Session = Depends(get_db)):
    """Download race proposition document (public access)."""
    return _race_document_response(
        race_id, AttachmentRole.propozice.value, "Propozice nebyly nalezeny", db
    )


@router.get("/{race_id}/results")
def download_race_results(race_id: int, db: Session = Depends(get_db)):
    """Download race results document (public access)."""
    return _race_document_response(
        race_id, AttachmentRole.vysledky.value, "Výsledky nebyly nalezeny", db
    )


@router.post("/{race_id}/register", response_model=schemas.Registration)
def register_for_race(
    race_id: int, payload: schemas.RegistrationCreate, db: Session = Depends(get_db)
):
    """Register a racer for a race"""
    # Set race_id from URL parameter
    payload.race_id = race_id

    # Import and use the registration logic from registration router
    from .registration import create_registration

    return create_registration(payload, db)
