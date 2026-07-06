import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.db import init_db, DB_PATH, get_connection
from app.routes import auth, profile, playlists, artists, songs, engine


# Ejecuta migraciones al iniciar el backend.
# Esto asegura que la base persistente tenga las columnas nuevas.
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


@fastapi_app.get("/debug-db")
def debug_db():
    init_db()

    conn = get_connection()

    tracks = conn.execute(
        "SELECT COUNT(*) AS total FROM tracks"
    ).fetchone()["total"]

    playlists = conn.execute(
        "SELECT COUNT(*) AS total FROM spotify_playlists"
    ).fetchone()["total"]

    users = conn.execute(
        "SELECT COUNT(*) AS total FROM spotify_users"
    ).fetchone()["total"]

    conn.close()

    return {
        "sqlite_db_path_env": os.getenv("SQLITE_DB_PATH"),
        "active_db_path": str(DB_PATH),
        "db_exists": DB_PATH.exists(),
        "tracks": tracks,
        "playlists": playlists,
        "users": users,
    }


fastapi_app.include_router(auth.router, prefix="/auth", tags=["Auth"])
fastapi_app.include_router(profile.router, tags=["Profile"])
fastapi_app.include_router(playlists.router, tags=["Playlists"])
fastapi_app.include_router(artists.router, tags=["Artists"])
fastapi_app.include_router(songs.router, tags=["Songs"])
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
    allow_methods=["*"],
    allow_headers=["*"],
)