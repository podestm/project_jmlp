import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ... import auth, models, schemas
from ...database import get_db
from ...models import AttachmentOwner, AttachmentRole, FileTypeEnum
from ...services import attachments as attachment_service
from ...services.standings import RACE_METHOD_PREP
from ...utils import fix_encoding

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/races", tags=["admin-races"])

# Závod má právě dva dokumenty; klíč je název pole v API, hodnota role přílohy.
RACE_DOCUMENT_ROLES = {
    "proposition_file_id": AttachmentRole.propozice,
    "results_file_id": AttachmentRole.vysledky,
}

# Role -> file_type v knihovně (zachovává původní auto-kategorizaci souborů)
_LIBRARY_FILE_TYPE = {
    AttachmentRole.propozice: FileTypeEnum.propozice,
    AttachmentRole.vysledky: FileTypeEnum.vysledky,
}


def _sync_race_document(
    db: Session, race_id: int, role: AttachmentRole, file_id, admin_id: int
) -> None:
    """Připojí nebo odpojí dokument závodu podle zaslaného file_id.

    Prázdná hodnota dokument odpojí. Soubor zůstane v knihovně.
    """
    file_record = None
    if file_id:
        file_record = db.query(models.File).filter(models.File.id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="Soubor nebyl nalezen")

    attachment_service.sync_single(
        db,
        owner_type=AttachmentOwner.race.value,
        owner_id=race_id,
        role=role.value,
        file_id=file_id,
        created_by=admin_id,
    )

    # Zachovává původní auto-kategorizaci souboru v knihovně
    if file_record and file_record.file_type == FileTypeEnum.neprirazene:
        file_record.file_type = _LIBRARY_FILE_TYPE[role]
        db.commit()


def _build_race_dict(race: models.Race, db: Session) -> dict:
    """Build a dictionary representation of a race enriched with related data.

    Args:
        race: The Race ORM instance to serialize.
        db: The active SQLAlchemy database session used to fetch related entities.

    Returns:
        dict: A shallow copy of the race's attributes (`race.__dict__`) extended with:
            - ``areal_name``: The name of the associated Areal, or ``None`` if not set.
            - ``organizer_name``: The name of the organizing Club, or ``None`` if not set.
            - ``registrations_count``: The number of registrations linked to this race.
    """
    race_dict = race.__dict__.copy()
    if race.areal_id:
        areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
        race_dict["areal_name"] = fix_encoding(areal.name) if areal else None
    else:
        race_dict["areal_name"] = None
    if race.organizer_id:
        organizer = db.query(models.Club).filter(models.Club.id == race.organizer_id).first()
        race_dict["organizer_name"] = fix_encoding(organizer.name) if organizer else None
    else:
        race_dict["organizer_name"] = None
    race_dict["registrations_count"] = (
        db.query(models.Registration).filter(models.Registration.race_id == race.id).count()
    )

    # Dokumenty závodu se čtou z příloh, ne z (dnes už nepoužívaných) sloupců.
    for field, role in RACE_DOCUMENT_ROLES.items():
        document = attachment_service.first_for_owner(
            db, AttachmentOwner.race.value, race.id, role.value
        )
        race_dict[field] = document["file_id"] if document else None
        race_dict[field.replace("_id", "_path")] = (
            f"uploads/documents/{document['filename']}" if document else None
        )
    return race_dict


