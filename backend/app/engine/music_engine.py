from datetime import datetime
from collections import Counter

from app.database.db import (
    init_db,
    clear_tracks,
    save_tracks,
    get_all_tracks,
    init_metadata_table,
    save_metadata,
    get_metadata,
)


class MusicAnalysisEngine:

    def __init__(self):
        self.tracks = []

    def sync(self, sp):
        playlists = sp.current_user_playlists(limit=50)
        tracks_data = []

        for playlist in playlists["items"]:
            playlist_name = playlist["name"]

            results = sp.playlist_tracks(playlist["id"])

            for item in results["items"]:
                track = item.get("track")

                if not track:
                    continue

                tracks_data.append({
                    "playlist": playlist_name,
                    "track_name": track["name"],
                    "artists": [a["name"] for a in track["artists"]],
                    "album": track["album"]["name"],
                })

        init_db()
        clear_tracks()
        save_tracks(tracks_data)

        init_metadata_table()
        save_metadata(
            "last_sync",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )

        self.tracks = tracks_data

        return {
            "message": "Biblioteca sincronizada correctamente",
            "tracks_loaded": len(tracks_data),
            "playlists_loaded": len(playlists["items"]),
        }

    def analyze(self):
        self.tracks = get_all_tracks()

        artist_counter = Counter()
        song_counter = Counter()
        album_counter = Counter()
        playlists = set()

        for track in self.tracks:

            playlists.add(track["playlist"])

            album_counter[track["album"]] += 1

            song_counter[
                f"{track['track_name']} — {', '.join(track['artists'])}"
            ] += 1

            for artist in track["artists"]:
                artist_counter[artist] += 1

        return {
            "total_tracks": len(self.tracks),
            "total_playlists": len(playlists),

            "top_artists": [
                {"name": n, "count": c}
                for n, c in artist_counter.most_common(10)
            ],

            "top_songs": [
                {"name": n, "count": c}
                for n, c in song_counter.most_common(10)
            ],

            "top_albums": [
                {"name": n, "count": c}
                for n, c in album_counter.most_common(10)
            ],

            "last_sync": get_metadata("last_sync"),
        }


engine = MusicAnalysisEngine()