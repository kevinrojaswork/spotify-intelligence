type TopItem = {
  name: string;
  count: number;
};

type Props = {
  label: string;
  title: string;
  items: TopItem[];
  unit: string;
};

function TopListCard({ label, title, items, unit }: Props) {
  const maxCount = items[0]?.count || 1;

  return (
    <section className="discovery-card">
      <p className="section-label">{label}</p>
      <h2>{title}</h2>

      <div className="top-list">
        {items.map((item, index) => {
          const width = Math.max((item.count / maxCount) * 100, 8);

          return (
            <div className="top-list-item" key={item.name}>
              <div className="top-list-header">
                <span>
                  {index + 1}. {item.name}
                </span>
                <strong>
                  {item.count} {unit}
                </strong>
              </div>

              <div className="top-list-bar">
                <div style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default TopListCard;