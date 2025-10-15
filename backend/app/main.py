import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import races, racers, clubs, registration, posts, analytics
from .routers.admin import router as admin_router
from .middleware import VisitorLogMiddleware

app = FastAPI(title="JMLP API")

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
