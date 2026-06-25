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
    <section className="discovery-card playlist-card">
      <p className="section-label">Playlists</p>
      <h2>Resumen de tus playlists</h2>

      <div className="playlist-metrics">
        <div>
          <span>📈</span>
          <p>Playlist más grande</p>
          <strong>{largestPlaylist?.name ?? "No disponible"}</strong>
          <small>{largestPlaylist?.count ?? 0} canciones</small>
        </div>

        <div>
          <span>📉</span>
          <p>Playlist más pequeña</p>
          <strong>{smallestPlaylist?.name ?? "No disponible"}</strong>
          <small>{smallestPlaylist?.count ?? 0} canciones</small>
        </div>
      </div>
    </section>
  );
}

export default PlaylistInsightsCard;