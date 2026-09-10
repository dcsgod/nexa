import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, store } from '../store/ontologyStore.js';
import { decideRelationship, governanceLog, resolveConflict } from './governanceService.js';
import { nowIso } from '../util/ids.js';

function seedEdge(edge_id: string, status: 'candidate' | 'conflict') {
  store.edges.set(edge_id, {
    edge_id, source: 'column:a.b.c.x', target: 'column:a.b.d.x',
    edge_type: 'references', confidence: 0.5, status, evidence_ids: [], updated_at: nowIso(),
  });
  store.confidence.set(edge_id, {
    edge_id, signals: { human_validation: null }, weighted_score: 0.5,
    gates_passed: [], gates_failed: [], conflict: status === 'conflict', trusted: false, computed_at: nowIso(),
  });
}

describe('governance write path (spec §19)', () => {
  beforeEach(() => resetStore());

  it('approving a candidate flips it to trusted and records an audit event', () => {
    seedEdge('e1', 'candidate');
    const ev = decideRelationship({ action: 'approve_relationship', actor: 'ravi', target_id: 'e1', reason: 'verified' });
    expect(store.edges.get('e1')!.status).toBe('trusted');
    expect(store.confidence.get('e1')!.signals.human_validation).toBe('approved');
    expect(ev.previous_value).toBe('candidate');
    expect(ev.new_value).toBe('trusted');
    expect(governanceLog()).toHaveLength(1);
  });

  it('rejecting records the actor and reason immutably in the log', () => {
    seedEdge('e2', 'candidate');
    decideRelationship({ action: 'reject_relationship', actor: 'sam', target_id: 'e2', reason: 'spurious join' });
    const log = governanceLog();
    expect(store.edges.get('e2')!.status).toBe('rejected');
    expect(log[0]!.actor).toBe('sam');
    expect(log[0]!.reason).toBe('spurious join');
  });

  it('resolving a conflict clears the conflict flag and sets the chosen status', () => {
    seedEdge('e3', 'conflict');
    resolveConflict({ action: 'resolve_conflict', actor: 'ravi', target_id: 'e3', resolution: 'trusted', reason: 'context ok' });
    expect(store.edges.get('e3')!.status).toBe('trusted');
    expect(store.confidence.get('e3')!.conflict).toBe(false);
  });

  it('throws on an unknown edge', () => {
    expect(() => decideRelationship({ action: 'approve_relationship', actor: 'x', target_id: 'missing' })).toThrow();
  });
});
