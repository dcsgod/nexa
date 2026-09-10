export function ComingSoon({
  title,
  phase,
  bullets,
}: {
  title: string;
  phase: string;
  bullets: string[];
}) {
  return (
    <div>
      <h1>{title}</h1>
      <div className="pill accent" style={{ marginBottom: 18 }}>{phase}</div>
      <div className="card" style={{ maxWidth: 640 }}>
        <h3>Planned in this workspace</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }} className="muted">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
