type DuplicateSong = {
  name: string;
  playlist_count: number;
  playlists: string[];
};

type Props = {
  songs: DuplicateSong[];
};

function DuplicateSongsCard({ songs }: Props) {
  return (
    <section className="discovery-card">
      <p className="section-label">Canciones duplicadas</p>
      <h2>Canciones que aparecen en varias playlists</h2>

      {songs.length === 0 ? (
        <p>No encontramos canciones repetidas entre playlists.</p>
      ) : (
        songs.map((song, index) => (
          <p key={song.name}>
            {index + 1}. {song.name} — aparece en {song.playlist_count}{" "}
            playlists
          </p>
        ))
      )}
    </section>
  );
}

export default DuplicateSongsCard;