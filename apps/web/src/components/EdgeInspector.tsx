import { useQuery } from '@tanstack/react-query';
import { api, type Evidence, type TechnicalEdge } from '../api/client';
import { Meter, StatusPill } from './ui';

const SIGNAL_LABELS: Record<string, string> = {
  semantic_similarity: 'Semantic similarity',
  structural_compatibility: 'Structural compatibility',
  value_overlap: 'Value overlap',
  lineage: 'Lineage',
  behavioral_usage: 'Behavioral usage',
  data_quality: 'Data quality',
  model_prediction: 'Graph ML prediction',
};

export function EdgeInspector({ edge, onClose }: { edge: TechnicalEdge; onClose: () => void }) {
  const conf = useQuery({
    queryKey: ['confidence', edge.edge_id],
    queryFn: () => api.confidence(edge.edge_id),
    retry: false,
  });
  const explanation = useQuery({
    queryKey: ['explanation', edge.edge_id],
    queryFn: () => api.explanation(edge.edge_id),
    retry: false,
  });
  const evidence = useQuery({
    queryKey: ['evidence-bundle', edge.edge_id],
    queryFn: async () => {
      const results: Evidence[] = [];
      for (const id of edge.evidence_ids.slice(0, 8)) {
        try { results.push(await api.evidence(id)); } catch { /* skip */ }
      }
      return results;
    },
  });

  const short = (id: string) => id.replace(/^(table|column):/, '');

  return (
    <div className="card" style={{ height: '100%', overflow: 'auto' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Why this relationship?</h3>
        <button className="btn ghost" style={{ padding: '3px 9px' }} onClick={onClose}>✕</button>
      </div>

      <div style={{ margin: '12px 0' }}>
        <div className="mono" style={{ fontSize: 12 }}>{short(edge.source)}</div>
        <div className="faint" style={{ fontSize: 11, margin: '2px 0' }}>
          ↓ {edge.edge_type.replace(/_/g, ' ')}
        </div>
        <div className="mono" style={{ fontSize: 12 }}>{short(edge.target)}</div>
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <StatusPill status={edge.status} />
          <span className="pill accent">confidence {Math.round(edge.confidence * 100)}%</span>
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>Level 1 · Confidence signals</h3>
      {conf.isError && <div className="faint">No multi-factor breakdown (deterministic edge).</div>}
      {conf.data && (
        <div className="grid" style={{ gap: 10 }}>
          {Object.entries(SIGNAL_LABELS).map(([k, label]) => {
            const v = conf.data!.signals[k];
            if (typeof v !== 'number') return null;
            return (
              <div key={k}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 3 }}>
                  <span className="muted" style={{ fontSize: 12 }}>{label}</span>
                </div>
                <Meter value={v} />
              </div>
            );
          })}
          <div style={{ marginTop: 4 }}>
            {conf.data.gates_passed.map((g) => (
              <span key={g} className="pill good" style={{ marginRight: 6 }}>✓ {g}</span>
            ))}
            {conf.data.gates_failed.map((g) => (
              <span key={g} className="pill bad" style={{ marginRight: 6 }}>✕ {g}</span>
            ))}
          </div>
          {conf.data.conflict && (
            <div className="pill bad" style={{ width: 'fit-content' }}>⚠ Semantic conflict detected</div>
          )}
        </div>
      )}

      {explanation.data?.level_2_model && (
        <>
          <h3 style={{ marginTop: 18 }}>Level 2 · Graph-ML model</h3>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="faint mono" style={{ fontSize: 11 }}>
              {explanation.data.level_2_model.model_version}
            </span>
            <span className="pill accent">
              prediction {Math.round(explanation.data.level_2_model.prediction * 100)}%
            </span>
          </div>
          <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>
            Strongest contributing signals
          </div>
          <div className="grid" style={{ gap: 6 }}>
            {explanation.data.level_2_model.top_signals
              .filter((s) => s.contribution > 0)
              .map((s) => (
                <div key={s.signal} className="row" style={{ gap: 8 }}>
                  <span className="muted" style={{ fontSize: 12, width: 140 }}>
                    {s.signal.replace(/_/g, ' ')}
                  </span>
                  <Meter value={s.contribution} />
                </div>
              ))}
          </div>
        </>
      )}

      <h3 style={{ marginTop: 18 }}>Evidence</h3>
      {evidence.data?.length ? (
        <div className="grid" style={{ gap: 8 }}>
          {evidence.data.map((ev) => (
            <div key={ev.evidence_id} style={{ borderLeft: '2px solid var(--accent-dim)', paddingLeft: 10 }}>
              <div style={{ fontSize: 12 }}>
                <span className="pill" style={{ marginRight: 6 }}>{ev.type}</span>
                strength {Math.round(ev.strength * 100)}%
              </div>
              <div className="faint mono" style={{ fontSize: 11, marginTop: 2 }}>{ev.source}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="faint">No evidence records linked.</div>
      )}
    </div>
  );
}
