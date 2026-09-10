/**
 * §56 — Counterfactual "Simulate Impact". Given a HypotheticalOverlay, compute
 * what WOULD change — affected agents, metrics, flipped mappings, new conflicts
 * — WITHOUT committing anything. This is "fail closed, with a preview" (§3.8).
 *
 * Guarantee: this module only READS real state and writes into a private
 * SimulationRun record. It never mutates nodes/edges/mappings/agents/history.
 */
import type {
  HypotheticalOverlay,
  SimulationRun,
  SimulationSummary,
} from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { nowIso, uuid } from '../util/ids.js';
import { analyzeImpact } from './impactService.js';

function tableOf(assetId: string): string {
  return assetId.replace(/^(column|table):/, '').split('.').slice(0, 3).join('.');
}
function combined(graph?: number, llm?: number): number {
  return (graph ?? 0) * 0.55 + (llm ?? 0) * 0.45;
}

export function runSimulation(overlay: HypotheticalOverlay, requestedBy: string): SimulationRun {
  const run: SimulationRun = {
    simulation_id: `sim-${uuid().slice(0, 8)}`,
    requested_by: requestedBy,
    created_at: nowIso(),
    overlay,
    status: 'running',
  };
  store.simulations.set(run.simulation_id, run);

  try {
    run.summary = computeSummary(overlay);
    run.status = 'complete';
  } catch {
    run.status = 'failed';
  }
  return run;
}

function computeSummary(overlay: HypotheticalOverlay): SimulationSummary {
  const summary: SimulationSummary = {
    affected_genie_agents: [],
    affected_metrics: [],
    newly_flipped_mappings: [],
    newly_created_conflicts: [],
  };

  const touchedConcepts = new Set<string>();
  const touchedTables = new Set<string>();

  // 1. Threshold override — re-evaluate the mapping population (no writes).
  if (typeof overlay.confidence_threshold_override === 'number') {
    const thr = overlay.confidence_threshold_override;
    // hypothetical status per concept: which asset would be approved.
    const wouldApproveByConcept = new Map<string, { asset: string; mapping_id: string }[]>();
    for (const m of store.mappings.values()) {
      const conf = combined(m.graph_confidence, m.llm_confidence);
      const wouldBe = conf >= thr ? 'approved' : 'candidate';
      const isApprovedNow = m.status === 'approved' || m.status === 'certified';
      const wouldApprove = wouldBe === 'approved';
      if (isApprovedNow !== wouldApprove && m.status !== 'rejected') {
        summary.newly_flipped_mappings.push({
          mapping_id: m.mapping_id,
          concept: m.semantic_concept,
          from: m.status,
          to: wouldBe,
        });
        touchedConcepts.add(m.semantic_concept);
      }
      if (wouldApprove) {
        const arr = wouldApproveByConcept.get(m.semantic_concept) ?? [];
        arr.push({ asset: m.technical_asset, mapping_id: m.mapping_id });
        wouldApproveByConcept.set(m.semantic_concept, arr);
      }
    }
    // new conflicts: a concept with 2+ approved-under-threshold distinct assets.
    for (const [concept, arr] of wouldApproveByConcept) {
      const distinct = [...new Set(arr.map((a) => a.asset))];
      if (distinct.length >= 2) {
        summary.newly_created_conflicts.push({ concept, asset_a: distinct[0]!, asset_b: distinct[1]! });
        touchedConcepts.add(concept);
      }
    }
  }

  // 2. Concept mapping changes — hypothetical re-point / status change.
  for (const change of overlay.concept_mapping_changes ?? []) {
    touchedConcepts.add(change.concept);
    touchedTables.add(tableOf(change.technical_asset));
    const current = [...store.mappings.values()].find(
      (m) => m.semantic_concept === change.concept && (m.status === 'approved' || m.status === 'certified'),
    );
    if (current && tableOf(current.technical_asset) !== tableOf(change.technical_asset)) {
      // repointing to a different asset — material change for anything using it.
    }
  }

  // 3. Deprecated assets — impact via the existing graph traversal.
  for (const asset of overlay.deprecated_assets ?? []) {
    touchedTables.add(tableOf(asset));
    const impact = analyzeImpact(asset);
    for (const m of impact.affected_metrics) if (!summary.affected_metrics.find((x) => x.metric_id === m.metric_id)) summary.affected_metrics.push(m);
    for (const mp of impact.affected_mappings) touchedConcepts.add(mp.concept);
  }

  // Metrics tied to touched concepts.
  for (const metric of store.metrics.values()) {
    if (touchedConcepts.has(metric.name) && !summary.affected_metrics.find((x) => x.metric_id === metric.metric_id)) {
      summary.affected_metrics.push({ metric_id: metric.metric_id, name: metric.name });
    }
  }

  // 4. Affected Genie agents — those referencing a touched concept or table.
  for (const a of store.genieAgents.values()) {
    const usesConcept = Object.keys(a.sql_expressions).some((t) => touchedConcepts.has(t)) ||
      a.business_definitions.some((d) => touchedConcepts.has(d.term));
    const usesTable = a.data_assets.some((d) => touchedTables.has(d));
    if (!usesConcept && !usesTable) continue;
    const parts: string[] = [];
    if (usesConcept) parts.push('references a re-scored concept');
    if (usesTable) parts.push('references a changed/deprecated asset');
    summary.affected_genie_agents.push({
      agent_id: a.agent_id,
      name: a.name,
      config_diff: parts.join('; '),
      materially_changed: usesTable || summary.newly_flipped_mappings.some((f) => Object.keys(a.sql_expressions).includes(f.concept)),
    });
  }

  return summary;
}

export function getSimulation(id: string): SimulationRun | undefined {
  return store.simulations.get(id);
}