@router.get("", response_model=list[schemas.Race])
def get_races(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """List all races for admin management."""
    # Jeden dotaz místo tří na každý závod (areál, organizátor, počet registrací)
    rows = db.execute(
        text(f"""
        SELECT r.id, r.closed+0 as closed, r.datum, r.race_nr,
               r.registration+0 as registration, r.areal_id,
               r.organizer_id, r.race_method_id, r.season_id, r.is_live+0 as is_live,
               r.is_final+0 as is_final,
               CONVERT(CONVERT(a.name USING binary) USING utf8mb4) as areal_name,
               CONVERT(CONVERT(o.name USING binary) USING utf8mb4) as organizer_name,
               {attachment_service.RACE_DOCUMENT_COLUMNS},
               (SELECT COUNT(*) FROM fuj_jmlp_race_registration rr WHERE rr.race_id = r.id)
                   as registrations_count
        FROM fuj_jmlp_race r
        LEFT JOIN fuj_jmlp_areal a ON r.areal_id = a.id
        LEFT JOIN fuj_jmlp_club o ON r.organizer_id = o.id
        {attachment_service.race_document_joins()}
        ORDER BY r.datum DESC, r.id DESC
        LIMIT :limit OFFSET :skip
    """),
        {"limit": limit, "skip": skip},
    ).fetchall()

    return [
        {
            "id": row.id,
            "closed": bool(row.closed),
            "datum": row.datum,
            "race_nr": row.race_nr,
            "registration": bool(row.registration),
            "is_live": bool(row.is_live),
            "is_final": bool(row.is_final),
            "proposition_file_id": row.proposition_file_id,
            "results_file_id": row.results_file_id,
            "proposition_file_path": row.proposition_file_path,
            "results_file_path": row.results_file_path,
            "areal_id": row.areal_id,
            "areal_name": fix_encoding(row.areal_name) if row.areal_name else None,
            "organizer_id": row.organizer_id,
            "organizer_name": fix_encoding(row.organizer_name) if row.organizer_name else None,
            "race_method_id": row.race_method_id,
            "season_id": row.season_id,
            "registrations_count": row.registrations_count,
        }
        for row in rows
    ]


@router.get("/{race_id}", response_model=schemas.Race)
def get_race(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Get single race details for admin."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    return _build_race_dict(race, db)


@router.post("", response_model=schemas.Race)
def create_race(
    race_data: schemas.RaceCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new race. Auto-creates areal/organizer from name if needed."""

    race_dict = race_data.dict()

    # Handle AREAL: priority is areal_name, fallback to areal_id (if it's a string)
    final_areal_id = None
    areal_name = race_dict.get("areal_name")

    if not areal_name and race_dict.get("areal_id") and isinstance(race_dict["areal_id"], str):
        areal_name = race_dict["areal_id"]

    if areal_name and areal_name.strip():
        areal_name = areal_name.strip()
        areal = db.query(models.Areal).filter(models.Areal.name == areal_name).first()
        if not areal:
            areal = models.Areal(name=areal_name)
            db.add(areal)
            db.commit()
            db.refresh(areal)
        final_areal_id = areal.id

    # Handle ORGANIZER: priority is organizer_name, fallback to organizer_id (if it's a string)
    final_organizer_id = None
    organizer_name = race_dict.get("organizer_name")

    if (
        not organizer_name
        and race_dict.get("organizer_id")
        and isinstance(race_dict["organizer_id"], str)
    ):
        organizer_name = race_dict["organizer_id"]

    if organizer_name and organizer_name.strip():
        organizer_name = organizer_name.strip()
        organizer = db.query(models.Club).filter(models.Club.name == organizer_name).first()
        if not organizer:
            organizer = models.Club(name=organizer_name, valid=True)
            db.add(organizer)
            db.commit()
            db.refresh(organizer)
        final_organizer_id = organizer.id

    race_dict["areal_id"] = final_areal_id
    race_dict["organizer_id"] = final_organizer_id
    race_dict.pop("areal_name", None)
    race_dict.pop("organizer_name", None)

    if race_dict.get("datum"):
        from ...utils import parse_date_string

        try:
            race_dict["datum"] = parse_date_string(race_dict["datum"])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    # Finále je jen závod na sněhu - suchý (přípravný) závod finálem být nemůže.
    race_dict["is_final"] = (
        bool(race_dict.get("is_final")) and race_dict.get("race_method_id") != RACE_METHOD_PREP
    )

    # Dokumenty se ukládají jako přílohy, ne jako sloupce závodu.
    document_ids = {field: race_dict.pop(field, None) for field in RACE_DOCUMENT_ROLES}

    race = models.Race(**race_dict)
    db.add(race)
    db.commit()
    db.refresh(race)

    for field, role in RACE_DOCUMENT_ROLES.items():
        if document_ids.get(field):
            _sync_race_document(db, race.id, role, document_ids[field], current_admin.id)

    # Re-query to get a fresh object with all attributes loaded
    # (MyISAM + multiple commits can expire the SQLAlchemy instance state)
    race = db.query(models.Race).filter(models.Race.id == race.id).first()
    return _build_race_dict(race, db)


@router.put("/{race_id}", response_model=schemas.Race)
def update_race(
    race_id: int,
    race_data: schemas.RaceUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Update an existing race."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")

    update_data = race_data.dict(exclude_unset=True)

    # Handle AREAL auto-create
    if "areal_name" in update_data or "areal_id" in update_data:
        areal_name = update_data.get("areal_name")
        if (
            not areal_name
            and update_data.get("areal_id")
            and isinstance(update_data["areal_id"], str)
        ):
            areal_name = update_data["areal_id"]
        if areal_name and areal_name.strip():
            areal_name = areal_name.strip()
            areal = db.query(models.Areal).filter(models.Areal.name == areal_name).first()
            if not areal:
                areal = models.Areal(name=areal_name)
                db.add(areal)
                db.commit()
                db.refresh(areal)
            update_data["areal_id"] = areal.id
        update_data.pop("areal_name", None)

    # Handle ORGANIZER auto-create
    if "organizer_name" in update_data or "organizer_id" in update_data:
        organizer_name = update_data.get("organizer_name")
        if (
            not organizer_name
            and update_data.get("organizer_id")
            and isinstance(update_data["organizer_id"], str)
        ):
            organizer_name = update_data["organizer_id"]
        if organizer_name and organizer_name.strip():
            organizer_name = organizer_name.strip()
            organizer = db.query(models.Club).filter(models.Club.name == organizer_name).first()
            if not organizer:
                organizer = models.Club(name=organizer_name, valid=True)
                db.add(organizer)
                db.commit()
                db.refresh(organizer)
            update_data["organizer_id"] = organizer.id
        update_data.pop("organizer_name", None)

    # Dokumenty jsou přílohy - prázdná hodnota dokument odpojí.
    document_updates = {
        field: update_data.pop(field) for field in list(RACE_DOCUMENT_ROLES) if field in update_data
    }

    for field, value in update_data.items():
        setattr(race, field, value)
    # Finále je jen závod na sněhu - i když se závod přepne na suchý.
    if race.race_method_id == RACE_METHOD_PREP:
        race.is_final = False

    db.commit()

    for field, file_id in document_updates.items():
        _sync_race_document(db, race_id, RACE_DOCUMENT_ROLES[field], file_id, current_admin.id)

    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    return _build_race_dict(race, db)


@router.post("/{race_id}/toggle-registration")
def toggle_race_registration(
    race_id: int,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
):
    """Toggle race registration on/off"""
    db_race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not db_race:
        raise HTTPException(status_code=404, detail="Race not found")

    db_race.registration = not db_race.registration
    db.commit()

    return {
        "message": f"Registration {'enabled' if db_race.registration else 'disabled'} for race {race_id}"
    }


@router.delete("/{race_id}")
def delete_race(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete a race and all its child rows (start list + registrations).

    MyISAM neumí transakce ani cizí klíče, takže mažeme od potomků k rodiči -
    když něco selže uprostřed, zůstane závod (ne osiřelé řádky).
    """
    try:
        race = db.query(models.Race).filter(models.Race.id == race_id).first()
        if not race:
            raise HTTPException(status_code=404, detail="Závod nenalezen")

        start_list_count = (
            db.query(models.StartListEntry).filter(models.StartListEntry.race_id == race_id).count()
        )

        if start_list_count > 0:
            db.query(models.StartListEntry).filter(
                models.StartListEntry.race_id == race_id
            ).delete()
            db.commit()

        registrations_count = (
            db.query(models.Registration).filter(models.Registration.race_id == race_id).count()
        )

        if registrations_count > 0:
            db.query(models.Registration).filter(models.Registration.race_id == race_id).delete()
            db.commit()

        # Přílohy se jen odpojí, soubory zůstávají v knihovně dokumentů.
        attachment_service.detach_owner(db, AttachmentOwner.race.value, race_id)

        db.delete(race)
        db.commit()

        message = "Závod úspěšně smazán"
        details = []
        if registrations_count > 0:
            details.append(f"{registrations_count} registrací")
        if start_list_count > 0:
            details.append(f"{start_list_count} řádků startovní listiny")
        if details:
            message += f" (včetně {' a '.join(details)})"

        return {"message": message}

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("Mazání závodu %s selhalo", race_id)
        raise HTTPException(status_code=500, detail="Chyba při mazání závodu") from None


@router.get("/autocomplete/areals")
def autocomplete_areals(
    q: str,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Get areals matching search query for autocomplete."""
    if not q or len(q.strip()) < 2:
        return []

    areals = db.query(models.Areal).filter(models.Areal.name.like(f"%{q}%")).limit(10).all()

    return [{"id": areal.id, "name": fix_encoding(areal.name)} for areal in areals]


@router.get("/autocomplete/organizers")
def autocomplete_organizers(
    q: str,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Get clubs/organizers matching search query for autocomplete."""
    if not q or len(q.strip()) < 2:
        return []

    clubs = db.query(models.Club).filter(models.Club.name.like(f"%{q}%")).limit(10).all()

    return [{"id": club.id, "name": fix_encoding(club.name)} for club in clubs]
