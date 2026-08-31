import { formatFcfa } from '@/lib/api';

export type Point = { label: string; value: number };

function maxVal(points: Point[]) {
  return Math.max(1, ...points.map((p) => p.value));
}

export function deltaPct(now: number, prev: number) {
  if (prev <= 0) return now > 0 ? 100 : 0;
  return Math.round(((now - prev) / prev) * 100);
}

export function BarChart({ points, format }: { points: Point[]; format?: (n: number) => string }) {
  const max = maxVal(points);
  const step = points.length > 20 ? 5 : points.length > 12 ? 2 : 1;
  const hasData = points.some((p) => p.value > 0);
  if (!hasData) return <div className="chart-no-data">Aucune activité sur cette période</div>;
  return (
    <div className="chart-shell" role="img" aria-label="Histogramme">
      <div className="chart-scale">
        <span>{format ? format(max) : max}</span>
        <span>{format ? format(Math.round(max / 2)) : Math.round(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="chart-bars">
        {points.map((p, i) => (
          <div key={p.label} className="chart-col" title={`${p.label} · ${format ? format(p.value) : p.value}`}>
            <div className="chart-bar-track">
              <div className="chart-bar" style={{ height: p.value > 0 ? `${Math.max(8, (p.value / max) * 100)}%` : '0%' }} />
            </div>
            <span className={i === 0 || i === points.length - 1 || i % step === 0 ? '' : 'chart-label-hidden'}>
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ points }: { points: Point[] }) {
  const total = points.reduce((sum, p) => sum + p.value, 0);
  if (!total) return <div className="chart-no-data">Aucune donnée sur cette période</div>;
  let cursor = 0;
  const colors = ['var(--gold)', 'var(--terra)', 'var(--ok)', '#6b7280', '#8b5cf6'];
  const gradient = points
    .map((p, i) => {
      const start = cursor;
      cursor += (p.value / total) * 100;
      return `${colors[i % colors.length]} ${start}% ${cursor}%`;
    })
    .join(', ');
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${gradient})` }}>
        <div>
          <strong>{total}</strong>
          <small>Total</small>
        </div>
      </div>
      <ul className="donut-legend">
        {points.map((p, i) => (
          <li key={p.label}>
            <i style={{ background: colors[i % colors.length] }} />
            <span>{p.label}</span>
            <strong>{p.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({ points, format }: { points: Point[]; format?: (n: number) => string }) {
  const max = maxVal(points);
  const w = 560;
  const h = 140;
  const pad = 8;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const coords = points.map((p, i) => {
    const x = pad + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = pad + innerH - (p.value / max) * innerH;
    return `${x},${y}`;
  });
  const area = `${pad},${pad + innerH} ${coords.join(' ')} ${pad + innerW},${pad + innerH}`;
  return (
    <svg className="chart-line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img">
      <polygon points={area} fill="var(--gold-soft)" />
      <polyline points={coords.join(' ')} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.length ? (
        <text x={w - pad} y={pad + 12} textAnchor="end" fontSize="11" fill="var(--muted)">
          {format ? format(points.at(-1)!.value) : points.at(-1)!.value}
        </text>
      ) : null}
    </svg>
  );
}

export function Kpi({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
}) {
  return (
    <div className="card stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {delta != null ? (
        <div className={`delta${delta >= 0 ? ' up' : ' down'}`}>
          {delta >= 0 ? '+' : ''}
          {delta}% vs veille
        </div>
      ) : hint ? (
        <div className="delta">{hint}</div>
      ) : null}
    </div>
  );
}

export function money(n: number | null | undefined) {
  if (n == null) return '—';
  return formatFcfa(n);
}

export function dayLabel(iso: string, compact = true) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5);
  return d.toLocaleDateString('fr-FR', compact ? { day: '2-digit', month: '2-digit' } : { weekday: 'short', day: 'numeric' });
}

export function monthLabel(ym: string) {
  const d = new Date(`${ym}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString('fr-FR', { month: 'short' });
}
