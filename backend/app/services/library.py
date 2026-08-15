"""Knihovna dokumentů jako plochý seznam souborů s filtry.

Strom sezóna -> podsložka -> soubor skončil: zařazení souboru dává
fuj_jmlp_attachment (kam je připojený) a systematický název, ne ruční
přesouvání mezi složkami. Knihovna proto jen filtruje jednu tabulku.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import models
from ..models import AttachmentOwner
from . import attachments as attachment_service

# Podle čeho jde filtrovat "kam soubor patří". "library" znamená
# nepřipojený nikam - proto se ptá NOT EXISTS, ne rovnost.
FILTERABLE_OWNERS = tuple(owner.value for owner in AttachmentOwner)


@dataclass(frozen=True)
class LibraryFilters:
    """Filtry výpisu knihovny. Všechny jsou volitelné a kombinují se přes AND."""
    q: Optional[str] = None
    extension: Optional[str] = None
    owner_type: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None


def build_where(filters: LibraryFilters) -> Tuple[str, Dict[str, Any]]:
    """WHERE (bez klíčového slova) a parametry pro dotaz nad `fuj_jmlp_files f`.

    Prázdný filtr vrací prázdný řetězec - volající ho pak do dotazu vůbec
    nevkládá a projdou všechny soubory.
    """
    clauses: List[str] = []
    params: Dict[str, Any] = {}

    if filters.q:
        clauses.append("f.original_filename LIKE :q")
        params["q"] = f"%{filters.q}%"

    if filters.extension:
        clauses.append("LOWER(SUBSTRING_INDEX(f.original_filename, '.', -1)) = :extension")
        params["extension"] = filters.extension.lstrip(".").lower()

    if filters.date_from:
        clauses.append("f.uploaded_at >= :date_from")
        params["date_from"] = filters.date_from

    if filters.date_to:
        # Horní mez je exkluzivní o den dál, aby se vešel celý poslední den
        # včetně času - uploaded_at je DATETIME, ne DATE.
        clauses.append("f.uploaded_at < :date_to_exclusive")
        params["date_to_exclusive"] = filters.date_to + timedelta(days=1)

    if filters.owner_type:
        if filters.owner_type == AttachmentOwner.library.value:
            clauses.append(
                "NOT EXISTS (SELECT 1 FROM fuj_jmlp_attachment a"
                " WHERE a.file_id = f.id AND a.owner_type <> 'library')"
            )
        else:
            clauses.append(
                "EXISTS (SELECT 1 FROM fuj_jmlp_attachment a"
                " WHERE a.file_id = f.id AND a.owner_type = :owner_type)"
            )
            params["owner_type"] = filters.owner_type

    return " AND ".join(clauses), params


def list_files(db: Session, filters: LibraryFilters) -> List[Dict[str, Any]]:
    """Soubory odpovídající filtru, od nejnovějšího."""
    where, params = build_where(filters)
    sql = "SELECT f.id FROM fuj_jmlp_files f"
    if where:
        sql += f" WHERE {where}"
    sql += " ORDER BY f.uploaded_at DESC, f.id DESC"

    file_ids = [row[0] for row in db.execute(text(sql), params)]
    if not file_ids:
        return []

    # Pořadí drží seznam id ze SQL - dotaz na modely ho nezachovává.
    by_id = {
        file_obj.id: file_obj
        for file_obj in db.query(models.File).filter(models.File.id.in_(file_ids)).all()
    }
    usage = attachment_service.usage_map(db, file_ids)

    return [
        {
            "id": file_obj.id,
            "original_filename": file_obj.original_filename,
            "filename": file_obj.filename,
            "file_size": file_obj.file_size,
            "mime_type": file_obj.mime_type,
            "uploaded_at": file_obj.uploaded_at,
            "download_url": f"/uploads/documents/{file_obj.filename}",
            "usage_info": usage.get(file_obj.id, []),
        }
        for file_obj in (by_id.get(file_id) for file_id in file_ids)
        if file_obj is not None
    ]
