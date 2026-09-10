/**
 * Schema drift detection + self-healing entry (spec §28). Compares the live
 * catalog to the stored ontology, records drift events, and re-runs incremental
 * discovery. It never silently rewrites trusted semantics — affected agents are
 * surfaced for review (see selfHealService).
 */
import { getDatabricksAdapter } from '../adapters/databricks/index.js';
import type { DriftEvent } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { nodeId, nowIso, uuid } from '../util/ids.js';
import { runDiscovery } from './discoveryPipeline.js';
import { compileSemanticLayer } from './semantic/semanticMappingEngine.js';

function drift(e: Omit<DriftEvent, 'drift_id' | 'detected_at' | 'status'>): DriftEvent {
  const ev: DriftEvent = { drift_id: `drift-${uuid().slice(0, 8)}`, detected_at: nowIso(), status: 'open', ...e };
  store.drift.push(ev);
  return ev;
}

export async function detectDrift(): Promise<{ events: DriftEvent[]; new_events: number }> {
  const adapter = getDatabricksAdapter();
  const tables = await adapter.listTables();
  const newEvents: DriftEvent[] = [];

  // Index current columns by table.
  const currentCols = new Map<string, Map<string, string>>(); // tableFq -> col -> data_type
  const currentTables = new Set<string>();
  for (const t of tables) {
    const fq = `${t.catalog}.${t.schema}.${t.name}`;
    currentTables.add(fq);
    currentCols.set(fq, new Map(t.columns.map((c) => [c.name, c.data_type])));
  }

  // Existing column nodes in the store, grouped by table.
  const existingCols = new Map<string, Map<string, string>>();
  const existingTables = new Set<string>();
  for (const n of store.nodes.values()) {
    if (n.node_type === 'table') existingTables.add(`${n.catalog}.${n.schema}.${n.name}`);
    if (n.node_type !== 'column') continue;
    const tableFq = n.node_id.replace(/^column:/, '').split('.').slice(0, 3).join('.');
    const m = existingCols.get(tableFq) ?? new Map<string, string>();
    m.set(n.name, n.data_type ?? '');
    existingCols.set(tableFq, m);
  }

  // Table added / removed.
  for (const t of currentTables) if (!existingTables.has(t)) newEvents.push(drift({ asset_id: nodeId.table(t), table: t, change_type: 'table_added', detail: `New table ${t}` }));
  for (const t of existingTables) if (!currentTables.has(t)) newEvents.push(drift({ asset_id: nodeId.table(t), table: t, change_type: 'table_removed', detail: `Table ${t} removed` }));

  // Column added / removed / type-changed, for tables present in both.
  for (const [tableFq, cols] of currentCols) {
    const prev = existingCols.get(tableFq);
    if (!prev) continue;
    for (const [col, type] of cols) {
      if (!prev.has(col)) {
        newEvents.push(drift({ asset_id: nodeId.column(tableFq, col), table: tableFq, change_type: 'column_added', detail: `Column ${col} ${type} added` }));
      } else if (prev.get(col) !== type) {
        newEvents.push(drift({ asset_id: nodeId.column(tableFq, col), table: tableFq, change_type: 'column_type_changed', detail: `Column ${col} type ${prev.get(col)} → ${type}` }));
      }
    }
    for (const [col] of prev) {
      if (!cols.has(col)) {
        newEvents.push(drift({ asset_id: nodeId.column(tableFq, col), table: tableFq, change_type: 'column_removed', detail: `Column ${col} removed` }));
        store.nodes.delete(nodeId.column(tableFq, col)); // drop the stale node
      }
    }
  }

  // Incremental re-discovery + semantic recompile so the ontology reflects reality.
  if (newEvents.length > 0) {
    await runDiscovery();
    await compileSemanticLayer();
  }

  return { events: store.drift, new_events: newEvents.length };
}

export function driftEvents(): DriftEvent[] {
  return [...store.drift].reverse();
}
