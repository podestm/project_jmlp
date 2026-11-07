import os
import threading
import time
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from . import models, schemas
from .database import get_db

# Security configuration
# Compose vyrenderuje nenastavenou proměnnou jako prázdný řetězec, proto testujeme délku.
SECRET_KEY = os.getenv("SECRET_KEY", "")
if len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY environment variable is required and must be at least 32 characters "
        "(set in secret/.env)"
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash using werkzeug (bcrypt)."""
    try:
        return check_password_hash(hashed_password, plain_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return generate_password_hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # iat: klient podle něj pozná polovinu platnosti a token včas obnoví
    # (klouzavé prodlužování, viz issue_token a /auth/refresh).
    to_encode.update({"exp": expire, "iat": datetime.now(UTC)})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def issue_token(admin: models.AdminUser) -> dict:
    """Odpověď s novým tokenem - při přihlášení i při obnově platného tokenu."""
    access_token = create_access_token(
        data={"sub": str(admin.id), "role": admin.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


def verify_token(token: str) -> schemas.TokenData | None:
    """Verify JWT token and return token data. Returns None for any invalid token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    admin_id = payload.get("sub")
    if admin_id is None:
        return None
    try:
        return schemas.TokenData(admin_id=int(admin_id))
    except (TypeError, ValueError):
        return None


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)
) -> models.AdminUser:
    """Get current authenticated admin user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = verify_token(credentials.credentials)
    if token_data is None or token_data.admin_id is None:
        raise credentials_exception

    admin = db.query(models.AdminUser).filter(models.AdminUser.id == token_data.admin_id).first()

    if admin is None or not admin.is_active:
        raise credentials_exception

    return admin


def require_role(*roles: str):
    """Vytvoří dependency, která vyžaduje jednu z uvedených rolí (kontrola proti DB)."""

    async def _role_checker(
        current_admin: models.AdminUser = Depends(get_current_admin),
    ) -> models.AdminUser:
        if current_admin.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nemáte oprávnění k této akci",
            )
        return current_admin

    return _role_checker


# --- Ochrana proti hádání hesel (in-process, per e-mail + IP) ---
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_LOCKOUT_SECONDS = int(os.getenv("LOGIN_LOCKOUT_SECONDS", "300"))

_login_attempts: dict = {}  # key -> (počet neúspěchů, čas posledního pokusu)
_login_attempts_lock = threading.Lock()


def _login_key(email: str, request: Request | None) -> str:
    ip = ""
    if request is not None:
        ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else "")
    return f"{(email or '').strip().lower()}|{ip}"


def check_login_allowed(email: str, request: Request | None = None) -> None:
    """Vyhodí 429, pokud je kombinace e-mail+IP dočasně zablokovaná."""
    key = _login_key(email, request)
    now = time.monotonic()
    with _login_attempts_lock:
        for k in [k for k, (_, ts) in _login_attempts.items() if now - ts > LOGIN_LOCKOUT_SECONDS]:
            del _login_attempts[k]
        count, last = _login_attempts.get(key, (0, now))
        if count >= LOGIN_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Příliš mnoho neúspěšných pokusů o přihlášení. Zkuste to prosím za chvíli.",
                headers={"Retry-After": str(int(LOGIN_LOCKOUT_SECONDS - (now - last)) + 1)},
            )


def register_failed_login(email: str, request: Request | None = None) -> None:
    """Zaznamená neúspěšný pokus o přihlášení."""
    key = _login_key(email, request)
    now = time.monotonic()
    with _login_attempts_lock:
        count, last = _login_attempts.get(key, (0, now))
        if now - last > LOGIN_LOCKOUT_SECONDS:
            count = 0
        _login_attempts[key] = (count + 1, now)


def reset_login_attempts(email: str, request: Request | None = None) -> None:
    """Vynuluje počítadlo po úspěšném přihlášení."""
    with _login_attempts_lock:
        _login_attempts.pop(_login_key(email, request), None)


def authenticate_admin(db: Session, email: str, password: str) -> models.AdminUser | None:
    """Authenticate admin user with email and password."""
    admin = db.query(models.AdminUser).filter(models.AdminUser.email == email).first()
    if not admin:
        return None
    if not admin.is_active:
        return None
    if not verify_password(password, admin.password_hash):
        return None
    return admin
