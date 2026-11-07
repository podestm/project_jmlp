"""Výsledky závodu - pořadí, body, podklad pro výsledkovou listinu.

Řazení, pořadí i body počítá services/results.py, aby se obrazovka časoměřiče,
uložené body i tištěná listina nemohly rozejít.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, auth
from ...models import AttachmentOwner, AttachmentRole, FileTypeEnum
from ...services import attachments as attachment_service
from ...services import category_order as category_order_service
from ...services import files as file_service
from ...services import naming
from ...services import fis_xml
from ...services import results as results_service
from ...utils import (
    StandardExceptions,
    category_display_sql,
    convert_utf8_field,
    fix_encoding,
)
from .idempotency import store_idempotent_response, try_get_idempotent_response
from ...services.start_list import _slcr_id

router = APIRouter(tags=["timekeeper-results"])


def _load_entries(db: Session, race_id: int) -> List[Any]:
    """Řádky startovní listiny závodu i s údaji potřebnými pro listinu.

    Bez vyřazených ze startky: do výsledků nepatří a pořadí i body ostatních
    se počítají, jako by nestartovali. Odsud čte výpis výsledků, výpočet bodů
    i publikace listiny, takže to stačí pohlídat tady.
    """
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
               CAST(SUBSTRING(sl.race_number_display, 2) AS UNSIGNED) AS race_number_actual,
               sl.race_number_display,
               rn.set_color,
               rac.slcr_id
        FROM fuj_jmlp_race_start_list sl
        LEFT JOIN fuj_jmlp_category cat ON sl.category_id = cat.id
        LEFT JOIN fuj_jmlp_race_numbers rn ON rn.id = sl.race_number_id
        LEFT JOIN fuj_jmlp_racer rac ON rac.id = sl.racer_id
        WHERE sl.race_id = :race_id
          AND sl.excluded = 0
    """)
    return list(db.execute(query, {"race_id": race_id}).fetchall())


def _clear_points_of_excluded(db: Session, race_id: int) -> None:
    """Vyřazený ze startky nemá umístění, a tedy ani body.

    Body se mu mohly uložit ještě předtím, než ho někdo vyřadil. Nechat je ve
    sloupci points by znamenalo, že uložené body tvrdí něco jiného než
    výsledky. Po vrácení je dostane zpátky při dalším výpočtu.
    """
    db.query(models.StartListEntry).filter(
        models.StartListEntry.race_id == race_id,
        models.StartListEntry.excluded.is_(True),
        models.StartListEntry.points.isnot(None),
    ).update({"points": None}, synchronize_session=False)


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
        # Registrační číslo SLČR - výsledková listina ho tiskne pod klubem jako LiZa.
        "slcr_id": _slcr_id(getattr(row, "slcr_id", None)),
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


def build_fis_dataset(db: Session, race_id: int, discipline: str = "",
                      category_id: Optional[int] = None) -> tuple[bytes, int, str]:
    """FIS XML Dataset závodu pro evidenci SLČR (routers/timekeeper/slcr.py):
    (obsah, počet startujících bez výsledku, název souboru). Všechny kategorie
    v jednom souboru, každá jako vlastní závod s kodexem = id kategorie;
    s category_id jen ta jedna (výsledky po kategoriích)."""
    discipline = (discipline or "").strip().upper()
    if discipline and discipline not in fis_xml.DISCIPLINES:
        raise HTTPException(status_code=400, detail="Neznámá disciplína")
    race = _race_or_404(db, race_id)
    if not race.datum:
        raise HTTPException(status_code=400, detail="Závod nemá datum")
    areal = _areal_name(db, race) or ""
    header = fis_xml.RaceHeader(
        race_date=race.datum,
        event_name=f"JMLP {areal}".strip(),
        place=areal,
        discipline=discipline,
        race_director=race.race_director,
        technical_delegate=race.technical_delegate,
    )

    categories = []
    for group in _group_by_category(_load_entries(db, race_id), race, db):
        if category_id is not None and group["category_id"] != category_id:
            continue
        rows = group["rows"]
        sex = next((row.category_sex for row in rows if row.category_sex is not None), None)
        categories.append(fis_xml.CategoryResults(
            name=group["category_name"], sex=sex, ranked=results_service.rank_category(rows),
            # Kodex = id kategorie u nás: stálé číslo, stejné každý závod.
            codex=str(group["category_id"]) if group["category_id"] else None,
        ))
    if not categories:
        raise HTTPException(status_code=400, detail="Závod nemá žádné výsledky")

    stem = "_".join(part for part in (str(race.datum), race.race_nr or f"zavod-{race_id}") if part)
    filename = f"{stem}_vysledky-slcr.xml"
    return fis_xml.build_dataset_xml(header, categories), fis_xml.unfinished_count(categories), filename


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


