type PlaylistInsight = {
  name: string;
  count: number;
};

type Props = {
  largestPlaylist: PlaylistInsight | null;
  smallestPlaylist: PlaylistInsight | null;
};

function PlaylistInsightsCard({ largestPlaylist, smallestPlaylist }: Props) {
  return (
    <section className="discovery-card">
      <p className="section-label">Playlists</p>
      <h2>Resumen de tus playlists</h2>

      {largestPlaylist && (
        <p>
          Playlist más grande: {largestPlaylist.name} — {largestPlaylist.count}{" "}
          canciones
        </p>
      )}

      {smallestPlaylist && (
        <p>
          Playlist más pequeña: {smallestPlaylist.name} —{" "}
          {smallestPlaylist.count} canciones
        </p>
      )}
    </section>
  );
}

export default PlaylistInsightsCard;