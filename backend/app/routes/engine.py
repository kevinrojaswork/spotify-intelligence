from typing import Optional

from fastapi import APIRouter, HTTPException

from app.services.spotify_service import (
    get_spotify_client,
    get_current_spotify_user_id,
)
from app.engine.music_engine import engine
from app.database.db import get_metadata

router = APIRouter()


@router.get("/load")
def load_engine(spotify_user_id: Optional[str] = None):
    user_id = spotify_user_id or get_current_spotify_user_id()

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="No hay usuario de Spotify conectado."
        )

    sp = get_spotify_client(user_id)

    if not sp:
        raise HTTPException(
            status_code=401,
            detail="No se pudo obtener el cliente de Spotify para este usuario."
        )

    return engine.sync(sp, user_id)


@router.get("/dashboard")
def get_dashboard(spotify_user_id: Optional[str] = None):
    user_id = spotify_user_id or get_current_spotify_user_id()

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="No hay usuario de Spotify conectado."
        )

    return engine.analyze(user_id)


@router.get("/sync-status")
def get_sync_status(spotify_user_id: Optional[str] = None):
    user_id = spotify_user_id or get_current_spotify_user_id()

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="No hay usuario de Spotify conectado."
        )

    status = get_metadata(f"sync_status:{user_id}") or "idle"
    error = get_metadata(f"sync_error:{user_id}") or ""

    return {
        "spotify_user_id": user_id,
        "status": status,
        "error": error,
    }