import { useEffect, useState } from "react";

const API_BASE_URL = "https://spotify-intelligence-production.up.railway.app";

const SPOTIFY_AUTH_URL =
  "https://accounts.spotify.com/authorize?client_id=920f42a830964ed6bcb6cdd2205004bc&response_type=code&redirect_uri=https%3A%2F%2Fspotify-intelligence-production.up.railway.app%2Fauth%2Fcallback&scope=playlist-read-private+playlist-read-collaborative+user-library-read+user-read-email+user-top-read+user-read-private";

const SPOTIFY_CHANGE_ACCOUNT_URL =
  "https://accounts.spotify.com/authorize?client_id=920f42a830964ed6bcb6cdd2205004bc&response_type=code&redirect_uri=https%3A%2F%2Fspotify-intelligence-production.up.railway.app%2Fauth%2Fcallback&scope=playlist-read-private+playlist-read-collaborative+user-library-read+user-read-email+user-top-read+user-read-private&show_dialog=true";

const SYNC_CHANNEL_NAME = "spotify-intelligence-sync";
const SYNC_EVENT_STORAGE_KEY = "spotify_sync_event";

type SyncTabMessage = {
  type: "sync-started" | "sync-finished";
  spotifyUserId: string | null;
  sentAt: number;
};

function createSyncTabMessage(
  type: SyncTabMessage["type"],
): SyncTabMessage {
  return {
    type,
    spotifyUserId: localStorage.getItem("spotify_user_id"),
    sentAt: Date.now(),
  };
}

function notifyOtherTabs(message: SyncTabMessage) {
  // El timestamp hace que cada escritura sea distinta y dispare el evento
  // "storage" incluso cuando se repite el mismo tipo de mensaje.
  localStorage.setItem(SYNC_EVENT_STORAGE_KEY, JSON.stringify(message));

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  }
}

type ConnectedUser = {
  spotify_user_id: string;
  display_name: string | null;
  email: string | null;
  image_url: string | null;
  last_login: string | null;
};

