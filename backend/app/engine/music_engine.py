from datetime import datetime
from collections import Counter, defaultdict

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
        playlist_counter = Counter()
        playlists = set()
        song_playlists = defaultdict(set)

        for track in self.tracks:
            playlist_name = track["playlist"]

            playlists.add(playlist_name)
            playlist_counter[playlist_name] += 1
            album_counter[track["album"]] += 1

            song_key = f"{track['track_name']} — {', '.join(track['artists'])}"
            song_counter[song_key] += 1
            song_playlists[song_key].add(playlist_name)

            for artist in track["artists"]:
                artist_counter[artist] += 1

        duplicate_songs = []

        for song, playlist_set in song_playlists.items():
            if len(playlist_set) > 1:
                duplicate_songs.append({
                    "name": song,
                    "playlist_count": len(playlist_set),
                    "playlists": sorted(list(playlist_set)),
                })

        duplicate_songs.sort(
            key=lambda item: item["playlist_count"],
            reverse=True
        )

        top_artists = [
            {"name": n, "count": c}
            for n, c in artist_counter.most_common(10)
        ]

        top_songs = [
            {"name": n, "count": c}
            for n, c in song_counter.most_common(10)
        ]

        top_albums = [
            {"name": n, "count": c}
            for n, c in album_counter.most_common(10)
        ]

        largest_playlist = None
        smallest_playlist = None

        if playlist_counter:
            largest_name, largest_count = playlist_counter.most_common(1)[0]
            smallest_name, smallest_count = min(
                playlist_counter.items(),
                key=lambda item: item[1]
            )

            largest_playlist = {
                "name": largest_name,
                "count": largest_count,
            }

            smallest_playlist = {
                "name": smallest_name,
                "count": smallest_count,
            }

        dominant_artist = top_artists[0] if top_artists else None
        dominant_artist_percentage = 0

        if dominant_artist and len(self.tracks) > 0:
            dominant_artist_percentage = round(
                (dominant_artist["count"] / len(self.tracks)) * 100,
                2
            )

        musical_dna = self.generate_musical_dna(
            total_tracks=len(self.tracks),
            total_playlists=len(playlists),
            total_unique_artists=len(artist_counter),
            dominant_artist_percentage=dominant_artist_percentage,
            duplicate_songs_count=len(duplicate_songs),
        )

        daily_discovery = self.generate_daily_discovery(
            dominant_artist,
            dominant_artist_percentage,
            duplicate_songs,
            largest_playlist,
            len(self.tracks),
            len(playlists)
        )

        return {
            "total_tracks": len(self.tracks),
            "total_playlists": len(playlists),
            "top_artists": top_artists,
            "top_songs": top_songs,
            "top_albums": top_albums,
            "duplicate_songs": duplicate_songs[:10],
            "dominant_artist": dominant_artist,
            "dominant_artist_percentage": dominant_artist_percentage,
            "largest_playlist": largest_playlist,
            "smallest_playlist": smallest_playlist,
            "musical_dna": musical_dna,
            "daily_discovery": daily_discovery,
            "last_sync": get_metadata("last_sync"),
        }

    def generate_musical_dna(
        self,
        total_tracks,
        total_playlists,
        total_unique_artists,
        dominant_artist_percentage,
        duplicate_songs_count,
    ):
        diversity_score = 0

        if total_tracks > 0:
            diversity_score = round(
                (total_unique_artists / total_tracks) * 100,
                2
            )

        if diversity_score >= 60:
            diversity_label = "Explorador musical"
        elif diversity_score >= 35:
            diversity_label = "Gusto equilibrado"
        else:
            diversity_label = "Biblioteca concentrada"

        if dominant_artist_percentage >= 10:
            concentration_label = "Alta concentración en artista dominante"
        elif dominant_artist_percentage >= 5:
            concentration_label = "Concentración moderada"
        else:
            concentration_label = "Gusto bastante distribuido"

        if duplicate_songs_count >= 20:
            duplicate_label = "Muchas canciones repetidas entre playlists"
        elif duplicate_songs_count >= 5:
            duplicate_label = "Algunas canciones aparecen en varias playlists"
        else:
            duplicate_label = "Pocas canciones repetidas"

        return {
            "diversity_score": diversity_score,
            "diversity_label": diversity_label,
            "concentration_label": concentration_label,
            "duplicate_label": duplicate_label,
            "total_unique_artists": total_unique_artists,
            "duplicate_songs_count": duplicate_songs_count,
            "summary": (
                f"Tu ADN Musical muestra un perfil de {diversity_label.lower()}, "
                f"con {total_unique_artists} artistas únicos en {total_tracks} canciones."
            )
        }

    def generate_daily_discovery(
        self,
        dominant_artist,
        dominant_artist_percentage,
        duplicate_songs,
        largest_playlist,
        total_tracks,
        total_playlists
    ):
        if dominant_artist:
            return (
                f"{dominant_artist['name']} domina tu biblioteca: aparece "
                f"{dominant_artist['count']} veces, equivalente al "
                f"{dominant_artist_percentage}% de tus canciones analizadas."
            )

        if largest_playlist:
            return (
                f"Tu playlist más grande es {largest_playlist['name']}, "
                f"con {largest_playlist['count']} canciones."
            )

        if duplicate_songs:
            top_duplicate = duplicate_songs[0]
            return (
                f"La canción más repetida es {top_duplicate['name']}, "
                f"presente en {top_duplicate['playlist_count']} playlists."
            )

        return (
            f"Tu biblioteca contiene {total_tracks} canciones "
            f"organizadas en {total_playlists} playlists."
        )


engine = MusicAnalysisEngine()