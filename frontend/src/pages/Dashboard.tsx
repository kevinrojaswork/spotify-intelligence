import { useEffect, useState } from "react";

import DiscoveryCard from "../components/DiscoveryCard";
import StatsGrid from "../components/StatsGrid";
import DominantArtistCard from "../components/DominantArtistCard";
import PlaylistInsightsCard from "../components/PlaylistInsightsCard";
import TopListCard from "../components/TopListCard";
import DuplicateSongsCard from "../components/DuplicateSongsCard";
import MusicalDNACard from "../components/MusicalDNACard";
import SmartInsightsCard from "../components/SmartInsightsCard";

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
  total_tracks: number;
  total_playlists: number;
  total_artists: number;
  total_albums: number;
  top_artists: TopItem[];
  top_songs: TopItem[];
  top_albums: TopItem[];
  duplicate_songs: DuplicateSong[];
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

  useEffect(() => {
    fetch("https://spotify-intelligence-production.up.railway.app/engine/dashboard")
      .then((res) => res.json())
      .then((data) => setStats(data));
  }, []);

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

      <DuplicateSongsCard songs={stats.duplicate_songs} />
    </div>
  );
}

export default Dashboard;