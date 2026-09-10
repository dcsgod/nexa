/**
 * Semantic Governance (spec §19). Human decisions become durable knowledge.
 * Every action is recorded with actor, timestamp, decision, previous/new value,
 * reason and evidence — the audited write path all governance UI goes through.
 */
import type { GovernanceAction, GovernanceEvent } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { nowIso, uuid } from '../util/ids.js';
import { recordEvidence } from './evidenceService.js';
import { appendMappingHistory } from './semantic/mappingHistoryService.js';

export interface GovernanceDecision {
  action: GovernanceAction;
  actor: string;
  target_id: string; // edge_id or mapping_id
  reason?: string;
}

function log(
  action: GovernanceAction,
  actor: string,
  target_id: string,
  previous: unknown,
  next: unknown,
  reason?: string,
  evidence_ids: string[] = [],
): GovernanceEvent {
  const ev: GovernanceEvent = {
    event_id: `gov-${uuid().slice(0, 8)}`,
    action,
    actor,
    target_id,
    timestamp: nowIso(),
    previous_value: previous,
    new_value: next,
    reason,
    evidence_ids,
  };
  store.governance.push(ev);
  return ev;
}

/** Approve or reject a relationship edge; flips status + records human evidence. */
export function decideRelationship(d: GovernanceDecision): GovernanceEvent {
  const edge = store.edges.get(d.target_id);
  if (!edge) throw new Error(`edge not found: ${d.target_id}`);
  const prev = edge.status;

  const approve = d.action === 'approve_relationship';
  const next = approve ? 'trusted' : 'rejected';

  // Human validation is the strongest signal — feed it back into confidence.
  const cb = store.confidence.get(edge.edge_id);
  if (cb) {
    cb.signals.human_validation = approve ? 'approved' : 'rejected';
  }

  const humanEv = recordEvidence({
    type: 'human_approval',
    source: `governance:${d.actor}`,
    source_entity: edge.source,
    target_entity: edge.target,
    strength: approve ? 1 : 0,
    detail: { decision: next, reason: d.reason },
  });

  edge.status = next;
  if (approve) edge.confidence = Math.max(edge.confidence, 0.99);
  if (!edge.evidence_ids.includes(humanEv.evidence_id)) edge.evidence_ids.push(humanEv.evidence_id);
  edge.updated_at = nowIso();

  return log(d.action, d.actor, d.target_id, prev, next, d.reason, [humanEv.evidence_id]);
}

/** Resolve a conflict edge into trusted or rejected (spec §17). */
export function resolveConflict(d: GovernanceDecision & { resolution: 'trusted' | 'rejected' }): GovernanceEvent {
  const edge = store.edges.get(d.target_id);
  if (!edge) throw new Error(`edge not found: ${d.target_id}`);
  const prev = edge.status;
  const cb = store.confidence.get(edge.edge_id);
  if (cb) {
    cb.conflict = false;
    cb.signals.human_validation = d.resolution === 'trusted' ? 'approved' : 'rejected';
  }
  const ev = recordEvidence({
    type: 'human_approval',
    source: `governance:${d.actor}`,
    source_entity: edge.source,
    target_entity: edge.target,
    strength: d.resolution === 'trusted' ? 1 : 0,
    detail: { conflict_resolution: d.resolution, reason: d.reason },
  });
  edge.status = d.resolution;
  edge.updated_at = nowIso();
  if (!edge.evidence_ids.includes(ev.evidence_id)) edge.evidence_ids.push(ev.evidence_id);
  return log('resolve_conflict', d.actor, d.target_id, prev, d.resolution, d.reason, [ev.evidence_id]);
}

/** Approve / reject / certify a semantic mapping (spec §19). Audited. */
export function decideMapping(d: {
  action: 'approve_mapping' | 'reject_mapping' | 'certify_metric';
  actor: string;
  target_id: string; // mapping_id
  reason?: string;
  simulation_id?: string; // §56: link a previewed simulation to this approval
}): GovernanceEvent {
  const mapping = store.mappings.get(d.target_id);
  if (!mapping) throw new Error(`mapping not found: ${d.target_id}`);
  const prev = mapping.status;
  // Permanently link the preview to the decision in the audit trail.
  const reason = d.simulation_id ? `${d.reason ?? ''} [previewed via ${d.simulation_id}]`.trim() : d.reason;
  d = { ...d, reason };
  const next =
    d.action === 'reject_mapping' ? 'rejected' : d.action === 'certify_metric' ? 'certified' : 'approved';

  const ev = recordEvidence({
    type: 'human_approval',
    source: `governance:${d.actor}`,
    source_entity: mapping.semantic_concept,
    target_entity: mapping.technical_asset,
    strength: next === 'rejected' ? 0 : 1,
    detail: { decision: next, reason: d.reason },
  });

  mapping.status = next;
  mapping.human_validation = d.actor;
  if (next !== 'rejected') mapping.conflict = false;
  mapping.version += 1;
  mapping.updated_at = nowIso();
  if (!mapping.evidence_ids.includes(ev.evidence_id)) mapping.evidence_ids.push(ev.evidence_id);

  // §55: append the human-driven status change to the mapping history.
  appendMappingHistory(mapping, d.actor, d.reason, ev.evidence_id);

  return log(d.action, d.actor, d.target_id, prev, next, d.reason, [ev.evidence_id]);
}

export function reviewQueue() {
  const edges = [...store.edges.values()];
  return {
    candidates: edges
      .filter((e) => e.status === 'candidate' && e.edge_type === 'references')
      .sort((a, b) => b.confidence - a.confidence),
    conflicts: edges.filter((e) => e.status === 'conflict'),
  };
}

export function governanceLog(): GovernanceEvent[] {
  return [...store.governance].reverse();
}
