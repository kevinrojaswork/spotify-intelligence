function Topbar() {
  const connectSpotify = async () => {
    const response = await fetch("http://127.0.0.1:8000/auth/login");
    const data = await response.json();

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