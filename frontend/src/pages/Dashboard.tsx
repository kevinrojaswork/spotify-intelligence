function Dashboard() {
  return (
    <div className="dashboard">
      <section className="discovery-card">
        <p className="section-label">Descubrimiento del día</p>
        <h2>Tu biblioteca tiene una historia esperando ser descubierta.</h2>
        <p>
          Próximamente analizaremos tus playlists para encontrar patrones,
          duplicados, artistas dominantes y conexiones ocultas.
        </p>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span>🎵</span>
          <p>Canciones</p>
          <h3>--</h3>
        </div>

        <div className="stat-card">
          <span>🎤</span>
          <p>Artistas</p>
          <h3>--</h3>
        </div>

        <div className="stat-card">
          <span>💿</span>
          <p>Álbumes</p>
          <h3>--</h3>
        </div>

        <div className="stat-card">
          <span>📁</span>
          <p>Playlists</p>
          <h3>--</h3>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;