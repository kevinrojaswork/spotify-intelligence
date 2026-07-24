import { useEffect, useMemo, useState, type ChangeEvent } from "react";

const API_BASE_URL = "https://spotify-intelligence-production.up.railway.app";
const LIKED_SONGS_COLLECTION_ID = "__spotify_liked_songs__";
const LIST_PREVIEW_LIMIT = 6;

type PlaylistOption = {
  spotify_playlist_id: string;
  name: string;
  total_tracks: number;
  collection_type?: "liked_songs";
  is_special_collection?: boolean;
};

type ComparisonCollection = {
  spotify_playlist_id: string;
  name: string;
  total_tracks: number;
  unique_tracks: number;
  unique_artists: number;
  artist_diversity_score: number;
  is_special_collection: boolean;
};

type ComparisonResult = {
  collection_a: ComparisonCollection;
  collection_b: ComparisonCollection;
  similarity_percentage: number;
  shared_songs_count: number;
  exclusive_songs_a_count: number;
  exclusive_songs_b_count: number;
  shared_artists_count: number;
  shared_songs: string[];
  exclusive_songs_a: string[];
  exclusive_songs_b: string[];
  shared_artists: string[];
  list_limit: number;
  diversity_winner: "a" | "b" | "tie";
  relationship_label: string;
  conclusion: string;
  recommendation: string;
};

type PlaylistComparisonCardProps = {
  collections: PlaylistOption[];
};

type ComparisonListProps = {
  title: string;
  total: number;
  items: string[];
  emptyMessage: string;
  searchPlaceholder: string;
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function ComparisonList({
  title,
  total,
  items,
  emptyMessage,
  searchPlaceholder,
}: ComparisonListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const normalizedSearch = normalizeSearchText(search);

  const filteredItems = useMemo(() => {
    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) =>
      normalizeSearchText(item).includes(normalizedSearch)
    );
  }, [items, normalizedSearch]);

  const visibleItems = isExpanded
    ? filteredItems
    : filteredItems.slice(0, LIST_PREVIEW_LIMIT);
  const canExpand = items.length > LIST_PREVIEW_LIMIT;

  const handleToggle = () => {
    setIsExpanded((currentValue) => !currentValue);

    if (isExpanded) {
      setSearch("");
    }
  };

  return (
    <article className="comparison-list-card">
      <div className="comparison-list-heading">
        <h4>{title}</h4>
        <span>{total}</span>
      </div>

      {isExpanded && items.length > 0 && (
        <label className="comparison-list-search">
          <span className="sr-only">Buscar dentro de {title}</span>
          <input
            type="search"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setSearch(event.target.value)
            }
            placeholder={searchPlaceholder}
          />
        </label>
      )}

      {visibleItems.length > 0 ? (
        <ol className="comparison-result-list">
          {visibleItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : (
        <p className="comparison-empty-list">
          {normalizedSearch
            ? "No encontramos coincidencias con esa búsqueda."
            : emptyMessage}
        </p>
      )}

      {total > items.length && (
        <p className="comparison-list-limit-note">
          Se muestran los primeros {items.length} de {total} resultados.
        </p>
      )}

      {canExpand && (
        <button
          type="button"
          className="comparison-list-toggle"
          onClick={handleToggle}
        >
          {isExpanded ? "Ver menos" : `Ver más (${items.length - LIST_PREVIEW_LIMIT} más)`}
        </button>
      )}
    </article>
  );
}

