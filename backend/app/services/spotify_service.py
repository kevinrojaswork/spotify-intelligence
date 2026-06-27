import time
import spotipy

from app.spotify import spotify_oauth
from app.database.db import (
    init_db,
    save_spotify_token,
    get_spotify_token,
)


current_spotify_user_id = None


def get_expires_at(token_info):
    expires_at = token_info.get("expires_at")

    if expires_at:
        return int(expires_at)

    expires_in = token_info.get("expires_in", 3600)
    return int(time.time()) + int(expires_in)


def save_token(code: str):
    global current_spotify_user_id

    init_db()

    token_info = spotify_oauth.get_access_token(code)

    access_token = token_info.get("access_token")
    refresh_token = token_info.get("refresh_token")
    expires_at = get_expires_at(token_info)

    if not access_token:
        raise ValueError("No se pudo obtener el access token de Spotify.")

    sp = spotipy.Spotify(auth=access_token)
    user = sp.current_user()

    spotify_user_id = user["id"]

    save_spotify_token(
        spotify_user_id=spotify_user_id,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
    )

    current_spotify_user_id = spotify_user_id

    return {
        "access_token": access_token,
        "spotify_user_id": spotify_user_id,
        "display_name": user.get("display_name"),
        "email": user.get("email"),
    }


def refresh_token_if_needed(spotify_user_id, token_data):
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_at = token_data.get("expires_at") or 0

    token_is_still_valid = int(expires_at) > int(time.time()) + 60

    if token_is_still_valid:
        return access_token

    if not refresh_token:
        return None

    try:
        new_token_info = spotify_oauth.refresh_access_token(refresh_token)

        new_access_token = new_token_info.get("access_token")
        new_refresh_token = new_token_info.get("refresh_token") or refresh_token
        new_expires_at = get_expires_at(new_token_info)

        if not new_access_token:
            return None

        save_spotify_token(
            spotify_user_id=spotify_user_id,
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            expires_at=new_expires_at,
        )

        return new_access_token

    except Exception as error:
        print("Error refrescando token de Spotify:", error)
        return None


def get_spotify_client(spotify_user_id=None):
    user_id = spotify_user_id or current_spotify_user_id

    if not user_id:
        return None

    init_db()

    token_data = get_spotify_token(user_id)

    if not token_data:
        return None

    access_token = refresh_token_if_needed(user_id, token_data)

    if not access_token:
        return None

    return spotipy.Spotify(auth=access_token)


def get_current_spotify_user_id():
    return current_spotify_user_id