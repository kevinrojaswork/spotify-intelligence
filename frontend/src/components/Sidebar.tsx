function Sidebar() {
  return (
    <aside className="sidebar">
      <h2 className="sidebar-logo">Spotify Intelligence</h2>

      <nav className="sidebar-nav">
        <button className="active">🏠 Inicio</button>
        <button>📊 Dashboard</button>
        <button>📁 Biblioteca</button>
        <button>🎵 Playlists</button>
        <button>🎤 Artistas</button>
        <button>💬 Chat IA</button>
        <button>⚙ Configuración</button>
      </nav>
    </aside>
  );
}

export default Sidebar;