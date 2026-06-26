import spotipy
from app.spotify import spotify_oauth


current_access_tokens = {}
current_spotify_user_id = None


def save_token(code: str):
    global current_spotify_user_id

    token_info = spotify_oauth.get_access_token(code)
    access_token = token_info.get("access_token")

    sp = spotipy.Spotify(auth=access_token)
    user = sp.current_user()

    spotify_user_id = user["id"]

    current_access_tokens[spotify_user_id] = access_token
    current_spotify_user_id = spotify_user_id

    return {
        "access_token": access_token,
        "spotify_user_id": spotify_user_id,
        "display_name": user.get("display_name"),
        "email": user.get("email"),
    }


def get_spotify_client(spotify_user_id=None):
    user_id = spotify_user_id or current_spotify_user_id

    if not user_id:
        return None

    access_token = current_access_tokens.get(user_id)

    if not access_token:
        return None

    return spotipy.Spotify(auth=access_token)


def get_current_spotify_user_id():
    return current_spotify_user_id