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
  const stats = [
    {
      icon: "🎵",
      label: "Canciones guardadas",
      value: totalTracks,
    },
    {
      icon: "🎤",
      label: "Artistas únicos",
      value: totalArtists,
    },
    {
      icon: "💿",
      label: "Álbumes únicos",
      value: totalAlbums,
    },
    {
      icon: "📁",
      label: "Playlists incluidas",
      value: totalPlaylists,
    },
  ];

  return (
    <section className="stats-grid">
      {stats.map((stat) => (
        <div className="stat-card" key={stat.label}>
          <span className="stat-icon">{stat.icon}</span>
          <p>{stat.label}</p>
          <strong>{stat.value}</strong>
        </div>
      ))}
    </section>
  );
}

export default StatsGrid;