function PlaylistComparisonCard({ collections }: PlaylistComparisonCardProps) {
  const availableCollections = useMemo(
    () =>
      [...collections]
        .filter((collection) => collection.total_tracks > 0)
        .sort((firstCollection, secondCollection) => {
          if (
            firstCollection.spotify_playlist_id === LIKED_SONGS_COLLECTION_ID
          ) {
            return -1;
          }

          if (
            secondCollection.spotify_playlist_id === LIKED_SONGS_COLLECTION_ID
          ) {
            return 1;
          }

          return firstCollection.name.localeCompare(secondCollection.name, "es", {
            sensitivity: "base",
          });
        }),
    [collections]
  );

  const [collectionAId, setCollectionAId] = useState("");
  const [collectionBId, setCollectionBId] = useState("");
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const validIds = new Set(
      availableCollections.map(
        (collection) => collection.spotify_playlist_id
      )
    );

    const nextCollectionAId = validIds.has(collectionAId)
      ? collectionAId
      : availableCollections[0]?.spotify_playlist_id || "";

    const nextCollectionBId =
      validIds.has(collectionBId) && collectionBId !== nextCollectionAId
        ? collectionBId
        : availableCollections.find(
            (collection) =>
              collection.spotify_playlist_id !== nextCollectionAId
          )?.spotify_playlist_id || "";

    if (nextCollectionAId !== collectionAId) {
      setCollectionAId(nextCollectionAId);
    }

    if (nextCollectionBId !== collectionBId) {
      setCollectionBId(nextCollectionBId);
    }
  }, [availableCollections, collectionAId, collectionBId]);

  const resetResult = () => {
    setComparison(null);
    setError("");
  };

  const handleCollectionAChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    setCollectionAId(event.target.value);
    resetResult();
  };

  const handleCollectionBChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    setCollectionBId(event.target.value);
    resetResult();
  };

  const handleSwap = () => {
    setCollectionAId(collectionBId);
    setCollectionBId(collectionAId);
    resetResult();
  };

  const compareCollections = async () => {
    if (!collectionAId || !collectionBId) {
      setError("Selecciona dos colecciones con canciones.");
      return;
    }

    if (collectionAId === collectionBId) {
      setError("Selecciona dos colecciones diferentes.");
      return;
    }

    const sessionToken = localStorage.getItem("session_token");

    if (!sessionToken) {
      setError("No hay una sesión válida.");
      return;
    }

    const params = new URLSearchParams({
      playlist_a_id: collectionAId,
      playlist_b_id: collectionBId,
    });

    try {
      setIsComparing(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/compare-playlists?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "No se pudo completar la comparación."
        );
      }

      setComparison(data as ComparisonResult);
    } catch (comparisonError) {
      console.error("Error comparando playlists:", comparisonError);
      setComparison(null);
      setError(
        comparisonError instanceof Error
          ? comparisonError.message
          : "No se pudo completar la comparación."
      );
    } finally {
      setIsComparing(false);
    }
  };

  if (availableCollections.length < 2) {
    return (
      <section className="playlist-comparison-card comparison-unavailable-card">
        <p className="section-label">Comparar playlists</p>
        <h2>Necesitas al menos dos colecciones con canciones.</h2>
        <p>
          Sincroniza o agrega canciones a otra playlist para habilitar esta
          comparación.
        </p>
      </section>
    );
  }

  const diversityWinnerName = comparison
    ? comparison.diversity_winner === "a"
      ? comparison.collection_a.name
      : comparison.diversity_winner === "b"
        ? comparison.collection_b.name
        : "Empate"
    : "";

  return (
    <section className="playlist-comparison-card">
      <div className="comparison-intro">
        <div>
          <p className="section-label">Comparar playlists</p>
          <h2>Descubre qué tan parecidas son dos colecciones</h2>
          <p>
            Comparamos las canciones reales que contienen tus playlists. Esta
            acción usa los datos guardados y no modifica nada en Spotify.
          </p>
        </div>

        <span className="comparison-feature-badge">Nueva herramienta</span>
      </div>

      <div className="comparison-selector-grid">
        <label>
          <span>Primera colección</span>
          <select
            value={collectionAId}
            onChange={handleCollectionAChange}
            disabled={isComparing}
          >
            {availableCollections.map((collection) => (
              <option
                key={collection.spotify_playlist_id}
                value={collection.spotify_playlist_id}
                disabled={collection.spotify_playlist_id === collectionBId}
              >
                {collection.spotify_playlist_id === LIKED_SONGS_COLLECTION_ID
                  ? "❤️ "
                  : ""}
                {collection.name} — {collection.total_tracks} canciones
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="comparison-swap-button"
          onClick={handleSwap}
          disabled={!collectionAId || !collectionBId || isComparing}
          aria-label="Intercambiar colecciones"
          title="Intercambiar colecciones"
        >
          ⇄
        </button>

        <label>
          <span>Segunda colección</span>
          <select
            value={collectionBId}
            onChange={handleCollectionBChange}
            disabled={isComparing}
          >
            {availableCollections.map((collection) => (
              <option
                key={collection.spotify_playlist_id}
                value={collection.spotify_playlist_id}
                disabled={collection.spotify_playlist_id === collectionAId}
              >
                {collection.spotify_playlist_id === LIKED_SONGS_COLLECTION_ID
                  ? "❤️ "
                  : ""}
                {collection.name} — {collection.total_tracks} canciones
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="comparison-action-row">
        <button
          type="button"
          className="connect-button comparison-submit-button"
          onClick={() => void compareCollections()}
          disabled={
            isComparing ||
            !collectionAId ||
            !collectionBId ||
            collectionAId === collectionBId
          }
        >
          {isComparing ? "Comparando..." : "Comparar colecciones"}
        </button>

        <p>La comparación se realiza con tu última sincronización guardada.</p>
      </div>

      {error && <p className="comparison-error-message">{error}</p>}

      {comparison && (
        <div className="comparison-results" aria-live="polite">
          <div className="comparison-verdict-card">
            <div className="comparison-score">
              <strong>{comparison.similarity_percentage}%</strong>
              <span>similitud</span>
            </div>

            <div>
              <p className="section-label">{comparison.relationship_label}</p>
              <h3>{comparison.conclusion}</h3>
              <p>{comparison.recommendation}</p>
            </div>
          </div>

          <div className="comparison-collection-grid">
            {[comparison.collection_a, comparison.collection_b].map(
              (collection, index) => (
                <article
                  key={collection.spotify_playlist_id}
                  className="comparison-collection-card"
                >
                  <span className="comparison-collection-letter">
                    {index === 0 ? "A" : "B"}
                  </span>
                  <div>
                    <h3>{collection.name}</h3>
                    <p>
                      {collection.total_tracks} canciones · {collection.unique_tracks}{" "}
                      únicas
                    </p>
                  </div>
                  <dl>
                    <div>
                      <dt>Artistas únicos</dt>
                      <dd>{collection.unique_artists}</dd>
                    </div>
                    <div>
                      <dt>Diversidad relativa</dt>
                      <dd>{collection.artist_diversity_score}%</dd>
                    </div>
                  </dl>
                </article>
              )
            )}
          </div>

          <div className="comparison-metrics-grid">
            <article>
              <span>🤝</span>
              <p>Canciones compartidas</p>
              <strong>{comparison.shared_songs_count}</strong>
            </article>
            <article>
              <span>🎤</span>
              <p>Artistas compartidos</p>
              <strong>{comparison.shared_artists_count}</strong>
            </article>
            <article>
              <span>🅰️</span>
              <p>Exclusivas de A</p>
              <strong>{comparison.exclusive_songs_a_count}</strong>
            </article>
            <article>
              <span>🅱️</span>
              <p>Exclusivas de B</p>
              <strong>{comparison.exclusive_songs_b_count}</strong>
            </article>
          </div>

          <div className="comparison-diversity-note">
            <span aria-hidden="true">🧬</span>
            <p>
              <strong>Mayor diversidad relativa:</strong> {diversityWinnerName}
              {comparison.diversity_winner !== "tie" &&
                ". La medida compara artistas únicos con canciones únicas para evitar que el tamaño por sí solo decida el resultado."}
            </p>
          </div>

          <div className="comparison-lists-grid">
            <ComparisonList
              title="Canciones compartidas"
              total={comparison.shared_songs_count}
              items={comparison.shared_songs}
              emptyMessage="No comparten canciones exactas."
              searchPlaceholder="Buscar una canción compartida..."
            />
            <ComparisonList
              title={`Solo en ${comparison.collection_a.name}`}
              total={comparison.exclusive_songs_a_count}
              items={comparison.exclusive_songs_a}
              emptyMessage="No tiene canciones exclusivas frente a la otra colección."
              searchPlaceholder="Buscar una canción exclusiva..."
            />
            <ComparisonList
              title={`Solo en ${comparison.collection_b.name}`}
              total={comparison.exclusive_songs_b_count}
              items={comparison.exclusive_songs_b}
              emptyMessage="No tiene canciones exclusivas frente a la otra colección."
              searchPlaceholder="Buscar una canción exclusiva..."
            />
            <ComparisonList
              title="Artistas compartidos"
              total={comparison.shared_artists_count}
              items={comparison.shared_artists}
              emptyMessage="No comparten artistas."
              searchPlaceholder="Buscar un artista compartido..."
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default PlaylistComparisonCard;
