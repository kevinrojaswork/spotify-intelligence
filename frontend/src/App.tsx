import { useState } from "react";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Layout from "./components/Layout";

function App() {
  const [started, setStarted] = useState(() => {
    return window.location.search.includes("spotify_connected=true");
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