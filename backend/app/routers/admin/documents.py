"""Zbytkové operace nad soubory, které nejsou součástí knihovny.

Správa knihovny (výpis s filtry, přejmenování, mazání, ZIP export) je
v routers/admin/library.py, nahrávání v routers/admin/attachments.py.
Tady zůstal plochý seznam pro výběr už nahraného souboru, stažení
souboru pod jeho názvem a statistika úložiště.

Složky skončily spolu s tabulkou fuj_jmlp_folders - kam soubor patří,
říká příloha (fuj_jmlp_attachment) a jeho systematický název.
"""

import os
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from ...database import get_db
from ... import models, auth
from ...models import FileTypeEnum
from ...services import attachments as attachment_service
from ...utils import format_file_size

router = APIRouter(tags=["admin-documents"])


@router.get("/files")
def get_files(
    file_type: str = None,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
):
    """Všechny soubory, volitelně filtrované podle typu.

    Používá to výběr souboru z knihovny u příloh (LibraryPicker).
    """
    query = db.query(models.File)

    if file_type:
        try:
            file_type_enum = FileTypeEnum(file_type)
            query = query.filter(models.File.file_type == file_type_enum)
        except ValueError:
            pass  # Invalid file type, return all files

    files = query.all()

    # Kde je soubor použitý, se čte z fuj_jmlp_attachment - jiná vazba
    # souboru na vlastníka neexistuje.
    usage_map = attachment_service.usage_map(db)

    result = []
    for file_obj in files:
        usage_info = usage_map.get(file_obj.id, [])

        result.append(
            {
                "id": file_obj.id,
                "original_filename": file_obj.original_filename,
                "filename": file_obj.filename,
                "file_path": file_obj.file_path,
                "file_size": file_obj.file_size,
                "mime_type": file_obj.mime_type,
                "file_type": file_obj.file_type.value if file_obj.file_type else "neprirazene",
                "uploaded_at": file_obj.uploaded_at,
                "uploaded_by": file_obj.uploaded_by,
                "usage_info": usage_info,
            }
        )

    return result


@router.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Stáhne soubor pod jeho názvem (na disku leží pod UUID)."""
    file_obj = db.query(models.File).filter(models.File.id == file_id).first()
    if not file_obj:
        raise HTTPException(status_code=404, detail="Soubor nenalezen")

    if not os.path.exists(file_obj.file_path):
        raise HTTPException(status_code=404, detail="Soubor nenalezen na disku")

    return FileResponse(
        path=file_obj.file_path,
        filename=file_obj.original_filename,
        media_type=file_obj.mime_type or "application/octet-stream",
    )


@router.get("/files/storage-stats")
def get_storage_stats(
    current_admin: models.AdminUser = Depends(auth.get_current_admin), db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Vrací statistiku úložného prostoru nahraných souborů.
    """
    # Celkovou velikost a počet spočítá databáze jedním dotazem
    file_count, total_size = db.query(
        func.count(models.File.id), func.coalesce(func.sum(models.File.file_size), 0)
    ).first()
    file_count = file_count or 0
    total_size = int(total_size or 0)

    # Pro info: kontrola existence na disku
    existing_files = 0
    missing_files = 0
    for (file_path,) in db.query(models.File.file_path).all():
        if os.path.exists(file_path):
            existing_files += 1
        else:
            missing_files += 1

    return {
        "total_size_bytes": total_size,
        "total_size_formatted": format_file_size(total_size),
        "file_count": file_count,
        "existing_files": existing_files,
        "missing_files": missing_files,
    }
