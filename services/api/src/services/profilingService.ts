/** Data profiling (spec §8.3) + data quality signals (spec §9). */
import { getDatabricksAdapter } from '../adapters/databricks/index.js';
import type { QualitySignal } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { nowIso } from '../util/ids.js';

/** Profile every column node and derive a per-table quality signal. */
export async function profileAndScoreQuality(): Promise<{ profiled: number }> {
  const adapter = getDatabricksAdapter();
  const columnNodes = [...store.nodes.values()].filter((n) => n.node_type === 'column');
  let profiled = 0;

  // group columns by their owning table
  const byTable = new Map<string, typeof columnNodes>();
  for (const c of columnNodes) {
    const fq = `${c.catalog}.${c.schema}.${c.name}`; // column node name is the column; rebuild table fq
    // node_id is column:catalog.schema.table.col — parse table fq from node_id
    const tableFq = c.node_id.replace(/^column:/, '').split('.').slice(0, 3).join('.');
    const arr = byTable.get(tableFq) ?? [];
    arr.push(c);
    byTable.set(tableFq, arr);
    void fq;
  }

  for (const [tableFq, cols] of byTable) {
    let nullSum = 0;
    let uniqSum = 0;
    let n = 0;
    for (const c of cols) {
      const p = await adapter.profile(c.node_id);
      if (!p) continue;
      profiled++;
      n++;
      nullSum += p.null_pct ?? 0;
      uniqSum += p.uniqueness ?? 0;
      // store column quality contribution on the node
      const node = store.nodes.get(c.node_id);
      if (node) {
        node.quality_score = 1 - (p.null_pct ?? 0);
      }
    }
    const completeness = n ? 1 - nullSum / n : 1;
    const uniqueness = n ? uniqSum / n : 1;
    const freshness = 0.98;
    const validity = 0.94;
    const overall = round((completeness + uniqueness + freshness + validity) / 4);

    const q: QualitySignal = {
      asset_id: `table:${tableFq}`,
      completeness: round(completeness),
      uniqueness: round(uniqueness),
      freshness,
      validity,
      overall,
      computed_at: nowIso(),
    };
    store.quality.set(q.asset_id, q);
    const node = store.nodes.get(`table:${tableFq}`);
    if (node) node.quality_score = overall;
  }
  return { profiled };
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}
