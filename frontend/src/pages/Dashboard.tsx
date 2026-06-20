import { useEffect, useState } from "react";

type SpotifyProfile = {
  display_name: string;
  country: string;
  product: string;
  followers: {
    total: number;
  };
};

type Playlist = {
  id: string;
  name: string;
  tracks_total: number;
  owner: string;
};

type TopArtist = {
  name: string;
  count: number;
};

type TopSong = {
  name: string;
  count: number;
};

function Dashboard() {
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setProfile(data);
      });

    fetch("http://127.0.0.1:8000/playlists")
      .then((res) => res.json())
      .then((data) => {
        if (data.playlists) setPlaylists(data.playlists);
      });

    fetch("http://127.0.0.1:8000/artists/top")
      .then((res) => res.json())
      .then((data) => {
        if (data.top_artists) setTopArtists(data.top_artists);
      });
      
    fetch("http://127.0.0.1:8000/songs/top")
  .then((res) => res.json())
  .then((data) => {
    if (data.top_songs) setTopSongs(data.top_songs);
  });
}, []);

  const totalCanciones = playlists.reduce(
    (total, playlist) => total + playlist.tracks_total,
    0
  );

  return (
    <div className="dashboard">
      <section className="discovery-card">
        <p className="section-label">Perfil conectado</p>

        <h2>
          {profile
            ? `Bienvenido, ${profile.display_name}`
            : "Conecta Spotify para comenzar"}
        </h2>

        <p>
          {profile
            ? `Cuenta: ${profile.product} · País: ${profile.country} · Seguidores: ${profile.followers.total}`
            : "Cuando conectes tu cuenta, analizaremos tus playlists reales."}
        </p>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span>🎵</span>
          <p>Canciones</p>
          <h3>{totalCanciones}</h3>
        </div>

        <div className="stat-card">
          <span>🎤</span>
          <p>Top artistas</p>
          <h3>{topArtists.length}</h3>
        </div>

        <div className="stat-card">
          <span>💿</span>
          <p>Álbumes</p>
          <h3>--</h3>
        </div>

        <div className="stat-card">
          <span>📁</span>
          <p>Playlists</p>
          <h3>{playlists.length}</h3>
        </div>
      </section>

      <section className="discovery-card">
        <p className="section-label">Top artistas</p>
        <h2>Tus artistas más presentes en playlists</h2>

        {topArtists.length === 0 ? (
          <p>Conecta Spotify para calcular tus artistas principales.</p>
        ) : (
          <div>
            {topArtists.map((artist, index) => (
              <p key={artist.name}>
                {index + 1}. {artist.name} — {artist.count} canciones
              </p>
            ))}
          </div>
        )}
      </section>
      <section className="discovery-card">
  <p className="section-label">Top canciones</p>
  <h2>Tus canciones más repetidas en playlists</h2>

  {topSongs.length === 0 ? (
    <p>Conecta Spotify para calcular tus canciones principales.</p>
  ) : (
    <div>
      {topSongs.map((song, index) => (
        <p key={song.name}>
          {index + 1}. {song.name} — {song.count} veces
        </p>
      ))}
    </div>
  )}
</section>
    </div>
  );
}

export default Dashboard;