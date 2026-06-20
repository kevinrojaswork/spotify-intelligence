from fastapi import APIRouter
from app.services.artist_service import get_top_artists_from_playlists

router = APIRouter()


@router.get("/artists/top")
def top_artists(limit: int = 10):
    return get_top_artists_from_playlists(limit)