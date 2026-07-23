type TopItem = {
  name: string;
  count: number;
  rank?: number;
};

type Props = {
  label: string;
  title: string;
  items: TopItem[];
  unit: string;
  referenceMaxCount?: number;
  showCount?: boolean;
};

function TopListCard({
  label,
  title,
  items,
  unit,
  referenceMaxCount,
  showCount = true,
}: Props) {
  const maxCount = Math.max(
    referenceMaxCount ?? Math.max(...items.map((item) => item.count), 1),
    1
  );

  return (
    <section className="discovery-card">
      <p className="section-label">{label}</p>
      <h2>{title}</h2>

      {items.length === 0 ? (
        <p className="ranking-empty-state">
          No encontramos resultados que coincidan con esta búsqueda.
        </p>
      ) : (
        <div className="top-list">
          {items.map((item, index) => {
            const width = Math.max((item.count / maxCount) * 100, 8);
            const position = item.rank ?? index + 1;

            return (
              <div className="top-list-item" key={`${position}-${item.name}`}>
                <div className="top-list-header">
                  <span>
                    {position}. {item.name}
                  </span>

                  {showCount && (
                    <strong>
                      {item.count} {unit}
                    </strong>
                  )}
                </div>

                {showCount && (
                  <div className="top-list-bar">
                    <div style={{ width: `${width}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default TopListCard;
