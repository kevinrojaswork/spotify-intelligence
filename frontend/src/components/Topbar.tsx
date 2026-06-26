import { useEffect, useState } from "react";

const API_BASE_URL = "https://spotify-intelligence-production.up.railway.app";

const SPOTIFY_AUTH_URL =
  "https://accounts.spotify.com/authorize?client_id=920f42a830964ed6bcb6cdd2205004bc&response_type=code&redirect_uri=https%3A%2F%2Fspotify-intelligence-production.up.railway.app%2Fauth%2Fcallback&scope=playlist-read-private+playlist-read-collaborative+user-library-read+user-read-email+user-top-read+user-read-private";

function Topbar() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyConnected = params.get("spotify_connected") === "true";
    const spotifyUserId = params.get("spotify_user_id");

    if (spotifyUserId) {
      localStorage.setItem("spotify_user_id", spotifyUserId);
    }

    const savedSpotifyUserId = localStorage.getItem("spotify_user_id");

    if (spotifyConnected || savedSpotifyUserId) {
      setIsConnected(true);
    }

    if (spotifyConnected || spotifyUserId) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }
  }, []);

  const handleSync = async () => {
    const spotifyUserId = localStorage.getItem("spotify_user_id");

    if (!spotifyUserId) {
      window.location.href = SPOTIFY_AUTH_URL;
      return;
    }

    try {
      setIsSyncing(true);

      const response = await fetch(
        `${API_BASE_URL}/engine/load?spotify_user_id=${encodeURIComponent(
          spotifyUserId
        )}`
      );

      if (!response.ok) {
        window.location.href = SPOTIFY_AUTH_URL;
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("Error sincronizando Spotify:", error);
      window.location.href = SPOTIFY_AUTH_URL;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="topbar">
      <div>
        <p className="topbar-label">
          {isConnected ? "Spotify conectado" : "Bienvenido"}
        </p>

        <h1>Tu centro de inteligencia musical</h1>
      </div>

      {isConnected ? (
        <button
          className="connect-button"
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? "Sincronizando..." : "Sincronizar Spotify"}
        </button>
      ) : (
        <a className="connect-button" href={SPOTIFY_AUTH_URL}>
          Conectar Spotify
        </a>
      )}
    </header>
  );
}

export default Topbar;