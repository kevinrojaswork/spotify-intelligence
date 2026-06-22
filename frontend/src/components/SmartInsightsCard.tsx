type Props = {
  insights: string[];
};

function SmartInsightsCard({ insights }: Props) {
  return (
    <section className="discovery-card">
      <p className="section-label">Insights inteligentes</p>
      <h2>Patrones detectados en tu biblioteca</h2>

      {insights.map((insight, index) => (
        <p key={index}>
          {index + 1}. {insight}
        </p>
      ))}
    </section>
  );
}

export default SmartInsightsCard;