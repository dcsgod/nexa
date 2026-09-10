import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type MappingHistoryRow } from '../api/client';

const STATUS_COLOR: Record<string, string> = {
  certified: 'var(--good)', approved: 'var(--good)',
  candidate: 'var(--accent)', proposed: 'var(--accent)',
  rejected: 'var(--text-faint)', superseded: 'var(--text-faint)', deprecated: 'var(--warn)',
};

/** §55 Concept Timeline — the history of meaning for a concept. */
export function ConceptTimeline({ conceptId }: { conceptId: string }) {
  const history = useQuery({ queryKey: ['concept-history', conceptId], queryFn: () => api.conceptHistory(conceptId) });
  const [compare, setCompare] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<MappingHistoryRow | null>(null);

  const rows = history.data ?? [];
  const diff = useQuery({
    queryKey: ['concept-diff', conceptId, compare?.[0], compare?.[1]],
    queryFn: () => api.conceptDiff(conceptId, compare![0], compare![1]),
    enabled: !!compare,
    retry: false,
  });

  const nodes = useMemo(() => rows.map((r) => ({ r, color: STATUS_COLOR[r.status] ?? 'var(--text-dim)' })), [rows]);

  if (history.isLoading) return <div className="faint">Loading timeline…</div>;
  if (rows.length === 0) return <div className="faint" style={{ fontSize: 12 }}>No mapping history yet.</div>;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="faint" style={{ fontSize: 11 }}>Every version this concept's mapping has had</span>
        {rows.length >= 2 && (
          <button className="btn ghost" style={{ padding: '3px 9px' }}
            onClick={() => setCompare(compare ? null : [rows[0]!.version, rows[rows.length - 1]!.version])}>
            {compare ? 'Exit compare' : 'Compare first ↔ latest'}
          </button>
        )}
      </div>

      {/* horizontal timeline */}
      <div className="row" style={{ gap: 0, alignItems: 'center', overflowX: 'auto', padding: '4px 0 10px' }}>
        {nodes.map(({ r, color }, i) => (
          <div key={r.version} className="row" style={{ gap: 0, alignItems: 'center' }}>
            <button
              onClick={() => setSelected(r)}
              title={`v${r.version} · ${r.status}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: 999, background: r.valid_to ? 'transparent' : color,
                border: `2px solid ${color}`,
                outline: selected?.version === r.version ? '2px solid var(--accent)' : 'none', outlineOffset: 2,
              }} />
              <span className="mono" style={{ fontSize: 10, color }}>v{r.version}</span>
            </button>
            {i < nodes.length - 1 && <span style={{ width: 34, height: 2, background: 'var(--border-strong)' }} />}
          </div>
        ))}
      </div>

      {selected && !compare && (
        <div style={{ borderLeft: `2px solid ${STATUS_COLOR[selected.status] ?? 'var(--border)'}`, paddingLeft: 12, marginTop: 6 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="pill">v{selected.version} · {selected.status}</span>
            <span className="faint" style={{ fontSize: 11 }}>{new Date(selected.valid_from).toLocaleString()}</span>
          </div>
          <div className="mono" style={{ fontSize: 12, marginTop: 6 }}>{selected.technical_asset.replace('column:', '')}</div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
            graph {Math.round((selected.graph_confidence ?? 0) * 100)}% · llm {Math.round((selected.llm_confidence ?? 0) * 100)}% · by {selected.approved_by}
          </div>
          {selected.approval_reason && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>“{selected.approval_reason}”</div>}
        </div>
      )}

      {compare && diff.data && (
        <div className="row" style={{ gap: 12, marginTop: 6 }}>
          <DiffCol title={`v${diff.data.from.version}`} status={diff.data.from.status} asset={diff.data.from.technical_asset} />
          <div className="faint" style={{ alignSelf: 'center' }}>→</div>
          <DiffCol title={`v${diff.data.to.version}`} status={diff.data.to.status} asset={diff.data.to.technical_asset} />
          <div style={{ flex: 1 }}>
            <div className="faint" style={{ fontSize: 11, marginBottom: 4 }}>CHANGES</div>
            <div style={{ fontSize: 12 }} className="muted">
              {diff.data.status_changed && <div>• status changed</div>}
              {diff.data.technical_asset_changed && <div>• technical asset changed</div>}
              {diff.data.confidence_delta !== 0 && <div>• confidence {diff.data.confidence_delta > 0 ? '+' : ''}{Math.round(diff.data.confidence_delta * 100)}%</div>}
              {!diff.data.status_changed && !diff.data.technical_asset_changed && diff.data.confidence_delta === 0 && <div>no material change</div>}
            </div>
            {diff.data.affected_genie_agents.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="faint" style={{ fontSize: 11, marginBottom: 4 }}>AFFECTED GENIE AGENTS</div>
                {diff.data.affected_genie_agents.map((a) => <span key={a.agent_id} className="pill warn" style={{ marginRight: 6 }}>{a.name}</span>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DiffCol({ title, status, asset }: { title: string; status: string; asset: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, minWidth: 150 }}>
      <div className="row" style={{ gap: 6 }}><span className="pill">{title}</span><span className="pill">{status}</span></div>
      <div className="mono" style={{ fontSize: 11, marginTop: 6 }}>{asset.replace('column:', '')}</div>
    </div>
  );
}
