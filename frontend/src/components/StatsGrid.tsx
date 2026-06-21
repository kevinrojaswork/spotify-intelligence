type Props = {
  totalTracks: number;
  totalPlaylists: number;
  topArtistsCount: number;
  topAlbumsCount: number;
};

function StatsGrid({
  totalTracks,
  totalPlaylists,
  topArtistsCount,
  topAlbumsCount,
}: Props) {
  return (
    <section className="stats-grid">
      <div className="stat-card">
        <span>🎵</span>
        <p>Canciones</p>
        <h3>{totalTracks}</h3>
      </div>

      <div className="stat-card">
        <span>🎤</span>
        <p>Top artistas</p>
        <h3>{topArtistsCount}</h3>
      </div>

      <div className="stat-card">
        <span>💿</span>
        <p>Top álbumes</p>
        <h3>{topAlbumsCount}</h3>
      </div>

      <div className="stat-card">
        <span>📁</span>
        <p>Playlists</p>
        <h3>{totalPlaylists}</h3>
      </div>
    </section>
  );
}

export default StatsGrid;