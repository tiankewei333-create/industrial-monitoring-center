export function Sparkline({
  values,
  hot,
}: {
  values: number[];
  hot?: boolean;
}) {
  if (values.length < 2) {
    return <div className="sparkline sparkline-empty" aria-hidden />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 140;
  const h = 36;
  const pad = 2;
  const d = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={`sparkline ${hot ? "hot" : ""}`}
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      aria-hidden
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
