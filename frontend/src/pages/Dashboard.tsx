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

type TopListKey =
  | "top-playlists"
  | "top-artists"
  | "top-songs"
  | "top-albums";

type PlaylistContentFilter = "all" | "with-songs" | "empty";

const TOP_LIST_PREVIEW_LIMIT = 5;
const PLAYLIST_SEARCH_RESULT_LIMIT = 10;



function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingScope, setIsChangingScope] = useState(false);
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);
  const [isPlaylistSelectorOpen, setIsPlaylistSelectorOpen] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [playlistContentFilter, setPlaylistContentFilter] =
  useState<PlaylistContentFilter>("all");
  const [expandedTopLists, setExpandedTopLists] = useState<
  Record<TopListKey, boolean>
>({
  "top-playlists": false,
  "top-artists": false,
  "top-songs": false,
  "top-albums": false,
});

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

  const responseText = await response.text();

  let data: DashboardStats;

  try {
    data = JSON.parse(responseText);
  } catch {
    console.error("Respuesta inválida del dashboard:", responseText);
    throw new Error("No se pudo interpretar la respuesta del dashboard.");
  }

  if (!response.ok) {
    console.error("Error cargando dashboard:", {
      status: response.status,
      data,
    });

    throw new Error("No se pudo cargar el dashboard.");
  }

  setStats(data);
  setError(null);

  return data;
};


  const loadPlaylists = async (spotifyUserId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis-playlists?spotify_user_id=${encodeURIComponent(
          spotifyUserId
        )}`
      );

      if (response.status === 401) {
        console.warn(
          "No se pudieron cargar las playlists porque la sesión de Spotify expiró. Mostrando análisis guardado."
        );

        setNeedsReconnect(true);
        localStorage.removeItem("selected_playlist_id");
        setSelectedPlaylistId("");
        setPlaylists([]);

        return [] as PlaylistOption[];
      }


      if (!response.ok) {
        console.warn("No se pudieron cargar las playlists. Mostrando biblioteca.");

        localStorage.removeItem("selected_playlist_id");
        setSelectedPlaylistId("");
        setPlaylists([]);

        return [] as PlaylistOption[];
      }

      const data = await response.json();
      const playlistList = data.playlists || [];

      setNeedsReconnect(Boolean(data.needs_reconnect));
      setPlaylists(playlistList);

      return playlistList as PlaylistOption[];
    } catch (error) {
      console.error("Error cargando playlists:", error);

      setNeedsReconnect(true);
      localStorage.removeItem("selected_playlist_id");
      setSelectedPlaylistId("");
      setPlaylists([]);

      return [] as PlaylistOption[];
    }
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
  const updateStarted =
    localStorage.getItem("analysis_update_started") === "true";

  if (!spotifyUserId) {
    setError(null);
    setIsLoading(false);
    return;
  }

  let intervalId: number | undefined;
  let isMounted = true;

  const markUpdateCompleted = () => {
    if (updateStarted) {
      setShowUpdateSuccess(true);
      localStorage.removeItem("analysis_update_started");
    }
  };

  const loadCachedDashboardFirst = async () => {
    setError(null);

    let dashboardData = await loadDashboard(spotifyUserId, "");

    if (!isMounted) {
      return dashboardData;
    }

    let playlistList: PlaylistOption[] = [];

    try {
      playlistList = await loadPlaylists(spotifyUserId);
    } catch (playlistError) {
      console.error(
        "No se pudieron cargar las playlists, pero sí cargamos la biblioteca:",
        playlistError
      );

      localStorage.removeItem("selected_playlist_id");
      setSelectedPlaylistId("");

      return dashboardData;
    }

    const storedPlaylistId =
      localStorage.getItem("selected_playlist_id") || "";

    const validPlaylistId = resolveValidPlaylistId(
      storedPlaylistId,
      playlistList
    );

    setSelectedPlaylistId(validPlaylistId);

    if (!validPlaylistId) {
      return dashboardData;
    }

    try {
      const playlistDashboardData = await loadDashboard(
        spotifyUserId,
        validPlaylistId
      );

      return playlistDashboardData;
    } catch (playlistDashboardError) {
      console.error(
        "No se pudo cargar la playlist seleccionada, volviendo a biblioteca:",
        playlistDashboardError
      );

      localStorage.removeItem("selected_playlist_id");
      setSelectedPlaylistId("");

      dashboardData = await loadDashboard(spotifyUserId, "");
      return dashboardData;
    }
  };

  const checkUntilSyncFinishes = async () => {
    try {
      const statusData = await loadSyncStatus(spotifyUserId);

      if (statusData.status === "completed") {
        if (intervalId) {
          window.clearInterval(intervalId);
        }

        await loadCachedDashboardFirst();
        markUpdateCompleted();
        setIsLoading(false);
      }

      if (statusData.status === "error") {
        if (intervalId) {
          window.clearInterval(intervalId);
        }

        localStorage.removeItem("analysis_update_started");
        setSyncError(
          statusData.error ||
            "Ocurrió un error mientras sincronizábamos Spotify."
        );
        setSyncStatus("error");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error revisando sincronización:", error);
    }
  };

  const start = async () => {
    try {
      await loadCachedDashboardFirst();

      let statusData: {
        status: SyncStatus;
        error: string;
        result: SyncResult | null;
      } | null = null;

      try {
        statusData = await loadSyncStatus(spotifyUserId);
      } catch (statusError) {
        console.error(
          "No se pudo revisar el estado de sincronización, pero el dashboard ya cargó:",
          statusError
        );

        setSyncStatus("completed");
        setSyncError("");
      }

      if (statusData?.status === "completed") {
        markUpdateCompleted();
      }

      if (statusData?.status === "syncing") {
        if (updateStarted) {
          intervalId = window.setInterval(checkUntilSyncFinishes, 4000);
        } else {
          setSyncStatus("completed");
        }
      }

      if (statusData?.status === "error") {
        localStorage.removeItem("analysis_update_started");
        setSyncError(
          statusData.error ||
            "Ocurrió un error mientras sincronizábamos Spotify."
        );
          setSyncStatus("error");
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
    isMounted = false;

    if (intervalId) {
      window.clearInterval(intervalId);
    }
  };
}, []);



  const selectPlaylistForAnalysis = async (newPlaylistId: string) => {
    const spotifyUserId = getSpotifyUserId();

    setPlaylistSearch("");
    setPlaylistContentFilter("all");

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

  const handlePlaylistChange = async (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    await selectPlaylistForAnalysis(event.target.value);
  };

  const handlePlaylistSearchResultClick = async (playlistId: string) => {
    await selectPlaylistForAnalysis(playlistId);
  };

  const handleReturnToLibrary = async () => {
    const spotifyUserId = getSpotifyUserId();

    if (!spotifyUserId) {
      setError("No hay una cuenta de Spotify conectada.");
      return;
    }

    localStorage.removeItem("selected_playlist_id");
    setSelectedPlaylistId("");
    setPlaylistSearch("");
    setPlaylistContentFilter("all");


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
  };


  const selectedPlaylist = playlists.find(
    (playlist) => playlist.spotify_playlist_id === selectedPlaylistId
  );


  const playlistsWithSongs = playlists.filter(
    (playlist) => playlist.total_tracks > 0
  );

  const emptyPlaylists = playlists.filter(
    (playlist) => playlist.total_tracks === 0
  );

  const normalizePlaylistText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizedPlaylistSearch =
  normalizePlaylistText(playlistSearch);

const renderHighlightedPlaylistName = (playlistName: string) => {
  if (!normalizedPlaylistSearch) {
    return playlistName;
  }

  let normalizedName = "";
  const originalIndexMap: number[] = [];

  for (let index = 0; index < playlistName.length; ) {
    const codePoint = playlistName.codePointAt(index);

    if (codePoint === undefined) {
      break;
    }

    const character = String.fromCodePoint(codePoint);

    const normalizedCharacter = character
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    for (const normalizedPart of normalizedCharacter) {
      normalizedName += normalizedPart;
      originalIndexMap.push(index);
    }

    index += character.length;
  }

  const matchStart = normalizedName.indexOf(normalizedPlaylistSearch);

  if (matchStart === -1) {
    return playlistName;
  }

  const normalizedMatchEnd =
    matchStart + normalizedPlaylistSearch.length - 1;

  const originalStart = originalIndexMap[matchStart];
  const finalCharacterStart = originalIndexMap[normalizedMatchEnd];

  if (
    originalStart === undefined ||
    finalCharacterStart === undefined
  ) {
    return playlistName;
  }

  const finalCodePoint = playlistName.codePointAt(finalCharacterStart);

  if (finalCodePoint === undefined) {
    return playlistName;
  }

  const originalEnd =
    finalCharacterStart + String.fromCodePoint(finalCodePoint).length;

  return (
    <>
      {playlistName.slice(0, originalStart)}

      <mark className="playlist-search-highlight">
        {playlistName.slice(originalStart, originalEnd)}
      </mark>

      {playlistName.slice(originalEnd)}
    </>
  );
};



  const filteredPlaylistsWithSongs = playlistsWithSongs
  .filter((playlist) =>
    normalizePlaylistText(playlist.name).includes(
      normalizedPlaylistSearch
    )
  )
  .sort((firstPlaylist, secondPlaylist) =>
    firstPlaylist.name.localeCompare(secondPlaylist.name, "es", {
      sensitivity: "base",
    })
  );

const filteredEmptyPlaylists = emptyPlaylists
  .filter((playlist) =>
    normalizePlaylistText(playlist.name).includes(
      normalizedPlaylistSearch
    )
  )
  .sort((firstPlaylist, secondPlaylist) =>
    firstPlaylist.name.localeCompare(secondPlaylist.name, "es", {
      sensitivity: "base",
    })
  );

const visiblePlaylistsWithSongs =
  playlistContentFilter === "empty"
    ? []
    : filteredPlaylistsWithSongs;

const visibleEmptyPlaylists =
  playlistContentFilter === "with-songs"
    ? []
    : filteredEmptyPlaylists;

const hasVisiblePlaylistResults =
  visiblePlaylistsWithSongs.length > 0 ||
  visibleEmptyPlaylists.length > 0;


  const playlistSearchResults = [
  ...visiblePlaylistsWithSongs,
  ...visibleEmptyPlaylists,
];

  const visiblePlaylistSearchResults = playlistSearchResults.slice(
    0,
    PLAYLIST_SEARCH_RESULT_LIMIT
  );

  const remainingPlaylistSearchResults =
    playlistSearchResults.length - visiblePlaylistSearchResults.length;

  const renderPlaylistSearchResults = () => {

    if (!normalizedPlaylistSearch) {
      return null;
    }

    if (!hasVisiblePlaylistResults) {
  return (
    <div className="playlist-search-results">
      <p className="playlist-search-empty">
        No encontramos playlists con ese nombre.
      </p>
    </div>
  );
}

    return (
      <div
        className="playlist-search-results"
        aria-label="Resultados de búsqueda de playlists"
      >
        {visiblePlaylistSearchResults.map((playlist) => (
          <button
            key={playlist.spotify_playlist_id}
            type="button"
            className="playlist-search-result-button"
            onClick={() =>
              void handlePlaylistSearchResultClick(
                playlist.spotify_playlist_id
              )
            }
            disabled={isChangingScope}
          >
            <span className="playlist-search-result-name">
  {renderHighlightedPlaylistName(playlist.name)}
</span>

            <span className="playlist-search-result-count">
              {playlist.total_tracks === 0
                ? "Playlist vacía"
                : `${playlist.total_tracks} ${
                    playlist.total_tracks === 1
                      ? "canción"
                      : "canciones"
                  }`}
            </span>
          </button>
        ))}

        {remainingPlaylistSearchResults > 0 && (
          <p className="playlist-search-more">
            Hay {remainingPlaylistSearchResults} resultados más. Escribe un
            nombre más específico para reducir la lista.
          </p>
        )}
      </div>
    );
  };

  const currentScopeLabel = selectedPlaylist
    ? selectedPlaylist.name
    : "Toda mi biblioteca";

    const availablePlaylistCount =
  playlists.length > 0 ? playlists.length : stats?.total_playlists ?? 0;

  const isPlaylistMode = Boolean(selectedPlaylistId);

  const isEmptyPlaylist =
  isPlaylistMode && stats !== null && stats.total_tracks === 0;

  const playlistDiscovery = stats?.dominant_artist
    ? `${stats.dominant_artist.name} domina esta playlist: aparece ${stats.dominant_artist.count} veces, equivalente al ${stats.dominant_artist_percentage}% de las canciones analizadas.`
    : "Esta playlist ya fue analizada correctamente.";

  const repeatedSongsInPlaylist = stats
  ? stats.top_songs.filter((song) => song.count >= 2)
  : [];

  const formatLastSync = (value: string | null) => {
    if (!value) {
      return "Sin fecha registrada";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("es-NI", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };



const getVisibleTopItems = (items: TopItem[], key: TopListKey) => {
  if (expandedTopLists[key]) {
    return items;
  }

  return items.slice(0, TOP_LIST_PREVIEW_LIMIT);
};

const renderTopListToggle = (items: TopItem[], key: TopListKey) => {
  if (items.length <= TOP_LIST_PREVIEW_LIMIT) {
    return null;
  }

  const isExpanded = expandedTopLists[key];

  return (
    <button
      type="button"
      className="show-more-list-button"
      onClick={() =>
        setExpandedTopLists((currentState) => ({
          ...currentState,
          [key]: !currentState[key],
        }))
      }
    >
      {isExpanded
        ? "Ver menos"
        : `Ver más (${items.length - TOP_LIST_PREVIEW_LIMIT} más)`}
    </button>
  );
};

  const hasConnectedSpotifyUser = Boolean(getSpotifyUserId());

  if (!hasConnectedSpotifyUser) {
    return null;
  }


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

  if (error && (!stats || stats.total_tracks === 0)) {
    return (
      <div className="dashboard">
        <section className="discovery-card">
          <p className="section-label">Acción necesaria</p>
<h2>No pudimos mostrar tu análisis guardado.</h2>
<p>
  Intenta recargar la página. Si el problema continúa, presiona{" "}
  <strong>Actualizar análisis</strong> para sincronizar Spotify nuevamente.
</p>


<div className="dashboard-error-actions">
  <button
    type="button"
    className="secondary-button"
    onClick={() => window.location.reload()}
  >
    Reintentar carga
  </button>
</div>

          {syncError && (
  <details className="technical-error-details">
    <summary>Ver detalles técnicos</summary>
    <p>{syncError}</p>
  </details>
)}
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

  if (!stats || (!isPlaylistMode && stats.total_tracks === 0)) {
    return (
      <div className="dashboard">
        <section className="discovery-card">
          <p className="section-label">Análisis no disponible</p>
<h2>Todavía no hay datos musicales guardados.</h2>
<p>
  Presiona <strong>Actualizar análisis</strong> para sincronizar tu cuenta de
  Spotify por primera vez. Después, tus datos se cargarán automáticamente.
</p>
        </section>
      </div>
    );
  }

  if (isEmptyPlaylist) {
    return (
      <div className="dashboard">
        <section className="analysis-scope-card">
          <div>
            <p className="section-label">Modo playlist</p>

            <h2>Analizando: {currentScopeLabel}</h2>

            <p>
              Esta playlist está guardada en Spotify, pero todavía no contiene
              canciones.
            </p>

            <span className="playlist-count-label">
              0 canciones en esta playlist
            </span>
          </div>

          <div className="scope-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setIsPlaylistSelectorOpen((isOpen) => !isOpen)
              }
            >
              {isPlaylistSelectorOpen
                ? "Ocultar selector"
                : "Cambiar playlist"}
            </button>

            <button
              type="button"
              className="scope-reset-button"
              onClick={handleReturnToLibrary}
            >
              Ver toda mi biblioteca
            </button>

            {isPlaylistSelectorOpen && (
              
<div className="playlist-selector-wrapper">
  <label htmlFor="empty-playlist-selector">
    Seleccionar análisis
  </label>

    <div className="playlist-search-field">
    <input
      type="search"
      className="playlist-search-input"
      placeholder="Buscar playlist por nombre..."
      value={playlistSearch}
      onChange={(event) => setPlaylistSearch(event.target.value)}
      autoComplete="off"
    />

    {playlistSearch && (
      <button
        type="button"
        className="playlist-search-clear-button"
        onClick={() => setPlaylistSearch("")}
        aria-label="Limpiar búsqueda"
        title="Limpiar búsqueda"
      >
        ×
      </button>
    )}
  </div>


  <div className="playlist-filter-tabs">
  <button
    type="button"
    className={playlistContentFilter === "all" ? "active" : ""}
    onClick={() => setPlaylistContentFilter("all")}
  >
    Todas ({playlists.length})
  </button>

  <button
    type="button"
    className={
      playlistContentFilter === "with-songs" ? "active" : ""
    }
    onClick={() => setPlaylistContentFilter("with-songs")}
  >
    Con canciones ({playlistsWithSongs.length})
  </button>

  <button
    type="button"
    className={playlistContentFilter === "empty" ? "active" : ""}
    onClick={() => setPlaylistContentFilter("empty")}
  >
    Vacías ({emptyPlaylists.length})
  </button>
</div>

  {renderPlaylistSearchResults()}

  <select
    id="empty-playlist-selector"
    value={selectedPlaylistId}
    onChange={handlePlaylistChange}
    disabled={isChangingScope}
  >
    <option value="">Toda mi biblioteca</option>

    {visiblePlaylistsWithSongs.length > 0 && (
  <optgroup
    label={`Con canciones (${visiblePlaylistsWithSongs.length})`}
  >
    {visiblePlaylistsWithSongs.map((playlist) => (
      <option
        key={playlist.spotify_playlist_id}
        value={playlist.spotify_playlist_id}
      >
        {playlist.name} — {playlist.total_tracks} canciones
      </option>
    ))}
  </optgroup>
)}

{visibleEmptyPlaylists.length > 0 && (
  <optgroup
    label={`Vacías (${visibleEmptyPlaylists.length})`}
  >
    {visibleEmptyPlaylists.map((playlist) => (
      <option
        key={playlist.spotify_playlist_id}
        value={playlist.spotify_playlist_id}
      >
        {playlist.name} — 0 canciones
      </option>
    ))}
  </optgroup>
)}
  </select>

  {isChangingScope && <span>Cambiando análisis...</span>}
          </div>
        )}
      </div>
    </section>

        <section className="discovery-card empty-playlist-card">
          <p className="section-label">Playlist vacía</p>

          <h2>{currentScopeLabel} todavía no tiene canciones.</h2>

          <p>
            Esta playlist seguirá disponible en tu biblioteca. Agrega canciones
            desde Spotify y luego presiona{" "}
            <strong>Actualizar desde Spotify</strong> para analizarla.
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
            {availablePlaylistCount} playlists encontradas en Spotify
          </span>

            {!isPlaylistMode && playlists.length > 0 && (
              <div className="playlist-library-breakdown">
                <span>
                  <strong>{playlistsWithSongs.length}</strong> con canciones
                </span>

                <span>
                  <strong>{emptyPlaylists.length}</strong> vacías
                </span>
              </div>
            )}
              
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
              onClick={handleReturnToLibrary}
            >
              Ver toda mi biblioteca
            </button>
          )}

          {isPlaylistSelectorOpen && (
            <div className="playlist-selector-wrapper">
              <label htmlFor="playlist-selector">Seleccionar análisis</label>

              <div className="playlist-search-field">
                <input
                  type="search"
                  className="playlist-search-input"
                  placeholder="Buscar playlist por nombre..."
                  value={playlistSearch}
                  onChange={(event) => setPlaylistSearch(event.target.value)}
                  autoComplete="off"
                />

                {playlistSearch && (
                  <button
                    type="button"
                    className="playlist-search-clear-button"
                    onClick={() => setPlaylistSearch("")}
                    aria-label="Limpiar búsqueda"
                    title="Limpiar búsqueda"
                  >
                    ×
                  </button>
                )}
              </div>

                <div className="playlist-filter-tabs">
  <button
    type="button"
    className={playlistContentFilter === "all" ? "active" : ""}
    onClick={() => setPlaylistContentFilter("all")}
  >
    Todas ({playlists.length})
  </button>

  <button
    type="button"
    className={
      playlistContentFilter === "with-songs" ? "active" : ""
    }
    onClick={() => setPlaylistContentFilter("with-songs")}
  >
    Con canciones ({playlistsWithSongs.length})
  </button>

  <button
    type="button"
    className={playlistContentFilter === "empty" ? "active" : ""}
    onClick={() => setPlaylistContentFilter("empty")}
  >
    Vacías ({emptyPlaylists.length})
  </button>
</div>


              {renderPlaylistSearchResults()}

              <select
  id="playlist-selector"
  value={selectedPlaylistId}
  onChange={handlePlaylistChange}
  disabled={isChangingScope}
>
  <option value="">Toda mi biblioteca</option>

  {visiblePlaylistsWithSongs.length > 0 && (
  <optgroup
    label={`Con canciones (${visiblePlaylistsWithSongs.length})`}
  >
    {visiblePlaylistsWithSongs.map((playlist) => (
      <option
        key={playlist.spotify_playlist_id}
        value={playlist.spotify_playlist_id}
      >
        {playlist.name} — {playlist.total_tracks} canciones
      </option>
    ))}
  </optgroup>
)}

{visibleEmptyPlaylists.length > 0 && (
  <optgroup
    label={`Vacías (${visibleEmptyPlaylists.length})`}
  >
    {visibleEmptyPlaylists.map((playlist) => (
      <option
        key={playlist.spotify_playlist_id}
        value={playlist.spotify_playlist_id}
      >
        {playlist.name} — 0 canciones
      </option>
    ))}
  </optgroup>
)}

</select>

              {isChangingScope && <span>Cambiando análisis...</span>}
            </div>
          )}
        </div>
      </section>

{syncStatus !== "syncing" && (
  <section className="discovery-card cached-data-card cached-data-card-compact">
    <div>
      <p className="section-label">Datos guardados</p>
      <h2>Análisis listo para consultar</h2>
    </div>

    <div className="cached-data-meta">
      <span>Última sincronización</span>
      <strong>{formatLastSync(stats.last_sync)}</strong>
    </div>
  </section>
)}

{needsReconnect && syncStatus !== "syncing" && (
    <section className="discovery-card reconnect-warning-card">
      <p className="section-label">Reconexión recomendada</p>

      <h2>Tu análisis guardado está disponible.</h2>

      <p>
        Puedes seguir viendo tus datos guardados. Para sincronizar cambios nuevos
        de Spotify, vuelve a conectar tu cuenta usando <strong>Cambiar cuenta</strong>.
      </p>
    </section>
  )}

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


{!isPlaylistMode && <a href="#top-playlists">Top playlists</a>}

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
  <div id="top-playlists">
    <TopListCard
      label="Top playlists"
      title="Tus playlists más grandes"
      items={getVisibleTopItems(stats.top_playlists, "top-playlists")}
      unit="canciones"
    />

    {renderTopListToggle(stats.top_playlists, "top-playlists")}
  </div>
)}

      <div id="top-artists">
  <TopListCard
    label="Top artistas"
    title={
      isPlaylistMode
        ? "Artistas más presentes en esta playlist"
        : "Tus artistas más presentes"
    }
    items={getVisibleTopItems(stats.top_artists, "top-artists")}
    unit="canciones"
  />

{renderTopListToggle(stats.top_artists, "top-artists")}


</div>

<div id="top-songs">
  {isPlaylistMode ? (
    repeatedSongsInPlaylist.length > 0 ? (
      <>
        <TopListCard
          label="Duplicadas"
          title="Canciones duplicadas en esta playlist"
          items={getVisibleTopItems(repeatedSongsInPlaylist, "top-songs")}
          unit="veces"
        />

        {renderTopListToggle(repeatedSongsInPlaylist, "top-songs")}
      </>
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
    <>
      <TopListCard
        label="Top canciones"
        title="Tus canciones más repetidas"
        items={getVisibleTopItems(stats.top_songs, "top-songs")}
        unit="veces"
      />

      {renderTopListToggle(stats.top_songs, "top-songs")}
    </>
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
    items={getVisibleTopItems(stats.top_albums, "top-albums")}
    unit="canciones"
  />

{renderTopListToggle(stats.top_albums, "top-albums")}

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
