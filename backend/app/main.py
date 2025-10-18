import os
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from .routers import races, racers, clubs, registration, posts, analytics
from .routers.admin import router as admin_router
from .middleware import VisitorLogMiddleware

app = FastAPI(title="JMLP API")

# Custom validation error handler for debugging
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"=== VALIDATION ERROR ===")
    print(f"Path: {request.url.path}")
    print(f"Method: {request.method}")
    print(f"Errors: {exc.errors()}")
    try:
        body = await request.json()
        print(f"Body: {body}")
    except:
        print("Could not parse body")
    print(f"======================")
    
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

# Přidáme middleware pro logování návštěv (zatím vypnuto, použijeme endpoint)
# app.add_middleware(VisitorLogMiddleware)

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
app.include_router(admin_router)  # New modular admin router

@app.get("/")
def root():
    return {"status": "ok"}
