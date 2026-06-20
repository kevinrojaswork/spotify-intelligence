from fastapi import APIRouter

from app.services.spotify_service import get_spotify_client
from app.engine.music_engine import engine

router = APIRouter()


@router.get("/engine/load")
def load_engine():
    sp = get_spotify_client()

    if not sp:
        return {"error": "Spotify no está conectado todavía"}

    return engine.sync(sp)


@router.get("/engine/dashboard")
def dashboard_stats():
    return engine.analyze()