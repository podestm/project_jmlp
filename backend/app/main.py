import os
from pathlib import Path
import traceback
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from .routers import races, racers, clubs, registration, posts, analytics, season_results
from .routers.admin import router as admin_router
from .routers.timekeeper import router as timekeeper_router

app = FastAPI(title="JMLP API", redirect_slashes=False)


@app.on_event("startup")
def run_migrations():
    """Spustí nezbytné databázové migrace při startu."""
    from sqlalchemy import text as _text
    from .database import engine
    with engine.connect() as conn:
        result = conn.execute(_text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "AND TABLE_NAME = 'fuj_jmlp_race_registration' "
            "AND COLUMN_NAME = 'club_request_note'"
        ))
        if result.scalar() == 0:
            conn.execute(_text(
                "ALTER TABLE fuj_jmlp_race_registration "
                "ADD COLUMN club_request_note VARCHAR(500) NULL DEFAULT NULL"
            ))
            conn.commit()

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
app.include_router(admin_router)  # New modular admin router
app.include_router(timekeeper_router)  # Timekeeper section

# Serve uploaded documents
@app.get("/uploads/documents/{filename}")
async def serve_document(filename: str):
    """Serve uploaded PDF documents"""
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
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=file_path.name,
    )

@app.get("/")
def root():
    return {"status": "ok"}
