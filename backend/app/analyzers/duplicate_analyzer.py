from collections import defaultdict


class DuplicateAnalyzer:
    def __init__(self, tracks):
        self.tracks = tracks

    def analyze(self):
        song_playlists = defaultdict(set)

        for track in self.tracks:
            song_key = f"{track['track_name']} — {', '.join(track['artists'])}"
            song_playlists[song_key].add(track["playlist"])

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

        return {
            "duplicate_songs": duplicate_songs[:25],
            "duplicate_songs_count": len(duplicate_songs),
        }