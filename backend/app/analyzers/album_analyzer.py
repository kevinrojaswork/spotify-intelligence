from collections import Counter


class AlbumAnalyzer:
    def __init__(self, tracks):
        self.tracks = tracks

    def analyze(self):
        album_counter = Counter()

        for track in self.tracks:
            album_counter[track["album"]] += 1

        return {
            "top_albums": [
                {"name": name, "count": count}
                for name, count in album_counter.most_common(25)
            ]
        }