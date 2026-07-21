import { useState, type ChangeEvent } from "react";

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
  const [search, setSearch] = useState("");

  const normalizedSearch = search.trim().toLocaleLowerCase("es");

  const rankedSongs = songs.map((song, index) => ({
    ...song,
    rank: index + 1,
  }));

  const filteredSongs = normalizedSearch
    ? rankedSongs.filter((song) =>
        song.name.toLocaleLowerCase("es").includes(normalizedSearch)
      )
    : rankedSongs;

  const visibleSongs = isExpanded
    ? filteredSongs
    : rankedSongs.slice(0, DUPLICATE_PREVIEW_LIMIT);

  const hasMoreSongs = songs.length > DUPLICATE_PREVIEW_LIMIT;

  const toggleExpanded = () => {
    const nextValue = !isExpanded;

    setIsExpanded(nextValue);

    if (!nextValue) {
      setSearch("");
    }
  };

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
          {isExpanded && (
            <div className="ranking-explorer">
              <label className="ranking-search-field">
                <span className="sr-only">Buscar una canción duplicada</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSearch(event.target.value)
                  }
                  placeholder={`Buscar entre ${songs.length} canciones duplicadas...`}
                />
              </label>

              <p className="ranking-result-summary">
                {normalizedSearch
                  ? `${filteredSongs.length} de ${songs.length} resultados`
                  : `${songs.length} resultados disponibles`}
              </p>
            </div>
          )}

          {visibleSongs.length > 0 ? (
            <div className="duplicates-list">
              {visibleSongs.map((song) => {
                const playlistPreview = song.playlists.slice(
                  0,
                  PLAYLIST_PREVIEW_LIMIT
                );

                const remainingPlaylists =
                  song.playlists.length - playlistPreview.length;

                return (
                  <div className="duplicate-item" key={`${song.rank}-${song.name}`}>
                    <span>#{song.rank}</span>

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
          ) : (
            <p className="ranking-empty-state">
              No encontramos canciones que coincidan con esta búsqueda.
            </p>
          )}

          {hasMoreSongs && (
            <button
              type="button"
              className="show-more-list-button"
              onClick={toggleExpanded}
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
