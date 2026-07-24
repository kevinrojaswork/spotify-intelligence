import re
import unicodedata


COMPARISON_LIST_LIMIT = 100


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    without_marks = "".join(
        character
        for character in normalized
        if not unicodedata.combining(character)
    )
    return re.sub(r"\s+", " ", without_marks).strip().casefold()


def build_song_identity(track: dict) -> tuple[str, str]:
    track_name = (track.get("track_name") or "Sin nombre").strip()
    artists = [
        (artist or "Artista desconocido").strip()
        for artist in track.get("artists", [])
        if artist
    ]

    display_artists = ", ".join(artists) or "Artista desconocido"
    normalized_artists = "|".join(
        sorted(normalize_text(artist) for artist in artists)
    )
    key = f"{normalize_text(track_name)}::{normalized_artists}"
    display_name = f"{track_name} — {display_artists}"

    return key, display_name


def build_song_map(tracks: list[dict]) -> dict[str, str]:
    songs: dict[str, str] = {}

    for track in tracks:
        key, display_name = build_song_identity(track)
        songs.setdefault(key, display_name)

    return songs


def build_artist_map(tracks: list[dict]) -> dict[str, str]:
    artists: dict[str, str] = {}

    for track in tracks:
        for artist in track.get("artists", []):
            display_name = (artist or "Artista desconocido").strip()
            artists.setdefault(normalize_text(display_name), display_name)

    return artists


def build_collection_summary(
    collection: dict,
    tracks: list[dict],
    song_map: dict[str, str],
    artist_map: dict[str, str],
) -> dict:
    unique_song_count = len(song_map)
    unique_artist_count = len(artist_map)
    diversity_score = (
        round((unique_artist_count / unique_song_count) * 100, 1)
        if unique_song_count
        else 0
    )

    return {
        "spotify_playlist_id": collection.get("spotify_playlist_id"),
        "name": collection.get("name") or "Sin nombre",
        "total_tracks": len(tracks),
        "unique_tracks": unique_song_count,
        "unique_artists": unique_artist_count,
        "artist_diversity_score": diversity_score,
        "is_special_collection": bool(
            collection.get("is_special_collection")
        ),
    }


def build_conclusion(
    similarity_percentage: float,
    shared_songs_count: int,
    shared_artists_count: int,
    total_unique_a: int,
    total_unique_b: int,
) -> tuple[str, str, str]:
    if total_unique_a == 0 and total_unique_b == 0:
        return (
            "Sin datos suficientes",
            "Ambas colecciones están vacías.",
            "Agrega canciones antes de intentar compararlas.",
        )

    if total_unique_a == 0 or total_unique_b == 0:
        return (
            "Comparación incompleta",
            "Una de las colecciones no contiene canciones.",
            "Elige dos colecciones con canciones para obtener una comparación útil.",
        )

    if similarity_percentage >= 75:
        return (
            "Muy similares",
            "Estas colecciones comparten gran parte de sus canciones.",
            "Conviene revisar si cumplen propósitos distintos o si podrías combinarlas.",
        )

    if similarity_percentage >= 40:
        return (
            "Relacionadas",
            "Comparten un núcleo musical importante, aunque cada una conserva contenido propio.",
            "Mantenerlas separadas tiene sentido si representan momentos o usos diferentes.",
        )

    if similarity_percentage >= 15:
        return (
            "Conexión parcial",
            "Tienen algunos puntos en común, pero la mayor parte de sus canciones es diferente.",
            "Son suficientemente distintas para conservarse como colecciones independientes.",
        )

    if shared_songs_count > 0:
        return (
            "Mayormente diferentes",
            "Comparten pocas canciones y mantienen identidades musicales separadas.",
            "No parece necesario combinarlas.",
        )

    if shared_artists_count > 0:
        return (
            "Artistas en común",
            "No comparten canciones exactas, aunque sí incluyen algunos de los mismos artistas.",
            "Las colecciones representan selecciones distintas dentro de gustos relacionados.",
        )

    return (
        "Completamente diferentes",
        "No encontramos canciones ni artistas compartidos entre estas colecciones.",
        "Cada una tiene una identidad musical claramente separada.",
    )


class PlaylistComparisonAnalyzer:
    def __init__(
        self,
        collection_a: dict,
        tracks_a: list[dict],
        collection_b: dict,
        tracks_b: list[dict],
    ):
        self.collection_a = collection_a
        self.tracks_a = tracks_a
        self.collection_b = collection_b
        self.tracks_b = tracks_b

    def analyze(self) -> dict:
        song_map_a = build_song_map(self.tracks_a)
        song_map_b = build_song_map(self.tracks_b)
        artist_map_a = build_artist_map(self.tracks_a)
        artist_map_b = build_artist_map(self.tracks_b)

        songs_a = set(song_map_a)
        songs_b = set(song_map_b)
        artists_a = set(artist_map_a)
        artists_b = set(artist_map_b)

        shared_song_keys = songs_a & songs_b
        exclusive_song_keys_a = songs_a - songs_b
        exclusive_song_keys_b = songs_b - songs_a
        shared_artist_keys = artists_a & artists_b
        song_union = songs_a | songs_b

        similarity_percentage = (
            round((len(shared_song_keys) / len(song_union)) * 100, 1)
            if song_union
            else 0
        )

        summary_a = build_collection_summary(
            self.collection_a,
            self.tracks_a,
            song_map_a,
            artist_map_a,
        )
        summary_b = build_collection_summary(
            self.collection_b,
            self.tracks_b,
            song_map_b,
            artist_map_b,
        )

        if (
            summary_a["artist_diversity_score"]
            > summary_b["artist_diversity_score"]
        ):
            diversity_winner = "a"
        elif (
            summary_b["artist_diversity_score"]
            > summary_a["artist_diversity_score"]
        ):
            diversity_winner = "b"
        else:
            diversity_winner = "tie"

        relationship_label, conclusion, recommendation = build_conclusion(
            similarity_percentage=similarity_percentage,
            shared_songs_count=len(shared_song_keys),
            shared_artists_count=len(shared_artist_keys),
            total_unique_a=len(songs_a),
            total_unique_b=len(songs_b),
        )

        shared_songs = sorted(
            (song_map_a[key] for key in shared_song_keys),
            key=str.casefold,
        )
        exclusive_songs_a = sorted(
            (song_map_a[key] for key in exclusive_song_keys_a),
            key=str.casefold,
        )
        exclusive_songs_b = sorted(
            (song_map_b[key] for key in exclusive_song_keys_b),
            key=str.casefold,
        )
        shared_artists = sorted(
            (artist_map_a[key] for key in shared_artist_keys),
            key=str.casefold,
        )

        return {
            "collection_a": summary_a,
            "collection_b": summary_b,
            "similarity_percentage": similarity_percentage,
            "shared_songs_count": len(shared_songs),
            "exclusive_songs_a_count": len(exclusive_songs_a),
            "exclusive_songs_b_count": len(exclusive_songs_b),
            "shared_artists_count": len(shared_artists),
            "shared_songs": shared_songs[:COMPARISON_LIST_LIMIT],
            "exclusive_songs_a": exclusive_songs_a[:COMPARISON_LIST_LIMIT],
            "exclusive_songs_b": exclusive_songs_b[:COMPARISON_LIST_LIMIT],
            "shared_artists": shared_artists[:COMPARISON_LIST_LIMIT],
            "list_limit": COMPARISON_LIST_LIMIT,
            "diversity_winner": diversity_winner,
            "relationship_label": relationship_label,
            "conclusion": conclusion,
            "recommendation": recommendation,
        }
