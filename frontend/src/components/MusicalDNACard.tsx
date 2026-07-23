type MusicalDNA = {
  diversity_score: number;
  diversity_label: string;
  concentration_label: string;
  duplicate_label: string;
  total_unique_artists: number;
  duplicate_songs_count: number;
  summary: string;
};

type Props = {
  dna: MusicalDNA;
  isLikedSongsMode?: boolean;
  totalTracks?: number;
};

function MusicalDNACard({
  dna,
  isLikedSongsMode = false,
  totalTracks = 0,
}: Props) {
  return (
    <section className="discovery-card dna-card">
      <p className="section-label">ADN Musical</p>
      <h2>{dna.diversity_label}</h2>

      <p>{dna.summary}</p>

      <div className="dna-score">
        <span>{dna.diversity_score}%</span>
        <p>Diversidad musical</p>
      </div>

      <div className="dna-grid">
        <div>
          <strong>{dna.total_unique_artists}</strong>
          <p>Artistas únicos</p>
        </div>

        <div>
          <strong>
            {isLikedSongsMode ? totalTracks : dna.duplicate_songs_count}
          </strong>
          <p>
            {isLikedSongsMode
              ? "Canciones guardadas"
              : "Canciones duplicadas"}
          </p>
        </div>
      </div>

      <p>{dna.concentration_label}</p>

      {!isLikedSongsMode && <p>{dna.duplicate_label}</p>}
    </section>
  );
}

export default MusicalDNACard;
