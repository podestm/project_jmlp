from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ...database import get_db
from ... import models, schemas, auth
from ...utils import fix_encoding

router = APIRouter(tags=["admin-posts"])


@router.get("/posts", response_model=List[schemas.Post])
def get_posts(
    skip: int = 0, 
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all posts for admin management."""
    posts = db.query(models.Post).order_by(desc(models.Post.created_at)).offset(skip).limit(limit).all()
    
    # Fix encoding issues in posts for admin interface
    for post in posts:
        post.title = fix_encoding(post.title)
        post.content = fix_encoding(post.content)
    
    return posts


@router.post("/posts", response_model=schemas.Post)
def create_post(
    post_data: schemas.PostCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new post."""
    db_post = models.Post(**post_data.dict())
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    # Fix encoding issues in the returned post
    db_post.title = fix_encoding(db_post.title)
    db_post.content = fix_encoding(db_post.content)
    
    return db_post


@router.put("/posts/{post_id}", response_model=schemas.Post)
def update_post(
    post_id: int,
    post_data: schemas.PostUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Update an existing post."""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post nenalezen")
    
    update_data = post_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_post, field, value)
    
    db.commit()
    db.refresh(db_post)
    
    # Fix encoding issues in the returned post
    db_post.title = fix_encoding(db_post.title)
    db_post.content = fix_encoding(db_post.content)
    
    return db_post


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a post."""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post nenalezen")
    
    db.delete(db_post)
    db.commit()
    return {"message": "Post úspěšně smazán"}


