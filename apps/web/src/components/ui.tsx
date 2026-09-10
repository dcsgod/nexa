import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: 'good' | 'warn' | 'bad' | 'accent';
}) {
  const color =
    tone === 'good' ? 'var(--good)' :
    tone === 'warn' ? 'var(--warn)' :
    tone === 'bad' ? 'var(--bad)' :
    tone === 'accent' ? 'var(--accent)' : 'var(--text)';
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="faint" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color }}>{value}</div>
      {sub && <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Meter({ value, tone }: { value: number; tone?: string }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 90 ? 'var(--good)' : pct >= 70 ? 'var(--accent)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="meter" style={{ flex: 1 }}>
        <span style={{ width: `${pct}%`, background: tone ?? color }} />
      </div>
      <span className="mono" style={{ minWidth: 34, textAlign: 'right', color }}>{pct}%</span>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    trusted: 'good', certified: 'good', approved: 'good', ready: 'good',
    candidate: 'accent', proposed: 'accent', draft: 'accent',
    conflict: 'bad', rejected: 'bad', needs_review: 'warn', deprecated: 'warn',
  };
  return <span className={`pill ${map[status] ?? ''}`}>{status}</span>;
}

export function Loading({ what }: { what?: string }) {
  return <div className="faint" style={{ padding: 40 }}>Loading {what ?? ''}…</div>;
}
