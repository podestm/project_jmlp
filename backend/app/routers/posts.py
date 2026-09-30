from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from pathlib import Path
from ..database import get_db
from ..models import AttachmentRole, Post, File
from ..schemas import Post as PostSchema
from ..services import attachments as attachment_service
from ..utils import fix_encoding

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("/", response_model=List[PostSchema])
def get_posts(
    skip: int = Query(0, description="Počet příspěvků k přeskočení"),
    limit: int = Query(10, description="Maximální počet příspěvků"),
    db: Session = Depends(get_db)
):
    """Získat seznam publikovaných aktualit/příspěvků.

    Koncepty jsou jen v adminu (viz backend/app/routers/admin/posts.py) - dřív
    je šlo přečíst i tady přes ?published_only=false.
    """
    query = db.query(Post).filter(Post.published == True)

    posts = query.order_by(desc(Post.created_at)).offset(skip).limit(limit).all()
    
    # Fix encoding issues in posts
    for post in posts:
        post.title = fix_encoding(post.title)
        post.content = fix_encoding(post.content)

    attachment_service.apply_post_documents(db, posts, published_only=True)
    return posts


@router.get("/{post_id}", response_model=PostSchema)
def get_post(post_id: int, db: Session = Depends(get_db)):
    """Získat konkrétní publikovaný příspěvek podle ID"""
    post = db.query(Post).filter(Post.id == post_id, Post.published == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    attachment_service.apply_post_documents(db, [post], published_only=True)
    return post


@router.get("/{post_id}/document/download")
def download_post_document(post_id: int, db: Session = Depends(get_db)):
    """Stáhnout dokument připojený k příspěvku (veřejný přístup)."""
    post = db.query(Post).filter(Post.id == post_id, Post.published == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    
    file_record = attachment_service.post_document_file(db, post_id, AttachmentRole.document.value)
    if not file_record:
        raise HTTPException(status_code=404, detail="K tomuto příspěvku není připojen žádný dokument")

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
    post = db.query(Post).filter(Post.id == post_id, Post.published == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    
    file_record = attachment_service.post_document_file(db, post_id, AttachmentRole.image.value)
    if not file_record:
        raise HTTPException(status_code=404, detail="K tomuto příspěvku není připojen žádný obrázek")

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
    
    # Add ETag based on post's updated_at timestamp and the actual file id
    # This ensures browser cache is invalidated when image changes
    etag = f'"{post.updated_at.timestamp()}-{file_record.id}"'
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "public, max-age=3600"  # Cache for 1 hour, but check ETag
    
    return response

# Zápisové operace nad příspěvky jsou pouze v chráněném adminu
# (viz backend/app/routers/admin/posts.py).