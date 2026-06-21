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
  return (
    <section className="discovery-card">
      <p className="section-label">{label}</p>
      <h2>{title}</h2>

      {items.map((item, index) => (
        <p key={item.name}>
          {index + 1}. {item.name} — {item.count} {unit}
        </p>
      ))}
    </section>
  );
}

export default TopListCard;