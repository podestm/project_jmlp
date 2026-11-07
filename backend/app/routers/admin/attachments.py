"""Správa příloh - jedno API pro všechna místa, kam se nahrávají soubory.

Klíčový endpoint je POST /api/admin/attachments: nahraje soubor A rovnou ho
připojí k závodu / článku / sezóně / klubu. Není potřeba soubor nejdřív nahrát
do knihovny a teprve pak přiřazovat.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, auth
from ...models import AttachmentOwner, AttachmentRole, FileTypeEnum
from ...services import attachments as attachment_service
from ...services import files as file_service
from ...services import naming

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin-attachments"])

# Role -> file_type v knihovně, aby zůstalo staré třídění souborů funkční.
_FILE_TYPE_BY_ROLE = {
    AttachmentRole.propozice: FileTypeEnum.propozice,
    AttachmentRole.vysledky: FileTypeEnum.vysledky,
    AttachmentRole.prubezne: FileTypeEnum.vysledky,
    AttachmentRole.image: FileTypeEnum.image,
    AttachmentRole.logo: FileTypeEnum.image,
}


def _validate_owner(owner_type: str, owner_id: Optional[int], db: Session) -> Optional[int]:
    """Ověří, že vlastník existuje. Vrací normalizované owner_id."""
    try:
        owner = AttachmentOwner(owner_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Neznámý typ vlastníka: {owner_type}")

    if owner is AttachmentOwner.library:
        return None

    if owner_id is None:
        raise HTTPException(status_code=400, detail="Chybí identifikátor vlastníka")

    if owner is AttachmentOwner.race:
        exists = db.query(models.Race.id).filter(models.Race.id == owner_id).first()
    elif owner is AttachmentOwner.post:
        exists = db.query(models.Post.id).filter(models.Post.id == owner_id).first()
    elif owner is AttachmentOwner.club:
        exists = db.query(models.Club.id).filter(models.Club.id == owner_id).first()
    else:  # season - owner_id je rok začátku sezóny
        exists = db.query(models.Season.id).filter(models.Season.year_start == owner_id).first()

    if not exists:
        raise HTTPException(status_code=404, detail="Vlastník přílohy nebyl nalezen")
    return owner_id


def _validate_role(role: str, owner_type: Optional[str] = None) -> AttachmentRole:
    try:
        role_enum = AttachmentRole(role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Neznámá role přílohy: {role}")

    if owner_type is not None:
        permitted = attachment_service.allowed_roles(owner_type)
        if role_enum not in permitted:
            labels = ", ".join(r.value for r in permitted)
            raise HTTPException(
                status_code=400,
                detail=f"Role '{role}' zde není povolená. Povolené role: {labels}",
            )
    return role_enum


def _get_attachment(db: Session, attachment_id: int) -> models.Attachment:
    attachment = db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Příloha nebyla nalezena")
    return attachment


@router.get("/attachments")
def list_attachments(
    owner_type: str = Query(...),
    owner_id: Optional[int] = Query(None),
    role: Optional[str] = Query(None),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Přílohy jednoho vlastníka."""
    normalized_owner_id = _validate_owner(owner_type, owner_id, db)
    roles = [_validate_role(role, owner_type).value] if role else None
    return attachment_service.list_for_owner(db, owner_type, normalized_owner_id, roles=roles)


