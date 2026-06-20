from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from app.spotify import spotify_oauth
from app.services.spotify_service import save_token, get_spotify_client
from app.engine.music_engine import load_library_from_spotify

router = APIRouter()


@router.get("/login")
def spotify_login():
    auth_url = spotify_oauth.get_authorize_url()
    return {"auth_url": auth_url}


@router.get("/callback")
def spotify_callback(code: str):
    save_token(code)

    sp = get_spotify_client()

    if sp:
        load_library_from_spotify(sp)

    return RedirectResponse(
        url="http://localhost:5173?spotify_connected=true"
    )