from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, schemas, auth

router = APIRouter(tags=["admin-auth"])


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
def get_current_admin_info(current_admin: models.AdminUser = Depends(auth.get_current_admin)):
    """Get current admin user info."""
    return current_admin


@router.post("/logout")
def logout(current_admin: models.AdminUser = Depends(auth.get_current_admin)):
    """Admin logout endpoint."""
    return {"message": "Úspěšně odhlášen"}