from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from app.spotify import spotify_oauth
from app.services.spotify_service import save_token

router = APIRouter()


@router.get("/login")
def spotify_login():
    auth_url = spotify_oauth.get_authorize_url()
    return {"auth_url": auth_url}


@router.get("/callback")
def spotify_callback(code: str):
    save_token(code)

    return RedirectResponse(
        url="http://localhost:5173?spotify_connected=true"
    )