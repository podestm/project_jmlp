from datetime import timedelta, datetime
from typing import List, Optional
import os
import uuid
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, text

from ..database import get_db
from .. import models, schemas, auth
from ..models import FileTypeEnum

router = APIRouter(prefix="/admin", tags=["admin"])

# File upload configuration
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".jpg", ".jpeg", ".png"}


@router.post("/login", response_model=schemas.Token)
def login(login_data: schemas.AdminLogin, db: Session = Depends(get_db)):
    """Admin login endpoint."""
    admin = auth.authenticate_admin(db, login_data.email, login_data.password)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nesprávný email nebo heslo",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last login
    admin.last_login = datetime.utcnow()
    db.commit()
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(admin.id)}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


@router.get("/me", response_model=schemas.AdminUser)
def read_current_admin(current_admin: models.AdminUser = Depends(auth.get_current_admin)):
    """Get current admin user info."""
    return current_admin


@router.post("/logout")
def logout(current_admin: models.AdminUser = Depends(auth.get_current_admin)):
    """Admin logout endpoint."""
    # In a more sophisticated implementation, we could invalidate the token
    # For now, we just return success
    return {"message": "Úspěšně odhlášeno"}


# Race management endpoints
@router.get("/races", response_model=List[schemas.Race])
def list_races_admin(
    skip: int = 0, 
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all races for admin management."""
    races = db.query(models.Race).order_by(desc(models.Race.datum)).offset(skip).limit(limit).all()
    
    # Add areal names and organizer names
    result = []
    for race in races:
        race_dict = race.__dict__.copy()
        
        # Add areal name
        if race.areal_id:
            areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
            race_dict["areal_name"] = areal.name if areal else None
        else:
            race_dict["areal_name"] = None
        
        # Add organizer name
        if race.organizer_id:
            organizer = db.query(models.Club).filter(models.Club.id == race.organizer_id).first()
            race_dict["organizer_name"] = organizer.name if organizer else None
        else:
            race_dict["organizer_name"] = None
            
        result.append(race_dict)
    
    return result


@router.get("/races/{race_id}", response_model=schemas.Race)
def get_race_admin(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get single race details for admin."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    race_dict = race.__dict__.copy()
    
    # Add areal name
    if race.areal_id:
        areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
        race_dict["areal_name"] = areal.name if areal else None
    else:
        race_dict["areal_name"] = None
    
    # Add organizer name
    if race.organizer_id:
        organizer = db.query(models.Club).filter(models.Club.id == race.organizer_id).first()
        race_dict["organizer_name"] = organizer.name if organizer else None
    else:
        race_dict["organizer_name"] = None
    
    return race_dict


@router.post("/races", response_model=schemas.Race)
def create_race_admin(
    race_data: schemas.RaceCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new race."""
    race = models.Race(**race_data.dict())
    db.add(race)
    db.commit()
    db.refresh(race)
    
    # Auto-categorize files when assigned to race
    if race_data.proposition_file_id:
        file_record = db.query(models.File).filter(models.File.id == race_data.proposition_file_id).first()
        if file_record and file_record.file_type == FileTypeEnum.neprirazene:
            file_record.file_type = FileTypeEnum.propozice
            db.commit()
    
    if race_data.results_file_id:
        file_record = db.query(models.File).filter(models.File.id == race_data.results_file_id).first()
        if file_record and file_record.file_type == FileTypeEnum.neprirazene:
            file_record.file_type = FileTypeEnum.vysledky
            db.commit()
    
    # Add areal name
    race_dict = race.__dict__.copy()
    if race.areal_id:
        areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
        race_dict["areal_name"] = areal.name if areal else None
    else:
        race_dict["areal_name"] = None
    
    return race_dict


@router.put("/races/{race_id}", response_model=schemas.Race)
def update_race_admin(
    race_id: int,
    race_data: schemas.RaceUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Update an existing race."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    # Debug: Print incoming data
    print(f"DEBUG: Updating race {race_id} with data: {race_data.dict(exclude_unset=True)}")
    
    # Update only provided fields
    update_data = race_data.dict(exclude_unset=True)
    
    # Handle file assignments and disconnections
    if 'proposition_file_id' in update_data:
        if update_data['proposition_file_id']:  # Assigning a file
            file_record = db.query(models.File).filter(models.File.id == update_data['proposition_file_id']).first()
            if file_record and file_record.file_type == FileTypeEnum.neprirazene:
                file_record.file_type = FileTypeEnum.propozice
        else:  # Disconnecting file (empty string or None)
            update_data['proposition_file_id'] = None
    
    if 'results_file_id' in update_data:
        if update_data['results_file_id']:  # Assigning a file
            file_record = db.query(models.File).filter(models.File.id == update_data['results_file_id']).first()
            if file_record and file_record.file_type == FileTypeEnum.neprirazene:
                file_record.file_type = FileTypeEnum.vysledky
        else:  # Disconnecting file (empty string or None)
            update_data['results_file_id'] = None
    
    # Apply updates to race
    for field, value in update_data.items():
        setattr(race, field, value)
    
    db.commit()
    db.refresh(race)
    
    # Add areal name
    race_dict = race.__dict__.copy()
    if race.areal_id:
        areal = db.query(models.Areal).filter(models.Areal.id == race.areal_id).first()
        race_dict["areal_name"] = areal.name if areal else None
    else:
        race_dict["areal_name"] = None
    
    return race_dict


@router.put("/races/{race_id}/toggle-registration")
def toggle_race_registration(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Toggle race registration on/off."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    race.registration = not race.registration
    db.commit()
    db.refresh(race)
    
    return {"message": f"Registrace {'povolena' if race.registration else 'zakázána'}", "registration": race.registration}


@router.delete("/races/{race_id}")
def delete_race_admin(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a race."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    db.delete(race)
    db.commit()
    
    return {"message": "Závod byl smazán"}


# Document upload endpoints
@router.post("/races/{race_id}/upload", response_model=schemas.Document)
async def upload_document(
    race_id: int,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Upload a document for a race."""
    # Validate race exists
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    # Validate file
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Soubor je příliš velký (max 10MB)")
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Nepodporovaný typ souboru. Povolené: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Validate document type
    if document_type not in ["propozice", "vysledky", "other"]:
        raise HTTPException(status_code=400, detail="Neplatný typ dokumentu")
    
    # Generate unique filename with documents folder
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"
    
    # Create documents directory if it doesn't exist
    documents_dir = UPLOAD_DIR / "documents"
    documents_dir.mkdir(exist_ok=True)
    
    file_path = documents_dir / unique_filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Chyba při ukládání souboru")
    
    # Update race table with document path
    relative_path = f"documents/{unique_filename}"
    
    if document_type == "propozice":
        race.proposition = relative_path
    elif document_type == "vysledky":
        race.result = relative_path
    
    # Save to database
    document = models.Document(
        race_id=race_id,
        type=document_type,
        filename=unique_filename,
        original_filename=file.filename,
        file_path=str(file_path),
        file_size=file.size,
        mime_type=file.content_type,
        uploaded_by=current_admin.id
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    return document


@router.get("/races/{race_id}/documents", response_model=List[schemas.Document])
def list_race_documents(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List documents for a race."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    documents = db.query(models.Document).filter(models.Document.race_id == race_id).all()
    return documents


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a document."""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Dokument nenalezen")
    
    # Delete file from disk
    try:
        if Path(document.file_path).exists():
            Path(document.file_path).unlink()
    except Exception:
        pass  # Continue even if file deletion fails
    
    # Delete from database
    db.delete(document)
    db.commit()
    
    return {"message": "Dokument byl smazán"}


@router.get("/documents/{document_id}/download")
def download_document(
    document_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Download a document."""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Dokument nenalezen")
    
    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Soubor nenalezen na disku")
    
    return FileResponse(
        path=str(file_path),
        filename=document.original_filename,
        media_type=document.mime_type or 'application/octet-stream'
    )


# Racer management endpoints
@router.get("/racers", response_model=List[schemas.Racer])
def list_racers_admin(
    skip: int = 0, 
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all racers for admin management."""
    # Use raw SQL to get racer with club name
    query = """
        SELECT r.id, r.name as firstName, r.surname as lastName, r.sex, r.year as birthYear, r.club_id, r.slcr_id as idSlcr,
               CONVERT(CONVERT(c.name USING binary) USING utf8mb4) as club_name
        FROM fuj_jmlp_racer r 
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        ORDER BY r.surname, r.name
        LIMIT :limit OFFSET :skip
    """
    
    result = db.execute(text(query), {"limit": limit, "skip": skip}).fetchall()
    
    racers = []
    for row in result:
        racer_data = {
            "id": row.id,
            "firstName": row.firstName,
            "lastName": row.lastName,
            "sex": row.sex,
            "birthYear": row.birthYear,
            "club_id": row.club_id,
            "idSlcr": row.idSlcr,
            "club_name": row.club_name,
            # Also include base fields for compatibility
            "name": row.firstName,
            "surname": row.lastName,
            "year": row.birthYear,
            "slcr_id": row.idSlcr
        }
        racers.append(racer_data)
    
    return racers


@router.post("/racers", response_model=schemas.Racer)
def create_racer_admin(
    racer: schemas.RacerCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new racer."""
    # Check if club exists if provided
    if racer.club_id:
        club = db.query(models.Club).filter(models.Club.id == racer.club_id).first()
        if not club:
            raise HTTPException(status_code=400, detail="Zadaný klub neexistuje")
    
    # Create new racer
    db_racer = models.Racer(
        name=racer.firstName,  # Map firstName to name
        surname=racer.lastName,  # Map lastName to surname
        sex=racer.sex,
        year=racer.birthYear,  # Map birthYear to year
        club_id=racer.club_id if racer.club_id else None,
        slcr_id=racer.idSlcr if racer.idSlcr else None  # Map idSlcr to slcr_id
    )
    
    db.add(db_racer)
    db.commit()
    db.refresh(db_racer)
    
    return db_racer


@router.put("/racers/{racer_id}", response_model=schemas.Racer)
def update_racer_admin(
    racer_id: int,
    racer_update: schemas.RacerCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Update an existing racer."""
    # Check if racer exists
    racer = db.query(models.Racer).filter(models.Racer.id == racer_id).first()
    if not racer:
        raise HTTPException(status_code=404, detail="Závodník nenalezen")
    
    # Check if club exists if provided
    if racer_update.club_id:
        club = db.query(models.Club).filter(models.Club.id == racer_update.club_id).first()
        if not club:
            raise HTTPException(status_code=400, detail="Zadaný klub neexistuje")
    
    # Update racer data
    racer.name = racer_update.firstName  # Map firstName to name
    racer.surname = racer_update.lastName  # Map lastName to surname
    racer.sex = racer_update.sex
    racer.year = racer_update.birthYear  # Map birthYear to year
    racer.club_id = racer_update.club_id if racer_update.club_id else None
    racer.slcr_id = racer_update.idSlcr if racer_update.idSlcr else None  # Map idSlcr to slcr_id
    
    db.commit()
    db.refresh(racer)
    
    return racer


@router.delete("/racers/{racer_id}")
def delete_racer_admin(
    racer_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a racer."""
    # Check if racer exists
    racer = db.query(models.Racer).filter(models.Racer.id == racer_id).first()
    if not racer:
        raise HTTPException(status_code=404, detail="Závodník nenalezen")
    
    # Check if racer has any registrations
    registration_count = db.query(models.Registration).filter(
        models.Registration.racer_id == racer_id
    ).count()
    
    if registration_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Nelze smazat závodníka, který má {registration_count} registrací"
        )
    
    db.delete(racer)
    db.commit()
    
    return {"message": "Závodník byl úspěšně smazán"}


# Registration export endpoints
@router.get("/races/{race_id}/export-csv")
def export_race_registrations_csv(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Export race registrations to CSV format."""
    # Check if race exists
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    # Get registrations with racer and club data
    query = """
        SELECT 
            r.name as firstName,
            r.surname as lastName,
            r.sex,
            r.year as birthYear,
            CONVERT(CONVERT(c.name USING binary) USING utf8mb4) as clubName,
            r.slcr_id as idSlcr
        FROM race_registration reg
        JOIN fuj_jmlp_racer r ON reg.racer_id = r.id
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE reg.race_id = :race_id
        ORDER BY r.surname, r.name
    """
    
    result = db.execute(text(query), {"race_id": race_id}).fetchall()
    
    if not result:
        raise HTTPException(status_code=404, detail="Pro tento závod nejsou registrace")
    
    # Generate CSV content
    import io
    import csv
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    
    # Write header
    writer.writerow(['jmeno', 'prijmeni', 'sex', 'rocnik_narozeni', 'oddil', 'body_jmlp', 'id_slcr'])
    
    # Write data rows
    for row in result:
        sex_letter = 'M' if row.sex == 1 else 'Z'  # Convert 1/2 to M/Z
        club_name = row.clubName or ''
        id_slcr = row.idSlcr or ''
        
        writer.writerow([
            row.firstName or '',
            row.lastName or '',
            sex_letter,
            row.birthYear or '',
            club_name,
            '',  # body_jmlp - empty as requested
            id_slcr
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    # Create filename with race number
    race_number = race.raceNr or f"zavod_{race_id}"
    filename = f"registrace_{race_number}.csv"
    
    # Return CSV as download
    from fastapi.responses import Response
    return Response(
        content=csv_content.encode('utf-8'),
        media_type='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )


@router.get("/races/{race_id}/registrations", response_model=List[dict])
def get_race_registrations(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all registrations for a specific race."""
    # Verify race exists
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")
    
    # Get registrations with racer and club info
    query = text("""
        SELECT 
            reg.id as registration_id,
            reg.race_id,
            reg.racer_id,
            reg.registered_at as registration_date,
            CONVERT(CONVERT(r.name USING binary) USING utf8mb4) as firstName,
            CONVERT(CONVERT(r.surname USING binary) USING utf8mb4) as lastName,
            r.sex,
            r.year as birthYear,
            r.slcr_id as idSlcr,
            CONVERT(CONVERT(c.name USING binary) USING utf8mb4) as club_name
        FROM race_registration reg
        LEFT JOIN fuj_jmlp_racer r ON reg.racer_id = r.id
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE reg.race_id = :race_id
        ORDER BY r.surname, r.name
    """)
    
    registrations = db.execute(query, {"race_id": race_id}).fetchall()
    
    result = []
    for reg in registrations:
        result.append({
            "registration_id": reg.registration_id,
            "race_id": reg.race_id,
            "racer_id": reg.racer_id,
            "registration_date": reg.registration_date,
            "firstName": reg.firstName,
            "lastName": reg.lastName,
            "sex": "M" if reg.sex == 1 else ("Z" if reg.sex == 2 else ""),
            "birthYear": reg.birthYear,
            "idSlcr": reg.idSlcr,
            "club_name": reg.club_name or "Bez klubu"
        })
    
    return result


@router.get("/documents", response_model=List[dict])
def get_all_documents(
    file_type: str = Query(None, description="Filter by file type: document, image, or all"),
    current_admin=Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get list of all uploaded files with usage information."""
    
    # Query to get all files with usage information
    query = text("""
        SELECT 
            f.id,
            f.filename,
            f.original_filename,
            f.file_path,
            f.file_size,
            f.mime_type,
            f.file_type,
            f.uploaded_at,
            f.uploaded_by,
            
            -- Check usage in races (propositions)
            COUNT(DISTINCT r_prop.id) as used_in_race_propositions,
            GROUP_CONCAT(DISTINCT r_prop.raceNr ORDER BY r_prop.raceNr SEPARATOR ', ') as proposition_races,
            
            -- Check usage in races (results)
            COUNT(DISTINCT r_res.id) as used_in_race_results,
            GROUP_CONCAT(DISTINCT r_res.raceNr ORDER BY r_res.raceNr SEPARATOR ', ') as result_races,
            
            -- Check usage in posts (documents)
            COUNT(DISTINCT p_doc.id) as used_in_post_documents,
            GROUP_CONCAT(DISTINCT p_doc.title ORDER BY p_doc.created_at SEPARATOR ', ') as document_posts,
            
            -- Check usage in posts (images)
            COUNT(DISTINCT p_img.id) as used_in_post_images,
            GROUP_CONCAT(DISTINCT p_img.title ORDER BY p_img.created_at SEPARATOR ', ') as image_posts,
            
            -- Admin name
            COALESCE(a.full_name, a.email) as uploaded_by_name
        FROM fuj_jmlp_files f
        LEFT JOIN fuj_jmlp_admin a ON f.uploaded_by = a.id
        LEFT JOIN fuj_jmlp_race r_prop ON r_prop.proposition_file_id = f.id
        LEFT JOIN fuj_jmlp_race r_res ON r_res.results_file_id = f.id
        LEFT JOIN posts p_doc ON p_doc.document_file_id = f.id
        LEFT JOIN posts p_img ON p_img.image_file_id = f.id
        {file_type_filter}
        GROUP BY f.id
        ORDER BY f.uploaded_at DESC
    """.format(
        file_type_filter="WHERE f.file_type = :file_type" if file_type and file_type != "all" else ""
    ))
    
    params = {"file_type": file_type} if file_type and file_type != "all" else {}
    files = db.execute(query, params).fetchall()
    
    documents_list = []
    for file_row in files:
        # Determine document type and usage
        usage_info = []
        doc_type = "unassigned"
        
        if file_row.used_in_race_propositions > 0:
            usage_info.append(f"Propozice: {file_row.proposition_races}")
            doc_type = "propozice"
        
        if file_row.used_in_race_results > 0:
            usage_info.append(f"Výsledky: {file_row.result_races}")
            doc_type = "vysledky" if doc_type == "unassigned" else "mixed"
        
        if file_row.used_in_post_documents > 0:
            usage_info.append(f"Přílohy postů: {file_row.document_posts}")
            doc_type = "posty" if doc_type == "unassigned" else "mixed"
            
        if file_row.used_in_post_images > 0:
            usage_info.append(f"Obrázky postů: {file_row.image_posts}")
            doc_type = "posty" if doc_type == "unassigned" else "mixed"
        
        documents_list.append({
            "id": file_row.id,
            "filename": file_row.filename,
            "original_filename": file_row.original_filename,
            "file_size": file_row.file_size or 0,
            "file_type": file_row.file_type,
            "mime_type": file_row.mime_type,
            "type": doc_type,
            "usage": usage_info,
            "created_at": file_row.uploaded_at.isoformat() if file_row.uploaded_at else None,
            "uploaded_by_name": file_row.uploaded_by_name or "Unknown"
        })
    
    return documents_list


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    current_admin=Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a document from race."""
    try:
        # Parse document ID to get type and race_id
        if document_id.startswith("prop_"):
            race_id = int(document_id.replace("prop_", ""))
            doc_type = "proposition"
        elif document_id.startswith("result_"):
            race_id = int(document_id.replace("result_", ""))
            doc_type = "result"
        else:
            raise HTTPException(status_code=400, detail="Neplatné ID dokumentu")
        
        # Get race
        race = db.query(models.Race).filter(models.Race.id == race_id).first()
        if not race:
            raise HTTPException(status_code=404, detail="Závod nenalezen")
        
        # Get file path and handle both old and new formats
        if doc_type == "proposition" and race.proposition:
            if race.proposition.startswith('documents/'):
                file_path = Path("uploads") / race.proposition
            else:
                file_path = Path("uploads") / "documents" / race.proposition
            race.proposition = None
        elif doc_type == "result" and race.result:
            if race.result.startswith('documents/'):
                file_path = Path("uploads") / race.result
            else:
                file_path = Path("uploads") / "documents" / race.result
            race.result = None
        else:
            raise HTTPException(status_code=404, detail="Dokument nenalezen")
        
        # Delete file
        if file_path.exists():
            file_path.unlink()
        
        # Update database
        db.commit()
        
        return {"message": "Dokument byl smazán"}
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Neplatné ID dokumentu")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Chyba při mazání dokumentu: {str(e)}")


@router.get("/documents/{document_id}/download")
def download_document(
    document_id: str,
    current_admin=Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Download a document file."""
    try:
        # Parse document ID to get type and race_id
        if document_id.startswith("prop_"):
            race_id = int(document_id.replace("prop_", ""))
            doc_type = "proposition"
        elif document_id.startswith("result_"):
            race_id = int(document_id.replace("result_", ""))
            doc_type = "result"
        else:
            raise HTTPException(status_code=400, detail="Neplatné ID dokumentu")
        
        # Get race
        race = db.query(models.Race).filter(models.Race.id == race_id).first()
        if not race:
            raise HTTPException(status_code=404, detail="Závod nenalezen")
        
        # Get file path and handle both old and new formats
        if doc_type == "proposition" and race.proposition:
            if race.proposition.startswith('documents/'):
                file_path = Path("uploads") / race.proposition
            else:
                file_path = Path("uploads") / "documents" / race.proposition
            filename = f"propozice_zavod_{race.race_number}.pdf"
        elif doc_type == "result" and race.result:
            if race.result.startswith('documents/'):
                file_path = Path("uploads") / race.result
            else:
                file_path = Path("uploads") / "documents" / race.result
            filename = f"vysledky_zavod_{race.race_number}.pdf"
        else:
            raise HTTPException(status_code=404, detail="Dokument nenalezen")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Soubor nenalezen")
        
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="application/pdf"
        )
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Neplatné ID dokumentu")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při stahování dokumentu: {str(e)}")


# Posts management endpoints
@router.get("/posts", response_model=List[schemas.Post])
def get_all_posts(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Získat všechny posty pro admin"""
    posts = db.query(models.Post).order_by(desc(models.Post.created_at)).all()
    return posts


@router.post("/posts", response_model=schemas.Post)
def create_post(
    post: schemas.PostCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Vytvořit nový post"""
    # Validate document_file_id if provided
    if post.document_file_id:
        document_exists = db.query(models.File).filter(models.File.id == post.document_file_id).first()
        if not document_exists:
            raise HTTPException(status_code=404, detail="Dokument nenalezen")
    
    # Validate image_file_id if provided  
    if post.image_file_id:
        image_exists = db.query(models.File).filter(
            models.File.id == post.image_file_id,
            models.File.file_type == "image"
        ).first()
        if not image_exists:
            raise HTTPException(status_code=404, detail="Obrázek nenalezen")
    
    db_post = models.Post(**post.model_dump())
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


@router.put("/posts/{post_id}", response_model=schemas.Post)
def update_post(
    post_id: int,
    post_update: schemas.PostUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Upravit existující post"""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post nenalezen")
    
    # Validate document_file_id if provided
    if post_update.document_file_id is not None and post_update.document_file_id > 0:
        document_exists = db.query(models.File).filter(models.File.id == post_update.document_file_id).first()
        if not document_exists:
            raise HTTPException(status_code=404, detail="Dokument nenalezen")
    
    # Validate image_file_id if provided  
    if post_update.image_file_id is not None and post_update.image_file_id > 0:
        image_exists = db.query(models.File).filter(
            models.File.id == post_update.image_file_id,
            models.File.file_type == "image"
        ).first()
        if not image_exists:
            raise HTTPException(status_code=404, detail="Obrázek nenalezen")
    
    # Update only provided fields
    for field, value in post_update.model_dump(exclude_unset=True).items():
        setattr(db_post, field, value)
    
    db_post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_post)
    return db_post


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Smazat post"""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post nenalezen")
    
    db.delete(db_post)
    db.commit()
    return {"message": "Post byl úspěšně smazán"}


@router.post("/documents/upload", response_model=schemas.File)
def upload_document(
    file: UploadFile = File(...),
    file_type: str = Form("document"),  # 'document' or 'image'
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Nahrát nový soubor (dokument nebo obrázek)"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nebyl vybrán žádný soubor")
    
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Nepodporovaný typ souboru. Povolené: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check file size
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Soubor je příliš velký (max 10MB)")
    
    # Determine MIME type
    mime_type = file.content_type
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    documents_dir = Path("documents")
    documents_dir.mkdir(exist_ok=True)
    file_path = documents_dir / unique_filename
    
    try:
        # Save file
        with open(file_path, "wb") as buffer:
            content = file.file.read()
            buffer.write(content)
            actual_size = len(content)
        
        # Create record in fuj_jmlp_files table
        db_file = models.File(
            filename=unique_filename,
            original_filename=file.filename,
            file_path=str(file_path),
            file_size=actual_size,
            mime_type=mime_type,
            file_type=file_type,
            uploaded_by=current_admin.id
        )
        
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        
        return db_file
        
    except Exception as e:
        # Clean up file if database operation fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Chyba při nahrávání souboru: {str(e)}")


@router.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Stáhnout soubor podle ID"""
    try:
        # Get file record
        db_file = db.query(models.File).filter(models.File.id == file_id).first()
        if not db_file:
            raise HTTPException(status_code=404, detail="Soubor nenalezen")
        
        file_path = Path(db_file.file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Fyzický soubor nenalezen")
        
        return FileResponse(
            path=str(file_path),
            filename=db_file.original_filename,
            media_type=db_file.mime_type or "application/octet-stream"
        )
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Neplatné ID souboru")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při stahování souboru: {str(e)}")


@router.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Smazat soubor podle ID"""
    try:
        # Get file record
        db_file = db.query(models.File).filter(models.File.id == file_id).first()
        if not db_file:
            raise HTTPException(status_code=404, detail="Soubor nenalezen")
        
        # Check if file is used anywhere
        race_usage = db.execute(
            text("SELECT COUNT(*) as count FROM fuj_jmlp_race WHERE proposition_file_id = :file_id OR results_file_id = :file_id"),
            {"file_id": file_id}
        ).fetchone().count
        
        post_usage = db.execute(
            text("SELECT COUNT(*) as count FROM posts WHERE document_id = :file_id OR image_file_id = :file_id"),
            {"file_id": file_id}
        ).fetchone().count
        
        if race_usage > 0 or post_usage > 0:
            raise HTTPException(
                status_code=409, 
                detail="Soubor nemůže být smazán, protože se používá v závodech nebo postech"
            )
        
        # Delete physical file
        file_path = Path(db_file.file_path)
        if file_path.exists():
            file_path.unlink()
        
        # Delete database record
        db.delete(db_file)
        db.commit()
        
        return {"message": "Soubor byl úspěšně smazán"}
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Neplatné ID souboru")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při mazání souboru: {str(e)}")


@router.get("/files/available-for-race")
def list_available_files_for_race(
    race_id: Optional[int] = Query(None, description="Current race ID (to include currently assigned files)"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Seznam souborů vhodných pro přiřazení k závodu (ne-obrázky, nepřiřazené + aktuálně přiřazené)"""
    try:
        # Base query - exclude images and get non-image files
        query = db.query(models.File).filter(
            ~models.File.mime_type.like('image/%')  # Exclude images
        ).order_by(models.File.original_filename)
        
        all_files = query.all()
        
        # Get currently assigned files for all races
        assigned_prop_files = set()
        assigned_result_files = set()
        
        # Get all proposition file IDs that are assigned
        prop_result = db.execute(
            text("SELECT proposition_file_id FROM fuj_jmlp_race WHERE proposition_file_id IS NOT NULL")
        ).fetchall()
        assigned_prop_files.update(row[0] for row in prop_result)
        
        # Get all results file IDs that are assigned  
        result_result = db.execute(
            text("SELECT results_file_id FROM fuj_jmlp_race WHERE results_file_id IS NOT NULL")
        ).fetchall()
        assigned_result_files.update(row[0] for row in result_result)
        
        # Get currently assigned files for this specific race (if editing existing race)
        current_race_prop_file = None
        current_race_result_file = None
        if race_id:
            race_result = db.execute(
                text("SELECT proposition_file_id, results_file_id FROM fuj_jmlp_race WHERE id = :race_id"),
                {"race_id": race_id}
            ).fetchone()
            if race_result:
                current_race_prop_file = race_result[0]
                current_race_result_file = race_result[1]
        
        # Prepare response
        result = []
        for file in all_files:
            file_dict = {
                "id": file.id,
                "original_filename": file.original_filename,
                "file_size": file.file_size,
                "uploaded_at": file.uploaded_at,
                "is_available_for_proposition": True,
                "is_available_for_results": True,
                "usage_info": []
            }
            
            # Check if file is already assigned as proposition
            if file.id in assigned_prop_files and file.id != current_race_prop_file:
                file_dict["is_available_for_proposition"] = False
                # Get race info for usage
                usage_race = db.execute(
                    text("SELECT raceNr FROM fuj_jmlp_race WHERE proposition_file_id = :file_id LIMIT 1"),
                    {"file_id": file.id}
                ).fetchone()
                if usage_race:
                    file_dict["usage_info"].append({
                        "type": "Propozice",
                        "title": usage_race[0] or "Závod"
                    })
            
            # Check if file is already assigned as results
            if file.id in assigned_result_files and file.id != current_race_result_file:
                file_dict["is_available_for_results"] = False
                # Get race info for usage
                usage_race = db.execute(
                    text("SELECT raceNr FROM fuj_jmlp_race WHERE results_file_id = :file_id LIMIT 1"),
                    {"file_id": file.id}
                ).fetchone()
                if usage_race:
                    file_dict["usage_info"].append({
                        "type": "Výsledky", 
                        "title": usage_race[0] or "Závod"
                    })
            
            # Include file if it's available for at least one purpose OR currently assigned to this race
            if (file_dict["is_available_for_proposition"] or file_dict["is_available_for_results"] or 
                file.id == current_race_prop_file or file.id == current_race_result_file):
                result.append(file_dict)
        
        return result
        
    except Exception as e:
        print(f"ERROR in list_available_files_for_race: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chyba při načítání dostupných souborů: {str(e)}")


@router.get("/files")
def list_files(
    file_type: Optional[str] = Query(None, description="Filter by file type (document, image, propozice, vysledky, posty, neprirazene)"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Seznam všech souborů s možností filtrace podle typu"""
    try:
        query = db.query(models.File).order_by(desc(models.File.uploaded_at))
        
        if file_type and file_type != 'all':
            query = query.filter(models.File.file_type == file_type)
        
        files = query.all()
        
        # Prepare response with usage information
        result = []
        for file in files:
            file_dict = {
                "id": file.id,
                "filename": file.filename,
                "original_filename": file.original_filename,
                "file_path": file.file_path,
                "file_size": file.file_size,
                "mime_type": file.mime_type,
                "file_type": file.file_type,
                "uploaded_at": file.uploaded_at,
                "uploaded_by": file.uploaded_by,
                "usage_info": []
            }
            
            # Check race usage
            race_prop_usage = db.execute(
                text("SELECT id, raceNr FROM fuj_jmlp_race WHERE proposition_file_id = :file_id"),
                {"file_id": file.id}
            ).fetchall()
            
            race_result_usage = db.execute(
                text("SELECT id, raceNr FROM fuj_jmlp_race WHERE results_file_id = :file_id"),
                {"file_id": file.id}
            ).fetchall()
            
            # Check post usage  
            post_usage = db.execute(
                text("SELECT id, title FROM posts WHERE image_file_id = :file_id"),
                {"file_id": file.id}
            ).fetchall()
            
            # Add usage information
            for race in race_prop_usage:
                file_dict["usage_info"].append({
                    "type": "Propozice závodu",
                    "title": race.raceNr
                })
            
            for race in race_result_usage:
                file_dict["usage_info"].append({
                    "type": "Výsledky závodu", 
                    "title": race.raceNr
                })
                
            for post in post_usage:
                file_dict["usage_info"].append({
                    "type": "Obrázek postu",
                    "title": post.title
                })
            
            result.append(file_dict)
        
        return result
        
    except Exception as e:
        print(f"ERROR in list_files: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chyba při načítání souborů: {str(e)}")


@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Nahrát nový soubor"""
    try:
        # Validate file size
        if file.size > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail="Soubor je příliš velký (max 10MB)")
        
        # Get file extension
        file_extension = Path(file.filename).suffix.lower()
        allowed_extensions = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif'}
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Nepodporovaný typ souboru. Povolené: {', '.join(allowed_extensions)}"
            )
        
        # Determine file type
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif'}
        document_extensions = {'.pdf', '.doc', '.docx', '.xls', '.xlsx'}
        
        if file_extension in image_extensions:
            file_type = FileTypeEnum.image
        elif file_extension in document_extensions:
            file_type = FileTypeEnum.neprirazene  # Default for new documents
        else:
            file_type = FileTypeEnum.neprirazene
        
        # Generate unique filename
        unique_filename = f"{uuid.uuid4().hex}{file_extension}"
        
        # Create upload directory if it doesn't exist
        upload_dir = Path("backend/documents")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = upload_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Save to database
        db_file = models.File(
            filename=unique_filename,
            original_filename=file.filename,
            file_path=str(file_path),
            file_size=file.size,
            mime_type=file.content_type,
            file_type=file_type,
            uploaded_by=current_admin.id
        )
        
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        
        return db_file
    except Exception as e:
        print(f"ERROR in upload_file: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chyba při nahrávání souboru: {str(e)}")


# Posts management endpoints
@router.get("/posts", response_model=List[schemas.Post])
def list_posts_admin(
    skip: int = 0, 
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all posts for admin management."""
    posts = db.query(models.Post).order_by(desc(models.Post.created_at)).offset(skip).limit(limit).all()
    return posts


@router.post("/posts", response_model=schemas.Post)
def create_post_admin(
    post: schemas.PostCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new post."""
    db_post = models.Post(**post.dict())
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


@router.put("/posts/{post_id}", response_model=schemas.Post)
def update_post_admin(
    post_id: int,
    post_update: schemas.PostUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Update an existing post."""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    
    # Update only provided fields
    for field, value in post_update.dict(exclude_unset=True).items():
        setattr(db_post, field, value)
    
    db.commit()
    db.refresh(db_post)
    return db_post


@router.delete("/posts/{post_id}")
def delete_post_admin(
    post_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a post."""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    
    db.delete(db_post)
    db.commit()
    
    return {"message": "Příspěvek byl smazán"}


@router.get("/files/available-for-posts")
def list_available_files_for_posts(
    file_type: str = Query("all", description="Filter by type: images, documents, all"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Seznam souborů vhodných pro přiřazení k postům."""
    try:
        query = db.query(models.File).order_by(models.File.original_filename)
        
        if file_type == "images":
            # Only images
            query = query.filter(models.File.mime_type.like('image/%'))
        elif file_type == "documents":
            # Only non-images
            query = query.filter(~models.File.mime_type.like('image/%'))
        # file_type == "all" - no filter, show everything
        
        files = query.all()
        
        # Prepare response with usage information
        result = []
        for file in files:
            file_dict = {
                "id": file.id,
                "original_filename": file.original_filename,
                "file_size": file.file_size,
                "mime_type": file.mime_type,
                "uploaded_at": file.uploaded_at,
                "usage_info": []
            }
            
            # Check post usage
            if file.mime_type and file.mime_type.startswith('image/'):
                # Check image usage
                post_usage = db.execute(
                    text("SELECT id, title FROM posts WHERE image_file_id = :file_id"),
                    {"file_id": file.id}
                ).fetchall()
                
                for post in post_usage:
                    file_dict["usage_info"].append({
                        "type": "Obrázek příspěvku",
                        "title": post.title
                    })
            else:
                # Check document usage  
                post_usage = db.execute(
                    text("SELECT id, title FROM posts WHERE document_file_id = :file_id"),
                    {"file_id": file.id}
                ).fetchall()
                
                for post in post_usage:
                    file_dict["usage_info"].append({
                        "type": "Dokument příspěvku", 
                        "title": post.title
                    })
            
            result.append(file_dict)
        
        return result
        
    except Exception as e:
        print(f"ERROR in list_available_files_for_posts: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chyba při načítání dostupných souborů: {str(e)}")