import logging
import os
from pathlib import Path
import traceback
from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .routers import races, racers, clubs, registration, posts, analytics, season_results, documents
from .routers.admin import router as admin_router
from .routers.timekeeper import router as timekeeper_router

logger = logging.getLogger(__name__)

app = FastAPI(title="JMLP API", redirect_slashes=False)


@app.on_event("startup")
def startup_migrations():
    """Spustí databázové migrace při startu (viz app/migrations.py)."""
    from .migrations import run_migrations
    run_migrations()


@app.on_event("startup")
def startup_check_uploads():
    """Ověří, že do složky s dokumenty jde zapisovat.

    Starší nasazení mají volume documents_data vytvořený ještě rootem, zatímco
    aplikace běží pod appuser (uid 1000). Zápis pak selhává až při nahrávání
    souboru obecnou hláškou. Radši to zjistíme při startu a řekneme jak na to.
    """
    from .services.files import DOCUMENTS_DIR
    try:
        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
        writable = os.access(DOCUMENTS_DIR, os.W_OK | os.X_OK)
    except OSError:
        writable = False
    if not writable:
        logger.error(
            "Do %s nelze zapisovat - nahrávání souborů nebude fungovat. "
            "Oprava: docker compose exec -u root backend "
            "chown -R appuser:appuser /app/uploads/documents",
            DOCUMENTS_DIR.resolve(),
        )

# Custom validation error handler for debugging
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body},
    )

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all handler to ensure 500 errors include CORS headers (not masked as CORS errors in browser)."""
    print(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Interní chyba serveru"},
    )

# Health check endpoint pro Docker
@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint for Docker health monitoring"""
    return {"status": "healthy", "service": "jmlp-backend"}

app.include_router(races.router)
app.include_router(racers.router)
app.include_router(clubs.router)
app.include_router(registration.router)
app.include_router(posts.router)
app.include_router(analytics.router)  # Public analytics router
app.include_router(season_results.router)  # Season results public router
app.include_router(documents.router)  # Public documents listing
app.include_router(admin_router)  # New modular admin router
app.include_router(timekeeper_router)  # Timekeeper section

# Serve uploaded documents
@app.get("/uploads/documents/{filename}")
async def serve_document(filename: str, db: Session = Depends(get_db)):
    """Vydá nahraný soubor pod jeho skutečným názvem.

    Na disku leží soubory pod UUID, aby se nemohly přepsat a aby název nešel
    zneužít k útěku z adresáře. Prohlížeči se ale musí nabídnout název, pod
    kterým ho člověk nahrál - jinak si uživatel stáhne
    "35638cb53f474090a4c1d35885a4993e.pdf" místo "Soutěžní řád 2026-2027.pdf".

    Tudy chodí stahování z celé aplikace (viz download_url v services/attachments.py),
    takže tenhle jeden endpoint určuje, jak se soubory jmenují všude.
    """
    base = Path("uploads/documents").resolve()
    try:
        file_path = (base / filename).resolve()
        file_path.relative_to(base)
    except (ValueError, OSError):
        return JSONResponse(
            status_code=404,
            content={"detail": "Soubor nebyl nalezen"}
        )
    if not file_path.is_file():
        return JSONResponse(
            status_code=404,
            content={"detail": "Soubor nebyl nalezen"}
        )

    # Soubor bez záznamu v databázi je osiřelý zbytek na disku - vydá se pod
    # UUID, protože jiný název o něm nikdo neví.
    file_record = db.query(models.File).filter(models.File.filename == filename).first()

    return FileResponse(
        path=file_path,
        media_type=(file_record.mime_type if file_record else None) or "application/octet-stream",
        filename=file_record.original_filename if file_record else file_path.name,
        # Soubor pod UUID se nepřepisuje - nová verze dokumentu dostane nový
        # název, takže ho prohlížeč smí držet natrvalo. Service worker soubory
        # schválně nekešuje (viz frontend/public/sw.js).
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )

@app.get("/")
def root():
    return {"status": "ok"}
