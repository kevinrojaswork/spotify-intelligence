from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from app.spotify import spotify_oauth
from app.services.spotify_service import save_token, get_spotify_client
from app.engine.music_engine import engine

router = APIRouter()


@router.get("/login")
def spotify_login():
    auth_url = spotify_oauth.get_authorize_url()
    return {"auth_url": auth_url}


@router.get("/callback")
def spotify_callback(code: str):
    token_data = save_token(code)

    spotify_user_id = token_data["spotify_user_id"]
    sp = get_spotify_client(spotify_user_id)

    if sp:
        engine.sync(sp, spotify_user_id)

    return RedirectResponse(
        url=(
            "https://spotify-intelligence.vercel.app/"
            f"?spotify_connected=true&spotify_user_id={spotify_user_id}"
        )
    )