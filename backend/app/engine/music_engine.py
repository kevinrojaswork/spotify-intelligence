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

from app.analyzers.artist_analyzer import ArtistAnalyzer
from app.analyzers.album_analyzer import AlbumAnalyzer
from app.analyzers.playlist_analyzer import PlaylistAnalyzer
from app.analyzers.duplicate_analyzer import DuplicateAnalyzer
from app.analyzers.dna_analyzer import DNAAnalyzer
from app.analyzers.insight_analyzer import InsightAnalyzer


class MusicAnalysisEngine:
    def __init__(self):
        self.tracks = []

    def get_all_playlists(self, sp):
        playlists = []
        results = sp.current_user_playlists(limit=50)

        while results:
            playlists.extend(results["items"])

            if results["next"]:
                results = sp.next(results)
            else:
                break

        return playlists

    def get_all_playlist_tracks(self, sp, playlist_id):
        tracks = []
        results = sp.playlist_tracks(playlist_id, limit=100)

        while results:
            tracks.extend(results["items"])

            if results["next"]:
                results = sp.next(results)
            else:
                break

        return tracks

    def sync(self, sp):
        playlists = self.get_all_playlists(sp)
        tracks_data = []

        for playlist in playlists:
            playlist_name = playlist["name"]
            playlist_id = playlist["id"]

            playlist_tracks = self.get_all_playlist_tracks(sp, playlist_id)

            for item in playlist_tracks:
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
            "message": "Biblioteca sincronizada completamente",
            "tracks_loaded": len(tracks_data),
            "playlists_loaded": len(playlists),
        }

    def analyze(self):
        self.tracks = get_all_tracks()

        artist_data = ArtistAnalyzer(self.tracks).analyze()
        album_data = AlbumAnalyzer(self.tracks).analyze()
        playlist_data = PlaylistAnalyzer(self.tracks).analyze()
        duplicate_data = DuplicateAnalyzer(self.tracks).analyze()

        dna_data = DNAAnalyzer(
            self.tracks,
            artist_data,
            duplicate_data
        ).analyze()

        smart_insights = InsightAnalyzer(
            self.tracks,
            artist_data,
            album_data,
            playlist_data,
            duplicate_data,
            dna_data
        ).analyze()

        top_songs = self.get_top_songs()

        daily_discovery = self.generate_daily_discovery(
            artist_data,
            duplicate_data,
            playlist_data,
        )

        return {
            "total_tracks": len(self.tracks),
            "total_playlists": playlist_data["total_playlists"],
            "top_artists": artist_data["top_artists"],
            "top_songs": top_songs,
            "top_albums": album_data["top_albums"],
            "duplicate_songs": duplicate_data["duplicate_songs"],
            "dominant_artist": artist_data["dominant_artist"],
            "dominant_artist_percentage": artist_data["dominant_artist_percentage"],
            "largest_playlist": playlist_data["largest_playlist"],
            "smallest_playlist": playlist_data["smallest_playlist"],
            "musical_dna": dna_data,
            "smart_insights": smart_insights,
            "daily_discovery": daily_discovery,
            "last_sync": get_metadata("last_sync"),
        }

    def get_top_songs(self):
        song_counter = Counter()

        for track in self.tracks:
            song_key = f"{track['track_name']} — {', '.join(track['artists'])}"
            song_counter[song_key] += 1

        return [
            {"name": name, "count": count}
            for name, count in song_counter.most_common(10)
        ]

    def generate_daily_discovery(self, artist_data, duplicate_data, playlist_data):
        dominant_artist = artist_data["dominant_artist"]
        dominant_percentage = artist_data["dominant_artist_percentage"]

        if dominant_artist:
            return (
                f"{dominant_artist['name']} domina tu biblioteca: aparece "
                f"{dominant_artist['count']} veces, equivalente al "
                f"{dominant_percentage}% de tus canciones analizadas."
            )

        largest_playlist = playlist_data["largest_playlist"]

        if largest_playlist:
            return (
                f"Tu playlist más grande es {largest_playlist['name']}, "
                f"con {largest_playlist['count']} canciones."
            )

        duplicate_songs = duplicate_data["duplicate_songs"]

        if duplicate_songs:
            top_duplicate = duplicate_songs[0]
            return (
                f"La canción más repetida es {top_duplicate['name']}, "
                f"presente en {top_duplicate['playlist_count']} playlists."
            )

        return "Tu biblioteca musical ya fue analizada correctamente."


engine = MusicAnalysisEngine()