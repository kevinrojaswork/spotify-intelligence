from datetime import datetime
from collections import Counter

from app.database.db import (
    init_db,
    save_tracks,
    get_all_tracks,
    get_user_playlists,
    save_user_playlists,
    save_metadata,
    get_metadata,
    get_playlist_snapshot_map,
    delete_tracks_for_playlist,
    delete_tracks_not_in_playlists,
    count_tracks_for_playlist,
    update_tracks_playlist_name,
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

    def sync(self, sp, spotify_user_id: str):
        playlists = self.get_all_playlists(sp)

        init_db()

        previous_snapshots = get_playlist_snapshot_map(spotify_user_id)

        current_playlist_ids = [
            playlist.get("id")
            for playlist in playlists
            if playlist.get("id")
        ]

        save_user_playlists(spotify_user_id, playlists)
        delete_tracks_not_in_playlists(spotify_user_id, current_playlist_ids)

        total_tracks_loaded = 0
        playlists_updated = 0
        playlists_skipped = 0

        for playlist in playlists:
            playlist_id = playlist.get("id")
            playlist_name = playlist.get("name", "Sin nombre")

            if not playlist_id:
                continue

            tracks_info = playlist.get("tracks") or {}
            expected_total_tracks = tracks_info.get("total", 0)
            current_snapshot_id = playlist.get("snapshot_id")
            previous_snapshot_id = previous_snapshots.get(playlist_id)

            existing_tracks_count = count_tracks_for_playlist(
                spotify_user_id,
                playlist_id,
            )

            playlist_changed = previous_snapshot_id != current_snapshot_id
            playlist_has_missing_tracks = existing_tracks_count != expected_total_tracks
            playlist_is_new = previous_snapshot_id is None

            should_update_playlist = (
                playlist_is_new
                or playlist_changed
                or playlist_has_missing_tracks
            )

            if not should_update_playlist:
                update_tracks_playlist_name(
                    spotify_user_id,
                    playlist_id,
                    playlist_name,
                )
                playlists_skipped += 1
                continue

            playlist_tracks = self.get_all_playlist_tracks(sp, playlist_id)

            tracks_data = []

            for item in playlist_tracks:
                track = item.get("track")

                if not track:
                    continue

                artists = [
    artist.get("name") or "Artista desconocido"
    for artist in track.get("artists", [])
    if artist
]

                album = track.get("album") or {}

                tracks_data.append(
                    {
                        "spotify_playlist_id": playlist_id,
                        "playlist": playlist_name,
                        "track_name": track.get("name", "Sin nombre"),
                        "artists": artists,
                        "album": album.get("name", "Sin álbum"),
                    }
                )

            delete_tracks_for_playlist(spotify_user_id, playlist_id)
            save_tracks(spotify_user_id, tracks_data)

            total_tracks_loaded += len(tracks_data)
            playlists_updated += 1

        save_metadata(
            f"last_sync:{spotify_user_id}",
            datetime.now().isoformat(timespec="seconds"),
        )

        return {
            "message": "Análisis actualizado correctamente",
            "tracks_loaded": total_tracks_loaded,
            "playlists_loaded": len(playlists),
            "playlists_updated": playlists_updated,
            "playlists_skipped": playlists_skipped,
    }

    def analyze(self, spotify_user_id, spotify_playlist_id=None):
        self.tracks = get_all_tracks(
            spotify_user_id,
            spotify_playlist_id=spotify_playlist_id
        )

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

        unique_artists = set()
        unique_albums = set()

        for track in self.tracks:
            for artist in track["artists"]:
                unique_artists.add(artist)

            unique_albums.add(track["album"])

        duplicate_percentage = round(
            (len(duplicate_data["duplicate_songs"]) / len(self.tracks)) * 100,
            1
        ) if self.tracks else 0

        return {
            "spotify_user_id": spotify_user_id,
            "spotify_playlist_id": spotify_playlist_id,
            "total_tracks": len(self.tracks),
            "total_playlists": playlist_data["total_playlists"],
            "total_artists": len(unique_artists),
            "total_albums": len(unique_albums),
            "top_artists": artist_data["top_artists"],
            "top_songs": top_songs,
            "top_albums": album_data["top_albums"],
            "duplicate_songs": duplicate_data["duplicate_songs"],
            "duplicate_percentage": duplicate_percentage,
            "dominant_artist": artist_data["dominant_artist"],
            "dominant_artist_percentage": artist_data["dominant_artist_percentage"],
            "largest_playlist": playlist_data["largest_playlist"],
            "smallest_playlist": playlist_data["smallest_playlist"],
            "top_playlists": playlist_data["top_playlists"],
            "musical_dna": dna_data,
            "smart_insights": smart_insights,
            "daily_discovery": daily_discovery,
            "last_sync": get_metadata(f"last_sync:{spotify_user_id}"),
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