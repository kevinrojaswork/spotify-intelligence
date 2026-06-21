type DominantArtist = {
  name: string;
  count: number;
};

type Props = {
  artist: DominantArtist | null;
  percentage: number;
};

function DominantArtistCard({ artist, percentage }: Props) {
  return (
    <section className="discovery-card">
      <p className="section-label">Artista dominante</p>
      <h2>{artist ? artist.name : "Todavía no hay artista dominante"}</h2>

      {artist && (
        <p>
          Aparece {artist.count} veces, equivalente al {percentage}% de tus
          canciones analizadas.
        </p>
      )}
    </section>
  );
}

export default DominantArtistCard;