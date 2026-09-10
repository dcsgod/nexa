/**
 * Join planner (spec §21, §25). Finds join paths between selected tables using
 * ONLY trusted technical relationships (FK / references / lineage). It never
 * invents joins from semantic similarity alone.
 */
import { store } from '../../store/ontologyStore.js';
import type { PlannedJoin, SelectedAsset } from './types.js';

function tableOf(assetId: string): string {
  return assetId.replace(/^(column|table):/, '').split('.').slice(0, 3).join('.');
}

export function planJoins(assets: SelectedAsset[]): PlannedJoin[] {
  const tables = new Set(assets.map((a) => tableOf(a.asset_id)));
  const joins: PlannedJoin[] = [];
  const seen = new Set<string>();

  for (const e of store.edges.values()) {
    if (e.edge_type !== 'foreign_key_to' && e.edge_type !== 'references' && e.edge_type !== 'lineage_to') continue;
    if (e.status === 'rejected' || e.status === 'candidate') continue; // trusted joins only
    const lt = tableOf(e.source);
    const rt = tableOf(e.target);
    if (lt === rt) continue;
    if (!tables.has(lt) || !tables.has(rt)) continue;
    const key = [lt, rt].sort().join('__');
    if (seen.has(key)) continue;
    seen.add(key);
    joins.push({
      left: e.source,
      right: e.target,
      left_table: lt,
      right_table: rt,
      edge_status: e.status,
      confidence: e.confidence,
    });
  }
  return joins;
}
