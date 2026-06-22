from collections import Counter


class PlaylistAnalyzer:
    def __init__(self, tracks):
        self.tracks = tracks

    def analyze(self):
        playlist_counter = Counter()

        for track in self.tracks:
            playlist_counter[track["playlist"]] += 1

        largest_playlist = None
        smallest_playlist = None

        if playlist_counter:
            largest_name, largest_count = playlist_counter.most_common(1)[0]
            smallest_name, smallest_count = min(
                playlist_counter.items(),
                key=lambda item: item[1]
            )

            largest_playlist = {"name": largest_name, "count": largest_count}
            smallest_playlist = {"name": smallest_name, "count": smallest_count}

        return {
            "total_playlists": len(playlist_counter),
            "largest_playlist": largest_playlist,
            "smallest_playlist": smallest_playlist,
        }