import { useEffect, useState } from "react";

type TopItem = {
  name: string;
  count: number;
};

type DashboardStats = {
  total_tracks: number;
  total_playlists: number;
  top_artists: TopItem[];
  top_songs: TopItem[];
  top_albums: TopItem[];
};

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/engine/dashboard")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
      });
  }, []);

  return (
    <div className="dashboard">
      <section className="discovery-card">
        <p className="section-label">Music Analysis Engine</p>
        <h2>Tu biblioteca musical ya fue analizada.</h2>
        <p>
          Estadísticas generadas desde el motor central de Spotify Intelligence.
        </p>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span>🎵</span>
          <p>Canciones</p>
          <h3>{stats ? stats.total_tracks : "--"}</h3>
        </div>

        <div className="stat-card">
          <span>🎤</span>
          <p>Top artistas</p>
          <h3>{stats ? stats.top_artists.length : "--"}</h3>
        </div>

        <div className="stat-card">
          <span>💿</span>
          <p>Top álbumes</p>
          <h3>{stats ? stats.top_albums.length : "--"}</h3>
        </div>

        <div className="stat-card">
          <span>📁</span>
          <p>Playlists</p>
          <h3>{stats ? stats.total_playlists : "--"}</h3>
        </div>
      </section>

      <section className="discovery-card">
        <p className="section-label">Top artistas</p>
        <h2>Tus artistas más presentes en playlists</h2>

        {stats?.top_artists.map((artist, index) => (
          <p key={artist.name}>
            {index + 1}. {artist.name} — {artist.count} canciones
          </p>
        ))}
      </section>

      <section className="discovery-card">
        <p className="section-label">Top canciones</p>
        <h2>Tus canciones más repetidas en playlists</h2>

        {stats?.top_songs.map((song, index) => (
          <p key={song.name}>
            {index + 1}. {song.name} — {song.count} veces
          </p>
        ))}
      </section>

      <section className="discovery-card">
        <p className="section-label">Top álbumes</p>
        <h2>Tus álbumes más presentes en playlists</h2>

        {stats?.top_albums.map((album, index) => (
          <p key={album.name}>
            {index + 1}. {album.name} — {album.count} canciones
          </p>
        ))}
      </section>
    </div>
  );
}

export default Dashboard;