"""Výsledky závodu - pořadí, body, podklad pro výsledkovou listinu.

Řazení, pořadí i body počítá services/results.py, aby se obrazovka časoměřiče,
uložené body i tištěná listina nemohly rozejít.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, auth
from ...models import AttachmentOwner, AttachmentRole, FileTypeEnum
from ...services import attachments as attachment_service
from ...services import category_order as category_order_service
from ...services import files as file_service
from ...services import naming
from ...services import results as results_service
from ...utils import (
    StandardExceptions,
    category_display_sql,
    convert_utf8_field,
    fix_encoding,
)

router = APIRouter(tags=["timekeeper-results"])


def _load_entries(db: Session, race_id: int) -> List[Any]:
    """Řádky startovní listiny závodu i s údaji potřebnými pro listinu."""
    query = text(f"""
        SELECT sl.id, sl.racer_id, sl.category_id, sl.start_number,
               sl.time1, sl.time2, sl.time_sum, sl.dnf, sl.dns, sl.dsq, sl.points,
               sl.racer_name, sl.racer_surname,
               sl.racer_year, sl.racer_sex,
               sl.club_name,
               sl.category_name,
               {category_display_sql('cat')} as category_display_name,
               cat.id as cat_id,
               sl.category_sex,
               sl.race_number_actual,
               sl.race_number_display,
               rn.set_color
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_category cat ON sl.category_id = cat.id
        LEFT JOIN fuj_jmlp_race_numbers rn ON rn.id = sl.race_number_id
        WHERE sl.race_id = :race_id
    """)
    return list(db.execute(query, {"race_id": race_id}).fetchall())


def _group_by_category(
    entries: List[Any], race: models.Race, db: Session
) -> List[Dict[str, Any]]:
    """Seskupí řádky po kategoriích v pořadí nastaveném u závodu."""
    rank_map = category_order_service.category_rank_map(race, db)

    groups: Dict[int, Dict[str, Any]] = {}
    for row in entries:
        cat_id = row.cat_id or 0
        if cat_id not in groups:
            groups[cat_id] = {
                "category_id": cat_id,
                # display_name z databáze; snapshot je záloha pro historická data
                "category_name": (
                    row.category_display_name
                    or (fix_encoding(row.category_name) if row.category_name else None)
                    or "Bez kategorie"
                ),
                "rows": [],
            }
        groups[cat_id]["rows"].append(row)

    return sorted(groups.values(), key=lambda g: rank_map.get(g["category_id"], 10 ** 6))


def _format_entry(ranked: results_service.RankedEntry) -> Dict[str, Any]:
    row = ranked.row
    return {
        "id": row.id,
        "position": ranked.rank,
        "start_number": row.start_number,
        "display_number": row.race_number_display,
        "race_number_display": row.race_number_display,
        "race_number_actual": row.race_number_actual,
        "set_color": row.set_color or "rose",
        "racer_name": fix_encoding(row.racer_name).strip() if row.racer_name else "",
        "racer_surname": fix_encoding(row.racer_surname).strip() if row.racer_surname else "",
        "racer_year": row.racer_year,
        "racer_sex": row.racer_sex,
        "club_name": fix_encoding(row.club_name) if row.club_name else None,
        "category_name": (
            row.category_display_name
            or (fix_encoding(row.category_name) if row.category_name else None)
        ),
        "time1": float(row.time1) if row.time1 is not None else None,
        "time2": float(row.time2) if row.time2 is not None else None,
        "time_sum": float(row.time_sum) if row.time_sum is not None else None,
        "diff": float(ranked.diff) if ranked.diff is not None else None,
        "points": ranked.points,
        "status": ranked.status,
    }


def _race_or_404(db: Session, race_id: int) -> models.Race:
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise StandardExceptions.race_not_found()
    return race


def _areal_name(db: Session, race: models.Race) -> Optional[str]:
    if not race.areal_id:
        return None
    row = db.execute(text(f"""
        SELECT {convert_utf8_field('name')} as name
        FROM fuj_jmlp_areal WHERE id = :areal_id
    """), {"areal_id": race.areal_id}).first()
    return fix_encoding(row.name) if row else None


@router.get("/races/{race_id}/results")
def get_race_results(
    race_id: int,
    group_by_category: bool = Query(default=True, description="Group results by category"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Výsledky závodu seřazené podle času, volitelně po kategoriích."""
    race = _race_or_404(db, race_id)
    entries = _load_entries(db, race_id)

    base = {
        "race_id": race_id,
        "race_nr": race.race_nr,
        "race_date": str(race.datum) if race.datum else None,
        "areal_name": _areal_name(db, race),
        "total_entries": len(entries),
    }

    if group_by_category:
        categories = []
        for group in _group_by_category(entries, race, db):
            ranked = results_service.rank_category(group["rows"])
            categories.append({
                "category_id": group["category_id"],
                "category_name": group["category_name"],
                "entries": [_format_entry(item) for item in ranked],
            })
        return {**base, "grouped": True, "categories": categories}

    # Plochý seznam - pořadí se stejně počítá po kategoriích, jen se nerozděluje
    flat = []
    for group in _group_by_category(entries, race, db):
        flat.extend(_format_entry(item) for item in results_service.rank_category(group["rows"]))
    return {**base, "grouped": False, "entries": flat}


