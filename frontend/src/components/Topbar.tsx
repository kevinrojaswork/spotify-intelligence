import { useEffect, useState } from "react";

const SPOTIFY_AUTH_URL =
  "https://accounts.spotify.com/authorize?client_id=920f42a830964ed6bcb6cdd2205004bc&response_type=code&redirect_uri=https%3A%2F%2Fspotify-intelligence-production.up.railway.app%2Fauth%2Fcallback&scope=playlist-read-private+playlist-read-collaborative+user-library-read+user-read-email+user-top-read+user-read-private";

function Topbar() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (window.location.search.includes("spotify_connected=true")) {
      setIsConnected(true);

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }
  }, []);

  return (
    <header className="topbar">
      <div>
        <p className="topbar-label">
          {isConnected ? "Spotify conectado" : "Bienvenido"}
        </p>

        <h1>Tu centro de inteligencia musical</h1>
      </div>

      <a className="connect-button" href={SPOTIFY_AUTH_URL}>
        {isConnected ? "Spotify conectado ✓" : "Conectar Spotify"}
      </a>
    </header>
  );
}

export default Topbar;