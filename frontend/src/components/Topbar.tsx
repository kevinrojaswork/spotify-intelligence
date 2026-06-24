function Topbar() {
  const connectSpotify = async () => {
  const response = await fetch(
    "https://spotify-intelligence-production.up.railway.app/auth/login"
  );

  const data = await response.json();

  console.log("Spotify auth data:", data);

  window.location.href = data.auth_url;
};

  return (
    <header className="topbar">
      <div>
        <p className="topbar-label">Bienvenido</p>
        <h1>Tu centro de inteligencia musical</h1>
      </div>

      <button className="connect-button" onClick={connectSpotify}>
        Conectar Spotify
      </button>
    </header>
  );
}

export default Topbar;