@router.post("/attachments")
async def upload_attachment(
    file: UploadFile = File(...),
    owner_type: str = Form(...),
    owner_id: Optional[int] = Form(None),
    role: str = Form(AttachmentRole.document.value),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Nahraje soubor a rovnou ho připojí k vlastníkovi (jeden request)."""
    normalized_owner_id = _validate_owner(owner_type, owner_id, db)
    role_enum = _validate_role(role, owner_type)

    file_record = await file_service.store_upload(
        db,
        file,
        file_type=_FILE_TYPE_BY_ROLE.get(role_enum, FileTypeEnum.document),
        uploaded_by=current_admin.id,
    )

    # Systematický název podle místa prvního připojení
    systematic = naming.systematic_filename(
        db, owner_type, normalized_owner_id, role_enum.value, file_record.original_filename
    )
    if systematic:
        file_record.original_filename = systematic
        db.commit()

    attachment = attachment_service.attach(
        db,
        file_id=file_record.id,
        owner_type=owner_type,
        owner_id=normalized_owner_id,
        role=role_enum.value,
        created_by=current_admin.id,
    )
    return attachment_service.attachment_dict(attachment, file_record)


@router.post("/attachments/link")
def link_attachment(
    payload: Dict[str, Any],
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Připojí soubor, který už je v knihovně."""
    file_id = payload.get("file_id")
    if not file_id:
        raise HTTPException(status_code=400, detail="Chybí file_id")

    file_record = db.query(models.File).filter(models.File.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="Soubor nebyl nalezen")

    owner_type = payload.get("owner_type") or ""
    normalized_owner_id = _validate_owner(owner_type, payload.get("owner_id"), db)
    role_enum = _validate_role(payload.get("role") or AttachmentRole.document.value, owner_type)

    attachment = attachment_service.attach(
        db,
        file_id=file_record.id,
        owner_type=owner_type,
        owner_id=normalized_owner_id,
        role=role_enum.value,
        created_by=current_admin.id,
    )
    # Název souboru se určuje při prvním nahrání a další připojení ho nemění -
    # jinak by se soubor přejmenoval pod rukama tomu, kdo ho už používá.
    return attachment_service.attachment_dict(attachment, file_record)


@router.put("/attachments/{attachment_id}")
def update_attachment(
    attachment_id: int,
    payload: Dict[str, Any],
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Změní roli, pořadí nebo zveřejnění přílohy.

    Název se tu měnit nedá - je to název souboru a mění se v knihovně
    (PUT /api/admin/library/files/{id}), aby ho všechna místa viděla stejně.
    """
    attachment = _get_attachment(db, attachment_id)

    if "role" in payload:
        attachment.role = _validate_role(payload["role"], attachment.owner_type).value
    if "sort_order" in payload:
        attachment.sort_order = int(payload["sort_order"] or 0)
    if "published" in payload:
        attachment.published = bool(payload["published"])

    db.commit()
    db.refresh(attachment)
    file_record = db.query(models.File).filter(models.File.id == attachment.file_id).first()
    return attachment_service.attachment_dict(attachment, file_record)


@router.post("/attachments/reorder")
def reorder_attachments(
    payload: Dict[str, Any],
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Přeuspořádá přílohy podle pořadí ID v `attachment_ids`."""
    attachment_ids = payload.get("attachment_ids") or []
    if not isinstance(attachment_ids, list):
        raise HTTPException(status_code=400, detail="attachment_ids musí být seznam")

    for position, attachment_id in enumerate(attachment_ids):
        db.query(models.Attachment).filter(models.Attachment.id == attachment_id).update(
            {"sort_order": position}, synchronize_session=False
        )
    db.commit()
    return {"message": "Pořadí uloženo", "updated": len(attachment_ids)}


@router.delete("/attachments/{attachment_id}")
def delete_attachment(
    attachment_id: int,
    delete_file: bool = Query(False, description="Smazat i soubor z knihovny"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Odpojí přílohu. Soubor zůstane v knihovně, pokud není delete_file=true."""
    attachment = _get_attachment(db, attachment_id)
    file_id = attachment.file_id

    db.delete(attachment)
    db.commit()

    if not delete_file:
        # Soubor bez jakékoli vazby patří zpátky do knihovny.
        remaining = db.query(models.Attachment).filter(models.Attachment.file_id == file_id).count()
        if remaining == 0:
            attachment_service.attach(
                db,
                file_id=file_id,
                owner_type=AttachmentOwner.library.value,
                owner_id=None,
                role=AttachmentRole.document.value,
                created_by=current_admin.id,
            )
        return {"message": "Příloha odpojena"}

    other_uses = (
        db.query(models.Attachment)
        .filter(
            models.Attachment.file_id == file_id,
            models.Attachment.owner_type != AttachmentOwner.library.value,
        )
        .count()
    )
    if other_uses:
        raise HTTPException(
            status_code=409,
            detail="Soubor je použitý i jinde, smazat lze jen přílohu",
        )

    db.query(models.Attachment).filter(models.Attachment.file_id == file_id).delete(
        synchronize_session=False
    )
    file_record = db.query(models.File).filter(models.File.id == file_id).first()
    if file_record:
        file_service.delete_file_from_disk(file_record)
        db.delete(file_record)
    db.commit()
    return {"message": "Příloha i soubor smazány"}
