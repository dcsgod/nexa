import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, type ChatResponse } from '../api/client';
import { Meter } from './ui';

const ACTOR = 'you@enterprise';

export function GenieAgentPanel({ agentId }: { agentId: string }) {
  const validate = useMutation({ mutationFn: () => api.validateGenie(agentId) });
  const deploy = useMutation({ mutationFn: () => api.deployGenie(agentId, ACTOR) });

  const gate = deploy.data?.gate ?? validate.data?.gate;
  const ready = gate?.verdict === 'READY_FOR_DEPLOYMENT';
  const deployed = deploy.data?.deployed;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>5 · Quality gate & deploy</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => validate.mutate()} disabled={validate.isPending}>
              {validate.isPending ? 'Running benchmarks…' : 'Run quality gate'}
            </button>
            <button
              className="btn"
              onClick={() => deploy.mutate()}
              disabled={!ready || deploy.isPending || deployed}
              title={ready ? '' : 'Deploy is disabled until the quality gate passes'}
            >
              {deployed ? '✓ Deployed' : deploy.isPending ? 'Deploying…' : 'Deploy agent'}
            </button>
          </div>
        </div>

        {validate.data && (
          <div className="faint" style={{ fontSize: 11, marginTop: 12, marginBottom: 6 }}>
            BENCHMARKS
            {validate.data.benchmarks.map((b, i) => (
              <div key={i} className="row" style={{ gap: 6, fontSize: 12, margin: '4px 0' }}>
                <span style={{ color: b.passed ? 'var(--good)' : 'var(--bad)' }}>{b.passed ? '✓' : '✗'}</span>
                <span className="muted">{b.question}</span>
              </div>
            ))}
          </div>
        )}

        {gate && (
          <div style={{ marginTop: 10 }}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['semantic_coverage', 'metric_coverage', 'relationship_trust', 'benchmark_accuracy', 'data_quality'] as const).map((k) => (
                <div key={k}>
                  <div className="faint" style={{ fontSize: 11, marginBottom: 3 }}>{k.replace(/_/g, ' ')}</div>
                  <Meter value={gate[k] ?? 0} />
                </div>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <span className={`pill ${ready ? 'good' : 'warn'}`}>{gate.verdict.replace(/_/g, ' ')}</span>
              {gate.failed_gates.length > 0 && (
                <span className="faint" style={{ fontSize: 12 }}>failed: {gate.failed_gates.join(', ')}</span>
              )}
            </div>
          </div>
        )}

        {deploy.data?.provisioning && (
          <div className="pill good" style={{ marginTop: 12 }}>
            Provisioned: {deploy.data.provisioning.agent_id} · {deploy.data.provisioning.status}
          </div>
        )}
      </div>

      {deployed && <ChatAndExplain agentId={agentId} />}
    </div>
  );
}

function ChatAndExplain({ agentId }: { agentId: string }) {
  const [msg, setMsg] = useState('What was Revenue by region last month?');
  const [turns, setTurns] = useState<{ q: string; r: ChatResponse }[]>([]);
  const explain = useQuery({ queryKey: ['genie-explain', agentId], queryFn: () => api.explainGenie(agentId) });
  const chat = useMutation({
    mutationFn: (m: string) => api.chatGenie(agentId, m),
    onSuccess: (r, m) => setTurns((t) => [...t, { q: m, r }]),
  });

  return (
    <div className="row" style={{ alignItems: 'stretch', gap: 16 }}>
      <div className="card" style={{ flex: 1 }}>
        <h3>6 · Genie chat</h3>
        <div style={{ maxHeight: 260, overflow: 'auto', marginBottom: 10 }}>
          {turns.map((t, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><span className="pill accent">you</span><span>{t.q}</span></div>
              <div style={{ marginTop: 6, paddingLeft: 4 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13 }}>{t.r.answer}</p>
                {t.r.sql && (
                  <pre className="mono" style={{ background: 'var(--bg)', padding: 8, borderRadius: 6, fontSize: 11, overflow: 'auto', margin: '6px 0' }}>{t.r.sql}</pre>
                )}
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {t.r.data_sources.map((s) => <span key={s} className="pill">{s.split('.').slice(-1)}</span>)}
                  {t.r.confidence != null && <span className="pill accent">conf {Math.round(t.r.confidence * 100)}%</span>}
                </div>
                {t.r.semantic_definitions.map((d) => (
                  <div key={d.term} className="faint" style={{ fontSize: 11, marginTop: 4 }}>
                    <strong>{d.term}</strong>: {d.definition}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && chat.mutate(msg)}
            style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13 }}
          />
          <button className="btn" onClick={() => chat.mutate(msg)} disabled={chat.isPending}>Ask</button>
        </div>
      </div>

      <div className="card" style={{ width: 320, flexShrink: 0 }}>
        <h3>Why these tables?</h3>
        {explain.data && (
          <>
            <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>DECISION PATH</div>
            {explain.data.decision_path.map((s, i) => (
              <div key={i} className="mono" style={{ fontSize: 11, marginBottom: 3 }}>
                {s.from.split('.').slice(-1)} <span className="faint">→</span> {s.to.split('.').slice(-1)}
              </div>
            ))}
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {explain.data.evidence.map((e, i) => (
                <div key={i} className="row" style={{ gap: 6, fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: e.ok ? 'var(--good)' : 'var(--warn)' }}>{e.ok ? '✓' : '⚠'}</span>
                  <span className="muted">{e.text}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
