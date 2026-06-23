function Sidebar() {
  return (
    <aside className="sidebar">
      <h2 className="sidebar-logo">Spotify Intelligence</h2>

      <nav className="sidebar-nav">
        <button className="active">🏠 Dashboard</button>

        <button onClick={() => alert("Configuración estará disponible pronto.")}>
          ⚙️ Configuración
        </button>

        <button
          onClick={() =>
            alert(
              "Spotify Intelligence v1.0\n\nAnaliza tus playlists, artistas, canciones, álbumes, duplicados, ADN Musical e insights inteligentes."
            )
          }
        >
          ℹ️ Acerca de
        </button>
      </nav>
    </aside>
  );
}

export default Sidebar;