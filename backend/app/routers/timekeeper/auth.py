"""Timekeeper auth - shares the same user table but checks for timekeeper/admin role."""
from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, schemas, auth

router = APIRouter(prefix="/auth", tags=["timekeeper-auth"])


@router.post("/login", response_model=schemas.Token)
def timekeeper_login(login_data: schemas.AdminLogin, request: Request, db: Session = Depends(get_db)):
    """Timekeeper login - accepts both admin and timekeeper roles."""
    auth.check_login_allowed(login_data.email, request)

    admin = auth.authenticate_admin(db, login_data.email, login_data.password)
    if not admin:
        auth.register_failed_login(login_data.email, request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nesprávný email nebo heslo",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Both admin and timekeeper roles can use the timekeeper interface
    if admin.role not in ("admin", "timekeeper"):
        auth.register_failed_login(login_data.email, request)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nemáte oprávnění pro časomíru"
        )

    auth.reset_login_attempts(login_data.email, request)

    admin.last_login = datetime.utcnow()
    db.commit()
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(admin.id), "role": admin.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


@router.get("/me", response_model=schemas.AdminUser)
def get_current_user(current_admin: models.AdminUser = Depends(auth.get_current_admin)):
    """Get current timekeeper user info."""
    return current_admin


@router.post("/refresh", response_model=schemas.Token)
def refresh_token(current_admin: models.AdminUser = Depends(auth.get_current_admin)):
    """Obnoví ještě platný token - klouzavé prodlužování přihlášení.

    Klient ho volá sám, když je online a z platnosti zbývá méně než půlka
    (config/tokenRefresh.js). Časoměřič tak během závodu nevypadne jen proto,
    že se ráno přihlásil o pár hodin dřív. Vypršelý nebo neplatný token
    obnovit nejde (401) - to už je nové přihlášení. Role se bere aktuální
    z databáze, ne z původního tokenu.
    """
    if current_admin.role not in ("admin", "timekeeper"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Nemáte oprávnění pro časomíry")
    return auth.issue_token(current_admin)

