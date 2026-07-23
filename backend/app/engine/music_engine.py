from collections import Counter
from datetime import datetime
from typing import Callable, Optional

from app.constants import (
    LIKED_SONGS_COLLECTION_ID,
    LIKED_SONGS_COLLECTION_NAME,
    LIKED_SONGS_COLLECTION_TYPE,
)
from app.database.db import (
    apply_music_sync,
    count_tracks_for_playlist,
    get_all_tracks,
    get_metadata,
    get_playlist_snapshot_map,
    get_user_playlists,
    init_db,
)

from app.analyzers.album_analyzer import AlbumAnalyzer
from app.analyzers.artist_analyzer import ArtistAnalyzer
from app.analyzers.dna_analyzer import DNAAnalyzer
from app.analyzers.duplicate_analyzer import DuplicateAnalyzer
from app.analyzers.insight_analyzer import InsightAnalyzer
from app.analyzers.playlist_analyzer import PlaylistAnalyzer


ProgressCallback = Optional[Callable[[], None]]


class MusicAnalysisEngine:
    def _report_progress(self, progress_callback: ProgressCallback):
        if progress_callback:
            progress_callback()

    def get_all_playlists(self, sp, progress_callback: ProgressCallback = None):
        playlists = []
        results = sp.current_user_playlists(limit=50)

        while results:
            playlists.extend(results.get("items", []))
            self._report_progress(progress_callback)

            if results.get("next"):
                results = sp.next(results)
            else:
                break

        return playlists

    def get_all_playlist_tracks(
        self,
        sp,
        playlist_id: str,
        progress_callback: ProgressCallback = None,
    ):
        tracks = []
        results = sp.playlist_tracks(playlist_id, limit=100)

        while results:
            tracks.extend(results.get("items", []))
            self._report_progress(progress_callback)

            if results.get("next"):
                results = sp.next(results)
            else:
                break

        return tracks

    def get_all_saved_tracks(
        self,
        sp,
        progress_callback: ProgressCallback = None,
    ):
        saved_tracks = []
        results = sp.current_user_saved_tracks(limit=50)

        while results:
            saved_tracks.extend(results.get("items", []))
            self._report_progress(progress_callback)

            if results.get("next"):
                results = sp.next(results)
            else:
                break

        return saved_tracks

    def _build_track_data(
        self,
        item: dict,
        collection_id: str,
        collection_name: str,
    ) -> dict | None:
        track = item.get("track")

        if not track:
            return None

        artists = [
            artist.get("name") or "Artista desconocido"
            for artist in track.get("artists", [])
            if artist
        ]
        album = track.get("album") or {}

        return {
            "spotify_playlist_id": collection_id,
            "playlist": collection_name,
            "track_name": track.get("name", "Sin nombre"),
            "artists": artists,
            "album": album.get("name", "Sin álbum"),
        }

    def sync(
        self,
        sp,
        spotify_user_id: str,
        progress_callback: ProgressCallback = None,
    ):
        """
        Descarga primero todos los cambios necesarios y solo después modifica
        SQLite mediante una única transacción. Si Spotify falla a mitad del
        proceso, el análisis válido anterior permanece intacto.
        """
        init_db()
        self._report_progress(progress_callback)

        spotify_playlists = self.get_all_playlists(
            sp,
            progress_callback=progress_callback,
        )
        saved_track_items = self.get_all_saved_tracks(
            sp,
            progress_callback=progress_callback,
        )
        previous_snapshots = get_playlist_snapshot_map(spotify_user_id)

        tracks_by_playlist: dict[str, list[dict]] = {}
        total_tracks_loaded = 0
        playlists_updated = 0
        playlists_skipped = 0

        for playlist in spotify_playlists:
            self._report_progress(progress_callback)

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
            playlist_has_missing_tracks = (
                existing_tracks_count != expected_total_tracks
            )
            playlist_is_new = previous_snapshot_id is None

            should_update_playlist = (
                playlist_is_new
                or playlist_changed
                or playlist_has_missing_tracks
            )

            if not should_update_playlist:
                playlists_skipped += 1
                continue

            playlist_tracks = self.get_all_playlist_tracks(
                sp,
                playlist_id,
                progress_callback=progress_callback,
            )

            tracks_data = []

            for item in playlist_tracks:
                track_data = self._build_track_data(
                    item,
                    playlist_id,
                    playlist_name,
                )

                if track_data:
                    tracks_data.append(track_data)

            # Todavía no tocamos la base. Solo preparamos el reemplazo.
            tracks_by_playlist[playlist_id] = tracks_data
            total_tracks_loaded += len(tracks_data)
            playlists_updated += 1

        liked_tracks_data = []

        for item in saved_track_items:
            track_data = self._build_track_data(
                item,
                LIKED_SONGS_COLLECTION_ID,
                LIKED_SONGS_COLLECTION_NAME,
            )

            if track_data:
                liked_tracks_data.append(track_data)

        # Esta colección no tiene snapshot_id en Spotify. Se reemplaza en cada
        # sincronización para detectar también cambios que no alteran el total.
        tracks_by_playlist[LIKED_SONGS_COLLECTION_ID] = liked_tracks_data
        total_tracks_loaded += len(liked_tracks_data)

        latest_saved_at = (
            saved_track_items[0].get("added_at")
            if saved_track_items
            else "empty"
        )
        liked_collection = {
            "id": LIKED_SONGS_COLLECTION_ID,
            "name": LIKED_SONGS_COLLECTION_NAME,
            "owner": {
                "id": spotify_user_id,
                "display_name": "Spotify",
            },
            "public": False,
            "snapshot_id": (
                f"liked:{len(liked_tracks_data)}:{latest_saved_at or ''}"
            ),
            "tracks": {"total": len(liked_tracks_data)},
        }

        collections_for_storage = [*spotify_playlists, liked_collection]

        sync_result = {
            "message": "Análisis actualizado correctamente",
            "tracks_loaded": total_tracks_loaded,
            "playlists_loaded": len(spotify_playlists),
            "playlists_updated": playlists_updated,
            "playlists_skipped": playlists_skipped,
            "liked_songs_loaded": len(liked_tracks_data),
        }

        synced_at = datetime.now().isoformat(timespec="seconds")

        # Esta operación es atómica: o se aplica todo, o no se aplica nada.
        apply_music_sync(
            spotify_user_id=spotify_user_id,
            playlists=collections_for_storage,
            tracks_by_playlist=tracks_by_playlist,
            sync_result=sync_result,
            synced_at=synced_at,
        )

        return sync_result

    def analyze(self, spotify_user_id, spotify_playlist_id=None):
        is_liked_songs_collection = (
            spotify_playlist_id == LIKED_SONGS_COLLECTION_ID
        )

        # Variable local: evita que solicitudes simultáneas de usuarios distintos
        # compartan o sobrescriban canciones dentro del motor global.
        if spotify_playlist_id:
            tracks = get_all_tracks(
                spotify_user_id,
                spotify_playlist_id=spotify_playlist_id,
            )
        else:
            # "Todas mis playlists" conserva su significado original. La
            # colección Me gusta se analiza por separado para evitar duplicar
            # canciones que también aparecen dentro de playlists.
            tracks = [
                track
                for track in get_all_tracks(spotify_user_id)
                if track.get("spotify_playlist_id")
                != LIKED_SONGS_COLLECTION_ID
            ]

        artist_data = ArtistAnalyzer(tracks).analyze()
        album_data = AlbumAnalyzer(tracks).analyze()
        playlist_data = PlaylistAnalyzer(tracks).analyze()
        duplicate_data = DuplicateAnalyzer(tracks).analyze()

        regular_playlists = [
            playlist
            for playlist in get_user_playlists(spotify_user_id)
            if playlist.get("spotify_playlist_id")
            != LIKED_SONGS_COLLECTION_ID
        ]

        total_library_playlists = (
            1
            if spotify_playlist_id
            else len(regular_playlists)
        )

        dna_data = DNAAnalyzer(
            tracks,
            artist_data,
            duplicate_data,
        ).analyze()

        smart_insights = InsightAnalyzer(
            tracks,
            artist_data,
            album_data,
            playlist_data,
            duplicate_data,
            dna_data,
        ).analyze()

        top_songs = (
            self.get_collection_songs(tracks)
            if is_liked_songs_collection
            else self.get_top_songs(tracks)
        )

        daily_discovery = self.generate_daily_discovery(
            artist_data,
            duplicate_data,
            playlist_data,
            is_liked_songs_collection=is_liked_songs_collection,
        )

        unique_artists = set()
        unique_albums = set()

        for track in tracks:
            for artist in track["artists"]:
                unique_artists.add(artist)

            unique_albums.add(track["album"])

        duplicate_percentage = round(
            (duplicate_data["duplicate_songs_count"] / len(tracks)) * 100,
            1,
        ) if tracks else 0

        if is_liked_songs_collection:
            analysis_scope_type = LIKED_SONGS_COLLECTION_TYPE
        elif spotify_playlist_id:
            analysis_scope_type = "playlist"
        else:
            analysis_scope_type = "all_playlists"

        return {
            "spotify_user_id": spotify_user_id,
            "spotify_playlist_id": spotify_playlist_id,
            "analysis_scope_type": analysis_scope_type,
            "total_tracks": len(tracks),
            "total_playlists": total_library_playlists,
            "total_artists": len(unique_artists),
            "total_albums": len(unique_albums),
            "top_artists": artist_data["top_artists"],
            "top_songs": top_songs,
            "top_albums": album_data["top_albums"],
            "duplicate_songs": duplicate_data["duplicate_songs"],
            "duplicate_percentage": duplicate_percentage,
            "dominant_artist": artist_data["dominant_artist"],
            "dominant_artist_percentage": artist_data[
                "dominant_artist_percentage"
            ],
            "largest_playlist": playlist_data["largest_playlist"],
            "smallest_playlist": playlist_data["smallest_playlist"],
            "top_playlists": playlist_data["top_playlists"],
            "musical_dna": dna_data,
            "smart_insights": smart_insights,
            "daily_discovery": daily_discovery,
            "last_sync": get_metadata(f"last_sync:{spotify_user_id}"),
        }

    def get_top_songs(self, tracks: list[dict]):
        song_counter = Counter()

        for track in tracks:
            song_key = (
                f"{track['track_name']} — {', '.join(track['artists'])}"
            )
            song_counter[song_key] += 1

        return [
            {"name": name, "count": count}
            for name, count in song_counter.most_common(25)
        ]

    def get_collection_songs(self, tracks: list[dict]):
        song_names = [
            f"{track['track_name']} — {', '.join(track['artists'])}"
            for track in tracks
        ]

        return [
            {"name": name, "count": 1}
            for name in sorted(song_names, key=str.casefold)[:25]
        ]

    def generate_daily_discovery(
        self,
        artist_data,
        duplicate_data,
        playlist_data,
        is_liked_songs_collection: bool = False,
    ):
        dominant_artist = artist_data["dominant_artist"]
        dominant_percentage = artist_data["dominant_artist_percentage"]

        if dominant_artist:
            if is_liked_songs_collection:
                return (
                    f"{dominant_artist['name']} es el artista con más canciones "
                    f"guardadas en Me gusta: aparece {dominant_artist['count']} "
                    f"veces, equivalente al {dominant_percentage}% de la colección."
                )

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

        if is_liked_songs_collection:
            return "Tu colección de Canciones que te gustan ya fue analizada."

        return "Tu biblioteca musical ya fue analizada correctamente."


engine = MusicAnalysisEngine()
