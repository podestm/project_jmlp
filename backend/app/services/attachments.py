"""Práce s přílohami - jediná vazba "soubor patří k něčemu".

Nahrazuje pět dřívějších samostatných vazeb. Díky tomu je kontrola použití
souboru úplná - dřív se na sezónní výsledky zapomínalo a soubor šlo smazat
i když ho veřejný kalendář používal.
"""
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import models
from ..models import (
    ATTACHMENT_EXCLUSIVE_GROUPS,
    ATTACHMENT_ROLE_LABELS,
    ATTACHMENT_ROLES_BY_OWNER,
    AttachmentOwner,
    AttachmentRole,
)
from ..utils import fix_encoding


def allowed_roles(owner_type: str) -> tuple:
    """Role povolené pro daný typ vlastníka."""
    try:
        return ATTACHMENT_ROLES_BY_OWNER[AttachmentOwner(owner_type)]
    except (ValueError, KeyError):
        return ()


def exclusive_group(owner_type: str, role: str) -> tuple:
    """Role, které danou roli u tohoto vlastníka vylučují.

    Prázdná n-tice znamená, že vlastník smí mít takových příloh víc.
    """
    try:
        groups = ATTACHMENT_EXCLUSIVE_GROUPS[AttachmentOwner(owner_type)]
        role_enum = AttachmentRole(role)
    except (ValueError, KeyError):
        return ()
    for group in groups:
        if role_enum in group:
            return tuple(r.value for r in group)
    return ()


# --------------------------------------------------------------------------
# SQL fragmenty pro raw dotazy nad závody
#
# Závod má právě dva dokumenty - propozice a výsledky - a od každého nejvýše
# jeden, takže tyhle joiny jsou 1:1 a nezmnoží řádky. Sloupce se jmenují stejně
# jako dřívější fuj_jmlp_race.*_file_id, aby se nemusel měnit tvar odpovědi.
# --------------------------------------------------------------------------
RACE_DOCUMENT_COLUMNS = """
               ap.file_id AS proposition_file_id,
               ar.file_id AS results_file_id,
               fp.file_path AS proposition_file_path,
               fr.file_path AS results_file_path
"""


def race_document_joins(published_only: bool = False, alias: str = "r") -> str:
    """LEFT JOINy na propozice a výsledky závodu. `alias` je alias tabulky závodů."""
    published = " AND {a}.published = 1" if published_only else ""
    return f"""
        LEFT JOIN fuj_jmlp_attachment ap
               ON ap.owner_type = 'race' AND ap.owner_id = {alias}.id
              AND ap.role = 'propozice'{published.format(a='ap')}
        LEFT JOIN fuj_jmlp_files fp ON fp.id = ap.file_id
        LEFT JOIN fuj_jmlp_attachment ar
               ON ar.owner_type = 'race' AND ar.owner_id = {alias}.id
              AND ar.role = 'vysledky'{published.format(a='ar')}
        LEFT JOIN fuj_jmlp_files fr ON fr.id = ar.file_id
    """


def race_document_file(db: Session, race_id: int, role: str) -> Optional[models.File]:
    """Soubor připojený k závodu v dané roli (propozice / výsledky)."""
    row = (
        db.query(models.File)
        .join(models.Attachment, models.Attachment.file_id == models.File.id)
        .filter(
            models.Attachment.owner_type == AttachmentOwner.race.value,
            models.Attachment.owner_id == race_id,
            models.Attachment.role == role,
            models.Attachment.published.is_(True),
        )
        .first()
    )
    return row


def apply_post_documents(db: Session, posts: Iterable[Any]) -> None:
    """Doplní příspěvkům image_file_id / document_file_id z příloh.

    Příspěvek má stejně jako dřív nejvýše jeden obrázek a jeden dokument, jen
    se čtou z fuj_jmlp_attachment místo ze sloupců.

    Příloha, jejíž soubor na disku není, se přeskočí. Bez toho web tvrdil, že
    obrázek existuje, prohlížeč si ho vyžádal a dostal 404 - u příspěvku pak
    zůstalo prázdné místo po obrázku, který nikde není. Radši žádný obrázek
    než rozbitý.
    """
    posts = list(posts)
    if not posts:
        return

    rows = (
        db.query(models.Attachment, models.File)
        .join(models.File, models.File.id == models.Attachment.file_id)
        .filter(
            models.Attachment.owner_type == AttachmentOwner.post.value,
            models.Attachment.owner_id.in_([p.id for p in posts]),
            models.Attachment.role.in_([AttachmentRole.image.value, AttachmentRole.document.value]),
        )
        .all()
    )

    by_post: Dict[int, Dict[str, int]] = defaultdict(dict)
    for row, file_obj in rows:
        if not Path(file_obj.file_path).exists():
            continue
        field = "image_file_id" if row.role == AttachmentRole.image.value else "document_file_id"
        by_post[row.owner_id][field] = row.file_id

    for post in posts:
        documents = by_post.get(post.id, {})
        post.image_file_id = documents.get("image_file_id")
        post.document_file_id = documents.get("document_file_id")


