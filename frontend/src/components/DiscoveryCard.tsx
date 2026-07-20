type Props = {
  discovery: string;
  lastSync: string | null;
};

function DiscoveryCard({ discovery, lastSync }: Props) {
  const clarifiedDiscovery = discovery
    .replace(
      /domina tu biblioteca/gi,
      "es el artista que más aparece en tus playlists",
    )
    .replace(
      /de tus canciones analizadas/gi,
      "de las canciones guardadas en tus playlists",
    );

  return (
    <section className="discovery-card">
      <p className="section-label">Descubrimiento de tus playlists</p>
      <h2>{clarifiedDiscovery}</h2>
      <p>
        Se calcula con las canciones guardadas en tus playlists, no con tu
        historial de reproducción.
      </p>
      <p>Última sincronización: {lastSync ?? "No sincronizado todavía"}</p>
    </section>
  );
}

export default DiscoveryCard;