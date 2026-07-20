import { useEffect, useState } from "react";

import "../styles/Landing.css";

const API_BASE_URL =
  "https://spotify-intelligence-production.up.railway.app";

type LoginResponse = {
  auth_url?: string;
};

function Landing() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyCancelled =
      params.get("spotify_cancelled") === "true";
    const spotifyAuthFailed =
      params.get("spotify_auth_failed") === "true";
    const spotifyError = params.get("spotify_error");

    if (spotifyCancelled) {
      setMessage(
        "La conexión fue cancelada. Puedes intentarlo nuevamente cuando quieras."
      );
    } else if (spotifyAuthFailed) {
      if (spotifyError === "user_not_registered") {
        setMessage(
          "Esta cuenta todavía no está autorizada para usar la aplicación."
        );
      } else {
        setMessage(
          "No se pudo completar la conexión con Spotify. Intenta nuevamente."
        );
      }
    }

    if (
      spotifyCancelled ||
      spotifyAuthFailed ||
      params.get("spotify_error")
    ) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }
  }, []);

  const connectSpotify = async () => {
    try {
      setMessage(null);
      setIsConnecting(true);

      const response = await fetch(`${API_BASE_URL}/auth/login`);

      if (!response.ok) {
        throw new Error("No se pudo iniciar la autorización.");
      }

      const data = (await response.json()) as LoginResponse;

      if (!data.auth_url) {
        throw new Error("Spotify no devolvió una URL de autorización.");
      }

      window.location.assign(data.auth_url);
    } catch (error) {
      console.error("Error iniciando conexión con Spotify:", error);
      setMessage(
        "No pudimos abrir Spotify. Revisa tu conexión e intenta nuevamente."
      );
      setIsConnecting(false);
    }
  };

  return (
    <main className="landing">
      <section className="landing-hero">
        <p className="landing-badge">Music Intelligence Platform</p>

        <h1>Spotify Intelligence</h1>

        <p className="landing-subtitle">
          Descubre patrones en las canciones guardadas en tus playlists de
          Spotify. Identifica qué artistas, álbumes y canciones aparecen con
          mayor frecuencia, sin confundirlos con tu historial de reproducción.
        </p>

        <button
          type="button"
          className="landing-primary-button"
          onClick={connectSpotify}
          disabled={isConnecting}
        >
          {isConnecting
            ? "Abriendo Spotify..."
            : "Conectar con Spotify"}
        </button>

        <p className="landing-privacy-note">
          La aplicación solicita acceso de lectura. No modifica ni elimina tus
          playlists, y los resultados se calculan con las canciones que contienen.
        </p>

        {message && (
          <p className="landing-message" role="status">
            {message}
          </p>
        )}

        <div className="landing-steps" aria-label="Cómo funciona">
          <article>
            <span>1</span>
            <strong>Conecta tu cuenta</strong>
            <p>Autoriza el acceso de lectura desde Spotify.</p>
          </article>

          <article>
            <span>2</span>
            <strong>Espera la preparación</strong>
            <p>Sincronizamos tus playlists y las canciones que contienen.</p>
          </article>

          <article>
            <span>3</span>
            <strong>Explora tu análisis</strong>
            <p>Consulta qué artistas, canciones y álbumes aparecen más en tus playlists.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

export default Landing;
