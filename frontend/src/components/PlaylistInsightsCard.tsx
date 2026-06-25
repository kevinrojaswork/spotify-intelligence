type PlaylistInsight = {
  name: string;
  count: number;
};

type Props = {
    largestPlaylist: PlaylistInsight | null;
    smallestPlaylist: PlaylistInsight | null;
    totalTracks: number;
};

function PlaylistInsightsCard({
    largestPlaylist,
    smallestPlaylist,
    totalTracks,
}: Props) {
  return (
    <section className="discovery-card playlist-card">
      <p className="section-label">Playlists</p>
      <h2>Resumen de tus playlists</h2>

      <div className="playlist-metrics">
        <div>
          <span>📈</span>
          <p>Playlist más grande</p>
          <strong>{largestPlaylist?.name ?? "No disponible"}</strong>
          <small>
    {largestPlaylist?.count ?? 0} canciones (
    {largestPlaylist
        ? ((largestPlaylist.count / totalTracks) * 100).toFixed(1)
        : 0}
    %)
</small>
        </div>

        <div>
          <span>📉</span>
          <p>Playlist más pequeña</p>
          <strong>{smallestPlaylist?.name ?? "No disponible"}</strong>
          <small>
    {smallestPlaylist?.count ?? 0} canciones (
    {smallestPlaylist
        ? ((smallestPlaylist.count / totalTracks) * 100).toFixed(1)
        : 0}
    %)
</small>
        </div>
      </div>
    </section>
  );
}

export default PlaylistInsightsCard;