def post_document_file(db: Session, post_id: int, role: str) -> Optional[models.File]:
    """Soubor připojený k příspěvku v dané roli."""
    return (
        db.query(models.File)
        .join(models.Attachment, models.Attachment.file_id == models.File.id)
        .filter(
            models.Attachment.owner_type == AttachmentOwner.post.value,
            models.Attachment.owner_id == post_id,
            models.Attachment.role == role,
        )
        .first()
    )


def role_label(role: Optional[str]) -> str:
    try:
        return ATTACHMENT_ROLE_LABELS[AttachmentRole(role)]
    except (ValueError, KeyError):
        return role or "Dokument"


def attachment_dict(attachment: models.Attachment, file_obj: Optional[models.File]) -> Dict[str, Any]:
    """Příloha + denormalizovaná data souboru, jak je čeká frontend."""
    return {
        "id": attachment.id,
        "file_id": attachment.file_id,
        "owner_type": attachment.owner_type,
        "owner_id": attachment.owner_id,
        "role": attachment.role,
        "role_label": role_label(attachment.role),
        # Soubor má jediný název - ten svůj. attachment.title se zrušil.
        "title": file_obj.original_filename if file_obj else None,
        "sort_order": attachment.sort_order,
        "published": bool(attachment.published),
        "is_generated": bool(attachment.is_generated),
        "created_at": attachment.created_at,
        "original_filename": file_obj.original_filename if file_obj else None,
        "filename": file_obj.filename if file_obj else None,
        "file_size": file_obj.file_size if file_obj else None,
        "mime_type": file_obj.mime_type if file_obj else None,
        "download_url": f"/uploads/documents/{file_obj.filename}" if file_obj else None,
    }


def list_for_owner(
    db: Session,
    owner_type: str,
    owner_id: Optional[int],
    *,
    roles: Optional[Iterable[str]] = None,
    published_only: bool = False,
) -> List[Dict[str, Any]]:
    """Přílohy jednoho vlastníka, seřazené podle sort_order."""
    query = (
        db.query(models.Attachment, models.File)
        .join(models.File, models.File.id == models.Attachment.file_id)
        .filter(models.Attachment.owner_type == owner_type)
    )
    query = query.filter(
        models.Attachment.owner_id.is_(None) if owner_id is None
        else models.Attachment.owner_id == owner_id
    )
    if roles:
        query = query.filter(models.Attachment.role.in_(list(roles)))
    if published_only:
        query = query.filter(models.Attachment.published.is_(True))

    rows = query.order_by(models.Attachment.sort_order, models.Attachment.id).all()
    return [attachment_dict(attachment, file_obj) for attachment, file_obj in rows]


def first_for_owner(
    db: Session, owner_type: str, owner_id: Optional[int], role: str
) -> Optional[Dict[str, Any]]:
    """První (nejvýše jedna) příloha dané role - náhrada za *_file_id sloupce."""
    items = list_for_owner(db, owner_type, owner_id, roles=[role])
    return items[0] if items else None


