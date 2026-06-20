from fastapi import APIRouter
from app.services.spotify_service import get_spotify_client

router = APIRouter()


@router.get("/playlists")
def get_playlists():
    sp = get_spotify_client()

    if not sp:
        return {"error": "Spotify no está conectado todavía"}

    results = sp.current_user_playlists(limit=50)

    playlists = []

    for item in results["items"]:
        playlists.append({
            "id": item["id"],
            "name": item["name"],
            "tracks_total": item["tracks"]["total"],
            "owner": item["owner"]["display_name"]
        })

    return {"playlists": playlists}