def _remove_published_results(db: Session, race_id: int) -> bool:
    """Odpojí publikovanou výsledkovou listinu závodu; vygenerovanou i smaže.

    Ručně nahranou listinu z knihovny nemažeme - to je vždycky vědomá akce
    v knihovně dokumentů, ne vedlejší efekt mazání výsledků.
    """
    attachment = db.query(models.Attachment).filter(
        models.Attachment.owner_type == AttachmentOwner.race.value,
        models.Attachment.owner_id == race_id,
        models.Attachment.role == AttachmentRole.vysledky.value,
    ).first()
    if not attachment:
        return False

    file_id = attachment.file_id
    was_generated = bool(attachment.is_generated)

    attachment_service.sync_single(
        db,
        owner_type=AttachmentOwner.race.value,
        owner_id=race_id,
        role=AttachmentRole.vysledky.value,
        file_id=None,
    )

    if file_id and was_generated:
        still_used = db.query(models.Attachment).filter(
            models.Attachment.file_id == file_id
        ).count()
        if still_used == 0:
            file_record = db.query(models.File).filter(models.File.id == file_id).first()
            if file_record:
                file_service.delete_file_from_disk(file_record)
                db.delete(file_record)
                db.commit()

    return True


@router.delete("/races/{race_id}/results")
def clear_race_results(
    race_id: int,
    published: bool = Query(
        default=False,
        description="Smazat i publikovanou výsledkovou listinu závodu",
    ),
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Smaže naměřené výsledky závodu - časy, příznaky i body.

    Startovní listina zůstává, maže se jen to, co se naměřilo: závod se dá
    rozjet znovu bez opakovaného losování. S `published=true` se navíc odebere
    výsledková listina publikovaná na webu.
    """
    # Query parametr patří do klíče: "smazat i listinu" a "smazat jen časy"
    # jsou dvě různé operace a nesmí se navzájem přehrát z fronty.
    endpoint = f"/api/timekeeper/races/{race_id}/results?published={int(published)}"
    replay = try_get_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="DELETE",
        endpoint=endpoint,
    )
    if replay:
        return replay

    _race_or_404(db, race_id)

    cleared = db.query(models.StartListEntry).filter(
        models.StartListEntry.race_id == race_id
    ).update({
        "time1": None,
        "time2": None,
        "time_sum": None,
        "dnf": False,
        "dns": False,
        "dsq": False,
        "points": None,
    }, synchronize_session=False)
    db.commit()

    published_removed = _remove_published_results(db, race_id) if published else False

    message = f"Smazány naměřené výsledky u {cleared} závodníků"
    if published_removed:
        message += ", publikovaná listina odebrána"

    response_payload = {
        "message": message,
        "cleared": cleared,
        "published_removed": published_removed,
        "idempotency_replayed": False,
    }
    store_idempotent_response(
        db=db,
        idempotency_key=x_idempotency_key,
        admin_id=int(current_admin.id),
        method="DELETE",
        endpoint=endpoint,
        response_payload=response_payload,
    )
    return response_payload


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
    _clear_points_of_excluded(db, race_id)

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
    _clear_points_of_excluded(db, race_id)
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
