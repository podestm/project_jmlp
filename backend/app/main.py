import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import races, racers, clubs, registration

app = FastAPI(title="JMLP API")

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(races.router)
app.include_router(racers.router)
app.include_router(clubs.router)
app.include_router(registration.router)

@app.get("/")
def root():
    return {"status": "ok"}
