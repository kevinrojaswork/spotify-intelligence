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

type SyncStatus = "idle" | "syncing" | "completed" | "error";

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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const reconnectSpotify = () => {
    localStorage.removeItem("spotify_user_id");
    window.location.assign(SPOTIFY_AUTH_URL);
  };

  useEffect(() => {
    const spotifyUserId = localStorage.getItem("spotify_user_id");

    if (!spotifyUserId) {
      setError("No hay una cuenta de Spotify conectada.");
      setIsLoading(false);
      return;
    }

    let intervalId: number | undefined;

    const loadDashboard = async () => {
      const response = await fetch(
        `${API_BASE_URL}/dashboard?spotify_user_id=${encodeURIComponent(
  spotifyUserId
)}`
      );

      if (!response.ok) {
        throw new Error("No se pudo cargar el dashboard.");
      }

      const data = await response.json();
      setStats(data);
      return data as DashboardStats;
    };

    const loadSyncStatus = async () => {
      const response = await fetch(
        `${API_BASE_URL}/sync-status?spotify_user_id=${encodeURIComponent(
  spotifyUserId
)}`
      );

      if (!response.ok) {
        throw new Error("No se pudo revisar el estado de sincronización.");
      }

      const data = await response.json();

      setSyncStatus(data.status || "idle");
      setSyncError(data.error || "");

      return data as {
        status: SyncStatus;
        error: string;
      };
    };

    const checkUntilSyncFinishes = async () => {
      try {
        const statusData = await loadSyncStatus();

        if (statusData.status === "completed") {
          if (intervalId) {
            window.clearInterval(intervalId);
          }

          await loadDashboard();
          setIsLoading(false);
        }

        if (statusData.status === "error") {
          if (intervalId) {
            window.clearInterval(intervalId);
          }

          setError(
            statusData.error ||
              "Ocurrió un error mientras sincronizábamos Spotify."
          );
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error revisando sincronización:", error);
      }
    };

    const start = async () => {
      try {
        const statusData = await loadSyncStatus();

        try {
          await loadDashboard();
        } catch (dashboardError) {
          console.error("Dashboard todavía no disponible:", dashboardError);
        }

        setIsLoading(false);

        if (statusData.status === "syncing") {
          intervalId = window.setInterval(checkUntilSyncFinishes, 4000);
        }
      } catch (error) {
        console.error("Error inicial cargando dashboard:", error);
        setError("No se pudo cargar tu análisis musical.");
        setIsLoading(false);
      }
    };

    start();

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="dashboard">
        <section className="discovery-card loading-card">
          <p className="section-label">Cargando...</p>
          <h2>Preparando tu análisis musical...</h2>
          <p>Estamos revisando el estado de tu sincronización con Spotify.</p>
          <div className="loading-pulse" />
        </section>
      </div>
    );
  }

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

          {syncError && <p>Error técnico: {syncError}</p>}

          <button className="connect-button" onClick={reconnectSpotify}>
            Conectar Spotify nuevamente
          </button>
        </section>
      </div>
    );
  }

  if (syncStatus === "syncing" && (!stats || stats.total_tracks === 0)) {
    return (
      <div className="dashboard">
        <section className="discovery-card loading-card">
          <p className="section-label">Sincronizando Spotify</p>
          <h2>Estamos preparando tu análisis musical...</h2>
          <p>
            Esto puede tardar un poco la primera vez si tienes muchas playlists.
            Cuando termine, el dashboard se actualizará automáticamente.
          </p>
          <div className="loading-pulse" />
        </section>
      </div>
    );
  }

  if (!stats || stats.total_tracks === 0) {
    return (
      <div className="dashboard">
        <section className="discovery-card">
          <p className="section-label">Sin datos todavía</p>
          <h2>No encontramos canciones guardadas para este usuario.</h2>
          <p>
            Conecta Spotify nuevamente para reconstruir tu análisis con el nuevo
            sistema multiusuario.
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
      {syncStatus === "syncing" && (
        <section className="discovery-card loading-card">
          <p className="section-label">Actualizando Spotify</p>
          <h2>Estamos actualizando tus datos en segundo plano...</h2>
          <p>
            Puedes seguir viendo tu análisis anterior mientras terminamos de
            sincronizar.
          </p>
          <div className="loading-pulse" />
        </section>
      )}

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