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
const LIKED_SONGS_COLLECTION_ID = "__spotify_liked_songs__";

type SyncStatus = "idle" | "syncing" | "completed" | "error";

type SyncResult = {
  message?: string;
  tracks_loaded?: number;
  playlists_loaded?: number;
  playlists_updated?: number;
  playlists_skipped?: number;
  liked_songs_loaded?: number;
};

type TopItem = {
  name: string;
  count: number;
  rank?: number;
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
  collection_type?: "liked_songs";
  is_special_collection?: boolean;
};

type DashboardStats = {
  spotify_user_id: string;
  spotify_playlist_id: string | null;
  analysis_scope_type: "all_playlists" | "playlist" | "liked_songs";
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
  const [likedSongsCollection, setLikedSongsCollection] =
    useState<PlaylistOption | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
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
  const [topListSearches, setTopListSearches] = useState<
    Record<TopListKey, string>
  >({
    "top-playlists": "",
    "top-artists": "",
    "top-songs": "",
    "top-albums": "",
  });

  const getSessionToken = () => {
    return localStorage.getItem("session_token");
  };

  const getSessionHeaders = () => {
    const sessionToken = getSessionToken();

    if (!sessionToken) {
      throw new Error("No hay una sesión válida.");
    }

    return {
      Authorization: `Bearer ${sessionToken}`,
    };
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

  const loadDashboard = async (playlistId?: string) => {
  const playlistQuery = playlistId
    ? `?playlist_id=${encodeURIComponent(playlistId)}`
    : "";

  const response = await fetch(
    `${API_BASE_URL}/dashboard${playlistQuery}`,
    {
      headers: getSessionHeaders(),
    }
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


  const loadPlaylists = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analysis-playlists`, {
        headers: getSessionHeaders(),
      });

      if (response.status === 401) {
        console.warn(
          "No se pudieron cargar las playlists porque la sesión de Spotify expiró. Mostrando análisis guardado."
        );

        setNeedsReconnect(true);
        localStorage.removeItem("selected_playlist_id");
        setSelectedPlaylistId("");
        setPlaylists([]);
        setLikedSongsCollection(null);

        return [] as PlaylistOption[];
      }


      if (!response.ok) {
        console.warn("No se pudieron cargar las playlists. Mostrando biblioteca.");
        setNeedsReconnect(false);

        localStorage.removeItem("selected_playlist_id");
        setSelectedPlaylistId("");
        setPlaylists([]);
        setLikedSongsCollection(null);

        return [] as PlaylistOption[];
      }

      const data = await response.json();
      const playlistList = (data.playlists || []) as PlaylistOption[];
      const likedSongs = (data.liked_songs || null) as PlaylistOption | null;

      setNeedsReconnect(Boolean(data.needs_reconnect));
      setPlaylists(playlistList);
      setLikedSongsCollection(likedSongs);

      return likedSongs
        ? [likedSongs, ...playlistList]
        : playlistList;
    } catch (error) {
      console.error("Error cargando playlists:", error);

      setNeedsReconnect(false);

      if (!navigator.onLine || error instanceof TypeError) {
        setIsOnline(false);
      }
      localStorage.removeItem("selected_playlist_id");
      setSelectedPlaylistId("");
      setPlaylists([]);
      setLikedSongsCollection(null);

      return [] as PlaylistOption[];
    }
  };

const loadSyncStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/sync-status`, {
    headers: getSessionHeaders(),
  });

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
    const sessionToken = getSessionToken();
    const updateStarted =
      localStorage.getItem("analysis_update_started") === "true";

    if (!sessionToken) {
      setError("No hay una sesión válida.");
      setIsLoading(false);
      return;
    }

    let pollTimeoutId: number | undefined;
    let isMounted = true;
    let syncCheckInFlight = false;
    let consecutiveStatusErrors = 0;

    const markUpdateCompleted = () => {
      if (updateStarted) {
        setShowUpdateSuccess(true);
        localStorage.removeItem("analysis_update_started");
      }
    };

    const loadCachedDashboardFirst = async () => {
      setError(null);

      let dashboardData = await loadDashboard("");

      if (!isMounted) {
        return dashboardData;
      }

      let playlistList: PlaylistOption[] = [];

      try {
        playlistList = await loadPlaylists();
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
        const playlistDashboardData = await loadDashboard(validPlaylistId);
        return playlistDashboardData;
      } catch (playlistDashboardError) {
        console.error(
          "No se pudo cargar la playlist seleccionada, volviendo a biblioteca:",
          playlistDashboardError
        );

        localStorage.removeItem("selected_playlist_id");
        setSelectedPlaylistId("");

        dashboardData = await loadDashboard("");
        return dashboardData;
      }
    };

    const scheduleNextSyncCheck = (
      callback: () => void,
      delay = 4000
    ) => {
      if (!isMounted) {
        return;
      }

      if (pollTimeoutId) {
        window.clearTimeout(pollTimeoutId);
      }

      pollTimeoutId = window.setTimeout(callback, delay);
    };

    const checkUntilSyncFinishes = async () => {
      if (!isMounted || syncCheckInFlight) {
        return;
      }

      syncCheckInFlight = true;
      let shouldContinuePolling = false;

      try {
        const statusData = await loadSyncStatus();
        consecutiveStatusErrors = 0;

        if (!isMounted) {
          return;
        }

        if (statusData.status === "completed") {
          await loadCachedDashboardFirst();
          markUpdateCompleted();
          setIsLoading(false);
        } else if (statusData.status === "error") {
          localStorage.removeItem("analysis_update_started");
          setSyncError(
            statusData.error ||
              "No pudimos completar la actualización. Tus datos guardados siguen disponibles."
          );
          setSyncStatus("error");
          setIsLoading(false);
        } else if (statusData.status === "syncing") {
          setIsLoading(false);
          shouldContinuePolling = true;
        } else {
          setIsLoading(false);
        }
      } catch (statusError) {
        console.error("Error revisando sincronización:", statusError);
        consecutiveStatusErrors += 1;
        shouldContinuePolling = true;

        if (consecutiveStatusErrors >= 3 && isMounted) {
          setIsLoading(false);
          setSyncError(
            "No pudimos comprobar el estado de la actualización. Tus datos guardados siguen disponibles."
          );
        }
      } finally {
        syncCheckInFlight = false;

        if (shouldContinuePolling && isMounted) {
          scheduleNextSyncCheck(
            () => void checkUntilSyncFinishes(),
            4000
          );
        }
      }
    };

    const start = async () => {
      try {
        const dashboardData = await loadCachedDashboardFirst();

        let statusData: {
          status: SyncStatus;
          error: string;
          result: SyncResult | null;
        } | null = null;

        try {
          statusData = await loadSyncStatus();
        } catch (statusError) {
          console.error(
            "No se pudo revisar el estado de sincronización, pero el dashboard ya cargó:",
            statusError
          );

          if (dashboardData?.total_tracks > 0) {
            setIsLoading(false);
          }

          scheduleNextSyncCheck(
            () => void checkUntilSyncFinishes(),
            4000
          );
          return;
        }

        if (statusData.status === "completed") {
          if (updateStarted) {
            await loadCachedDashboardFirst();
          }

          markUpdateCompleted();
          setIsLoading(false);
          return;
        }

        if (statusData.status === "syncing") {
          setIsLoading(false);
          scheduleNextSyncCheck(
            () => void checkUntilSyncFinishes(),
            4000
          );
          return;
        }

        if (statusData.status === "error") {
          localStorage.removeItem("analysis_update_started");
          setSyncError(
            statusData.error ||
              "No pudimos completar la actualización. Tus datos guardados siguen disponibles."
          );
          setSyncStatus("error");
        }

        setIsLoading(false);
      } catch (initialError) {
        console.error("Error inicial cargando dashboard:", initialError);
        setError("No se pudo cargar tu análisis musical.");
        setIsLoading(false);
      }
    };

    void start();

    return () => {
      isMounted = false;

      if (pollTimeoutId) {
        window.clearTimeout(pollTimeoutId);
      }
    };
  }, []);

useEffect(() => {
  let isCancelled = false;
  let isCheckingConnection = false;

  const verifyConnection = async () => {
    if (!navigator.onLine) {
      if (!isCancelled) {
        setIsOnline(false);
      }

      return;
    }

    if (isCheckingConnection) {
      return;
    }

    isCheckingConnection = true;

    try {
      await fetch(`${API_BASE_URL}/health?timestamp=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!isCancelled) {
        setIsOnline(true);
      }
    } catch (error) {
      console.warn("No se pudo verificar la conexión:", error);

      if (!isCancelled) {
        setIsOnline(false);
      }
    } finally {
      isCheckingConnection = false;
    }
  };

  const handleOnline = () => {
    void verifyConnection();
  };

  const handleOffline = () => {
    setIsOnline(false);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void verifyConnection();
    }
  };

  const handleWindowFocus = () => {
    void verifyConnection();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  window.addEventListener("focus", handleWindowFocus);

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  void verifyConnection();

  const connectionInterval = window.setInterval(() => {
    void verifyConnection();
  }, 10000);

  return () => {
    isCancelled = true;

    window.clearInterval(connectionInterval);

    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("focus", handleWindowFocus);

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
  };
}, []);



  const selectPlaylistForAnalysis = async (newPlaylistId: string) => {
    const sessionToken = getSessionToken();

    setPlaylistSearch("");
    setPlaylistContentFilter("all");
    setExpandedTopLists({
      "top-playlists": false,
      "top-artists": false,
      "top-songs": false,
      "top-albums": false,
    });
    setTopListSearches({
      "top-playlists": "",
      "top-artists": "",
      "top-songs": "",
      "top-albums": "",
    });

    if (!sessionToken) {
      setError("No hay una sesión válida de Spotify.");
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
      await loadDashboard(newPlaylistId)
      setIsPlaylistSelectorOpen(false);
    } catch (error) {
      console.error("Error cambiando análisis:", error);

      if (!navigator.onLine || error instanceof TypeError) {
        setIsOnline(false);
      }

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
    const sessionToken = getSessionToken();

    if (!sessionToken) {
      setError("No hay una sesión válida de Spotify.");
      return;
    }

    localStorage.removeItem("selected_playlist_id");
    setSelectedPlaylistId("");
    setPlaylistSearch("");
    setPlaylistContentFilter("all");
    setExpandedTopLists({
      "top-playlists": false,
      "top-artists": false,
      "top-songs": false,
      "top-albums": false,
    });
    setTopListSearches({
      "top-playlists": "",
      "top-artists": "",
      "top-songs": "",
      "top-albums": "",
    });

    try {
      setIsChangingScope(true);
      await loadDashboard("")
      setIsPlaylistSelectorOpen(false);
    } catch (error) {
      console.error("Error volviendo a biblioteca completa:", error);

      if (!navigator.onLine || error instanceof TypeError) {
  setIsOnline(false);
}

      setError("No se pudo volver al análisis general.");
    } finally {
      setIsChangingScope(false);
    }
  };


  const selectedPlaylist =
    selectedPlaylistId === LIKED_SONGS_COLLECTION_ID
      ? likedSongsCollection
      : playlists.find(
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
    : "Todas mis playlists";

  const availablePlaylistCount =
    playlists.length > 0 ? playlists.length : stats?.total_playlists ?? 0;

  const isPlaylistMode = Boolean(selectedPlaylistId);
  const isLikedSongsMode =
    selectedPlaylistId === LIKED_SONGS_COLLECTION_ID ||
    stats?.analysis_scope_type === "liked_songs";

  const hasLikedSongs = (likedSongsCollection?.total_tracks ?? 0) > 0;

  const isEmptyPlaylist =
    isPlaylistMode && stats !== null && stats.total_tracks === 0;

  const playlistDiscovery = stats?.dominant_artist
    ? isLikedSongsMode
      ? `${stats.dominant_artist.name} es el artista con más canciones guardadas en Me gusta: tiene ${stats.dominant_artist.count} apariciones, equivalentes al ${stats.dominant_artist_percentage}% de esta colección.`
      : `${stats.dominant_artist.name} es el artista que más aparece en esta playlist: tiene ${stats.dominant_artist.count} apariciones, equivalentes al ${stats.dominant_artist_percentage}% de sus canciones.`
    : isLikedSongsMode
      ? "Tu colección de Canciones que te gustan ya fue analizada correctamente."
      : "Esta playlist ya fue analizada correctamente.";

  const repeatedSongsInPlaylist =
    stats && !isLikedSongsMode
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



const getTopListSearchPlaceholder = (key: TopListKey) => {
  const placeholders: Record<TopListKey, string> = {
    "top-playlists": "Buscar una playlist en el ranking...",
    "top-artists": "Buscar un artista en el ranking...",
    "top-songs": "Buscar una canción en el ranking...",
    "top-albums": "Buscar un álbum en el ranking...",
  };

  return placeholders[key];
};

const getFilteredTopItems = (items: TopItem[], key: TopListKey) => {
  const rankedItems = items.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  if (!expandedTopLists[key]) {
    return rankedItems.slice(0, TOP_LIST_PREVIEW_LIMIT);
  }

  const normalizedSearch = topListSearches[key]
    .trim()
    .toLocaleLowerCase("es");

  if (!normalizedSearch) {
    return rankedItems;
  }

  return rankedItems.filter((item) =>
    item.name.toLocaleLowerCase("es").includes(normalizedSearch)
  );
};

const renderTopListExplorer = (items: TopItem[], key: TopListKey) => {
  if (items.length <= TOP_LIST_PREVIEW_LIMIT) {
    return null;
  }

  const isExpanded = expandedTopLists[key];
  const filteredItems = getFilteredTopItems(items, key);
  const normalizedSearch = topListSearches[key].trim();

  const toggleExpanded = () => {
    setExpandedTopLists((currentState) => ({
      ...currentState,
      [key]: !currentState[key],
    }));

    if (isExpanded) {
      setTopListSearches((currentState) => ({
        ...currentState,
        [key]: "",
      }));
    }
  };

  return (
    <div className="top-list-explorer-controls">
      {isExpanded && (
        <div className="ranking-explorer">
          <label className="ranking-search-field">
            <span className="sr-only">Buscar dentro del ranking</span>
            <input
              type="search"
              value={topListSearches[key]}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setTopListSearches((currentState) => ({
                  ...currentState,
                  [key]: event.target.value,
                }))
              }
              placeholder={getTopListSearchPlaceholder(key)}
            />
          </label>

          <p className="ranking-result-summary">
            {normalizedSearch
              ? `${filteredItems.length} de ${items.length} resultados`
              : `${items.length} resultados disponibles`}
          </p>
        </div>
      )}

      <button
        type="button"
        className="show-more-list-button"
        onClick={toggleExpanded}
      >
        {isExpanded
          ? "Ver menos"
          : `Ver más (${items.length - TOP_LIST_PREVIEW_LIMIT} más)`}
      </button>
    </div>
  );
};

  const hasValidSession = Boolean(getSessionToken());

  if (!hasValidSession) {
    return null;
  }


  if (isLoading) {
    return (
      <div id="dashboard-overview" className="dashboard">
        <section className="discovery-card loading-card">
          <p className="section-label">Cargando...</p>
          <h2>Preparando el análisis de tus playlists...</h2>
          <p>Estamos revisando tu conexión con Spotify.</p>
          <div className="loading-pulse" />
        </section>
      </div>
    );
  }

  if (error && (!stats || stats.total_tracks === 0)) {
  return (
    <div id="dashboard-overview" className="dashboard">
      <section className="discovery-card dashboard-error-card">
        <p className="section-label">Acción necesaria</p>

        <h2>
          {isOnline
            ? "No pudimos mostrar tu análisis guardado."
            : "No tienes conexión a internet."}
        </h2>

        <p>
          {isOnline
            ? "Intenta cargar nuevamente tus datos guardados. Solo necesitas sincronizar cambios de Spotify si el problema continúa."
            : "Comprueba tu conexión. Cuando vuelvas a tener internet, presiona Reintentar carga."}
        </p>

        <div className="dashboard-error-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.location.reload()}
            disabled={!isOnline}
          >
            {isOnline ? "Reintentar carga" : "Esperando conexión..."}
          </button>
        </div>
      </section>
    </div>
  );
}

  if (syncStatus === "syncing" && (!stats || stats.total_tracks === 0)) {
    return (
      <div id="dashboard-overview" className="dashboard">
        <section className="discovery-card loading-card">
          <p className="section-label">Sincronizando Spotify</p>
          <h2>Estamos preparando el análisis de tus playlists...</h2>
          <p>
            La primera sincronización puede tardar un poco si tienes muchas
            playlists. Cuando termine, el dashboard se actualizará solo.
          </p>
          <div className="loading-pulse" />
        </section>
      </div>
    );
  }

  if (
    !stats ||
    (!isPlaylistMode && stats.total_tracks === 0 && !hasLikedSongs)
  ) {
    return (
      <div id="dashboard-overview" className="dashboard">
        <section className="discovery-card">
          <p className="section-label">Análisis no disponible</p>
<h2>Todavía no hay datos musicales guardados.</h2>
<p>
  Usa <strong>Sincronizar cambios de Spotify</strong> para volver a iniciar la
  sincronización. Después, tus datos se cargarán automáticamente.
</p>
        </section>
      </div>
    );
  }

  if (isEmptyPlaylist) {
    return (
      <div id="dashboard-overview" className="dashboard">
        <section className="analysis-scope-card">
          <div>
            <p className="section-label">
              {isLikedSongsMode ? "Colección personal" : "Modo playlist"}
            </p>

            <h2>Analizando: {currentScopeLabel}</h2>

            <p>
              {isLikedSongsMode
                ? "Todavía no tienes canciones guardadas con Me gusta en Spotify."
                : "Esta playlist está guardada en Spotify, pero todavía no contiene canciones."}
            </p>

            <span className="playlist-count-label">
              0 canciones en este análisis
            </span>

            <p className="scope-change-hint">
              Puedes elegir otro análisis sin sincronizar nuevamente con Spotify.
            </p>
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
                : "Elegir otro análisis"}
            </button>

            <button
              type="button"
              className="scope-reset-button"
              onClick={handleReturnToLibrary}
            >
              Analizar todas mis playlists
            </button>

            {isPlaylistSelectorOpen && (
              
<div className="playlist-selector-wrapper">
  <label htmlFor="empty-playlist-selector">
    Seleccionar análisis
  </label>

  {likedSongsCollection && (
    <button
      type="button"
      className={`liked-songs-selector-card ${
        selectedPlaylistId === LIKED_SONGS_COLLECTION_ID ? "active" : ""
      }`}
      onClick={() =>
        void selectPlaylistForAnalysis(LIKED_SONGS_COLLECTION_ID)
      }
      disabled={isChangingScope}
    >
      <span className="liked-songs-selector-icon" aria-hidden="true">
        ❤️
      </span>

      <span className="liked-songs-selector-copy">
        <strong>Canciones que te gustan</strong>
        <small>Colección personal de Spotify</small>
      </span>

      <span className="liked-songs-selector-count">
        {likedSongsCollection.total_tracks} canciones
      </span>
    </button>
  )}

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
    <option value="">Todas mis playlists</option>

    {likedSongsCollection && (
      <optgroup label="Colección personal">
        <option value={LIKED_SONGS_COLLECTION_ID}>
          ❤️ Canciones que te gustan — {likedSongsCollection.total_tracks} canciones
        </option>
      </optgroup>
    )}

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
          <p className="section-label">
            {isLikedSongsMode ? "Colección vacía" : "Playlist vacía"}
          </p>

          <h2>{currentScopeLabel} todavía no tiene canciones.</h2>

          <p>
            {isLikedSongsMode
              ? "Marca canciones con Me gusta desde Spotify y luego presiona "
              : "Esta playlist seguirá disponible entre tus playlists. Agrega canciones desde Spotify y luego presiona "}
            <strong>Sincronizar cambios de Spotify</strong> para analizarla.
          </p>
        </section>
      </div>
    );
  }



  return (
    <div id="dashboard-overview" className="dashboard">
      <section className="analysis-scope-card analysis-scope-card-visual">
        <div className="analysis-visual-summary">
          <div className="analysis-visual-icon" aria-hidden="true">
            {isLikedSongsMode ? "❤️" : isPlaylistMode ? "🎧" : "📚"}
          </div>

          <div className="analysis-visual-copy">
            <p className="section-label">
              {isLikedSongsMode
                ? "Colección personal"
                : isPlaylistMode
                  ? "Playlist individual"
                  : "Análisis general"}
            </p>

            <h2>{currentScopeLabel}</h2>

            <p className="analysis-visual-description">
              {isLikedSongsMode
                ? "Análisis independiente de las canciones que guardaste con Me gusta en Spotify."
                : isPlaylistMode
                  ? "Resultados calculados únicamente con las canciones de esta playlist."
                  : "Una vista conjunta de las canciones guardadas en todas tus playlists de Spotify."}
            </p>

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
        </div>

        <div className="analysis-visual-metrics" aria-label="Resumen del análisis actual">
          <div className="analysis-visual-metric analysis-visual-metric-primary">
            <span>{isPlaylistMode ? "Canciones" : "Playlists"}</span>
            <strong>
              {isPlaylistMode ? stats.total_tracks : availablePlaylistCount}
            </strong>
          </div>

          <div className="analysis-visual-metric">
            <span>Última sincronización</span>
            <strong>{formatLastSync(stats.last_sync)}</strong>
          </div>
        </div>

        <div className="analysis-visual-footer">
          <p className="analysis-quick-note">
            <span aria-hidden="true">⚡</span>{" "}
            {isLikedSongsMode
              ? "Esta colección se actualiza al sincronizar cambios de Spotify."
              : "Cambiar de análisis usa los datos guardados y es inmediato."}
          </p>

          <div className="analysis-visual-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsPlaylistSelectorOpen((isOpen) => !isOpen)}
            >
              {isPlaylistSelectorOpen ? "Ocultar selector" : "Elegir otro análisis"}
            </button>

            {selectedPlaylistId && (
              <button
                type="button"
                className="scope-reset-button"
                onClick={handleReturnToLibrary}
              >
                Analizar todas mis playlists
              </button>
            )}
          </div>
        </div>

        {isPlaylistSelectorOpen && (
          <div className="playlist-selector-wrapper analysis-visual-selector">
            <label htmlFor="playlist-selector">Seleccionar análisis</label>

            {likedSongsCollection && (
              <button
                type="button"
                className={`liked-songs-selector-card ${
                  selectedPlaylistId === LIKED_SONGS_COLLECTION_ID
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  void selectPlaylistForAnalysis(LIKED_SONGS_COLLECTION_ID)
                }
                disabled={isChangingScope}
              >
                <span className="liked-songs-selector-icon" aria-hidden="true">
                  ❤️
                </span>

                <span className="liked-songs-selector-copy">
                  <strong>Canciones que te gustan</strong>
                  <small>Colección personal de Spotify</small>
                </span>

                <span className="liked-songs-selector-count">
                  {likedSongsCollection.total_tracks} canciones
                </span>
              </button>
            )}

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
              <option value="">Todas mis playlists</option>

              {likedSongsCollection && (
                <optgroup label="Colección personal">
                  <option value={LIKED_SONGS_COLLECTION_ID}>
                    ❤️ Canciones que te gustan — {likedSongsCollection.total_tracks}{" "}
                    canciones
                  </option>
                </optgroup>
              )}

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
                <optgroup label={`Vacías (${visibleEmptyPlaylists.length})`}>
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
      </section>

      {!isOnline && (
  <section className="discovery-card offline-warning-card">
    <p className="section-label">Sin conexión</p>

    <h2>Estás viendo los datos que ya estaban cargados.</h2>

    <p>
      Algunas funciones, como cambiar de playlist o sincronizar cambios con Spotify,
      estarán disponibles cuando regrese tu conexión.
    </p>
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

      {syncStatus === "error" && (
        <section className="discovery-card dashboard-error-card">
          <p className="section-label">Actualización interrumpida</p>
          <h2>Tus datos guardados siguen disponibles.</h2>
          <p>
            {syncError ||
              "No pudimos completar la actualización. Intenta nuevamente más tarde."}
          </p>
        </section>
      )}

      <nav className="dashboard-section-nav">
  <a href="#dashboard-summary">Resumen</a>
  <a href="#musical-dna">ADN Musical</a>

  {!isPlaylistMode && (
    <a href="#smart-insights">Insights inteligentes</a>
  )}

{!isPlaylistMode && <a href="#top-playlists">Top playlists</a>}

 <a href="#top-artists">Top artistas</a>
  <a href="#top-songs">
    {isLikedSongsMode ? "Canciones guardadas" : "Top canciones"}
  </a>
  <a href="#top-albums">Top álbumes</a>

  {!isPlaylistMode && <a href="#duplicate-songs">Duplicadas</a>}
</nav>

      {showUpdateSuccess && syncStatus === "completed" && (
  <section className="discovery-card sync-result-card">
    <p className="section-label">Análisis actualizado</p>
    <h2>El análisis de tus playlists se actualizó correctamente.</h2>
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
          <p className="section-label">
            {isLikedSongsMode
              ? "Resumen de Canciones que te gustan"
              : "Resumen de esta playlist"}
          </p>
          <h2>{playlistDiscovery}</h2>
          <p>
            {isLikedSongsMode
              ? "Este análisis usa únicamente las canciones que guardaste con Me gusta en Spotify."
              : <>
                  Este análisis usa únicamente las canciones guardadas dentro de{" "}
                  <strong>{currentScopeLabel}</strong>. No representa tu historial de
                  reproducción.
                </>}
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
            <p>
              {isLikedSongsMode
                ? "Canciones guardadas con Me gusta"
                : "Canciones en esta playlist"}
            </p>
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
            <span>{isLikedSongsMode ? "🧬" : "🔁"}</span>
            <p>{isLikedSongsMode ? "Diversidad musical" : "Duplicadas detectadas"}</p>
            <strong>
              {isLikedSongsMode
                ? `${stats.musical_dna.diversity_score}%`
                : repeatedSongsInPlaylist.length}
            </strong>
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
  <MusicalDNACard
    dna={stats.musical_dna}
    isLikedSongsMode={isLikedSongsMode}
    totalTracks={stats.total_tracks}
  />
</div>

      {!isPlaylistMode && (
        <div id="smart-insights">
          <SmartInsightsCard insights={stats.smart_insights} />
        </div>
      )}

      <DominantArtistCard
        artist={stats.dominant_artist}
        percentage={stats.dominant_artist_percentage}
        isPlaylistMode={isPlaylistMode}
        contextLabel={
          isLikedSongsMode
            ? "en tus Canciones que te gustan"
            : undefined
        }
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
      items={getFilteredTopItems(stats.top_playlists, "top-playlists")}
      unit="canciones"
      referenceMaxCount={stats.top_playlists[0]?.count}
    />

    {renderTopListExplorer(stats.top_playlists, "top-playlists")}
  </div>
)}

      <div id="top-artists">
  <TopListCard
    label="Top artistas"
    title={
      isLikedSongsMode
        ? "Artistas con más canciones guardadas en Me gusta"
        : isPlaylistMode
          ? "Artistas que más aparecen en esta playlist"
          : "Artistas que más aparecen en tus playlists"
    }
    items={getFilteredTopItems(stats.top_artists, "top-artists")}
    unit="canciones"
    referenceMaxCount={stats.top_artists[0]?.count}
  />

{renderTopListExplorer(stats.top_artists, "top-artists")}


</div>

<div id="top-songs">
  {isLikedSongsMode ? (
    <>
      <TopListCard
        label="Canciones guardadas"
        title="Canciones de tu colección, ordenadas alfabéticamente"
        items={getFilteredTopItems(stats.top_songs, "top-songs")}
        unit=""
        showCount={false}
      />

      {renderTopListExplorer(stats.top_songs, "top-songs")}
    </>
  ) : isPlaylistMode ? (
    repeatedSongsInPlaylist.length > 0 ? (
      <>
        <TopListCard
          label="Duplicadas"
          title="Canciones duplicadas en esta playlist"
          items={getFilteredTopItems(repeatedSongsInPlaylist, "top-songs")}
          unit="veces"
          referenceMaxCount={repeatedSongsInPlaylist[0]?.count}
        />

        {renderTopListExplorer(repeatedSongsInPlaylist, "top-songs")}
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
        title="Canciones que más se repiten entre tus playlists"
        items={getFilteredTopItems(stats.top_songs, "top-songs")}
        unit="veces"
        referenceMaxCount={stats.top_songs[0]?.count}
      />

      {renderTopListExplorer(stats.top_songs, "top-songs")}
    </>
  )}
</div>

      <div id="top-albums">
  <TopListCard
    label="Top álbumes"
    title={
      isLikedSongsMode
        ? "Álbumes con más canciones guardadas en Me gusta"
        : isPlaylistMode
          ? "Álbumes con más canciones en esta playlist"
          : "Álbumes con más canciones guardadas en tus playlists"
    }
    items={getFilteredTopItems(stats.top_albums, "top-albums")}
    unit="canciones"
    referenceMaxCount={stats.top_albums[0]?.count}
  />

{renderTopListExplorer(stats.top_albums, "top-albums")}

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

