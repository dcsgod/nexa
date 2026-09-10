/** Evidence Engine (spec §15) — append-only, auditable evidence records. */
import type { Evidence, EvidenceType } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { nowIso, uuid } from '../util/ids.js';

export interface EvidenceInput {
  type: EvidenceType;
  source: string;
  source_entity?: string;
  target_entity?: string;
  detail?: Record<string, unknown>;
  strength: number;
}

export function recordEvidence(input: EvidenceInput): Evidence {
  const ev: Evidence = {
    evidence_id: `ev-${uuid().slice(0, 8)}`,
    observed_at: nowIso(),
    ...input,
  };
  store.evidence.set(ev.evidence_id, ev);
  return ev;
}

export function getEvidence(id: string): Evidence | undefined {
  return store.evidence.get(id);
}

export function evidenceForPair(source: string, target: string): Evidence[] {
  return [...store.evidence.values()].filter(
    (e) =>
      (e.source_entity === source && e.target_entity === target) ||
      (e.source_entity === target && e.target_entity === source),
  );
}
