type Props = {
  insights: string[];
};

function SmartInsightsCard({ insights }: Props) {
  return (
    <section className="discovery-card insights-card">
      <p className="section-label">Insights inteligentes</p>
      <h2>Patrones detectados en tu biblioteca</h2>

      <div className="insights-list">
        {insights.map((insight, index) => (
          <div className="insight-item" key={index}>
            <span>🧠</span>
            <p>{insight}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default SmartInsightsCard;