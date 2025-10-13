from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from pathlib import Path
from ..database import get_db
from ..models import Post, File
from ..schemas import Post as PostSchema, PostCreate, PostUpdate
from ..utils import fix_encoding

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("/", response_model=List[PostSchema])
def get_posts(
    skip: int = Query(0, description="Počet příspěvků k přeskočení"),
    limit: int = Query(10, description="Maximální počet příspěvků"),
    published_only: bool = Query(True, description="Zobrazit pouze publikované"),
    db: Session = Depends(get_db)
):
    """Získat seznam aktualit/příspěvků"""
    query = db.query(Post)
    
    if published_only:
        query = query.filter(Post.published == True)
    
    posts = query.order_by(desc(Post.created_at)).offset(skip).limit(limit).all()
    
    # Fix encoding issues in posts
    for post in posts:
        post.title = fix_encoding(post.title)
        post.content = fix_encoding(post.content)
    
    return posts


@router.get("/{post_id}", response_model=PostSchema)
def get_post(post_id: int, db: Session = Depends(get_db)):
    """Získat konkrétní příspěvek podle ID"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    return post


@router.get("/{post_id}/document/download")
def download_post_document(post_id: int, db: Session = Depends(get_db)):
    """Stáhnout dokument připojený k příspěvku (veřejný přístup)."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    
    if not post.document_file_id:
        raise HTTPException(status_code=404, detail="K tomuto příspěvku není připojen žádný dokument")
    
    # Get file from database
    file_record = db.query(File).filter(File.id == post.document_file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="Soubor nenalezen v databázi")
    
    # Check if file exists on disk
    file_path = Path(file_record.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Soubor nenalezen na disku")
    
    return FileResponse(
        path=str(file_path),
        filename=file_record.original_filename,
        media_type=file_record.mime_type or 'application/octet-stream'
    )


@router.get("/{post_id}/image")
def get_post_image(post_id: int, db: Session = Depends(get_db)):
    """Získat obrázek příspěvku (veřejný přístup)."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    
    if not post.image_file_id:
        raise HTTPException(status_code=404, detail="K tomuto příspěvku není připojen žádný obrázek")
    
    # Get file from database
    file_record = db.query(File).filter(File.id == post.image_file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="Soubor nenalezen v databázi")
    
    # Check if file exists on disk
    file_path = Path(file_record.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Soubor nenalezen na disku")
    
    # Return file with cache control headers based on post's updated_at timestamp
    response = FileResponse(
        path=str(file_path),
        filename=file_record.original_filename,
        media_type=file_record.mime_type or 'application/octet-stream'
    )
    
    # Add ETag based on post's updated_at timestamp and image_file_id
    # This ensures browser cache is invalidated when image changes
    etag = f'"{post.updated_at.timestamp()}-{post.image_file_id}"'
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "public, max-age=3600"  # Cache for 1 hour, but check ETag
    
    return response


# Admin endpoints (zatím bez autentizace)
@router.post("/", response_model=PostSchema)
def create_post(post: PostCreate, db: Session = Depends(get_db)):
    """Vytvořit nový příspěvek"""
    db_post = Post(**post.dict())
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


@router.put("/{post_id}", response_model=PostSchema)
def update_post(post_id: int, post_update: PostUpdate, db: Session = Depends(get_db)):
    """Aktualizovat existující příspěvek"""
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    
    # Aktualizovat pouze poskytnutá pole
    for field, value in post_update.dict(exclude_unset=True).items():
        setattr(db_post, field, value)
    
    db.commit()
    db.refresh(db_post)
    return db_post


@router.delete("/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db)):
    """Smazat příspěvek"""
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    
    db.delete(db_post)
    db.commit()
    return {"message": "Příspěvek byl úspěšně smazán"}