import { useState } from "react";

type DuplicateSong = {
  name: string;
  playlist_count: number;
  playlists: string[];
};

type Props = {
  songs: DuplicateSong[];
  duplicatePercentage: number;
};

const DUPLICATE_PREVIEW_LIMIT = 5;
const PLAYLIST_PREVIEW_LIMIT = 3;

function DuplicateSongsCard({ songs, duplicatePercentage }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleSongs = isExpanded
    ? songs
    : songs.slice(0, DUPLICATE_PREVIEW_LIMIT);

  const hasMoreSongs = songs.length > DUPLICATE_PREVIEW_LIMIT;

  return (
    <section className="discovery-card duplicates-card">
      <p className="section-label">Canciones duplicadas</p>

      <h2>Canciones que aparecen en varias playlists</h2>

      <p>
        {duplicatePercentage}% de tu biblioteca aparece en más de una playlist.
      </p>

      {songs.length === 0 ? (
        <p>No encontramos canciones repetidas entre playlists.</p>
      ) : (
        <>
          <div className="duplicates-list">
            {visibleSongs.map((song, index) => {
              const playlistPreview = song.playlists.slice(
                0,
                PLAYLIST_PREVIEW_LIMIT
              );

              const remainingPlaylists =
                song.playlists.length - playlistPreview.length;

              return (
                <div className="duplicate-item" key={song.name}>
                  <span>#{index + 1}</span>

                  <div>
                    <strong>{song.name}</strong>

                    <p>Aparece en {song.playlist_count} playlists</p>

                    {playlistPreview.length > 0 && (
                      <p className="duplicate-playlists-preview">
                        {playlistPreview.join(" · ")}
                        {remainingPlaylists > 0 &&
                          ` · y ${remainingPlaylists} más`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {hasMoreSongs && (
            <button
              type="button"
              className="show-more-list-button"
              onClick={() => setIsExpanded((currentValue) => !currentValue)}
            >
              {isExpanded
                ? "Ver menos"
                : `Ver más (${songs.length - DUPLICATE_PREVIEW_LIMIT} más)`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default DuplicateSongsCard;