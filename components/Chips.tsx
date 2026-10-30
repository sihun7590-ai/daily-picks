export function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "good" | "warn" | "solid" }) {
  const cls = {
    plain: "bg-surface-2 text-ink-2",
    good: "bg-good-bg text-good-ink",
    warn: "bg-warn-bg text-warn-ink",
    solid: "bg-accent text-bg",
  }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function Change({ pct }: { pct: number }) {
  const cls = pct > 0 ? "text-up" : pct < 0 ? "text-down" : "text-ink-3";
  return <span className={`num ${cls}`}>{`${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`}</span>;
}

export function Stat({ label, value, sub, valueClass = "" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={`num mt-0.5 font-semibold ${valueClass}`}>{value}</div>
      {sub ? <div className="num mt-0.5 text-xs text-ink-3">{sub}</div> : null}
    </div>
  );
}
