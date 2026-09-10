import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const NAV = [
  { to: '/overview', label: 'Overview', icon: '◈' },
  { to: '/ontology', label: 'Technical Ontology', icon: '⌗' },
  { to: '/semantic', label: 'Semantic Explorer', icon: '❖' },
  { to: '/genie', label: 'Genie Builder', icon: '✦' },
  { to: '/governance', label: 'Governance', icon: '⚖' },
  { to: '/drift', label: 'Drift & Impact', icon: '⚡' },
];

export function Layout() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health });
  const ai = useQuery({ queryKey: ['ai-status'], queryFn: api.aiStatus, refetchInterval: 20_000 });
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        style={{
          width: 236,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-elev)',
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 12px',
        }}
      >
        <div style={{ padding: '4px 10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg,var(--accent),var(--purple))',
              display: 'grid', placeItems: 'center', fontWeight: 800, color: 'white',
            }}
          >
            N
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Nexa</div>
            <div className="faint" style={{ fontSize: 10 }}>Semantic Intelligence</div>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 11px', borderRadius: 8, fontSize: 13,
                fontWeight: 500,
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
                background: isActive ? 'var(--bg-elev-2)' : 'transparent',
                textDecoration: 'none',
              })}
            >
              <span style={{ width: 16, textAlign: 'center', opacity: 0.8 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '10px', fontSize: 11 }} className="faint">
          <div className="row" style={{ gap: 6 }}>
            <span
              style={{
                width: 7, height: 7, borderRadius: 99,
                background: health.data ? 'var(--good)' : 'var(--bad)',
              }}
            />
            {health.data ? `API up · ${health.data.mode} mode` : 'API unreachable'}
          </div>
          <div className="row" style={{ gap: 6, marginTop: 5 }}>
            <span
              style={{
                width: 7, height: 7, borderRadius: 99,
                background: ai.data?.ok ? 'var(--good)' : 'var(--warn)',
              }}
            />
            {ai.data?.ok ? 'AI engine up' : 'AI engine offline (degraded)'}
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 30px' }}>
        <Outlet />
      </main>
    </div>
  );
}
