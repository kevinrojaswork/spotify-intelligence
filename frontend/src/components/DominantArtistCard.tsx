type DominantArtist = {
  name: string;
  count: number;
};

type Props = {
  artist: DominantArtist | null;
  percentage: number;
  isPlaylistMode?: boolean;
  contextLabel?: string;
};

function DominantArtistCard({
  artist,
  percentage,
  isPlaylistMode = false,
  contextLabel,
}: Props) {
  const resolvedContext =
    contextLabel ?? (isPlaylistMode ? "en esta playlist" : "en tus playlists");

  return (
    <section className="discovery-card">
      <p className="section-label">Artista con mayor presencia</p>
      <h2>
        {artist
          ? artist.name
          : "Todavía no hay suficientes canciones para destacar un artista"}
      </h2>

      {artist && (
        <p>
          Es el artista que más aparece {resolvedContext}: tiene {artist.count}{" "}
          apariciones, equivalentes al {percentage}% de las canciones incluidas
          en este análisis.
        </p>
      )}
    </section>
  );
}

export default DominantArtistCard;
