class InsightAnalyzer:
    def __init__(
        self,
        tracks,
        artist_data,
        album_data,
        playlist_data,
        duplicate_data,
        dna_data,
    ):
        self.tracks = tracks
        self.artist_data = artist_data
        self.album_data = album_data
        self.playlist_data = playlist_data
        self.duplicate_data = duplicate_data
        self.dna_data = dna_data

    def analyze(self):
        insights = []

        total_tracks = len(self.tracks)
        total_playlists = self.playlist_data["total_playlists"]
        top_artists = self.artist_data["top_artists"]
        top_albums = self.album_data["top_albums"]
        duplicate_songs_count = self.duplicate_data["duplicate_songs_count"]
        largest_playlist = self.playlist_data["largest_playlist"]
        smallest_playlist = self.playlist_data["smallest_playlist"]

        if total_tracks > 0 and total_playlists > 0:
            average_tracks = round(total_tracks / total_playlists, 1)
            insights.append(
                f"Tus playlists tienen un promedio de {average_tracks} canciones cada una."
            )

        if top_artists:
            artist = top_artists[0]
            insights.append(
                f"{artist['name']} es el artista que más se repite en tu biblioteca, con {artist['count']} apariciones."
            )

        if top_albums:
            album = top_albums[0]
            insights.append(
                f"El álbum más presente en tu biblioteca es {album['name']}, con {album['count']} canciones."
            )

        if largest_playlist and smallest_playlist:
            insights.append(
                f"Tu playlist más grande es {largest_playlist['name']} con {largest_playlist['count']} canciones, "
                f"mientras que la más pequeña es {smallest_playlist['name']} con {smallest_playlist['count']}."
            )

        if duplicate_songs_count > 0:
            insights.append(
                f"Tienes {duplicate_songs_count} canciones que aparecen en más de una playlist."
            )
        else:
            insights.append(
                "No encontramos canciones duplicadas entre tus playlists principales."
            )

        insights.append(self.dna_data["summary"])

        return insights