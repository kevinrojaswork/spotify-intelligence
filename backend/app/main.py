import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.db import init_db
from app.routes import auth, engine


init_db()

fastapi_app = FastAPI(title="Spotify Intelligence API")


@fastapi_app.get("/")
def home():
    return {"message": "Spotify Intelligence API funcionando"}


@fastapi_app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "spotify-intelligence-backend",
    }


fastapi_app.include_router(auth.router, prefix="/auth", tags=["Auth"])
fastapi_app.include_router(engine.router, tags=["Engine"])


frontend_url = os.getenv(
    "FRONTEND_URL",
    "https://spotify-intelligence.vercel.app",
)

allowed_origins = [
    "https://spotify-intelligence.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)


app = CORSMiddleware(
    app=fastapi_app,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)