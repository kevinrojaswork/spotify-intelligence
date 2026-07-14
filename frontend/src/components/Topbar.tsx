import { useEffect, useState } from "react";

const API_BASE_URL = "https://spotify-intelligence-production.up.railway.app";

const SPOTIFY_AUTH_URL =
  "https://accounts.spotify.com/authorize?client_id=920f42a830964ed6bcb6cdd2205004bc&response_type=code&redirect_uri=https%3A%2F%2Fspotify-intelligence-production.up.railway.app%2Fauth%2Fcallback&scope=playlist-read-private+playlist-read-collaborative+user-library-read+user-read-email+user-top-read+user-read-private";

const SPOTIFY_CHANGE_ACCOUNT_URL =
  "https://accounts.spotify.com/authorize?client_id=920f42a830964ed6bcb6cdd2205004bc&response_type=code&redirect_uri=https%3A%2F%2Fspotify-intelligence-production.up.railway.app%2Fauth%2Fcallback&scope=playlist-read-private+playlist-read-collaborative+user-library-read+user-read-email+user-top-read+user-read-private&show_dialog=true";

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
  const [connectedUser, setConnectedUser] = useState<ConnectedUser | null>(
    null
  );
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyConnected = params.get("spotify_connected") === "true";
    const spotifyCancelled = params.get("spotify_cancelled") === "true";
    const spotifyAuthFailed = params.get("spotify_auth_failed") === "true";
    const spotifyError = params.get("spotify_error");
    const spotifyUserIdFromUrl = params.get("spotify_user_id");

    if (spotifyCancelled) {
      localStorage.removeItem("spotify_account_change_pending");
      setIsWorking(false);
      setAccountMessage("Cambio de cuenta cancelado. Tu cuenta anterior sigue conectada.");
    }

    if (spotifyAuthFailed) {
      localStorage.removeItem("spotify_account_change_pending");
      setIsWorking(false);

      if (spotifyError === "user_not_registered") {
        setAccountMessage(
          "Esta cuenta todavía no está autorizada para usar la aplicación. Agrégala en Users and Access dentro de Spotify Developers."
        );
      } else {
        setAccountMessage(
          "No se pudo completar la conexión con Spotify. Intenta nuevamente."
        );
      }
    }

    if (spotifyUserIdFromUrl) {
  const previousSpotifyUserId =
    localStorage.getItem("spotify_user_id");

  const accountChanged =
    previousSpotifyUserId !== spotifyUserIdFromUrl;

  localStorage.setItem(
    "spotify_user_id",
    spotifyUserIdFromUrl
  );

  localStorage.removeItem(
    "spotify_account_change_pending"
  );

  localStorage.removeItem(
    "selected_playlist_id"
  );

  localStorage.setItem(
    "analysis_update_started",
    "true"
  );

  if (accountChanged) {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    window.location.reload();
    return;
  }
}

    const savedSpotifyUserId = localStorage.getItem("spotify_user_id");
    const activeSpotifyUserId = spotifyUserIdFromUrl || savedSpotifyUserId;

    if (spotifyConnected || activeSpotifyUserId) {
      setIsConnected(true);
    }

    if (activeSpotifyUserId) {
      void loadConnectedUser(activeSpotifyUserId);
    }

    if (
      spotifyConnected ||
      spotifyUserIdFromUrl ||
      spotifyCancelled ||
      spotifyAuthFailed ||
      params.get("sync")
    ) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }
  }, []);

  const loadConnectedUser = async (spotifyUserId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/me?spotify_user_id=${encodeURIComponent(
          spotifyUserId
        )}`
      );

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
    const spotifyUserId = localStorage.getItem("spotify_user_id");

    if (!spotifyUserId) {
      connectSpotify();
      return;
    }

    try {
      setAccountMessage(null);
      setIsWorking(true);
      localStorage.setItem("analysis_update_started", "true");

      const response = await fetch(
        `${API_BASE_URL}/load?spotify_user_id=${encodeURIComponent(
          spotifyUserId
        )}`
      );

      if (!response.ok) {
        localStorage.removeItem("analysis_update_started");
        connectSpotify();
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("Error actualizando análisis:", error);
      localStorage.removeItem("analysis_update_started");
      connectSpotify();
    } finally {
      setIsWorking(false);
    }
  };

  const changeAccount = () => {
    // Conservamos la cuenta actual hasta que Spotify confirme otra.
    // Si el usuario cancela, la sesión anterior permanece intacta.
    localStorage.setItem("spotify_account_change_pending", "true");
    localStorage.removeItem("analysis_update_started");

    setAccountMessage(
      'En Spotify, pulsa "¿No eres tú?" para iniciar sesión con otra cuenta.'
    );
    setIsWorking(true);
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
    <header className="topbar">
      <div>
        <p className="topbar-label">
          {isConnected ? "Spotify conectado" : "Conecta tu cuenta"}
        </p>

        <h1>Tu centro de inteligencia musical</h1>

        <p className="topbar-description">
          Analiza tus playlists, artistas, álbumes y patrones musicales desde
          tu cuenta de Spotify.
        </p>

        {isConnected && connectedUser && (
          <div className="connected-account">
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

      <div className="dashboard-actions-block">
        <div className="topbar-actions">
          <button
            type="button"
            className="connect-button"
            onClick={handleSpotifyAction}
            disabled={isWorking}
          >
            {isWorking
              ? isConnected
                ? "Abriendo Spotify..."
                : "Abriendo Spotify..."
              : isConnected
              ? "Actualizar desde Spotify"
              : "Conectar Spotify"}
          </button>

          {isConnected && (
            <button
              type="button"
              className="secondary-button"
              onClick={changeAccount}
              disabled={isWorking}
            >
              Cambiar cuenta
            </button>
          )}
        </div>

        {accountMessage && (
          <p className="spotify-account-message" role="status">
            {accountMessage}
          </p>
        )}

        {isConnected && (
          <p className="dashboard-actions-hint">
            Tus datos guardados se cargan automáticamente. Usa este botón solo
            cuando hayas cambiado canciones o playlists en Spotify.
          </p>
        )}
      </div>
    </header>
  );
}

export default Topbar;