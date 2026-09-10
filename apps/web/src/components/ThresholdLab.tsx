import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

/** §56 Threshold Lab — preview a confidence-threshold change before committing. */
export function ThresholdLab() {
  const [threshold, setThreshold] = useState(0.6);
  const sim = useMutation({ mutationFn: () => api.simulate({ confidence_threshold_override: threshold, requested_by: 'you@enterprise' }) });
  const summary = sim.data?.summary;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Threshold Lab · Simulate impact</h3>
        <span className="pill accent">counterfactual — no state changes</span>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '8px 0 14px' }}>
        Preview how changing the auto-trust confidence threshold would reshape the semantic layer —
        which mappings flip and which new conflicts appear — before committing anything.
      </p>

      <div className="row" style={{ gap: 12 }}>
        <span className="faint" style={{ fontSize: 12 }}>auto-trust threshold</span>
        <input type="range" min={0.3} max={0.95} step={0.05} value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))} style={{ flex: 1, maxWidth: 300 }} />
        <span className="mono" style={{ width: 40 }}>{Math.round(threshold * 100)}%</span>
        <button className="btn" onClick={() => sim.mutate()} disabled={sim.isPending}>
          {sim.isPending ? 'Simulating…' : 'Simulate'}
        </button>
      </div>

      {summary && (
        <div className="grid" style={{ gap: 14, marginTop: 16, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>
              MAPPINGS THAT WOULD FLIP ({summary.newly_flipped_mappings.length})
            </div>
            {summary.newly_flipped_mappings.length === 0 ? <div className="faint" style={{ fontSize: 12 }}>none</div> :
              summary.newly_flipped_mappings.map((m) => (
                <div key={m.mapping_id} className="row" style={{ gap: 6, fontSize: 12, marginBottom: 4 }}>
                  <strong>{m.concept}</strong>
                  <span className="faint">{m.from}</span>
                  <span style={{ color: m.to === 'approved' ? 'var(--good)' : 'var(--warn)' }}>→ {m.to}</span>
                </div>
              ))}
          </div>
          <div>
            <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>
              NEW CONFLICTS ({summary.newly_created_conflicts.length})
            </div>
            {summary.newly_created_conflicts.length === 0 ? <div className="faint" style={{ fontSize: 12 }}>none</div> :
              summary.newly_created_conflicts.map((c, i) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 6 }}>
                  <span className="pill bad" style={{ marginRight: 6 }}>{c.concept}</span>
                  <span className="mono faint" style={{ fontSize: 11 }}>
                    {c.asset_a.split('.').slice(-1)} vs {c.asset_b.split('.').slice(-1)}
                  </span>
                </div>
              ))}
          </div>
          {summary.affected_genie_agents.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>AFFECTED GENIE AGENTS</div>
              {summary.affected_genie_agents.map((a) => (
                <span key={a.agent_id} className={`pill ${a.materially_changed ? 'bad' : 'warn'}`} style={{ marginRight: 6 }}>
                  {a.name}{a.materially_changed ? ' · material' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
