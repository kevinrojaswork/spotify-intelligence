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
    <section className="discovery-card duplicates-card">
      <p className="section-label">Canciones duplicadas</p>
      <h2>Canciones que aparecen en varias playlists</h2>

      {songs.length === 0 ? (
        <p>No encontramos canciones repetidas entre playlists.</p>
      ) : (
        <div className="duplicates-list">
          {songs.map((song, index) => (
            <div className="duplicate-item" key={song.name}>
              <span>#{index + 1}</span>

              <div>
                <strong>{song.name}</strong>
                <p>Aparece en {song.playlist_count} playlists</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default DuplicateSongsCard;