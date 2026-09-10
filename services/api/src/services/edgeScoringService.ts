/**
 * Multi-factor relationship confidence (spec §14).
 *
 * Discovers candidate join relationships between columns and scores each with
 * SEPARATE signals, then applies weighted scoring + gating rules to derive a
 * governed trust decision. Confidence is deliberately NOT a plain average.
 */
import { getDatabricksAdapter } from '../adapters/databricks/index.js';
import type {
  ConfidenceBreakdown,
  ConfidenceSignals,
  TechnicalEdge,
  TechnicalNode,
} from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { nowIso } from '../util/ids.js';
import { recordEvidence } from './evidenceService.js';

const WEIGHTS: Record<keyof Omit<ConfidenceSignals, 'human_validation'>, number> = {
  semantic_similarity: 0.15,
  structural_compatibility: 0.15,
  value_overlap: 0.15,
  lineage: 0.25,
  behavioral_usage: 0.15,
  data_quality: 0.1,
  model_prediction: 0.05, // model prediction filled in during P1 (GraphSAGE)
};

function nameSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const na = a.replace(/_id$|_key$/, '');
  const nb = b.replace(/_id$|_key$/, '');
  if (na === nb) return 0.9;
  if (a.includes(nb) || b.includes(na)) return 0.6;
  return 0.2;
}

function typeCompatible(a?: string, b?: string): number {
  if (!a || !b) return 0.3;
  const norm = (t: string) => t.replace(/\(.*\)/, '');
  return norm(a) === norm(b) ? 1 : 0.3;
}

export async function scoreCandidateEdges(catalog?: string): Promise<{ scored: number }> {
  const adapter = getDatabricksAdapter();
  const usage = await adapter.getUsageSignals(catalog);
  const columns = [...store.nodes.values()].filter(
    (n): n is TechnicalNode => n.node_type === 'column',
  );

  // candidate pairs: id-like columns that share a normalized name across different tables
  const idCols = columns.filter((c) => /(_id|_key)$/.test(c.name));
  let scored = 0;

  for (let i = 0; i < idCols.length; i++) {
    for (let j = i + 1; j < idCols.length; j++) {
      const a = idCols[i]!;
      const b = idCols[j]!;
      const tableA = tableOf(a.node_id);
      const tableB = tableOf(b.node_id);
      if (tableA === tableB) continue;
      const sim = nameSimilarity(a.name, b.name);
      if (sim < 0.6) continue; // only plausible joins

      const edgeId = `edge:references:${a.node_id}->${b.node_id}`;
      const existingFk = store.edges.get(`edge:foreign_key_to:${a.node_id}->${b.node_id}`) ||
        store.edges.get(`edge:foreign_key_to:${b.node_id}->${a.node_id}`);
      const lineageEdge = store.edges.get(`edge:lineage_to:${a.node_id}->${b.node_id}`) ||
        store.edges.get(`edge:lineage_to:${b.node_id}->${a.node_id}`);

      const usageHit = usage.find(
        (u) =>
          (u.entity_a === tableA && u.entity_b === tableB) ||
          (u.entity_a === tableB && u.entity_b === tableA),
      );

      const qA = store.quality.get(`table:${tableA}`)?.overall ?? 0.8;
      const qB = store.quality.get(`table:${tableB}`)?.overall ?? 0.8;

      const signals: ConfidenceSignals = {
        semantic_similarity: sim,
        structural_compatibility: typeCompatible(a.data_type, b.data_type),
        value_overlap: existingFk || lineageEdge ? 0.98 : 0.5,
        lineage: lineageEdge ? 1 : 0,
        behavioral_usage: usageHit ? clamp(usageHit.join_count / 2000) : 0,
        data_quality: (qA + qB) / 2,
        model_prediction: undefined,
        human_validation: existingFk ? 'approved' : null,
      };

      const breakdown = evaluate(edgeId, signals);
      store.confidence.set(edgeId, breakdown);

      const evIds: string[] = [];
      if (usageHit) {
        evIds.push(
          recordEvidence({
            type: 'query_behavior',
            source: 'system.query.history',
            source_entity: a.node_id,
            target_entity: b.node_id,
            strength: signals.behavioral_usage ?? 0,
            detail: { join_count: usageHit.join_count },
          }).evidence_id,
        );
      }

      const edge: TechnicalEdge = {
        edge_id: edgeId,
        source: a.node_id,
        target: b.node_id,
        edge_type: 'references',
        confidence: breakdown.weighted_score,
        status: breakdown.conflict
          ? 'conflict'
          : breakdown.trusted
            ? 'trusted'
            : 'candidate',
        evidence_ids: [...evIds, ...(lineageEdge?.evidence_ids ?? [])],
        updated_at: nowIso(),
      };
      // don't overwrite an already-trusted FK edge
      if (!existingFk) store.edges.set(edgeId, edge);
      scored++;
    }
  }
  return { scored };
}

/** Weighted scoring + gating rules (spec §14.1). */
export function evaluate(edgeId: string, signals: ConfidenceSignals): ConfidenceBreakdown {
  let sum = 0;
  let wSum = 0;
  for (const [k, w] of Object.entries(WEIGHTS) as [keyof typeof WEIGHTS, number][]) {
    const v = signals[k];
    if (typeof v === 'number') {
      sum += v * w;
      wSum += w;
    }
  }
  const weighted = wSum ? round(sum / wSum) : 0;

  const gates_passed: string[] = [];
  const gates_failed: string[] = [];

  // Gate: structural compatibility must clear a floor.
  if ((signals.structural_compatibility ?? 0) >= 0.8) gates_passed.push('structural_floor');
  else gates_failed.push('structural_floor');

  // Gate: minimum evidence — need lineage OR strong behavioral OR declared FK.
  const hasStrongEvidence =
    (signals.lineage ?? 0) >= 0.9 ||
    (signals.behavioral_usage ?? 0) >= 0.5 ||
    signals.human_validation === 'approved';
  if (hasStrongEvidence) gates_passed.push('minimum_evidence');
  else gates_failed.push('minimum_evidence');

  // Conflict: high semantic similarity but zero lineage AND zero behavioral => suspicious.
  const conflict =
    (signals.semantic_similarity ?? 0) >= 0.85 &&
    (signals.lineage ?? 0) === 0 &&
    (signals.behavioral_usage ?? 0) === 0;

  // Trusted rule: strong lineage + structural floor + no conflict.
  const trusted =
    gates_failed.length === 0 &&
    !conflict &&
    ((signals.lineage ?? 0) >= 0.9 || signals.human_validation === 'approved');

  return {
    edge_id: edgeId,
    signals,
    weighted_score: weighted,
    gates_passed,
    gates_failed,
    conflict,
    trusted,
    computed_at: nowIso(),
  };
}

function tableOf(columnNodeId: string): string {
  return columnNodeId.replace(/^column:/, '').split('.').slice(0, 3).join('.');
}
function clamp(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round(x: number): number {
  return Math.round(x * 100) / 100;
}
