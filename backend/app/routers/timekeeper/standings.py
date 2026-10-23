"""Pořadí poháru - průběžné a celkové výsledky sezóny.

Časoměřič po závodě vygeneruje pořadí (počítá services/standings.py),
prohlédne si ho v náhledu a může ho zveřejnit u sezóny. Sezóna má vždy
nejvýše jeden výsledkový dokument (průběžné, nebo celkové výsledky), takže
zveřejnění nahradí ten dosavadní.

PDF vzniká v prohlížeči stejně jako výsledková listina závodu; sem se posílá
hotový soubor, takže je zveřejněné přesně to, co bylo v náhledu.
"""
from typing import Optional, Any, Dict

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, auth
from ...models import AttachmentOwner, AttachmentRole, FileTypeEnum
from ...services import attachments as attachment_service
from ...services import files as file_service
from ...services import naming
from ...services import standings as standings_service

router = APIRouter(tags=["timekeeper-standings"])


def _season_or_404(db: Session, season_id: int) -> models.Season:
    season = db.query(models.Season).filter(models.Season.year_start == season_id).first()
    if not season:
        raise HTTPException(status_code=404, detail="Sezóna nenalezena")
    return season


@router.get("/seasons/{season_id}/standings")
def get_standings(
    season_id: int,
    final: Optional[bool] = Query(default=None, description="Celkové výsledky místo průběžných; "
                                  "bez parametru celkové, jakmile má finále sezóny výsledky"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Pořadí poháru po kategoriích jako podklad pro PDF."""
    _season_or_404(db, season_id)
    if final is None:
        final = standings_service.season_finished(db, season_id)
    return standings_service.season_standings(db, season_id, final=final)


@router.post("/seasons/{season_id}/standings/publish")
async def publish_standings(
    season_id: int,
    final: bool = Query(default=False, description="Zveřejnit jako celkové výsledky"),
    file: UploadFile = File(...),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Zveřejní vygenerované pořadí u sezóny (průběžné nebo celkové výsledky)."""
    _season_or_404(db, season_id)
    owner_type = AttachmentOwner.season.value
    role = (AttachmentRole.vysledky if final else AttachmentRole.prubezne).value

    file_record = await file_service.store_upload(
        db, file, file_type=FileTypeEnum.vysledky, uploaded_by=current_admin.id,
    )

    # Dosavadní výsledkový dokument sezóny - průběžné i celkové jsou jedna skupina.
    group = attachment_service.exclusive_group(owner_type, role) or (role,)
    previous = db.query(models.Attachment).filter(
        models.Attachment.owner_type == owner_type,
        models.Attachment.owner_id == season_id,
        models.Attachment.role.in_(group),
    ).all()
    previous_generated = [item.file_id for item in previous if item.is_generated]

    attachment_service.attach(
        db,
        file_id=file_record.id,
        owner_type=owner_type,
        owner_id=season_id,
        role=role,
        is_generated=True,
        created_by=current_admin.id,
    )

    # Dřívější VYGENEROVANÉ pořadí smažeme, ať se nehromadí. Ručně nahrané
    # (třeba PDF z LiZy) nikdy - jen se v attach() odpojilo.
    for file_id in previous_generated:
        if file_id == file_record.id:
            continue
        if db.query(models.Attachment).filter(models.Attachment.file_id == file_id).count():
            continue
        old_file = db.query(models.File).filter(models.File.id == file_id).first()
        if old_file:
            file_service.delete_file_from_disk(old_file)
            db.delete(old_file)
            db.commit()

    systematic = naming.systematic_filename(
        db, owner_type, season_id, role, file_record.original_filename,
    )
    if systematic:
        file_record.original_filename = systematic
        db.commit()

    return {
        "message": "Celkové výsledky poháru zveřejněny" if final else "Průběžné výsledky poháru zveřejněny",
        "file_id": file_record.id,
    }
