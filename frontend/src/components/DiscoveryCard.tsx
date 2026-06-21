type Props = {
  discovery: string;
  lastSync: string | null;
};

function DiscoveryCard({ discovery, lastSync }: Props) {
  return (
    <section className="discovery-card">
      <p className="section-label">Descubrimiento del día</p>
      <h2>{discovery}</h2>
      <p>Última sincronización: {lastSync ?? "No sincronizado todavía"}</p>
    </section>
  );
}

export default DiscoveryCard;