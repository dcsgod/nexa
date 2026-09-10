import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SemanticMapping } from '../api/client';
import { Loading, Meter, StatusPill } from '../components/ui';
import { ConceptTimeline } from '../components/ConceptTimeline';

const ACTOR = 'you@enterprise';

export function SemanticExplorer() {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const concepts = useQuery({ queryKey: ['concepts', q], queryFn: () => api.concepts(q) });

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1>Semantic Explorer</h1>
          <div className="muted">Enterprise language, grounded in technical evidence</div>
        </div>
        <input
          placeholder="Search concepts (e.g. Revenue)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            background: 'var(--bg-elev)', border: '1px solid var(--border-strong)',
            borderRadius: 8, color: 'var(--text)', padding: '9px 13px', width: 260, fontSize: 13,
          }}
        />
      </div>

      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div style={{ width: 320, flexShrink: 0 }}>
          {concepts.isLoading ? (
            <Loading what="concepts" />
          ) : (
            <div className="grid" style={{ gap: 8 }}>
              {concepts.data?.map((c) => (
                <button
                  key={c.concept_id}
                  onClick={() => setSelected(c.concept_id)}
                  className="card"
                  style={{
                    textAlign: 'left', cursor: 'pointer',
                    borderColor: selected === c.concept_id ? 'var(--accent)' : undefined,
                    padding: 14,
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>{c.name}</strong>
                    {c.has_conflict && <span className="pill bad">conflict</span>}
                  </div>
                  <div className="faint" style={{ fontSize: 12, margin: '4px 0 8px' }}>
                    {c.type.replace(/_/g, ' ')} · {c.domain}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="faint" style={{ fontSize: 11 }}>{c.mapping_count} mappings</span>
                    {c.best_confidence > 0 && (
                      <span className="pill accent">{Math.round(c.best_confidence * 100)}%</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          {selected ? <ConceptDetail conceptId={selected} /> : (
            <div className="card faint">Select a concept to see its definition, technical mappings, and evidence.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConceptDetail({ conceptId }: { conceptId: string }) {
  const detail = useQuery({ queryKey: ['concept', conceptId], queryFn: () => api.conceptDetail(conceptId) });
  if (detail.isLoading || !detail.data) return <Loading what="concept" />;
  const { concept, metric, mappings } = detail.data;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>{concept.name}</h2>
          <StatusPill status={concept.status} />
        </div>
        <p className="muted" style={{ marginTop: 8 }}>{concept.definition}</p>
        {concept.synonyms?.length ? (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <span className="faint" style={{ fontSize: 11 }}>synonyms:</span>
            {concept.synonyms.map((s) => <span key={s} className="pill">{s}</span>)}
          </div>
        ) : null}
        {metric && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h3>Metric definition</h3>
            <div className="mono" style={{ fontSize: 13 }}>{metric.expression}</div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <span className="pill">grain: {metric.grain}</span>
              <span className="pill">source: {metric.source.split('.').slice(-1)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Concept timeline</h3>
        <ConceptTimeline conceptId={concept.concept_id} />
      </div>

      <div className="card">
        <h3>Technical mappings — graph vs LLM confidence</h3>
        <div className="faint" style={{ fontSize: 12, marginBottom: 12 }}>
          Graph confidence (technical evidence) and LLM confidence (semantic interpretation) are kept separate.
        </div>
        <div className="grid" style={{ gap: 14 }}>
          {mappings.map((m) => <MappingRow key={m.mapping_id} m={m} />)}
        </div>
      </div>
    </div>
  );
}

function MappingRow({ m }: { m: SemanticMapping }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const expl = useQuery({
    queryKey: ['explanation', m.mapping_id],
    queryFn: () => api.explanation(m.mapping_id),
    enabled: open,
    retry: false,
  });
  const invalidate = () => qc.invalidateQueries();
  const decide = useMutation({
    mutationFn: (a: 'approve_mapping' | 'reject_mapping' | 'certify_metric') =>
      api.decideMapping(a, m.mapping_id, ACTOR, 'reviewed in Semantic Explorer'),
    onSuccess: invalidate,
  });

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8, padding: 12,
      borderLeftColor: m.conflict ? 'var(--bad)' : 'var(--border)', borderLeftWidth: m.conflict ? 3 : 1,
    }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="mono" style={{ fontSize: 12 }}>{m.technical_asset.replace('column:', '')}</span>
        <div className="row" style={{ gap: 6 }}>
          {m.conflict && <span className="pill bad">conflict</span>}
          <StatusPill status={m.status} />
        </div>
      </div>
      <div className="grid" style={{ gap: 6, marginTop: 10, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <div className="faint" style={{ fontSize: 11, marginBottom: 3 }}>Graph confidence</div>
          <Meter value={m.graph_confidence ?? 0} />
        </div>
        <div>
          <div className="faint" style={{ fontSize: 11, marginBottom: 3 }}>LLM confidence</div>
          <Meter value={m.llm_confidence ?? 0} tone="var(--purple)" />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <button className="btn ghost" style={{ padding: '4px 10px' }} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'Why?'} evidence
        </button>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost" style={{ padding: '4px 10px' }} onClick={() => decide.mutate('reject_mapping')}>Reject</button>
          <button className="btn ghost" style={{ padding: '4px 10px' }} onClick={() => decide.mutate('approve_mapping')}>Approve</button>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={() => decide.mutate('certify_metric')}>Certify</button>
        </div>
      </div>
      {open && expl.data?.level_3_llm && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div className="faint" style={{ fontSize: 11, marginBottom: 4 }}>
            Level 3 · LLM semantic interpretation ({expl.data.level_3_llm.llm_version})
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>{expl.data.level_3_llm.interpretation}</p>
          {expl.data.level_3_llm.grounding.map((g, i) => (
            <div key={i} className="row" style={{ gap: 6, fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: g.ok ? 'var(--good)' : 'var(--bad)' }}>{g.ok ? '✓' : '✗'}</span>
              <span className="muted">{g.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
