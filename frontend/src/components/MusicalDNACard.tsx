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
};

function MusicalDNACard({ dna }: Props) {
  return (
    <section className="discovery-card">
      <p className="section-label">ADN Musical</p>
      <h2>{dna.diversity_label}</h2>

      <p>{dna.summary}</p>

      <p>Diversidad musical: {dna.diversity_score}%</p>
      <p>{dna.concentration_label}</p>
      <p>{dna.duplicate_label}</p>
      <p>Artistas únicos: {dna.total_unique_artists}</p>
      <p>Canciones duplicadas: {dna.duplicate_songs_count}</p>
    </section>
  );
}

export default MusicalDNACard;