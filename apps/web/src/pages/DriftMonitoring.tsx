import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type DriftEvent, type HealingProposal } from '../api/client';
import { Loading, Meter, StatusPill } from '../components/ui';

const ACTOR = 'you@enterprise';

const SIMULATIONS: { label: string; change: Record<string, string> }[] = [
  { label: 'Change net_sales → double', change: { kind: 'change_type', table: 'retail.sales.fact_sales', column: 'net_sales', data_type: 'double' } },
  { label: 'Drop orders.customer_id', change: { kind: 'drop_column', table: 'retail.crm.orders', column: 'customer_id' } },
  { label: 'Add fact_sales.discount', change: { kind: 'add_column', table: 'retail.sales.fact_sales', column: 'discount', data_type: 'decimal(18,2)' } },
];

export function DriftMonitoring() {
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ['drift'], queryFn: api.driftEvents });
  const [selected, setSelected] = useState<DriftEvent | null>(null);

  const invalidate = () => qc.invalidateQueries();
  const simulate = useMutation({ mutationFn: (c: Record<string, string>) => api.simulateDrift(c), onSuccess: invalidate });
  const detect = useMutation({ mutationFn: () => api.detectDrift(), onSuccess: invalidate });

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1>Drift & Impact</h1>
          <div className="muted">Schema changes propagate through the dependency graph — self-healing, not silent rewrites.</div>
        </div>
        <button className="btn ghost" onClick={() => detect.mutate()} disabled={detect.isPending}>
          {detect.isPending ? 'Scanning…' : '↻ Detect drift'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Simulate a schema change (demo)</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {SIMULATIONS.map((s) => (
            <button key={s.label} className="btn ghost" style={{ padding: '6px 12px' }}
              onClick={() => simulate.mutate(s.change)} disabled={simulate.isPending}>
              {s.label}
            </button>
          ))}
        </div>
        {simulate.data && <div className="pill accent" style={{ marginTop: 10 }}>{simulate.data.description}</div>}
      </div>

      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div style={{ width: 380, flexShrink: 0 }}>
          <h3>Drift events</h3>
          {events.isLoading ? <Loading /> : events.data?.length ? (
            <div className="grid" style={{ gap: 8 }}>
              {events.data.map((e) => (
                <button key={e.drift_id} className="card" style={{ textAlign: 'left', cursor: 'pointer', padding: 12, borderColor: selected?.drift_id === e.drift_id ? 'var(--accent)' : undefined }}
                  onClick={() => setSelected(e)}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="pill">{e.change_type.replace(/_/g, ' ')}</span>
                    <StatusPill status={e.status} />
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>{e.detail}</div>
                  <div className="faint mono" style={{ fontSize: 10, marginTop: 4 }}>{e.table}</div>
                </button>
              ))}
            </div>
          ) : <div className="card faint">No drift detected. Simulate a change above.</div>}
        </div>

        <div style={{ flex: 1 }}>
          {selected ? <ImpactPanel event={selected} /> : (
            <div className="card faint">Select a drift event to see its blast radius and heal affected agents.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactPanel({ event }: { event: DriftEvent }) {
  const impact = useQuery({ queryKey: ['impact', event.asset_id], queryFn: () => api.impact(event.asset_id) });
  if (impact.isLoading || !impact.data) return <Loading what="impact" />;
  const i = impact.data;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h3>Impact analysis</h3>
        <div className="mono faint" style={{ fontSize: 12, marginBottom: 10 }}>{event.detail}</div>
        <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
          <Stat n={i.affected_metrics.length} label="metrics" />
          <Stat n={i.affected_agents.length} label="Genie agents" />
          <Stat n={i.affected_mappings.length} label="semantic mappings" />
          <Stat n={i.downstream_assets.length} label="downstream assets" />
        </div>
        {i.high_risk.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>HIGH RISK</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {i.high_risk.map((h) => <span key={h} className="pill bad">{h}</span>)}
            </div>
          </div>
        )}
      </div>

      {i.affected_agents.length > 0 && (
        <div className="card">
          <h3>Affected Genie agents — self-heal</h3>
          <div className="grid" style={{ gap: 10 }}>
            {i.affected_agents.map((a) => <HealRow key={a.agent_id} agentId={a.agent_id} name={a.name} status={a.status} reason={a.reason} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 700, color: n > 0 ? 'var(--warn)' : 'var(--text)' }}>{n}</div>
      <div className="faint" style={{ fontSize: 11 }}>{label}</div>
    </div>
  );
}

function HealRow({ agentId, name, status, reason }: { agentId: string; name: string; status: string; reason: string }) {
  const qc = useQueryClient();
  const [proposal, setProposal] = useState<HealingProposal | null>(null);
  const propose = useMutation({ mutationFn: () => api.proposeHeal(agentId), onSuccess: setProposal });
  const approve = useMutation({
    mutationFn: () => api.approveHeal(proposal!.candidate_agent_id, agentId, ACTOR),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{name}</strong>
          <div className="faint" style={{ fontSize: 11 }}>{reason}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <StatusPill status={status} />
          <button className="btn ghost" style={{ padding: '4px 10px' }} onClick={() => propose.mutate()} disabled={propose.isPending}>
            {propose.isPending ? 'Recompiling…' : 'Propose fix'}
          </button>
        </div>
      </div>

      {proposal && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="faint" style={{ fontSize: 11 }}>recompiled candidate re-benchmarked</span>
            <span className={`pill ${proposal.recommendation === 'safe_to_redeploy' ? 'good' : 'warn'}`}>
              {proposal.recommendation.replace(/_/g, ' ')}
            </span>
          </div>
          <div style={{ maxWidth: 260, marginBottom: 8 }}><Meter value={proposal.gate.overall} /></div>
          <div className="faint" style={{ fontSize: 12, marginBottom: 8 }}>
            gate: {proposal.gate.verdict.replace(/_/g, ' ')}
            {proposal.diff.grain_now_flagged && ' · ⚠ grain now flagged'}
            {proposal.diff.added_assets.length > 0 && ` · +${proposal.diff.added_assets.length} assets`}
            {proposal.diff.removed_assets.length > 0 && ` · -${proposal.diff.removed_assets.length} assets`}
          </div>
          <button className="btn" onClick={() => approve.mutate()}
            disabled={proposal.recommendation !== 'safe_to_redeploy' || approve.isPending || approve.isSuccess}>
            {approve.isSuccess ? '✓ Redeployed' : approve.isPending ? 'Redeploying…' : 'Approve & redeploy'}
          </button>
          {proposal.recommendation !== 'safe_to_redeploy' && (
            <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>Redeploy blocked — requires manual review.</div>
          )}
        </div>
      )}
    </div>
  );
}
