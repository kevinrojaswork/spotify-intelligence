import { useEffect, useState, type ChangeEvent } from "react";

import DiscoveryCard from "../components/DiscoveryCard";
import StatsGrid from "../components/StatsGrid";
import DominantArtistCard from "../components/DominantArtistCard";
import PlaylistInsightsCard from "../components/PlaylistInsightsCard";
import TopListCard from "../components/TopListCard";
import DuplicateSongsCard from "../components/DuplicateSongsCard";
import MusicalDNACard from "../components/MusicalDNACard";
import SmartInsightsCard from "../components/SmartInsightsCard";

const API_BASE_URL = "https://spotify-intelligence-production.up.railway.app";

type SyncStatus = "idle" | "syncing" | "completed" | "error";

type SyncResult = {
  message?: string;
  tracks_loaded?: number;
  playlists_loaded?: number;
  playlists_updated?: number;
  playlists_skipped?: number;
};

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

type PlaylistOption = {
  spotify_playlist_id: string;
  name: string;
  total_tracks: number;
};

type DashboardStats = {
  spotify_user_id: string;
  spotify_playlist_id: string | null;
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
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingScope, setIsChangingScope] = useState(false);
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);
  const [isPlaylistSelectorOpen, setIsPlaylistSelectorOpen] = useState(false);

  const getSpotifyUserId = () => {
    return localStorage.getItem("spotify_user_id");
  };

  const resolveValidPlaylistId = (
    storedPlaylistId: string,
    playlistList: PlaylistOption[]
  ) => {
    if (!storedPlaylistId) {
      return "";
    }

    const playlistStillExists = playlistList.some(
      (playlist) => playlist.spotify_playlist_id === storedPlaylistId
    );

    if (!playlistStillExists) {
      localStorage.removeItem("selected_playlist_id");
      return "";
    }

    return storedPlaylistId;
  };

  const loadDashboard = async (
    spotifyUserId: string,
    playlistId?: string
  ) => {
    const playlistQuery = playlistId
      ? `&playlist_id=${encodeURIComponent(playlistId)}`
      : "";

    const response = await fetch(
      `${API_BASE_URL}/dashboard?spotify_user_id=${encodeURIComponent(
        spotifyUserId
      )}${playlistQuery}`
    );

    if (!response.ok) {
      throw new Error("No se pudo cargar el dashboard.");
    }

    const data = await response.json();
    setStats(data);
    return data as DashboardStats;
  };

  const loadPlaylists = async (spotifyUserId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/analysis-playlists?spotify_user_id=${encodeURIComponent(
        spotifyUserId
      )}`
    );

    if (!response.ok) {
      throw new Error("No se pudieron cargar las playlists.");
    }

    const data = await response.json();
    const playlistList = data.playlists || [];

    setPlaylists(playlistList);

    return playlistList as PlaylistOption[];
  };

  const loadSyncStatus = async (spotifyUserId: string) => {
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
    setSyncResult(data.result || null);

    return data as {
      status: SyncStatus;
      error: string;
      result: SyncResult | null;
    };
  };

  useEffect(() => {
    const spotifyUserId = getSpotifyUserId();
    const storedPlaylistId = localStorage.getItem("selected_playlist_id") || "";
    const updateStarted =
      localStorage.getItem("analysis_update_started") === "true";

    if (!spotifyUserId) {
      setError("No hay una cuenta de Spotify conectada.");
      setIsLoading(false);
      return;
    }

    let intervalId: number | undefined;

    const markUpdateCompleted = () => {
      if (updateStarted) {
        setShowUpdateSuccess(true);
        localStorage.removeItem("analysis_update_started");
      }
    };

    const loadValidDashboard = async () => {
      const playlistList = await loadPlaylists(spotifyUserId);
      const validPlaylistId = resolveValidPlaylistId(
        storedPlaylistId,
        playlistList
      );

      setSelectedPlaylistId(validPlaylistId);

      await loadDashboard(spotifyUserId, validPlaylistId);
    };

    const checkUntilSyncFinishes = async () => {
      try {
        const statusData = await loadSyncStatus(spotifyUserId);

        if (statusData.status === "completed") {
          if (intervalId) {
            window.clearInterval(intervalId);
          }

          await loadValidDashboard();
          markUpdateCompleted();
          setIsLoading(false);
        }

        if (statusData.status === "error") {
          if (intervalId) {
            window.clearInterval(intervalId);
          }

          localStorage.removeItem("analysis_update_started");

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
        const statusData = await loadSyncStatus(spotifyUserId);

        try {
          await loadValidDashboard();
        } catch (dashboardError) {
          console.error("Dashboard todavía no disponible:", dashboardError);
        }

        if (statusData.status === "completed") {
          markUpdateCompleted();
        }

        if (statusData.status === "syncing") {
          intervalId = window.setInterval(checkUntilSyncFinishes, 4000);
        }

        if (statusData.status === "error") {
          localStorage.removeItem("analysis_update_started");
          setError(
            statusData.error ||
              "Ocurrió un error mientras sincronizábamos Spotify."
          );
        }

        setIsLoading(false);
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

  const handlePlaylistChange = async (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const newPlaylistId = event.target.value;
    const spotifyUserId = getSpotifyUserId();

    if (!spotifyUserId) {
      setError("No hay una cuenta de Spotify conectada.");
      return;
    }

    setSelectedPlaylistId(newPlaylistId);

    if (newPlaylistId) {
      localStorage.setItem("selected_playlist_id", newPlaylistId);
    } else {
      localStorage.removeItem("selected_playlist_id");
    }

    try {
      setIsChangingScope(true);
      await loadDashboard(spotifyUserId, newPlaylistId);
      setIsPlaylistSelectorOpen(false);
    } catch (error) {
      console.error("Error cambiando análisis:", error);
      setError("No se pudo cambiar el análisis seleccionado.");
    } finally {
      setIsChangingScope(false);
    }
  };

  const selectedPlaylist = playlists.find(
    (playlist) => playlist.spotify_playlist_id === selectedPlaylistId
  );

  const currentScopeLabel = selectedPlaylist
    ? selectedPlaylist.name
    : "Toda mi biblioteca";

  const isPlaylistMode = Boolean(selectedPlaylistId);

  const playlistDiscovery = stats?.dominant_artist
    ? `${stats.dominant_artist.name} domina esta playlist: aparece ${stats.dominant_artist.count} veces, equivalente al ${stats.dominant_artist_percentage}% de las canciones analizadas.`
    : "Esta playlist ya fue analizada correctamente.";

  const repeatedSongsInPlaylist = stats
  ? stats.top_songs.filter((song) => song.count >= 2)
  : [];

  if (isLoading) {
    return (
      <div className="dashboard">
        <section className="discovery-card loading-card">
          <p className="section-label">Cargando...</p>
          <h2>Preparando tu análisis musical...</h2>
          <p>Estamos revisando tu conexión con Spotify.</p>
          <div className="loading-pulse" />
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <section className="discovery-card">
          <p className="section-label">Acción necesaria</p>
          <h2>{error}</h2>
          <p>
            Usa el botón superior para conectar o actualizar Spotify y reconstruir
            tu análisis musical.
          </p>

          {syncError && <p>Error técnico: {syncError}</p>}
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
            La primera sincronización puede tardar un poco si tienes muchas
            playlists. Cuando termine, el dashboard se actualizará solo.
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
          <h2>No encontramos canciones guardadas para este análisis.</h2>
          <p>
            Usa el botón superior para actualizar Spotify. Si acabamos de
            agregar el selector de playlists, necesitas actualizar el análisis
            una vez para llenar los nuevos datos.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="analysis-scope-card">
        <div>
          <p className="section-label">
            {isPlaylistMode ? "Modo playlist" : "Modo biblioteca"}
          </p>

          <h2>Analizando: {currentScopeLabel}</h2>

          <p>
            {isPlaylistMode
              ? "Estás viendo un análisis calculado solo con las canciones de esta playlist."
              : "Estás viendo un análisis general de todas tus playlists guardadas."}
          </p>

          <span className="playlist-count-label">
            {playlists.length} playlists disponibles
          </span>
        </div>

        <div className="scope-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsPlaylistSelectorOpen((isOpen) => !isOpen)}
          >
            {isPlaylistSelectorOpen ? "Ocultar selector" : "Cambiar playlist"}
          </button>

          {selectedPlaylistId && (
            <button
              type="button"
              className="scope-reset-button"
              onClick={async () => {
                const spotifyUserId = getSpotifyUserId();

                if (!spotifyUserId) {
                  setError("No hay una cuenta de Spotify conectada.");
                  return;
                }

                localStorage.removeItem("selected_playlist_id");
                setSelectedPlaylistId("");

                try {
                  setIsChangingScope(true);
                  await loadDashboard(spotifyUserId, "");
                  setIsPlaylistSelectorOpen(false);
                } catch (error) {
                  console.error("Error volviendo a biblioteca completa:", error);
                  setError("No se pudo volver al análisis general.");
                } finally {
                  setIsChangingScope(false);
                }
              }}
            >
              Ver toda mi biblioteca
            </button>
          )}

          {isPlaylistSelectorOpen && (
            <div className="playlist-selector-wrapper">
              <label htmlFor="playlist-selector">Seleccionar análisis</label>

              <select
                id="playlist-selector"
                value={selectedPlaylistId}
                onChange={handlePlaylistChange}
                disabled={isChangingScope}
              >
                <option value="">Toda mi biblioteca</option>

                {playlists.map((playlist) => (
                  <option
                    key={playlist.spotify_playlist_id}
                    value={playlist.spotify_playlist_id}
                  >
                    {playlist.name} — {playlist.total_tracks} canciones
                  </option>
                ))}
              </select>

              {isChangingScope && <span>Cambiando análisis...</span>}
            </div>
          )}
        </div>
      </section>

      {syncStatus === "syncing" && (
        <section className="discovery-card loading-card">
          <p className="section-label">Actualizando análisis</p>
          <h2>Estamos actualizando tus datos en segundo plano...</h2>
          <p>
            Puedes seguir viendo tu análisis anterior mientras terminamos de
            sincronizar tus playlists.
          </p>
          <div className="loading-pulse" />
        </section>
      )}

      <nav className="dashboard-section-nav">
  <a href="#dashboard-summary">Resumen</a>
  <a href="#musical-dna">ADN Musical</a>
  <a href="#top-artists">Top artistas</a>
  <a href="#top-songs">Top canciones</a>
  <a href="#top-albums">Top álbumes</a>

  {!isPlaylistMode && <a href="#duplicate-songs">Duplicadas</a>}
</nav>

      {showUpdateSuccess && syncStatus === "completed" && (
  <section className="discovery-card sync-result-card">
    <p className="section-label">Análisis actualizado</p>
    <h2>Tu análisis musical se actualizó correctamente.</h2>
    <p>
      Los datos que ves abajo ya corresponden a la última sincronización.
    </p>

    {syncResult && (
      <div className="sync-result-grid">
        <div>
          <span>Playlists actualizadas</span>
          <strong>{syncResult.playlists_updated ?? 0}</strong>
        </div>

        <div>
          <span>Playlists sin cambios</span>
          <strong>{syncResult.playlists_skipped ?? 0}</strong>
        </div>

        <div>
          <span>Canciones procesadas</span>
          <strong>{syncResult.tracks_loaded ?? 0}</strong>
        </div>
      </div>
    )}
  </section>
)}

      {isPlaylistMode ? (
        <section className="discovery-card playlist-context-card">
          <p className="section-label">Resumen de esta playlist</p>
          <h2>{playlistDiscovery}</h2>
          <p>
            Este análisis no usa toda tu biblioteca, solo las canciones guardadas
            dentro de <strong>{currentScopeLabel}</strong>.
          </p>
        </section>
      ) : (
        <DiscoveryCard
          discovery={stats.daily_discovery}
          lastSync={stats.last_sync}
        />
      )}

      {isPlaylistMode ? (
  <section id="dashboard-summary" className="playlist-mode-summary-grid">
          <div className="playlist-mode-stat-card">
            <span>🎵</span>
            <p>Canciones en esta playlist</p>
            <strong>{stats.total_tracks}</strong>
          </div>

          <div className="playlist-mode-stat-card">
            <span>🎤</span>
            <p>Artistas únicos</p>
            <strong>{stats.total_artists}</strong>
          </div>

          <div className="playlist-mode-stat-card">
            <span>💿</span>
            <p>Álbumes únicos</p>
            <strong>{stats.total_albums}</strong>
          </div>

          <div className="playlist-mode-stat-card">
  <span>🔁</span>
  <p>Duplicadas detectadas</p>
  <strong>{repeatedSongsInPlaylist.length}</strong>
</div>
        </section>
      ) : (
  <div id="dashboard-summary">
    <StatsGrid
      totalTracks={stats.total_tracks}
      totalPlaylists={stats.total_playlists}
      totalArtists={stats.total_artists}
      totalAlbums={stats.total_albums}
    />
  </div>
)}

      <div id="musical-dna">
  <MusicalDNACard dna={stats.musical_dna} />
</div>

      {!isPlaylistMode && <SmartInsightsCard insights={stats.smart_insights} />}

      <DominantArtistCard
        artist={stats.dominant_artist}
        percentage={stats.dominant_artist_percentage}
      />

      {!isPlaylistMode && (
        <PlaylistInsightsCard
          largestPlaylist={stats.largest_playlist}
          smallestPlaylist={stats.smallest_playlist}
          totalTracks={stats.total_tracks}
        />
      )}

      {!isPlaylistMode && (
        <TopListCard
          label="Top playlists"
          title="Tus playlists más grandes"
          items={stats.top_playlists}
          unit="canciones"
        />
      )}

      <div id="top-artists">
  <TopListCard
    label="Top artistas"
    title={
      isPlaylistMode
        ? "Artistas más presentes en esta playlist"
        : "Tus artistas más presentes"
    }
    items={stats.top_artists}
    unit="canciones"
  />
</div>

<div id="top-songs">
  {isPlaylistMode ? (
    repeatedSongsInPlaylist.length > 0 ? (
      <TopListCard
        label="Duplicadas"
        title="Canciones duplicadas en esta playlist"
        items={repeatedSongsInPlaylist}
        unit="veces"
      />
    ) : (
      <section className="discovery-card">
        <p className="section-label">Duplicadas</p>
        <h2>No encontramos canciones duplicadas en esta playlist.</h2>
        <p>
          Todas las canciones de <strong>{currentScopeLabel}</strong> aparecen
          una sola vez.
        </p>
      </section>
    )
  ) : (
    <TopListCard
      label="Top canciones"
      title="Tus canciones más repetidas"
      items={stats.top_songs}
      unit="veces"
    />
  )}
</div>

      <div id="top-albums">
  <TopListCard
    label="Top álbumes"
    title={
      isPlaylistMode
        ? "Álbumes más presentes en esta playlist"
        : "Tus álbumes más presentes"
    }
    items={stats.top_albums}
    unit="canciones"
  />
</div>

{!isPlaylistMode && (
  <div id="duplicate-songs">
    <DuplicateSongsCard
      songs={stats.duplicate_songs}
      duplicatePercentage={stats.duplicate_percentage}
    />
  </div>
)}

    </div>
  );
}

export default Dashboard;