class DNAAnalyzer:
    def __init__(self, tracks, artist_data, duplicate_data):
        self.tracks = tracks
        self.artist_data = artist_data
        self.duplicate_data = duplicate_data

    def analyze(self):
        total_tracks = len(self.tracks)
        total_unique_artists = self.artist_data["total_unique_artists"]
        dominant_artist_percentage = self.artist_data["dominant_artist_percentage"]
        duplicate_songs_count = self.duplicate_data["duplicate_songs_count"]

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