function Topbar() {
  const [isConnected, setIsConnected] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [isChangingAccount, setIsChangingAccount] = useState(false);
  const [isSyncing, setIsSyncing] = useState(
    () => localStorage.getItem("analysis_update_started") === "true",
  );
  const [connectedUser, setConnectedUser] = useState<ConnectedUser | null>(
    null,
  );
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyConnected = params.get("spotify_connected") === "true";
    const spotifyCancelled = params.get("spotify_cancelled") === "true";
    const spotifyAuthFailed = params.get("spotify_auth_failed") === "true";
    const spotifyError = params.get("spotify_error");
    const spotifyUserIdFromUrl = params.get("spotify_user_id");
    const sessionTokenFromUrl = params.get("session_token");

    if (spotifyCancelled) {
      localStorage.removeItem("spotify_account_change_pending");
      setIsWorking(false);
      setIsChangingAccount(false);
      setAccountMessage(
        "Cambio de cuenta cancelado. Tu cuenta anterior sigue conectada.",
      );
    }

    if (spotifyAuthFailed) {
      localStorage.removeItem("spotify_account_change_pending");
      setIsWorking(false);
      setIsChangingAccount(false);

      if (spotifyError === "user_not_registered") {
        setAccountMessage(
          "Esta cuenta todavía no está autorizada para usar la aplicación. Agrégala en Users and Access dentro de Spotify Developers.",
        );
      } else {
        setAccountMessage(
          "No se pudo completar la conexión con Spotify. Intenta nuevamente.",
        );
      }
    }

    if (spotifyUserIdFromUrl && sessionTokenFromUrl) {
      const previousSpotifyUserId = localStorage.getItem("spotify_user_id");
      const accountChanged = previousSpotifyUserId !== spotifyUserIdFromUrl;

      localStorage.setItem("spotify_user_id", spotifyUserIdFromUrl);
      localStorage.setItem("session_token", sessionTokenFromUrl);
      localStorage.removeItem("spotify_account_change_pending");
      setIsChangingAccount(false);
      localStorage.removeItem("selected_playlist_id");
      localStorage.setItem("analysis_update_started", "true");

      if (accountChanged) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
        window.location.reload();
        return;
      }
    }

    const activeSessionToken =
      sessionTokenFromUrl || localStorage.getItem("session_token");

    if (spotifyConnected || activeSessionToken) {
      setIsConnected(true);
    }

    if (activeSessionToken) {
      void loadConnectedUser();
    }

    if (
      spotifyConnected ||
      spotifyUserIdFromUrl ||
      sessionTokenFromUrl ||
      spotifyCancelled ||
      spotifyAuthFailed ||
      params.get("sync")
    ) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const resetAbandonedAccountChange = () => {
      const accountChangePending =
        localStorage.getItem("spotify_account_change_pending") === "true";

      if (!accountChangePending) {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const hasSpotifyResult =
        params.get("spotify_connected") === "true" ||
        params.get("spotify_cancelled") === "true" ||
        params.get("spotify_auth_failed") === "true" ||
        Boolean(params.get("spotify_user_id")) ||
        Boolean(params.get("session_token"));

      if (hasSpotifyResult) {
        return;
      }

      localStorage.removeItem("spotify_account_change_pending");
      setIsChangingAccount(false);
      setIsWorking(false);
      setAccountMessage(
        "Cambio de cuenta cancelado. Tu cuenta actual sigue conectada.",
      );
    };

    const handlePageShow = () => {
      resetAbandonedAccountChange();
    };

    const handleWindowFocus = () => {
      resetAbandonedAccountChange();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetAbandonedAccountChange();
      }
    };

    resetAbandonedAccountChange();

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let pollTimeoutId: number | undefined;
    let requestInFlight = false;
    let syncChannel: BroadcastChannel | null = null;

    const scheduleNextCheck = (delay = 3000) => {
      if (isCancelled) {
        return;
      }

      if (pollTimeoutId) {
        window.clearTimeout(pollTimeoutId);
      }

      pollTimeoutId = window.setTimeout(() => {
        void checkSyncStatus();
      }, delay);
    };

    const finishLocalSyncState = (notifyTabs: boolean) => {
      const hadActiveFlag =
        localStorage.getItem("analysis_update_started") === "true";

      localStorage.removeItem("analysis_update_started");

      if (!isCancelled) {
        setIsSyncing(false);
      }

      if (notifyTabs && hadActiveFlag) {
        notifyOtherTabs(createSyncTabMessage("sync-finished"));
      }
    };

    const checkSyncStatus = async () => {
      if (isCancelled || requestInFlight) {
        return;
      }

      const sessionToken = localStorage.getItem("session_token");

      if (!sessionToken) {
        finishLocalSyncState(false);
        return;
      }

      requestInFlight = true;

      try {
        const response = await fetch(`${API_BASE_URL}/sync-status`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (response.status === 401) {
          finishLocalSyncState(true);
          return;
        }

        if (!response.ok) {
          if (
            !isCancelled &&
            localStorage.getItem("analysis_update_started") === "true"
          ) {
            scheduleNextCheck(4000);
          }
          return;
        }

        const data = await response.json();
        const syncing = data.status === "syncing";

        if (syncing) {
          localStorage.setItem("analysis_update_started", "true");

          if (!isCancelled) {
            setIsSyncing(true);
          }

          scheduleNextCheck();
          return;
        }

        finishLocalSyncState(true);
      } catch (error) {
        console.error("Error revisando sincronización desde Topbar:", error);

        if (
          !isCancelled &&
          localStorage.getItem("analysis_update_started") === "true"
        ) {
          scheduleNextCheck(4000);
        }
      } finally {
        requestInFlight = false;
      }
    };

    const belongsToCurrentAccount = (message: SyncTabMessage) => {
      const currentUserId = localStorage.getItem("spotify_user_id");

      return (
        !message.spotifyUserId ||
        !currentUserId ||
        message.spotifyUserId === currentUserId
      );
    };

    const applyTabMessage = (message: SyncTabMessage) => {
      if (isCancelled || !belongsToCurrentAccount(message)) {
        return;
      }

      if (message.type === "sync-started") {
        localStorage.setItem("analysis_update_started", "true");
        setIsSyncing(true);

        if (pollTimeoutId) {
          window.clearTimeout(pollTimeoutId);
        }

        void checkSyncStatus();
        return;
      }

      finishLocalSyncState(false);
    };

    const handleSyncStarted = () => {
      applyTabMessage(createSyncTabMessage("sync-started"));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "analysis_update_started") {
        const syncing = event.newValue === "true";
        setIsSyncing(syncing);

        if (syncing) {
          void checkSyncStatus();
        }
        return;
      }

      if (event.key !== SYNC_EVENT_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        applyTabMessage(JSON.parse(event.newValue) as SyncTabMessage);
      } catch (error) {
        console.error("Evento de sincronización inválido:", error);
      }
    };

    const handleChannelMessage = (event: MessageEvent<SyncTabMessage>) => {
      applyTabMessage(event.data);
    };

    const handleWindowFocus = () => {
      void checkSyncStatus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkSyncStatus();
      }
    };

    if ("BroadcastChannel" in window) {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      syncChannel.addEventListener("message", handleChannelMessage);
    }

    void checkSyncStatus();

    window.addEventListener("spotify-sync-started", handleSyncStarted);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      window.removeEventListener("spotify-sync-started", handleSyncStarted);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (pollTimeoutId) {
        window.clearTimeout(pollTimeoutId);
      }

      if (syncChannel) {
        syncChannel.removeEventListener("message", handleChannelMessage);
        syncChannel.close();
      }
    };
  }, []);

  const loadConnectedUser = async () => {
    try {
      const sessionToken = localStorage.getItem("session_token");

      if (!sessionToken) {
        setIsConnected(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/me`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.status === 401) {
        setIsConnected(false);
        setAccountMessage(
          "Tu sesión de la aplicación expiró. Conecta Spotify nuevamente.",
        );
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setConnectedUser(data);
    } catch (error) {
      console.error("Error cargando cuenta conectada:", error);
    }
  };

  const connectSpotify = () => {
    setAccountMessage(null);
    setIsWorking(true);
    window.location.assign(SPOTIFY_AUTH_URL);
  };

  const updateAnalysis = async () => {
    const sessionToken = localStorage.getItem("session_token");

    if (!sessionToken) {
      connectSpotify();
      return;
    }

    try {
      setAccountMessage(null);
      setIsWorking(true);

      const response = await fetch(`${API_BASE_URL}/load`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem("analysis_update_started");
        setAccountMessage(
          "Tu conexión con Spotify expiró. Autoriza tu cuenta nuevamente para actualizar.",
        );
        connectSpotify();
        return;
      }

      if (!response.ok) {
        setAccountMessage(
          "No pudimos iniciar la actualización. Tus datos guardados siguen disponibles; intenta nuevamente.",
        );
        return;
      }

      const data = await response.json();

      if (data.status !== "syncing") {
        setAccountMessage(
          "El servidor no confirmó el inicio de la actualización. Intenta nuevamente.",
        );
        return;
      }

      localStorage.setItem("analysis_update_started", "true");
      setIsSyncing(true);

      const syncMessage = createSyncTabMessage("sync-started");
      notifyOtherTabs(syncMessage);
      window.dispatchEvent(new Event("spotify-sync-started"));

      window.location.reload();
    } catch (error) {
      console.error("Error actualizando análisis:", error);
      setAccountMessage(
        "No pudimos comunicarnos con el servidor. Tus datos guardados siguen disponibles.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const changeAccount = () => {
    localStorage.setItem("spotify_account_change_pending", "true");
    localStorage.removeItem("analysis_update_started");

    setAccountMessage(
      'En Spotify, pulsa "¿No eres tú?" para iniciar sesión con otra cuenta.',
    );
    setIsChangingAccount(true);
    window.location.assign(SPOTIFY_CHANGE_ACCOUNT_URL);
  };

  const handleSpotifyAction = () => {
    if (isConnected) {
      void updateAnalysis();
    } else {
      connectSpotify();
    }
  };

  const accountName =
    connectedUser?.display_name ||
    connectedUser?.spotify_user_id ||
    "Cuenta de Spotify";

  const accountInitial = accountName.charAt(0).toUpperCase();

  return (
    <header className="topbar topbar-compact">
      <div className="topbar-intro">
        <p className="topbar-label">
          {isConnected ? "Panel conectado a Spotify" : "Conecta tu cuenta"}
        </p>

        <h1>Inteligencia para tus playlists</h1>

        <p className="topbar-description">
          Descubre qué contienen tus playlists, cómo se relacionan y qué patrones
          se repiten. Los resultados se basan en canciones guardadas, no en tu
          historial de reproducción.
        </p>

        {isConnected && connectedUser && (
          <div className="connected-account connected-account-compact">
            {connectedUser.image_url ? (
              <img
                src={connectedUser.image_url}
                alt={accountName}
                className="connected-account-avatar"
              />
            ) : (
              <div className="connected-account-placeholder">
                {accountInitial}
              </div>
            )}

            <div>
              <span>Cuenta conectada</span>
              <strong>{accountName}</strong>
            </div>
          </div>
        )}
      </div>

      <aside
        className="dashboard-actions-block dashboard-actions-block-compact"
        aria-label="Sincronización con Spotify"
      >
        <div className="dashboard-actions-copy">
          <p className="section-label">Actualizar datos</p>
          <h2>
            {isConnected
              ? "Sincroniza solo cuando cambies algo en Spotify"
              : "Conecta Spotify para analizar tus playlists"}
          </h2>

          {isConnected && (
            <p>
              Cambiar de playlist utiliza el análisis guardado y no inicia una
              nueva sincronización.
            </p>
          )}
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="connect-button"
            onClick={handleSpotifyAction}
            disabled={isWorking || isSyncing || isChangingAccount}
          >
            {isSyncing
              ? "Sincronizando cambios..."
              : isWorking
                ? isConnected
                  ? "Iniciando sincronización..."
                  : "Abriendo Spotify..."
                : isConnected
                  ? "Sincronizar cambios de Spotify"
                  : "Conectar Spotify"}
          </button>

          {isConnected && (
            <button
              type="button"
              className="secondary-button"
              onClick={changeAccount}
              disabled={isWorking || isSyncing || isChangingAccount}
            >
              {isChangingAccount ? "Abriendo Spotify..." : "Cambiar cuenta"}
            </button>
          )}
        </div>

        {accountMessage && (
          <p className="spotify-account-message" role="status">
            {accountMessage}
          </p>
        )}
      </aside>
    </header>
  );
}

export default Topbar;

