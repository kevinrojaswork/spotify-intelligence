from fastapi import APIRouter
from app.services.spotify_service import get_spotify_client

router = APIRouter()


@router.get("/me")
def get_me():
    sp = get_spotify_client()

    if not sp:
        return {"error": "Spotify no está conectado todavía"}

    return sp.current_user()