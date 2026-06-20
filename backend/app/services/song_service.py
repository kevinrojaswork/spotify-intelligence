from collections import Counter
from app.services.spotify_service import get_spotify_client


def get_top_songs_from_playlists(limit: int = 10):
    sp = get_spotify_client()

    if not sp:
        return {"error": "Spotify no está conectado todavía"}

    playlists = sp.current_user_playlists(limit=50)
    song_counter = Counter()

    for playlist in playlists["items"]:
        playlist_id = playlist["id"]
        tracks = sp.playlist_tracks(playlist_id)

        for item in tracks["items"]:
            track = item.get("track")

            if not track:
                continue

            song_name = track["name"]
            artists = ", ".join([artist["name"] for artist in track["artists"]])
            key = f"{song_name} — {artists}"

            song_counter[key] += 1

    top_songs = [
        {"name": song, "count": count}
        for song, count in song_counter.most_common(limit)
    ]

    return {"top_songs": top_songs}