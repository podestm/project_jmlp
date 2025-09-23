from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from ..database import get_db
from ..models import Post
from ..schemas import Post as PostSchema, PostCreate, PostUpdate

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
    return posts


@router.get("/{post_id}", response_model=PostSchema)
def get_post(post_id: int, db: Session = Depends(get_db)):
    """Získat konkrétní příspěvek podle ID"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Příspěvek nenalezen")
    return post


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