@router.post("/races/{race_id}/results/calculate-points")
def calculate_points(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Přepočítá a uloží body podle pořadí v kategoriích."""
    race = _race_or_404(db, race_id)
    entries = _load_entries(db, race_id)

    updated = 0
    categories = _group_by_category(entries, race, db)
    for group in categories:
        for item in results_service.rank_category(group["rows"]):
            db.query(models.StartListEntry).filter(
                models.StartListEntry.id == item.row.id
            ).update({"points": item.points}, synchronize_session=False)
            updated += 1

    db.commit()
    return {
        "message": f"Body přiřazeny pro {updated} závodníků v {len(categories)} kategoriích",
        "updated": updated,
        "categories": len(categories),
    }


@router.post("/races/{race_id}/results/publish")
async def publish_results(
    race_id: int,
    file: UploadFile = File(...),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Publikuje vygenerovanou výsledkovou listinu jako dokument závodu.

    PDF vzniká v prohlížeči, aby tisk fungoval i offline; sem se posílá hotový
    soubor. Publikovaná listina je tak bit po bitu ta, kterou časoměřič viděl
    v náhledu.

    Body se před uložením přepočítají, aby uložené body a vytištěná listina
    nemohly být rozdílné.
    """
    race = _race_or_404(db, race_id)

    # 1) Přepočítat a uložit body
    entries = _load_entries(db, race_id)
    for group in _group_by_category(entries, race, db):
        for item in results_service.rank_category(group["rows"]):
            db.query(models.StartListEntry).filter(
                models.StartListEntry.id == item.row.id
            ).update({"points": item.points}, synchronize_session=False)
    db.commit()

    # 2) Uložit PDF do knihovny
    file_record = await file_service.store_upload(
        db,
        file,
        file_type=FileTypeEnum.vysledky,
        uploaded_by=current_admin.id,
    )

    # 3) Nahradit dosavadní listinu
    previous = db.query(models.Attachment).filter(
        models.Attachment.owner_type == AttachmentOwner.race.value,
        models.Attachment.owner_id == race_id,
        models.Attachment.role == AttachmentRole.vysledky.value,
    ).first()
    previous_file_id = previous.file_id if previous else None
    previous_was_generated = bool(previous.is_generated) if previous else False

    attachment_service.attach(
        db,
        file_id=file_record.id,
        owner_type=AttachmentOwner.race.value,
        owner_id=race_id,
        role=AttachmentRole.vysledky.value,
        is_generated=True,
        created_by=current_admin.id,
    )

    # Dřívější VYGENEROVANOU listinu smažeme, ať se nehromadí. Ručně nahranou
    # nikdy nemažeme - jen se odpojila v attach() výše.
    if previous_file_id and previous_was_generated:
        still_used = db.query(models.Attachment).filter(
            models.Attachment.file_id == previous_file_id
        ).count()
        if still_used == 0:
            old_file = db.query(models.File).filter(models.File.id == previous_file_id).first()
            if old_file:
                file_service.delete_file_from_disk(old_file)
                db.delete(old_file)
                db.commit()

    # 4) Pojmenovat stejně jako kteroukoli jinou přílohu závodu.
    # Až tady: dokud předchozí listina existovala, držela si název
    # JMLP2025-05_vysledky.pdf a nová by dostala pořadové číslo, které by
    # po jejím smazání nemělo důvod.
    systematic = naming.systematic_filename(
        db,
        AttachmentOwner.race.value,
        race_id,
        AttachmentRole.vysledky.value,
        file_record.original_filename,
    )
    if systematic:
        file_record.original_filename = systematic
        db.commit()

    return {
        "message": "Výsledková listina publikována",
        "file_id": file_record.id,
        "download_url": f"/races/{race_id}/results",
        "replaced_generated": bool(previous_file_id and previous_was_generated),
    }
