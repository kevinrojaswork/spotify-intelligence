import "../styles/Landing.css";

type LandingProps = {
  onStart: () => void;
};

function Landing({ onStart }: LandingProps) {
  return (
    <main className="landing">
      <section className="hero">
        <p className="badge">Music Intelligence Platform</p>

        <h1>Spotify Intelligence</h1>

        <p className="subtitle">
          Descubre patrones ocultos, analiza tus playlists y conversa con tu
          historia musical.
        </p>

        <button className="primary-button" onClick={onStart}>
          Entrar al Dashboard
        </button>

        <div className="features">
          <span>Analiza playlists</span>
          <span>Descubre patrones</span>
          <span>Conversa con tu música</span>
        </div>
      </section>
    </main>
  );
}

export default Landing;