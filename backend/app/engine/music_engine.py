from collections import Counter

from app.database.db import (
    init_db,
    clear_tracks,
    save_tracks,
    get_all_tracks,
)


def load_library_from_spotify(sp):
    playlists = sp.current_user_playlists(limit=50)
    tracks_data = []

    for playlist in playlists["items"]:
        playlist_id = playlist["id"]
        playlist_name = playlist["name"]

        results = sp.playlist_tracks(playlist_id)

        for item in results["items"]:
            track = item.get("track")

            if not track:
                continue

            artists = [artist["name"] for artist in track.get("artists", [])]

            tracks_data.append({
                "playlist": playlist_name,
                "track_name": track.get("name"),
                "artists": artists,
                "album": track.get("album", {}).get("name", "Sin álbum")
            })

    init_db()
    clear_tracks()
    save_tracks(tracks_data)

    return {
        "message": "Biblioteca cargada y guardada en SQLite correctamente",
        "tracks_loaded": len(tracks_data),
        "playlists_loaded": len(playlists["items"])
    }


def get_dashboard_stats():
    tracks = get_all_tracks()

    artist_counter = Counter()
    song_counter = Counter()
    album_counter = Counter()
    playlists = set()

    for track in tracks:
        playlists.add(track["playlist"])
        album_counter[track["album"]] += 1

        song_key = f"{track['track_name']} — {', '.join(track['artists'])}"
        song_counter[song_key] += 1

        for artist in track["artists"]:
            artist_counter[artist] += 1

    return {
        "total_tracks": len(tracks),
        "total_playlists": len(playlists),
        "top_artists": [
            {"name": name, "count": count}
            for name, count in artist_counter.most_common(10)
        ],
        "top_songs": [
            {"name": name, "count": count}
            for name, count in song_counter.most_common(10)
        ],
        "top_albums": [
            {"name": name, "count": count}
            for name, count in album_counter.most_common(10)
        ],
    }