import { useState } from "react";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Layout from "./components/Layout";

const SESSION_STORAGE_KEY = "session_token";
const SPOTIFY_USER_STORAGE_KEY = "spotify_user_id";

function App() {
  const [hasSession] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyUserIdFromUrl = params.get("spotify_user_id");
    const sessionTokenFromUrl = params.get("session_token");

    // Guardamos la sesión antes de montar Dashboard y Topbar.
    // Esto evita que el primer ingreso intente cargar datos sin el token.
    if (spotifyUserIdFromUrl) {
      localStorage.setItem(
        SPOTIFY_USER_STORAGE_KEY,
        spotifyUserIdFromUrl
      );
    }

    if (sessionTokenFromUrl) {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        sessionTokenFromUrl
      );
    }

    return Boolean(
      sessionTokenFromUrl ||
      localStorage.getItem(SESSION_STORAGE_KEY)
    );
  });

  if (!hasSession) {
    return <Landing />;
  }

  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}

export default App;
