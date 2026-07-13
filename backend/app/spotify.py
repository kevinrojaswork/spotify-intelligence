import os

from dotenv import load_dotenv
from spotipy.oauth2 import SpotifyOAuth
from spotipy.cache_handler import MemoryCacheHandler


load_dotenv()

spotify_cache_handler = MemoryCacheHandler()

spotify_oauth = SpotifyOAuth(
    client_id=os.getenv("SPOTIFY_CLIENT_ID"),
    client_secret=os.getenv("SPOTIFY_CLIENT_SECRET"),
    redirect_uri=os.getenv("SPOTIFY_REDIRECT_URI"),
    scope=(
        "playlist-read-private "
        "playlist-read-collaborative "
        "user-library-read "
        "user-read-email "
        "user-top-read "
        "user-read-private"
    ),
    cache_handler=spotify_cache_handler,
)