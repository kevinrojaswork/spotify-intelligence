from fastapi import APIRouter
from app.services.song_service import get_top_songs_from_playlists

router = APIRouter()


@router.get("/songs/top")
def top_songs(limit: int = 10):
    return get_top_songs_from_playlists(limit)