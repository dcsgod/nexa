import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type CompileOutput } from '../api/client';
import { Meter } from '../components/ui';
import { GenieAgentPanel } from '../components/GenieAgentPanel';

const EXAMPLES = [
  'Build me a supply chain intelligence agent',
  'Why is inventory increasing by supplier over time?',
  'Compare revenue and inventory units by product and store',
  'Show revenue and units sold by region last month',
];

export function GenieBuilder() {
  const [request, setRequest] = useState('');
  const compile = useMutation({ mutationFn: (r: string) => api.genieCompile(r) });

  return (
    <div>
      <h1>Genie Builder</h1>
      <div className="muted" style={{ marginBottom: 18 }}>
        Describe what you need. The semantic compiler interprets intent, selects trusted assets,
        plans joins, checks grain, and compiles a governed Genie configuration.
      </div>

      <div className="card">
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="e.g. Create an agent that helps me understand why inventory is increasing"
          rows={3}
          style={{
            width: '100%', background: 'var(--bg)', border: '1px solid var(--border-strong)',
            borderRadius: 8, color: 'var(--text)', padding: 12, fontSize: 14, resize: 'vertical',
            fontFamily: 'var(--sans)',
          }}
        />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} className="pill" style={{ cursor: 'pointer' }} onClick={() => setRequest(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <button className="btn" disabled={request.length < 3 || compile.isPending} onClick={() => compile.mutate(request)}>
            {compile.isPending ? 'Compiling…' : '✦ Compile agent'}
          </button>
        </div>
      </div>

      {compile.data && <Result out={compile.data} />}
      {compile.isError && <div className="card" style={{ marginTop: 16, color: 'var(--bad)' }}>Compile failed.</div>}
    </div>
  );
}

function Result({ out }: { out: CompileOutput }) {
  const { plan, config } = out;
  const ready = plan.grain_warnings.every((w) => w.severity !== 'critical') && plan.scores.overall >= 0.7;

  return (
    <div className="grid" style={{ gap: 16, marginTop: 18 }}>
      {/* Step 1 — interpretation */}
      <div className="card">
        <h3>1 · AI interpretation</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="pill accent">domain: {plan.intent.domain}</span>
          {plan.intent.time_comparison && <span className="pill">time comparison</span>}
          {plan.intent.concepts.map((c) => <span key={c} className="pill">{c}</span>)}
        </div>
      </div>

      {/* Step 2 — recommended model */}
      <div className="row" style={{ alignItems: 'stretch', gap: 16 }}>
        <div className="card" style={{ flex: 1 }}>
          <h3>2 · Recommended semantic model</h3>
          <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>ASSETS</div>
          {plan.selected_assets.map((a) => (
            <div key={a.asset_id} className="row" style={{ justifyContent: 'space-between', padding: '5px 0' }}>
              <span className="mono" style={{ fontSize: 12 }}>{a.asset_id.replace('table:', '')}</span>
              <div className="row" style={{ gap: 5 }}>
                <span className="pill">{a.role}</span>
                {a.certified && <span className="pill good">certified</span>}
              </div>
            </div>
          ))}
          {plan.metrics.length > 0 && (
            <>
              <div className="faint" style={{ fontSize: 11, margin: '10px 0 6px' }}>METRICS</div>
              {plan.metrics.map((m) => (
                <div key={m.name} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>{m.name}</span>
                  <span className="mono faint" style={{ fontSize: 11 }}>{m.expression} · {m.grain}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Step 3 — evidence + trust */}
        <div className="card" style={{ width: 320, flexShrink: 0 }}>
          <h3>3 · Trust & quality</h3>
          {(['semantic_coverage', 'metric_coverage', 'relationship_trust', 'data_quality'] as const).map((k) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <div className="faint" style={{ fontSize: 11, marginBottom: 3 }}>{k.replace(/_/g, ' ')}</div>
              <Meter value={plan.scores[k]} />
            </div>
          ))}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            {plan.evidence.map((e, i) => (
              <div key={i} className="row" style={{ gap: 6, fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: e.ok ? 'var(--good)' : 'var(--warn)' }}>{e.ok ? '✓' : '⚠'}</span>
                <span className="muted">{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grain safeguard */}
      {plan.grain_warnings.map((w, i) => (
        <div key={i} className="card" style={{ borderColor: w.severity === 'critical' ? 'var(--bad)' : 'var(--warn)' }}>
          <h3 style={{ color: w.severity === 'critical' ? 'var(--bad)' : 'var(--warn)' }}>
            ⚠ Grain {w.severity === 'critical' ? 'safeguard' : 'notice'}
          </h3>
          <p className="muted" style={{ margin: 0 }}>{w.message}</p>
        </div>
      ))}

      {/* Step 4 — Genie preview */}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>4 · Genie configuration preview</h3>
          <span className={`pill ${ready ? 'good' : 'warn'}`}>
            {ready ? 'READY (pending P4 validation)' : 'HUMAN REVIEW REQUIRED'}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 12, marginTop: 10 }}>{config.name}</div>
        <div className="faint" style={{ fontSize: 11, margin: '10px 0 4px' }}>INSTRUCTIONS</div>
        <ul className="muted" style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7 }}>
          {config.instructions.map((ins, i) => (
            <li key={i} style={{ color: ins.startsWith('GRAIN') ? 'var(--bad)' : undefined }}>{ins}</li>
          ))}
        </ul>
        <div className="faint" style={{ fontSize: 11, margin: '12px 0 4px' }}>EXAMPLE QUESTIONS</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {config.example_questions.map((q) => <span key={q} className="pill">{q}</span>)}
        </div>
      </div>

      {/* Step 5-6 — quality gate, deploy, chat, explainability (P4) */}
      <GenieAgentPanel agentId={config.agent_id} />
    </div>
  );
}
