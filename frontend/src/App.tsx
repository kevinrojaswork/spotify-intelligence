import { useState } from "react";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Layout from "./components/Layout";

function App() {
  const [started, setStarted] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyConnected = params.get("spotify_connected") === "true";
    const spotifyUserIdFromUrl = params.get("spotify_user_id");
    const spotifyUserIdFromStorage = localStorage.getItem("spotify_user_id");

    if (spotifyUserIdFromUrl) {
      localStorage.setItem("spotify_user_id", spotifyUserIdFromUrl);
    }

    return Boolean(
      spotifyConnected ||
      spotifyUserIdFromUrl ||
      spotifyUserIdFromStorage
    );
  });

  if (!started) {
    return <Landing onStart={() => setStarted(true)} />;
  }

  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}

export default App;