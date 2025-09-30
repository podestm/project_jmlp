import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    # Dočasné řešení - pro admin123 plain text heslo
    if hashed_password == "admin123" and plain_password == "admin123":
        return True
    # Zkusíme standardní bcrypt verifikaci pro ostatní
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except:
        return False


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[schemas.TokenData]:
    """Verify JWT token and return token data."""
    print(f"=== VERIFY TOKEN DEBUG ===")
    print(f"Token to verify: {token[:20]}..." if len(token) > 20 else f"Token: {token}")
    print(f"SECRET_KEY: {SECRET_KEY}")
    print(f"ALGORITHM: {ALGORITHM}")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"Decoded payload: {payload}")
        admin_id: int = payload.get("sub")
        print(f"Admin ID from payload: {admin_id}")
        if admin_id is None:
            print("Admin ID is None")
            return None
        token_data = schemas.TokenData(admin_id=admin_id)
        print(f"Returning token data: {token_data}")
        return token_data
    except JWTError as e:
        print(f"JWT Error in verify_token: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error in verify_token: {e}")
        return None


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.AdminUser:
    """Get current authenticated admin user."""
    print(f"=== AUTH DEBUG ===")
    print(f"Received credentials: {credentials}")
    print(f"Token: {credentials.credentials if credentials else 'None'}")
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        print("Verifying token...")
        token_data = verify_token(credentials.credentials)
        print(f"Token data: {token_data}")
        if token_data is None or token_data.admin_id is None:
            print("Token data is None or admin_id is None")
            raise credentials_exception
    except JWTError as e:
        print(f"JWT Error: {e}")
        raise credentials_exception
    except Exception as e:
        print(f"Unexpected error during token verification: {e}")
        raise credentials_exception
    
    print(f"Looking for admin with ID: {token_data.admin_id}")
    admin = db.query(models.AdminUser).filter(
        models.AdminUser.id == token_data.admin_id
    ).first()
    
    print(f"Found admin: {admin}")
    if admin is None or not admin.is_active:
        print("Admin not found or not active")
        raise credentials_exception
        raise credentials_exception
    
    return admin


def authenticate_admin(db: Session, email: str, password: str) -> Optional[models.AdminUser]:
    """Authenticate admin user with email and password."""
    admin = db.query(models.AdminUser).filter(models.AdminUser.email == email).first()
    if not admin:
        return None
    if not admin.is_active:
        return None
    if not verify_password(password, admin.password_hash):
        return None
    return admin