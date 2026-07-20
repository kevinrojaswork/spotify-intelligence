type DominantArtist = {
  name: string;
  count: number;
};

type Props = {
  artist: DominantArtist | null;
  percentage: number;
  isPlaylistMode?: boolean;
};

function DominantArtistCard({
  artist,
  percentage,
  isPlaylistMode = false,
}: Props) {
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
          Es el artista que más aparece{" "}
          {isPlaylistMode ? "en esta playlist" : "en tus playlists"}: tiene{" "}
          {artist.count} apariciones, equivalentes al {percentage}% de las
          canciones incluidas en este análisis.
        </p>
      )}
    </section>
  );
}

export default DominantArtistCard;