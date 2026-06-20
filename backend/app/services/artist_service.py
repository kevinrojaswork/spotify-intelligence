from collections import Counter
from app.services.spotify_service import get_spotify_client


def get_top_artists_from_playlists(limit: int = 10):
    sp = get_spotify_client()

    if not sp:
        return {"error": "Spotify no está conectado todavía"}

    playlists = sp.current_user_playlists(limit=50)
    artist_counter = Counter()

    for playlist in playlists["items"]:
        playlist_id = playlist["id"]
        tracks = sp.playlist_tracks(playlist_id)

        for item in tracks["items"]:
            track = item.get("track")

            if not track:
                continue

            for artist in track.get("artists", []):
                artist_counter[artist["name"]] += 1

    top_artists = [
        {"name": artist, "count": count}
        for artist, count in artist_counter.most_common(limit)
    ]

    return {"top_artists": top_artists}