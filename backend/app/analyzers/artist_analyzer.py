from collections import Counter


class ArtistAnalyzer:
    def __init__(self, tracks):
        self.tracks = tracks

    def analyze(self):
        artist_counter = Counter()

        for track in self.tracks:
            for artist in track["artists"]:
                artist_counter[artist] += 1

        top_artists = [
            {"name": name, "count": count}
            for name, count in artist_counter.most_common(25)
        ]

        dominant_artist = top_artists[0] if top_artists else None

        dominant_percentage = 0
        if dominant_artist and len(self.tracks) > 0:
            dominant_percentage = round(
                (dominant_artist["count"] / len(self.tracks)) * 100,
                2
            )

        return {
            "top_artists": top_artists,
            "dominant_artist": dominant_artist,
            "dominant_artist_percentage": dominant_percentage,
            "total_unique_artists": len(artist_counter),
        }