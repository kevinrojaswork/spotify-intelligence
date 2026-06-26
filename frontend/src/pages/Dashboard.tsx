import { useEffect, useState } from "react";

import DiscoveryCard from "../components/DiscoveryCard";
import StatsGrid from "../components/StatsGrid";
import DominantArtistCard from "../components/DominantArtistCard";
import PlaylistInsightsCard from "../components/PlaylistInsightsCard";
import TopListCard from "../components/TopListCard";
import DuplicateSongsCard from "../components/DuplicateSongsCard";
import MusicalDNACard from "../components/MusicalDNACard";
import SmartInsightsCard from "../components/SmartInsightsCard";

const API_BASE_URL = "https://spotify-intelligence-production.up.railway.app";

const SPOTIFY_AUTH_URL =
  "https://accounts.spotify.com/authorize?client_id=920f42a830964ed6bcb6cdd2205004bc&response_type=code&redirect_uri=https%3A%2F%2Fspotify-intelligence-production.up.railway.app%2Fauth%2Fcallback&scope=playlist-read-private+playlist-read-collaborative+user-library-read+user-read-email+user-top-read+user-read-private&show_dialog=true";

type TopItem = {
  name: string;
  count: number;
};

type DuplicateSong = {
  name: string;
  playlist_count: number;
  playlists: string[];
};

type PlaylistInsight = {
  name: string;
  count: number;
};

type DominantArtist = {
  name: string;
  count: number;
};

type MusicalDNA = {
  diversity_score: number;
  diversity_label: string;
  concentration_label: string;
  duplicate_label: string;
  total_unique_artists: number;
  duplicate_songs_count: number;
  summary: string;
};

type DashboardStats = {
  spotify_user_id: string;
  total_tracks: number;
  total_playlists: number;
  total_artists: number;
  total_albums: number;
  top_artists: TopItem[];
  top_songs: TopItem[];
  top_albums: TopItem[];
  top_playlists: TopItem[];
  duplicate_songs: DuplicateSong[];
  duplicate_percentage: number;
  dominant_artist: DominantArtist | null;
  dominant_artist_percentage: number;
  largest_playlist: PlaylistInsight | null;
  smallest_playlist: PlaylistInsight | null;
  musical_dna: MusicalDNA;
  smart_insights: string[];
  daily_discovery: string;
  last_sync: string | null;
};

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reconnectSpotify = () => {
    localStorage.removeItem("spotify_user_id");
    window.location.assign(SPOTIFY_AUTH_URL);
  };

  useEffect(() => {
    const spotifyUserId = localStorage.getItem("spotify_user_id");

    if (!spotifyUserId) {
      setError("No hay una cuenta de Spotify conectada.");
      return;
    }

    fetch(
      `${API_BASE_URL}/engine/dashboard?spotify_user_id=${encodeURIComponent(
        spotifyUserId
      )}`
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error("No se pudo cargar el dashboard.");
        }

        return res.json();
      })
      .then((data) => {
        setStats(data);
      })
      .catch((error) => {
        console.error("Error cargando dashboard:", error);
        setError("No se pudo cargar tu análisis musical.");
      });
  }, []);

  if (error) {
    return (
      <div className="dashboard">
        <section className="discovery-card">
          <p className="section-label">Spotify no conectado</p>
          <h2>{error}</h2>
          <p>
            Necesitamos conectar Spotify nuevamente para guardar tus datos con
            el nuevo sistema multiusuario.
          </p>

          <button className="connect-button" onClick={reconnectSpotify}>
            Conectar Spotify nuevamente
          </button>
        </section>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard">
        <section className="discovery-card loading-card">
          <p className="section-label">Cargando...</p>
          <h2>Analizando tu biblioteca musical...</h2>
          <div className="loading-pulse" />
        </section>
      </div>
    );
  }

  if (stats.total_tracks === 0) {
    return (
      <div className="dashboard">
        <section className="discovery-card">
          <p className="section-label">Sin datos todavía</p>
          <h2>No encontramos canciones guardadas para este usuario.</h2>
          <p>
            Esto puede pasar porque acabamos de cambiar la app al sistema
            multiusuario. Conecta Spotify nuevamente para reconstruir tu
            análisis.
          </p>

          <button className="connect-button" onClick={reconnectSpotify}>
            Reconectar Spotify
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <DiscoveryCard
        discovery={stats.daily_discovery}
        lastSync={stats.last_sync}
      />

      <StatsGrid
        totalTracks={stats.total_tracks}
        totalPlaylists={stats.total_playlists}
        totalArtists={stats.total_artists}
        totalAlbums={stats.total_albums}
      />

      <MusicalDNACard dna={stats.musical_dna} />

      <SmartInsightsCard insights={stats.smart_insights} />

      <DominantArtistCard
        artist={stats.dominant_artist}
        percentage={stats.dominant_artist_percentage}
      />

      <PlaylistInsightsCard
        largestPlaylist={stats.largest_playlist}
        smallestPlaylist={stats.smallest_playlist}
        totalTracks={stats.total_tracks}
      />

      <TopListCard
        label="Top playlists"
        title="Tus playlists más grandes"
        items={stats.top_playlists}
        unit="canciones"
      />

      <TopListCard
        label="Top artistas"
        title="Tus artistas más presentes en playlists"
        items={stats.top_artists}
        unit="canciones"
      />

      <TopListCard
        label="Top canciones"
        title="Tus canciones más repetidas en playlists"
        items={stats.top_songs}
        unit="veces"
      />

      <TopListCard
        label="Top álbumes"
        title="Tus álbumes más presentes en playlists"
        items={stats.top_albums}
        unit="canciones"
      />

      <DuplicateSongsCard
        songs={stats.duplicate_songs}
        duplicatePercentage={stats.duplicate_percentage}
      />
    </div>
  );
}

export default Dashboard;