import os
import uuid
import shutil
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, schemas, auth
from ...models import FileTypeEnum

router = APIRouter(tags=["admin-documents"])

# File upload configuration
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".xlsx", ".xls", ".csv"}


# ============================================================================
# ACTIVE FILE MANAGEMENT ENDPOINTS (fuj_jmlp_files table)
# ============================================================================

@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    file_type: str = Form("neprirazene"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Upload a general file."""
    # Validate file
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Soubor je příliš velký (max 10MB)")
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Nepodporovaný typ souboru. Povolené: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"
    
    # Create documents directory if it doesn't exist
    documents_dir = Path("documents")
    documents_dir.mkdir(exist_ok=True)
    
    file_path = documents_dir / unique_filename
    
    # Save file
    try:
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        actual_file_size = len(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Chyba při ukládání souboru")
    
    # Create file record
    try:
        file_type_enum = FileTypeEnum(file_type)
    except ValueError:
        file_type_enum = FileTypeEnum.neprirazene
    
    file_record = models.File(
        original_filename=file.filename,
        filename=unique_filename,
        file_path=str(file_path),
        file_size=actual_file_size,
        mime_type=file.content_type,
        file_type=file_type_enum,
        uploaded_by=current_admin.id
    )
    
    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    
    return {
        "message": "Soubor úspěšně nahrán", 
        "file_id": file_record.id,
        "original_filename": file_record.original_filename,
        "filename": file_record.filename
    }


@router.get("/files")
def get_files(
    file_type: str = None,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(auth.get_current_admin)
):
    """Get all files, optionally filtered by type."""
    query = db.query(models.File)
    
    if file_type:
        try:
            file_type_enum = FileTypeEnum(file_type)
            query = query.filter(models.File.file_type == file_type_enum)
        except ValueError:
            pass  # Invalid file type, return all files
    
    files = query.all()
    
    result = []
    for file_obj in files:
        result.append({
            "id": file_obj.id,
            "original_filename": file_obj.original_filename,
            "filename": file_obj.filename,
            "file_path": file_obj.file_path,
            "file_size": file_obj.file_size,
            "mime_type": file_obj.mime_type,
            "file_type": file_obj.file_type.value if file_obj.file_type else "neprirazene",
            "uploaded_at": file_obj.uploaded_at,
            "uploaded_by": file_obj.uploaded_by
        })
    
    return result


@router.get("/files/available-for-race")
def get_files_for_race(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get files available for race assignment."""
    files = db.query(models.File).filter(
        models.File.file_type.in_([FileTypeEnum.neprirazene, FileTypeEnum.propozice, FileTypeEnum.vysledky])
    ).all()
    
    result = []
    for file_obj in files:
        result.append({
            "id": file_obj.id,
            "original_name": file_obj.original_filename,
            "file_type": file_obj.file_type.value if file_obj.file_type else "neprirazene"
        })
    
    return result


@router.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a file."""
    file_obj = db.query(models.File).filter(models.File.id == file_id).first()
    if not file_obj:
        raise HTTPException(status_code=404, detail="Soubor nenalezen")
    
    # Delete file from filesystem
    try:
        if os.path.exists(file_obj.file_path):
            os.remove(file_obj.file_path)
    except Exception as e:
        print(f"Warning: Could not delete file {file_obj.file_path}: {e}")
    
    # Delete record from database
    db.delete(file_obj)
    db.commit()
    
    return {"message": "Soubor úspěšně smazán"}


@router.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Download a file."""
    print(f"=== FILE DOWNLOAD DEBUG ===")
    print(f"file_id: {file_id}")
    print(f"current_admin: {current_admin}")
    
    file_obj = db.query(models.File).filter(models.File.id == file_id).first()
    print(f"file_obj: {file_obj}")
    if not file_obj:
        raise HTTPException(status_code=404, detail="Soubor nenalezen")
    
    if not os.path.exists(file_obj.file_path):
        raise HTTPException(status_code=404, detail="Soubor nenalezen na disku")
    
    return FileResponse(
        path=file_obj.file_path,
        filename=file_obj.original_filename,
        media_type=file_obj.mime_type or 'application/octet-stream'
    )