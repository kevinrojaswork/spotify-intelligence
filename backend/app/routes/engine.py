from typing import Optional

from fastapi import APIRouter, HTTPException

from app.services.spotify_service import (
    get_spotify_client,
    get_current_spotify_user_id,
)
from app.engine.music_engine import engine

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