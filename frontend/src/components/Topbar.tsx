import { useEffect, useState } from "react";

const SPOTIFY_AUTH_URL =
  "https://accounts.spotify.com/authorize?client_id=920f42a830964ed6bcb6cdd2205004bc&response_type=code&redirect_uri=https%3A%2F%2Fspotify-intelligence-production.up.railway.app%2Fauth%2Fcallback&scope=playlist-read-private+playlist-read-collaborative+user-library-read+user-read-email+user-top-read+user-read-private";

function Topbar() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

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

    if (spotifyConnected || spotifyUserId || params.get("sync")) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }
  }, []);

  const handleSpotifyAction = () => {
    setIsRedirecting(true);
    window.location.assign(SPOTIFY_AUTH_URL);
  };

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
      </div>

      <button
        type="button"
        className="connect-button"
        onClick={handleSpotifyAction}
        disabled={isRedirecting}
      >
        {isRedirecting
          ? "Abriendo Spotify..."
          : isConnected
          ? "Actualizar análisis"
          : "Conectar Spotify"}
      </button>
    </header>
  );
}

export default Topbar;