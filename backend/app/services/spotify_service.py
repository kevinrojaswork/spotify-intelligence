import spotipy
from app.spotify import spotify_oauth

current_access_token = None


def save_token(code: str):
    global current_access_token
    token_info = spotify_oauth.get_access_token(code)
    current_access_token = token_info.get("access_token")
    return current_access_token


def get_spotify_client():
    if not current_access_token:
        return None

    return spotipy.Spotify(auth=current_access_token)