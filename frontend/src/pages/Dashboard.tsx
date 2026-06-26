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

  useEffect(() => {
    const spotifyUserId = localStorage.getItem("spotify_user_id");

    if (!spotifyUserId) {
      setError("No hay usuario de Spotify conectado.");
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
          <p className="section-label">Error</p>
          <h2>{error}</h2>
          <p>
            Conecta Spotify nuevamente o presiona sincronizar para actualizar
            tus datos.
          </p>
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