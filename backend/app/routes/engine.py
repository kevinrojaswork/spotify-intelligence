from fastapi import APIRouter

from app.services.spotify_service import get_spotify_client
from app.engine.music_engine import (
    load_library_from_spotify,
    get_dashboard_stats,
)

router = APIRouter()


@router.get("/engine/load")
def load_engine():
    sp = get_spotify_client()

    if not sp:
        return {"error": "Spotify no está conectado todavía"}

    return load_library_from_spotify(sp)


@router.get("/engine/dashboard")
def dashboard_stats():
    return get_dashboard_stats()