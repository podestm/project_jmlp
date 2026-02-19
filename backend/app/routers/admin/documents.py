import os
import uuid
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

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
# FOLDER MANAGEMENT (uses fuj_jmlp_folders table)
# ============================================================================

@router.get("/folders")
def get_folders(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all folders with file counts."""
    # Get all folders from the folders table
    all_folders = db.query(models.Folder).order_by(models.Folder.name).all()
    
    # Get file counts per folder name
    file_counts = dict(
        db.query(
            models.File.folder,
            func.count(models.File.id)
        )
        .filter(models.File.folder.isnot(None), models.File.folder != "")
        .group_by(models.File.folder)
        .all()
    )
    
    folders = [
        {"id": f.id, "name": f.name, "file_count": file_counts.get(f.name, 0)}
        for f in all_folders
    ]
    
    # Count files without folder
    unassigned_count = (
        db.query(func.count(models.File.id))
        .filter((models.File.folder == None) | (models.File.folder == ""))
        .scalar()
    )
    
    total_count = db.query(func.count(models.File.id)).scalar()
    
    return {
        "folders": folders,
        "unassigned_count": unassigned_count,
        "total_count": total_count
    }


@router.post("/folders")
def create_folder(
    name: str = Form(...),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new folder."""
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Název složky nesmí být prázdný")
    
    # Check if folder already exists in the table
    existing = db.query(models.Folder).filter(models.Folder.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Složka s tímto názvem již existuje")
    
    folder = models.Folder(name=name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    
    return {"message": f"Složka '{name}' vytvořena", "id": folder.id, "name": folder.name}


@router.post("/folders/rename")
def rename_folder(
    name: str = Form(...),
    new_name: str = Form(...),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Rename a folder (updates folder table + all files in it)."""
    new_name = new_name.strip()
    name = name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Nový název nesmí být prázdný")
    
    folder = db.query(models.Folder).filter(models.Folder.name == name).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Složka nenalezena")
    
    # Check if new name already exists
    if db.query(models.Folder).filter(models.Folder.name == new_name).first():
        raise HTTPException(status_code=400, detail="Složka s tímto názvem již existuje")
    
    # Update folder table
    folder.name = new_name
    
    # Update all files in this folder
    files = db.query(models.File).filter(models.File.folder == name).all()
    for f in files:
        f.folder = new_name
    
    db.commit()
    
    return {"message": f"Složka přejmenována na '{new_name}'", "affected_files": len(files)}


@router.delete("/folders")
def delete_folder(
    name: str = Query(..., description="Folder name to delete"),
    delete_files: bool = Query(False, description="Also delete all files in the folder"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Remove folder. Optionally delete all files in it."""
    folder = db.query(models.Folder).filter(models.Folder.name == name).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Složka nenalezena")
    
    files = db.query(models.File).filter(models.File.folder == name).all()
    
    if delete_files:
        # Delete files from filesystem and DB
        for f in files:
            try:
                if os.path.exists(f.file_path):
                    os.remove(f.file_path)
            except Exception as e:
                print(f"Warning: Could not delete file {f.file_path}: {e}")
            db.delete(f)
        msg = f"Složka '{name}' odstraněna, {len(files)} souborů smazáno"
    else:
        # Just unassign files
        for f in files:
            f.folder = None
        msg = f"Složka '{name}' odstraněna, {len(files)} souborů přesunuto do Nepřiřazené"
    
    db.delete(folder)
    db.commit()
    
    return {"message": msg}


@router.post("/files/{file_id}/move")
def move_file_to_folder(
    file_id: int,
    folder: Optional[str] = Form(None),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Move a file to a different folder (or remove from folder)."""
    file_obj = db.query(models.File).filter(models.File.id == file_id).first()
    if not file_obj:
        raise HTTPException(status_code=404, detail="Soubor nenalezen")
    
    file_obj.folder = folder.strip() if folder and folder.strip() else None
    db.commit()
    
    return {"message": "Soubor přesunut", "folder": file_obj.folder}


@router.post("/files/batch-move")
def batch_move_files(
    file_ids: str = Form(...),
    folder: Optional[str] = Form(None),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Move multiple files to a folder at once. file_ids is comma-separated."""
    try:
        ids = [int(x.strip()) for x in file_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Neplatný formát ID souborů")
    
    if not ids:
        raise HTTPException(status_code=400, detail="Žádné soubory k přesunu")
    
    target_folder = folder.strip() if folder and folder.strip() else None
    
    files = db.query(models.File).filter(models.File.id.in_(ids)).all()
    for f in files:
        f.folder = target_folder
    db.commit()
    
    return {
        "message": f"{len(files)} souborů přesunuto",
        "folder": target_folder,
        "moved_count": len(files)
    }


# ============================================================================
# ACTIVE FILE MANAGEMENT ENDPOINTS (fuj_jmlp_files table)
# ============================================================================

@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    file_type: str = Form("neprirazene"),
    folder: str = Form(None),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Upload a general file, optionally into a folder."""
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
    
    # Create documents directory if it doesn't exist (persistent volume)
    documents_dir = Path("uploads/documents")
    documents_dir.mkdir(parents=True, exist_ok=True)
    
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
        folder=folder.strip() if folder and folder.strip() else None,
        uploaded_by=current_admin.id
    )
    
    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    
    return {
        "message": "Soubor úspěšně nahrán", 
        "file_id": file_record.id,
        "original_filename": file_record.original_filename,
        "filename": file_record.filename,
        "file_type": file_record.file_type.value if file_record.file_type else "neprirazene",
        "folder": file_record.folder
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
        # Check where this file is used
        usage_info = []
        
        # Check if used as proposition
        races_with_proposition = db.query(models.Race).filter(
            models.Race.proposition_file_id == file_obj.id
        ).all()
        for race in races_with_proposition:
            usage_info.append({
                "type": "Propozice",
                "title": f"Závod {race.raceNr or race.id} - {race.datum}"
            })
        
        # Check if used as results
        races_with_results = db.query(models.Race).filter(
            models.Race.results_file_id == file_obj.id
        ).all()
        for race in races_with_results:
            usage_info.append({
                "type": "Výsledky",
                "title": f"Závod {race.raceNr or race.id} - {race.datum}"
            })
        
        # Check if used as post image
        posts_with_image = db.query(models.Post).filter(
            models.Post.image_file_id == file_obj.id
        ).all()
        for post in posts_with_image:
            usage_info.append({
                "type": "Obrázek příspěvku",
                "title": post.title
            })
        
        # Check if used as post document
        posts_with_document = db.query(models.Post).filter(
            models.Post.document_file_id == file_obj.id
        ).all()
        for post in posts_with_document:
            usage_info.append({
                "type": "Dokument příspěvku",
                "title": post.title
            })
        
        result.append({
            "id": file_obj.id,
            "original_filename": file_obj.original_filename,
            "filename": file_obj.filename,
            "file_path": file_obj.file_path,
            "file_size": file_obj.file_size,
            "mime_type": file_obj.mime_type,
            "file_type": file_obj.file_type.value if file_obj.file_type else "neprirazene",
            "folder": file_obj.folder,
            "uploaded_at": file_obj.uploaded_at,
            "uploaded_by": file_obj.uploaded_by,
            "usage_info": usage_info
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
            "file_type": file_obj.file_type.value if file_obj.file_type else "neprirazene",
            "folder": file_obj.folder
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


@router.get("/files/storage-stats")
def get_storage_stats(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Vrací statistiku úložného prostoru nahraných souborů.
    """
    # Spočítáme velikost všech souborů v databázi
    files = db.query(models.File).all()
    
    total_size = 0
    file_count = 0
    existing_files = 0
    missing_files = 0
    
    for file_obj in files:
        file_count += 1
        # Použijeme file_size z databáze (spolehlivější než kontrola disku)
        total_size += file_obj.file_size
        
        # Pro info: kontrola existence na disku
        if os.path.exists(file_obj.file_path):
            existing_files += 1
        else:
            missing_files += 1
    
    # Formátování velikosti
    def format_size(size_bytes):
        """Převede byty na čitelný formát."""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.2f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.2f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"
    
    return {
        "total_size_bytes": total_size,
        "total_size_formatted": format_size(total_size),
        "file_count": file_count,
        "existing_files": existing_files,
        "missing_files": missing_files
    }