def attach(
    db: Session,
    *,
    file_id: int,
    owner_type: str,
    owner_id: Optional[int],
    role: str,
    is_generated: bool = False,
    created_by: Optional[int] = None,
    replace_singleton: bool = True,
) -> models.Attachment:
    """Připojí soubor k vlastníkovi.

    Pokud role patří do skupiny, která se vzájemně vylučuje, nahradí dosavadní
    přílohu z celé skupiny - závod má jen jednu platnou výsledkovou listinu,
    sezóna buď průběžné, nebo celkové výsledky.
    """
    group = exclusive_group(owner_type, role) if replace_singleton else ()
    if group:
        db.query(models.Attachment).filter(
            models.Attachment.owner_type == owner_type,
            models.Attachment.owner_id == owner_id,
            models.Attachment.role.in_(group),
        ).delete(synchronize_session=False)

    next_order = db.query(models.Attachment).filter(
        models.Attachment.owner_type == owner_type,
        models.Attachment.owner_id == owner_id,
    ).count()

    attachment = models.Attachment(
        file_id=file_id,
        owner_type=owner_type,
        owner_id=owner_id,
        role=role,
        sort_order=next_order,
        published=True,
        is_generated=is_generated,
        created_by=created_by,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def sync_single(
    db: Session,
    *,
    owner_type: str,
    owner_id: Optional[int],
    role: str,
    file_id: Optional[int],
    created_by: Optional[int] = None,
) -> Optional[models.Attachment]:
    """Nastaví jedinou přílohu dané role. Prázdné file_id ji odpojí.

    Používají to místa, kde měl vlastník dřív jeden *_file_id sloupec:
    závod (propozice, výsledky) a příspěvek (obrázek, dokument).
    """
    group = exclusive_group(owner_type, role) or (role,)
    existing = db.query(models.Attachment).filter(
        models.Attachment.owner_type == owner_type,
        models.Attachment.owner_id == owner_id,
        models.Attachment.role.in_(group),
    )

    if not file_id:
        existing.delete(synchronize_session=False)
        db.commit()
        return None

    current = existing.first()
    if current and current.file_id == file_id:
        return current

    return attach(
        db,
        file_id=file_id,
        owner_type=owner_type,
        owner_id=owner_id,
        role=role,
        created_by=created_by,
    )


def detach_owner(db: Session, owner_type: str, owner_id: int) -> int:
    """Odpojí všechny přílohy vlastníka (při jeho smazání).

    Soubory zůstávají v knihovně - mazání souborů je vždy vědomá akce
    v knihovně dokumentů, ne vedlejší efekt smazání závodu nebo příspěvku.
    """
    removed = db.query(models.Attachment).filter(
        models.Attachment.owner_type == owner_type,
        models.Attachment.owner_id == owner_id,
    ).delete(synchronize_session=False)
    db.commit()
    return removed


def usage_map(db: Session, file_ids: Optional[List[int]] = None) -> Dict[int, List[Dict[str, Any]]]:
    """Mapa file_id -> kde všude je soubor použitý.

    Jeden dotaz nad fuj_jmlp_attachment s doplněním názvu vlastníka. Na rozdíl
    od původní implementace nemůže žádnou vazbu přehlédnout - jiná než přes
    přílohy už neexistuje.
    """
    query = db.query(models.Attachment).filter(
        models.Attachment.owner_type != AttachmentOwner.library.value
    )
    if file_ids is not None:
        if not file_ids:
            return {}
        query = query.filter(models.Attachment.file_id.in_(file_ids))

    # Pořadí podle id, aby "první použití" bylo pokaždé stejné - podle něj
    # se soubor zařazuje do složky v ZIP exportu knihovny.
    attachments = query.order_by(models.Attachment.id).all()
    if not attachments:
        return {}

    labels = _owner_labels(db, attachments)
    usage: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for attachment in attachments:
        usage[attachment.file_id].append({
            "type": role_label(attachment.role),
            "title": labels.get((attachment.owner_type, attachment.owner_id), attachment.owner_type),
            "owner_type": attachment.owner_type,
            "owner_id": attachment.owner_id,
            "role": attachment.role,
            "published": bool(attachment.published),
        })
    return usage


def _owner_labels(db: Session, attachments: List[models.Attachment]) -> Dict[tuple, str]:
    """Čitelné názvy vlastníků pro výpis použití souboru."""
    by_type: Dict[str, set] = defaultdict(set)
    for attachment in attachments:
        if attachment.owner_id is not None:
            by_type[attachment.owner_type].add(attachment.owner_id)

    labels: Dict[tuple, str] = {}

    race_ids = by_type.get(AttachmentOwner.race.value)
    if race_ids:
        for race in db.query(models.Race).filter(models.Race.id.in_(race_ids)).all():
            labels[(AttachmentOwner.race.value, race.id)] = f"Závod {race.race_nr or race.id} - {race.datum}"

    post_ids = by_type.get(AttachmentOwner.post.value)
    if post_ids:
        for post in db.query(models.Post).filter(models.Post.id.in_(post_ids)).all():
            labels[(AttachmentOwner.post.value, post.id)] = f"Příspěvek: {post.title}"

    club_ids = by_type.get(AttachmentOwner.club.value)
    if club_ids:
        for club in db.query(models.Club).filter(models.Club.id.in_(club_ids)).all():
            labels[(AttachmentOwner.club.value, club.id)] = f"Klub: {fix_encoding(club.name)}"

    for year in by_type.get(AttachmentOwner.season.value, ()):
        labels[(AttachmentOwner.season.value, year)] = f"Sezóna {year}/{year + 1}"

    return labels
