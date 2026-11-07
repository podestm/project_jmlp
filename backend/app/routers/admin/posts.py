from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ... import auth, models, schemas
from ...database import get_db
from ...models import AttachmentOwner, AttachmentRole
from ...services import attachments as attachment_service
from ...utils import fix_encoding

router = APIRouter(tags=["admin-posts"])

# Příspěvek má nejvýše jeden obrázek a jeden dokument.
POST_DOCUMENT_ROLES = {
    "image_file_id": AttachmentRole.image,
    "document_file_id": AttachmentRole.document,
}


def _sync_post_documents(db: Session, post_id: int, document_ids: dict, admin_id: int) -> None:
    """Uloží obrázek/dokument příspěvku jako přílohy."""
    for field, role in POST_DOCUMENT_ROLES.items():
        if field not in document_ids:
            continue
        file_id = document_ids[field]
        if file_id and not db.query(models.File.id).filter(models.File.id == file_id).first():
            raise HTTPException(status_code=404, detail="Soubor nebyl nalezen")
        attachment_service.sync_single(
            db,
            owner_type=AttachmentOwner.post.value,
            owner_id=post_id,
            role=role.value,
            file_id=file_id,
            created_by=admin_id,
        )


@router.get("/posts", response_model=list[schemas.Post])
def get_posts(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Get all posts for admin management."""
    posts = (
        db.query(models.Post).order_by(desc(models.Post.created_at)).offset(skip).limit(limit).all()
    )

    # Fix encoding issues in posts for admin interface
    for post in posts:
        post.title = fix_encoding(post.title)
        post.content = fix_encoding(post.content)

    attachment_service.apply_post_documents(db, posts)
    return posts


@router.post("/posts", response_model=schemas.Post)
def create_post(
    post_data: schemas.PostCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new post."""
    post_dict = post_data.dict()
    document_ids = {field: post_dict.pop(field, None) for field in POST_DOCUMENT_ROLES}

    db_post = models.Post(**post_dict)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)

    _sync_post_documents(db, db_post.id, document_ids, current_admin.id)

    # Fix encoding issues in the returned post
    db_post.title = fix_encoding(db_post.title)
    db_post.content = fix_encoding(db_post.content)

    attachment_service.apply_post_documents(db, [db_post])
    return db_post


@router.put("/posts/{post_id}", response_model=schemas.Post)
def update_post(
    post_id: int,
    post_data: schemas.PostUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Update an existing post."""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post nenalezen")

    update_data = post_data.dict(exclude_unset=True)
    document_ids = {
        field: update_data.pop(field) for field in list(POST_DOCUMENT_ROLES) if field in update_data
    }

    for field, value in update_data.items():
        setattr(db_post, field, value)

    db.commit()
    db.refresh(db_post)

    _sync_post_documents(db, post_id, document_ids, current_admin.id)

    # Fix encoding issues in the returned post
    db_post.title = fix_encoding(db_post.title)
    db_post.content = fix_encoding(db_post.content)

    attachment_service.apply_post_documents(db, [db_post])
    return db_post


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete a post."""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post nenalezen")

    attachment_service.detach_owner(db, AttachmentOwner.post.value, post_id)
    db.delete(db_post)
    db.commit()
    return {"message": "Post úspěšně smazán"}
