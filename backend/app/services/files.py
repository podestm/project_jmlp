"""Ukládání souborů na disk a do fuj_jmlp_files.

Jediné místo, které zapisuje do uploads/documents/. Používá ho jak ruční upload
z administrace, tak publikace vygenerovaného PDF.
"""

import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models
from ..models import FileTypeEnum

logger = logging.getLogger(__name__)

# Relativní cesta - CWD je /app v obou images, /app/uploads/documents je volume.
DOCUMENTS_DIR = Path("uploads/documents")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
    ".jpg",
    ".jpeg",
    ".png",
    ".xlsx",
    ".xls",
    ".csv",
}

_MIME_BY_EXTENSION = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".txt": "text/plain",
    ".csv": "text/csv",
}


def guess_mime_type(filename: str, fallback: Optional[str] = None) -> str:
    """MIME podle přípony. Content-Type z prohlížeče je jen záložní zdroj."""
    extension = Path(filename).suffix.lower()
    return _MIME_BY_EXTENSION.get(extension) or fallback or "application/octet-stream"


def validate_extension(filename: str) -> str:
    """Ověří příponu a vrátí ji (s tečkou, malými písmeny)."""
    extension = Path(filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Nepodporovaný typ souboru. Povolené: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return extension


def store_document_bytes(
    db: Session,
    *,
    content: bytes,
    original_filename: str,
    file_type: FileTypeEnum = FileTypeEnum.neprirazene,
    mime_type: Optional[str] = None,
    uploaded_by: Optional[int] = None,
) -> models.File:
    """Zapíše bajty na disk pod UUID názvem a založí řádek ve fuj_jmlp_files."""
    extension = validate_extension(original_filename)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Soubor je příliš velký (max 10MB)")
    if not content:
        raise HTTPException(status_code=400, detail="Soubor je prázdný")

    unique_filename = f"{uuid.uuid4().hex}{extension}"
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    file_path = DOCUMENTS_DIR / unique_filename

    try:
        file_path.write_bytes(content)
    except OSError:
        logger.exception("Nepodařilo se uložit soubor %s", file_path)
        raise HTTPException(status_code=500, detail="Chyba při ukládání souboru")

    file_record = models.File(
        original_filename=original_filename,
        filename=unique_filename,
        file_path=str(file_path),
        file_size=len(content),
        mime_type=guess_mime_type(original_filename, mime_type),
        file_type=file_type,
        uploaded_by=uploaded_by,
    )
    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    return file_record


async def store_upload(
    db: Session,
    upload: UploadFile,
    *,
    file_type: FileTypeEnum = FileTypeEnum.neprirazene,
    uploaded_by: Optional[int] = None,
) -> models.File:
    """Načte UploadFile a uloží ho.

    Velikost se kontroluje až po načtení - `upload.size` je u chunked uploadů
    None a porovnání s intem by spadlo na TypeError (dřívější chování).
    """
    validate_extension(upload.filename or "")
    content = await upload.read()
    return store_document_bytes(
        db,
        content=content,
        original_filename=upload.filename,
        file_type=file_type,
        mime_type=upload.content_type,
        uploaded_by=uploaded_by,
    )


def delete_file_from_disk(file_record: models.File) -> None:
    """Smaže soubor z disku. Chybějící soubor není chyba."""
    try:
        Path(file_record.file_path).unlink(missing_ok=True)
    except OSError:
        logger.warning("Nepodařilo se smazat soubor %s z disku", file_record.file_path)
