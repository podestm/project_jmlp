"""Knihovna dokumentů - plochý seznam souborů, přejmenování, mazání, export.

Složky ani sezóny se tu už nespravují: kam soubor patří, určuje příloha
(fuj_jmlp_attachment) a systematický název. Zbývá filtrovat, přejmenovat,
smazat a stáhnout všechno jako ZIP.
"""

import logging
import tempfile
import zipfile
from datetime import date
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, auth
from ...services import attachments as attachment_service
from ...services import files as file_service
from ...services import library as library_service
from ...services import library_export
from ...services import naming

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/library", tags=["admin-library"])


def library_filters(
    q: Optional[str] = Query(None, description="Část názvu souboru"),
    extension: Optional[str] = Query(None, description="Přípona, s tečkou i bez"),
    owner_type: Optional[str] = Query(None, description="Kam je soubor připojený"),
    date_from: Optional[date] = Query(None, description="Nahráno od (včetně)"),
    date_to: Optional[date] = Query(None, description="Nahráno do (včetně)"),
) -> library_service.LibraryFilters:
    """Filtry výpisu - stejné pro seznam i pro export, ať stahuje to, co je vidět."""
    if owner_type and owner_type not in library_service.FILTERABLE_OWNERS:
        allowed = ", ".join(library_service.FILTERABLE_OWNERS)
        raise HTTPException(
            status_code=400,
            detail=f"Neznámý typ vlastníka: {owner_type}. Povolené: {allowed}",
        )

    return library_service.LibraryFilters(
        q=(q or "").strip() or None,
        extension=(extension or "").strip() or None,
        owner_type=owner_type or None,
        date_from=date_from,
        date_to=date_to,
    )


def _get_file(db: Session, file_id: int) -> models.File:
    file_record = db.query(models.File).filter(models.File.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="Soubor nebyl nalezen")
    return file_record


@router.get("")
def list_library(
    filters: library_service.LibraryFilters = Depends(library_filters),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Soubory odpovídající filtru, od nejnovějšího."""
    files = library_service.list_files(db, filters)
    return {
        "files": files,
        "count": len(files),
        "total": db.query(models.File).count(),
    }


@router.put("/files/{file_id}")
def rename_file(
    file_id: int,
    payload: Dict[str, Any],
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Přejmenuje soubor. Příponu určuje soubor na disku, ne zadaný text."""
    file_record = _get_file(db, file_id)

    extension = Path(file_record.filename or "").suffix.lower()
    try:
        new_name = naming.sanitize_manual_name(payload.get("name"), extension)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Kolace je case-insensitive, takže tohle chytne i "Propozice.pdf".
    clash = (
        db.query(models.File.id)
        .filter(
            models.File.original_filename == new_name,
            models.File.id != file_id,
        )
        .first()
    )
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f'Soubor s názvem „{new_name}" už v knihovně je',
        )

    file_record.original_filename = new_name
    db.commit()
    return {"id": file_record.id, "original_filename": file_record.original_filename}


@router.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    force: bool = Query(False, description="Smazat i když je soubor použitý"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Smaže soubor z knihovny i z disku."""
    file_record = _get_file(db, file_id)

    usage = attachment_service.usage_map(db, [file_id]).get(file_id, [])
    if usage and not force:
        places = ", ".join(f"{u['type']}: {u['title']}" for u in usage)
        raise HTTPException(
            status_code=409,
            detail=f"Soubor je používán ({places}) a nelze jej smazat. Nejprve jej odpojte.",
        )

    db.query(models.Attachment).filter(models.Attachment.file_id == file_id).delete(
        synchronize_session=False
    )
    file_service.delete_file_from_disk(file_record)
    db.delete(file_record)
    db.commit()
    return {"message": "Soubor smazán"}


@router.get("/export.zip")
def export_library(
    background_tasks: BackgroundTasks,
    filters: library_service.LibraryFilters = Depends(library_filters),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> FileResponse:
    """Stáhne vyfiltrované soubory jako ZIP roztříděný do složek.

    Archiv se skládá na disk, ne do paměti - celá knihovna má přes 80 MB a
    dva workery by na dvoujádrovém stroji sáhly po 160 MB RAM najednou.
    """
    files = library_service.list_files(db, filters)
    if not files:
        raise HTTPException(status_code=404, detail="Filtru neodpovídá žádný soubor")

    entry_names = library_export.zip_entry_names(files)

    archive = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    archive.close()
    archive_path = Path(archive.name)

    try:
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as bundle:
            for file_info in files:
                source = file_service.DOCUMENTS_DIR / (file_info["filename"] or "")
                if not source.is_file():
                    logger.warning(
                        "Soubor %s (%s) chybí na disku, do archivu nepůjde",
                        file_info["id"],
                        file_info["filename"],
                    )
                    continue
                bundle.write(source, entry_names[file_info["id"]])
    except OSError:
        archive_path.unlink(missing_ok=True)
        logger.exception("Nepodařilo se sestavit archiv knihovny")
        raise HTTPException(status_code=500, detail="Nepodařilo se sestavit archiv")

    # Až po odeslání odpovědi - dřív by se stahoval smazaný soubor.
    background_tasks.add_task(archive_path.unlink, missing_ok=True)
    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename=f"jmlp-dokumenty-{date.today().isoformat()}.zip",
    )
