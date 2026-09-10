/**
 * §55 — Semantic Diff & Drift Timeline. A read/query layer plus the append-only
 * write path over `semantic_mapping_history`. Every mapping status change
 * appends a new row and closes the prior row's `valid_to` — meaning itself
 * becomes a first-class, browsable history. Nothing is ever updated in place.
 */
import type {
  ConflictLogRow,
  MappingHistoryRow,
  SemanticMapping,
} from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';
import { nowIso, uuid } from '../../util/ids.js';

/** Append a new history row for a mapping, closing its prior open row. */
export function appendMappingHistory(
  mapping: SemanticMapping,
  approvedBy: string,
  reason?: string,
  evidenceRef?: string,
): MappingHistoryRow {
  const now = nowIso();
  // Close the currently-open row for this mapping lineage.
  const open = store.mappingHistory.find((r) => r.mapping_id === mapping.mapping_id && r.valid_to === null);
  // Idempotent: nothing meaningful changed → keep the existing open row.
  if (open && open.status === mapping.status && open.technical_asset === mapping.technical_asset) {
    return open;
  }
  if (open) open.valid_to = now;

  const priorVersions = store.mappingHistory.filter((r) => r.mapping_id === mapping.mapping_id).length;
  const row: MappingHistoryRow = {
    mapping_id: mapping.mapping_id,
    business_concept: mapping.semantic_concept,
    technical_asset: mapping.technical_asset,
    version: priorVersions + 1,
    valid_from: now,
    valid_to: null,
    status: mapping.status,
    graph_confidence: mapping.graph_confidence,
    llm_confidence: mapping.llm_confidence,
    evidence_ref: evidenceRef ?? mapping.evidence_ids[0],
    approved_by: approvedBy,
    approval_reason: reason,
    superseded_by_mapping_id: null,
  };
  store.mappingHistory.push(row);
  detectConceptConflicts(mapping.semantic_concept);
  return row;
}

export function conceptHistory(businessConcept: string): MappingHistoryRow[] {
  return store.mappingHistory
    .filter((r) => r.business_concept === businessConcept)
    .sort((a, b) => a.valid_from.localeCompare(b.valid_from) || a.version - b.version);
}

export interface MappingDiff {
  business_concept: string;
  from: { version: number; technical_asset: string; status: string; confidence?: number };
  to: { version: number; technical_asset: string; status: string; confidence?: number };
  technical_asset_changed: boolean;
  status_changed: boolean;
  confidence_delta: number;
  affected_genie_agents: { agent_id: string; name: string }[];
}

/** Diff two history rows of a concept (by version across all its mappings). */
export function diffConcept(businessConcept: string, fromV: number, toV: number): MappingDiff | null {
  const rows = conceptHistory(businessConcept);
  const from = rows.find((r) => r.version === fromV) ?? rows[0];
  const to = rows.find((r) => r.version === toV) ?? rows[rows.length - 1];
  if (!from || !to) return null;
  const conf = (r: MappingHistoryRow) => (r.graph_confidence ?? 0) * 0.5 + (r.llm_confidence ?? 0) * 0.5;
  return {
    business_concept: businessConcept,
    from: { version: from.version, technical_asset: from.technical_asset, status: from.status, confidence: round(conf(from)) },
    to: { version: to.version, technical_asset: to.technical_asset, status: to.status, confidence: round(conf(to)) },
    technical_asset_changed: from.technical_asset !== to.technical_asset,
    status_changed: from.status !== to.status,
    confidence_delta: round(conf(to) - conf(from)),
    affected_genie_agents: agentsReferencingConcept(businessConcept),
  };
}

/** Genie agents whose config references this business concept (spec §55.3). */
export function agentsReferencingConcept(businessConcept: string): { agent_id: string; name: string }[] {
  return [...store.genieAgents.values()]
    .filter(
      (a) =>
        Object.keys(a.sql_expressions).includes(businessConcept) ||
        a.business_definitions.some((d) => d.term === businessConcept),
    )
    .map((a) => ({ agent_id: a.agent_id, name: a.name }));
}

/**
 * §55 conflict detection: two `approved` history rows for the same concept with
 * different technical assets and overlapping validity → log a conflict.
 */
export function detectConceptConflicts(businessConcept: string): void {
  const openApproved = store.mappingHistory.filter(
    (r) => r.business_concept === businessConcept && r.valid_to === null &&
      (r.status === 'approved' || r.status === 'certified'),
  );
  for (let i = 0; i < openApproved.length; i++) {
    for (let j = i + 1; j < openApproved.length; j++) {
      const a = openApproved[i]!;
      const b = openApproved[j]!;
      if (a.technical_asset === b.technical_asset) continue;
      const exists = store.conflictLog.some(
        (c) => c.business_concept === businessConcept && c.resolution === 'pending' &&
          [c.mapping_id_a, c.mapping_id_b].sort().join() === [a.mapping_id, b.mapping_id].sort().join(),
      );
      if (exists) continue;
      store.conflictLog.push({
        conflict_id: `conf-${uuid().slice(0, 8)}`,
        business_concept: businessConcept,
        mapping_id_a: a.mapping_id,
        mapping_id_b: b.mapping_id,
        detected_at: nowIso(),
        resolution: 'pending',
      });
    }
  }
}

export function listConflicts(status?: string): ConflictLogRow[] {
  return store.conflictLog.filter((c) => !status || c.resolution === status);
}

export function resolveMappingConflict(
  conflictId: string,
  resolution: ConflictLogRow['resolution'],
  resolvedBy: string,
  notes?: string,
): ConflictLogRow {
  const conflict = store.conflictLog.find((c) => c.conflict_id === conflictId);
  if (!conflict) throw new Error(`conflict not found: ${conflictId}`);
  conflict.resolution = resolution;
  conflict.resolved_by = resolvedBy;
  conflict.resolution_notes = notes;
  return conflict;
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}
