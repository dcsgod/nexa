/**
 * Impact analysis (spec §29). Given a changed asset, traverse lineage + semantic
 * dependencies to find affected downstream assets, semantic mappings, metrics,
 * and — crucially — which live Genie agents would be affected (spec §28).
 */
import type { ImpactAnalysis } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';

function tableOf(assetId: string): string {
  return assetId.replace(/^(column|table):/, '').split('.').slice(0, 3).join('.');
}

export function analyzeImpact(assetId: string): ImpactAnalysis {
  const table = tableOf(assetId);

  // Downstream via lineage/derivation/reference edges.
  const downstream = new Set<string>();
  for (const e of store.edges.values()) {
    if (!['lineage_to', 'derived_from', 'references', 'foreign_key_to', 'used_by', 'feeds'].includes(e.edge_type)) continue;
    if (e.source === assetId || tableOf(e.source) === table) downstream.add(e.target);
    if (e.target === assetId || tableOf(e.target) === table) downstream.add(e.source);
  }

  // Affected semantic mappings (mapping's technical asset is this column/table).
  const affected_mappings = [...store.mappings.values()]
    .filter((m) => m.technical_asset === assetId || tableOf(m.technical_asset) === table)
    .map((m) => ({ mapping_id: m.mapping_id, concept: m.semantic_concept, status: m.status }));

  // Affected metrics (metric sourced from this table).
  const affected_metrics = [...store.metrics.values()]
    .filter((m) => tableOf(`table:${m.source}`) === table)
    .map((m) => ({ metric_id: m.metric_id, name: m.name }));

  const affectedConcepts = new Set(affected_mappings.map((m) => m.concept));

  // Affected Genie agents — reference the table or any affected concept.
  const affected_agents = [...store.genieAgents.values()]
    .map((a) => {
      const usesTable = a.data_assets.some((d) => d === table) ||
        a.trusted_assets.some((d) => d === table);
      const usesConcept = a.business_definitions.some((d) => affectedConcepts.has(d.term)) ||
        Object.keys(a.sql_expressions).some((t) => affectedConcepts.has(t));
      if (!usesTable && !usesConcept) return null;
      const reasons: string[] = [];
      if (usesTable) reasons.push('uses changed table');
      if (usesConcept) reasons.push('uses affected concept');
      return { agent_id: a.agent_id, name: a.name, status: a.status, reason: reasons.join(' + ') };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // High-risk: deployed agents + certified metrics touching the change.
  const high_risk = [
    ...affected_agents.filter((a) => a.status === 'deployed').map((a) => a.name),
    ...affected_metrics.map((m) => `${m.name} metric`),
  ];

  return {
    asset_id: assetId,
    table,
    downstream_assets: [...downstream],
    affected_mappings,
    affected_metrics,
    affected_agents,
    affected_dashboards: [], // dashboards not modeled in mock seed
    high_risk: [...new Set(high_risk)],
  };
}
