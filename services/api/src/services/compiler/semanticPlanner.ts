/**
 * Semantic planner + asset selection (spec §21). Chooses the smallest coherent
 * set of trusted technical assets that supports the intent. Preference order:
 * certified > trusted > high-quality > small table sets. Avoids exposing dozens
 * of tables.
 */
import type { Metric, TechnicalNode } from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';
import type { Intent, SelectedAsset } from './types.js';

function tableOf(assetId: string): string {
  return assetId.replace(/^(column|table):/, '').split('.').slice(0, 3).join('.');
}

export interface PlannerResult {
  assets: SelectedAsset[];
  metrics: Metric[];
}

export function planAssets(intent: Intent): PlannerResult {
  const chosen = new Map<string, SelectedAsset>();
  const metrics: Metric[] = [];

  const addTable = (tableFq: string, role: SelectedAsset['role'], supports: string, reason: string) => {
    const nodeId = `table:${tableFq}`;
    const node = store.nodes.get(nodeId);
    if (!node) return;
    const existing = chosen.get(nodeId);
    if (existing) {
      if (!existing.supports.includes(supports)) existing.supports.push(supports);
      return;
    }
    chosen.set(nodeId, {
      asset_id: nodeId,
      role,
      certified: node.tags?.includes('certified') ?? false,
      trusted: (node.quality_score ?? 0) >= 0.85,
      quality: node.quality_score ?? 0,
      reason,
      supports: [supports],
    });
  };

  // 1. Metrics → source fact tables (prefer certified metric source).
  for (const metricName of intent.metrics) {
    const metric = [...store.metrics.values()].find((m) => m.name === metricName);
    if (metric) {
      metrics.push(metric);
      addTable(metric.source, 'fact', metricName, `source of metric "${metricName}"`);
      continue;
    }
    // fall back to best approved mapping's asset
    const mapping = bestMapping(metricName);
    if (mapping) addTable(tableOf(mapping), 'fact', metricName, `best-mapped asset for "${metricName}"`);
  }

  // 2. Dimensions + entities → dimension/entity tables via mappings or dim_ naming.
  for (const dimName of [...intent.dimensions, ...intent.entities]) {
    const mapping = bestMapping(dimName);
    const role: SelectedAsset['role'] = intent.entities.includes(dimName) ? 'entity' : 'dimension';
    if (mapping) addTable(tableOf(mapping), role, dimName, `mapped asset for "${dimName}"`);
  }

  // 3. Pull in dimension tables reachable from chosen facts via trusted FK/lineage.
  for (const asset of [...chosen.values()]) {
    if (asset.role !== 'fact') continue;
    for (const dim of reachableDimensions(asset.asset_id)) {
      addTable(tableOf(dim), 'dimension', 'join dimension', 'reachable via trusted relationship from fact');
    }
  }

  return { assets: [...chosen.values()], metrics };
}

function bestMapping(conceptName: string): string | undefined {
  const maps = [...store.mappings.values()]
    .filter((m) => m.semantic_concept === conceptName && m.status !== 'rejected')
    .sort((a, b) => b.confidence - a.confidence);
  return maps[0]?.technical_asset;
}

/** Dimension tables one trusted hop from a fact table's columns. */
function reachableDimensions(factTableId: string): string[] {
  const factFq = tableOf(factTableId);
  const dims = new Set<string>();
  for (const e of store.edges.values()) {
    if (e.status !== 'trusted') continue;
    if (e.edge_type !== 'foreign_key_to' && e.edge_type !== 'references' && e.edge_type !== 'lineage_to') continue;
    const s = tableOf(e.source);
    const t = tableOf(e.target);
    if (s === factFq && t !== factFq && isDim(t)) dims.add(`table:${t}`);
    if (t === factFq && s !== factFq && isDim(s)) dims.add(`table:${s}`);
  }
  return [...dims];
}

function isDim(tableFq: string): boolean {
  const node: TechnicalNode | undefined = store.nodes.get(`table:${tableFq}`);
  return /(^|\.)dim_|_dim$/.test(tableFq) || node?.name.startsWith('dim_') === true || node?.name.endsWith('_dim') === true;
}
