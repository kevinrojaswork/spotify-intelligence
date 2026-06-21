import { useEffect, useState } from "react";

type TopItem = {
  name: string;
  count: number;
};

type DuplicateSong = {
  name: string;
  playlist_count: number;
  playlists: string[];
};

type DominantArtist = {
  name: string;
  count: number;
};

type DashboardStats = {
  total_tracks: number;
  total_playlists: number;
  top_artists: TopItem[];
  top_songs: TopItem[];
  top_albums: TopItem[];
  duplicate_songs: DuplicateSong[];
  dominant_artist: DominantArtist | null;
  dominant_artist_percentage: number;
  daily_discovery: string;
  last_sync: string | null;
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
        <p className="section-label">Descubrimiento del día</p>
        <h2>{stats?.daily_discovery ?? "Analizando tu biblioteca..."}</h2>
        <p>
          Última sincronización: {stats?.last_sync ?? "No sincronizado todavía"}
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
        <p className="section-label">Artista dominante</p>
        <h2>
          {stats?.dominant_artist
            ? stats.dominant_artist.name
            : "Todavía no hay artista dominante"}
        </h2>

        {stats?.dominant_artist && (
          <p>
            Aparece {stats.dominant_artist.count} veces, equivalente al{" "}
            {stats.dominant_artist_percentage}% de tus canciones analizadas.
          </p>
        )}
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

      <section className="discovery-card">
        <p className="section-label">Canciones duplicadas</p>
        <h2>Canciones que aparecen en varias playlists</h2>

        {stats?.duplicate_songs.length === 0 ? (
          <p>No encontramos canciones repetidas entre playlists.</p>
        ) : (
          stats?.duplicate_songs.map((song, index) => (
            <p key={song.name}>
              {index + 1}. {song.name} — aparece en {song.playlist_count} playlists
            </p>
          ))
        )}
      </section>
    </div>
  );
}

export default Dashboard;