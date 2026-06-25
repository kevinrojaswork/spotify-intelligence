type Props = {
  totalTracks: number;
  totalPlaylists: number;
  totalArtists: number;
  totalAlbums: number;
};

function StatsGrid({
  totalTracks,
  totalPlaylists,
  totalArtists,
  totalAlbums,
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
        <p>Artistas destacados</p>
        <h3>{totalArtists}</h3>
      </div>

      <div className="stat-card">
        <span>💿</span>
        <p>Álbumes destacados</p>
        <h3>{totalAlbums}</h3>
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