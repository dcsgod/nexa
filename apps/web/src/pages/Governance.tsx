import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type GovernanceEvent, type TechnicalEdge } from '../api/client';
import { Loading, StatusPill } from '../components/ui';
import { ThresholdLab } from '../components/ThresholdLab';

const ACTOR = 'you@enterprise'; // in P0/P1 a placeholder; wired to OAuth identity later.

export function Governance() {
  const qc = useQueryClient();
  const queue = useQuery({ queryKey: ['review-queue'], queryFn: api.reviewQueue });
  const log = useQuery({ queryKey: ['gov-log'], queryFn: api.governanceLog });

  const invalidate = () =>
    qc.invalidateQueries({ predicate: (q) => ['review-queue', 'gov-log', 'overview', 'edges'].includes(q.queryKey[0] as string) });

  const approve = useMutation({
    mutationFn: (v: { id: string; reason: string }) => api.approve(v.id, ACTOR, v.reason),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (v: { id: string; reason: string }) => api.reject(v.id, ACTOR, v.reason),
    onSuccess: invalidate,
  });
  const resolve = useMutation({
    mutationFn: (v: { id: string; res: 'trusted' | 'rejected'; reason: string }) =>
      api.resolveConflict(v.id, ACTOR, v.res, v.reason),
    onSuccess: invalidate,
  });

  if (queue.isLoading || !queue.data) return <Loading what="review queue" />;
  const { candidates, conflicts } = queue.data;

  return (
    <div>
      <h1>Semantic Governance</h1>
      <div className="muted" style={{ marginBottom: 20 }}>
        Human decisions become durable semantic knowledge — every action is audited.
      </div>

      <div style={{ marginBottom: 24 }}>
        <ThresholdLab />
      </div>

      {conflicts.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ color: 'var(--bad)' }}>⚠ Conflicts — human review required ({conflicts.length})</h3>
          <div className="grid" style={{ gap: 10 }}>
            {conflicts.map((e) => (
              <ReviewRow
                key={e.edge_id}
                edge={e}
                conflict
                onResolveTrusted={(reason) => resolve.mutate({ id: e.edge_id, res: 'trusted', reason })}
                onResolveRejected={(reason) => resolve.mutate({ id: e.edge_id, res: 'rejected', reason })}
              />
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 24 }}>
        <h3>Candidate relationships ({candidates.length})</h3>
        {candidates.length === 0 ? (
          <div className="card faint">No candidates awaiting review.</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {candidates.map((e) => (
              <ReviewRow
                key={e.edge_id}
                edge={e}
                onApprove={(reason) => approve.mutate({ id: e.edge_id, reason })}
                onReject={(reason) => reject.mutate({ id: e.edge_id, reason })}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3>Audit trail</h3>
        <div className="card" style={{ padding: 0 }}>
          {log.data?.length ? (
            <table className="data">
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Change</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {log.data.map((g: GovernanceEvent) => (
                  <tr key={g.event_id}>
                    <td className="faint mono">{new Date(g.timestamp).toLocaleTimeString()}</td>
                    <td>{g.actor}</td>
                    <td><span className="pill">{g.action.replace(/_/g, ' ')}</span></td>
                    <td className="mono faint">{String(g.previous_value)} → {String(g.new_value)}</td>
                    <td className="muted">{g.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="faint" style={{ padding: 18 }}>No governance actions yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function short(id: string) {
  return id.replace(/^(edge:references:)?(column|table):/g, '').replace(/->/g, '  →  ');
}

function ReviewRow({
  edge,
  conflict,
  onApprove,
  onReject,
  onResolveTrusted,
  onResolveRejected,
}: {
  edge: TechnicalEdge;
  conflict?: boolean;
  onApprove?: (reason: string) => void;
  onReject?: (reason: string) => void;
  onResolveTrusted?: (reason: string) => void;
  onResolveRejected?: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="card" style={{ borderColor: conflict ? 'color-mix(in srgb, var(--bad) 45%, var(--border))' : undefined }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="mono" style={{ fontSize: 12 }}>{short(edge.edge_id)}</div>
        <div className="row" style={{ gap: 8 }}>
          <StatusPill status={edge.status} />
          <span className="pill accent">conf {Math.round(edge.confidence * 100)}%</span>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <input
          placeholder="reason (recorded in audit trail)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{
            flex: 1, background: 'var(--bg)', border: '1px solid var(--border-strong)',
            borderRadius: 6, color: 'var(--text)', padding: '7px 10px', fontSize: 13,
          }}
        />
        {conflict ? (
          <>
            <button className="btn" onClick={() => onResolveTrusted?.(reason)}>Trust</button>
            <button className="btn ghost" onClick={() => onResolveRejected?.(reason)}>Reject</button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => onApprove?.(reason)}>Approve</button>
            <button className="btn ghost" onClick={() => onReject?.(reason)}>Reject</button>
          </>
        )}
      </div>
    </div>
  );
}
