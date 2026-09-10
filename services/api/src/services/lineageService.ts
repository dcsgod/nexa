/** Lineage Intelligence (spec §10) — a primary, high-trust relationship source. */
import { getDatabricksAdapter } from '../adapters/databricks/index.js';
import type { TechnicalEdge } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { nodeId, nowIso } from '../util/ids.js';
import { recordEvidence } from './evidenceService.js';

function toNodeId(entity: string): string {
  // 4 parts => column (catalog.schema.table.column), 3 parts => table.
  const parts = entity.split('.');
  if (parts.length >= 4) {
    const col = parts.slice(3).join('.');
    return nodeId.column(parts.slice(0, 3).join('.'), col);
  }
  return nodeId.table(entity);
}

export async function ingestLineage(catalog?: string): Promise<{ edges: number }> {
  const adapter = getDatabricksAdapter();
  const lineage = await adapter.getLineage(catalog);
  let count = 0;

  for (const l of lineage) {
    const source = toNodeId(l.source);
    const target = toNodeId(l.target);
    const ev = recordEvidence({
      type: l.level === 'column' ? 'column_lineage' : 'lineage',
      source: l.source_system,
      source_entity: source,
      target_entity: target,
      strength: 1,
      detail: { level: l.level },
    });
    const edge: TechnicalEdge = {
      edge_id: `edge:lineage_to:${source}->${target}`,
      source,
      target,
      edge_type: 'lineage_to',
      confidence: 1,
      status: 'trusted', // lineage is stronger than inferred similarity (spec §10)
      evidence_ids: [ev.evidence_id],
      updated_at: nowIso(),
    };
    store.edges.set(edge.edge_id, edge);
    count++;
  }
  return { edges: count };
}
