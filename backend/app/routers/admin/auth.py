from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, schemas, auth

router = APIRouter(prefix="/auth", tags=["admin-auth"])


@router.post("/login", response_model=schemas.Token)
def login(login_data: schemas.AdminLogin, request: Request, db: Session = Depends(get_db)):
    """Admin login endpoint."""
    auth.check_login_allowed(login_data.email, request)

    admin = auth.authenticate_admin(db, login_data.email, login_data.password)
    if not admin:
        auth.register_failed_login(login_data.email, request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nesprávný email nebo heslo",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if admin.role != "admin":
        auth.register_failed_login(login_data.email, request)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nemáte oprávnění pro administraci"
        )

    auth.reset_login_attempts(login_data.email, request)

    # Update last login
    admin.last_login = datetime.utcnow()
    db.commit()

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(admin.id), "role": admin.role}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


@router.post("/register", response_model=schemas.AdminUser)
def register_admin(admin_data: schemas.AdminUserCreate, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(auth.require_role("admin"))):
    """Register new admin user. Only existing admins can create new admins."""

    if admin_data.role not in ("admin", "timekeeper"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Neplatná role. Použijte 'admin' nebo 'timekeeper'"
        )
    
    # Check if email already exists
    existing_admin = db.query(models.AdminUser).filter(models.AdminUser.email == admin_data.email).first()
    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email je již používán"
        )
    
    # Hash the password
    hashed_password = auth.get_password_hash(admin_data.password)
    
    # Create new admin user
    new_admin = models.AdminUser(
        email=admin_data.email,
        password_hash=hashed_password,
        full_name=admin_data.full_name,
        is_active=admin_data.is_active,
        role=admin_data.role,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    
    return new_admin


@router.get("/me", response_model=schemas.AdminUser)
def get_current_admin_info(current_admin: models.AdminUser = Depends(auth.get_current_admin)):
    """Get current admin user info."""
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
    if current_admin.role not in ("admin",):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Nemáte oprávnění pro administrace")
    return auth.issue_token(current_admin)

