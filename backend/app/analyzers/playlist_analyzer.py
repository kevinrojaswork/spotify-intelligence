class PlaylistAnalyzer:
    def __init__(self, tracks):
        self.tracks = tracks

    def analyze(self):
        playlists = {}

        for track in self.tracks:
            playlist_id = track.get("spotify_playlist_id")
            playlist_name = (
                track.get("playlist")
                or "Sin nombre"
            ).strip()

            # Usamos el ID como clave principal.
            # Para datos antiguos sin ID, usamos el nombre como respaldo.
            playlist_key = (
                playlist_id
                if playlist_id
                else f"name:{playlist_name}"
            )

            if playlist_key not in playlists:
                playlists[playlist_key] = {
                    "spotify_playlist_id": playlist_id,
                    "name": playlist_name,
                    "count": 0,
                }

            playlists[playlist_key]["count"] += 1

        playlist_items = list(playlists.values())

        largest_playlist = None
        smallest_playlist = None
        top_playlists = []

        if playlist_items:
            largest_playlist = max(
                playlist_items,
                key=lambda playlist: playlist["count"],
            )

            smallest_playlist = min(
                playlist_items,
                key=lambda playlist: playlist["count"],
            )

            top_playlists = sorted(
                playlist_items,
                key=lambda playlist: playlist["count"],
                reverse=True,
            )[:10]

        return {
            "total_playlists": len(playlist_items),
            "largest_playlist": largest_playlist,
            "smallest_playlist": smallest_playlist,
            "top_playlists": top_playlists,
        }