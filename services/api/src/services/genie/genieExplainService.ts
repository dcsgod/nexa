/**
 * Genie explainability (spec §27). Answers "why did Genie use these tables?" by
 * reconstructing the decision path term → concept → metric → asset → join, plus
 * the supporting evidence lines. Uses only the compiled config + governed
 * semantic layer — no fabricated reasoning.
 */
import type { GenieDecisionStep } from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';

export interface GenieExplanation {
  agent_id: string;
  decision_path: GenieDecisionStep[];
  evidence: { ok: boolean; text: string }[];
}

export function explainAgent(agentId: string): GenieExplanation {
  const config = store.genieAgents.get(agentId);
  if (!config) throw new Error(`agent not found: ${agentId}`);

  const steps: GenieDecisionStep[] = [];

  // concept → metric → source asset
  for (const term of Object.keys(config.sql_expressions)) {
    steps.push({ from: term, to: `${term} metric`, kind: 'concept_to_metric' });
    const def = config.business_definitions.find((d) => d.term === term);
    if (def) steps.push({ from: `${term} metric`, to: def.mapping, kind: 'metric_to_asset' });
  }
  // joins
  for (const j of config.joins) {
    steps.push({ from: j.left.split('.').slice(0, 3).join('.'), to: j.right.split('.').slice(0, 3).join('.'), kind: 'asset_join' });
  }

  const evidence = [
    { ok: config.business_definitions.length > 0, text: `${config.business_definitions.length} certified/approved metric definition(s) used` },
    { ok: config.joins.length > 0, text: `${config.joins.length} join(s) from verified relationships` },
    { ok: config.trusted_assets.length > 0, text: `${config.trusted_assets.length} trusted source asset(s)` },
    { ok: !config.instructions.some((i) => i.startsWith('GRAIN SAFEGUARD')), text: gateNote(config.instructions) },
    { ok: (store.qualityGates.get(agentId)?.benchmark_accuracy ?? 0) >= 0.8, text: benchNote(agentId) },
  ];

  return { agent_id: agentId, decision_path: steps, evidence };
}

function gateNote(instructions: string[]): string {
  return instructions.some((i) => i.startsWith('GRAIN SAFEGUARD'))
    ? 'Grain safeguard active — facts must be pre-aggregated'
    : 'No grain conflicts';
}
function benchNote(agentId: string): string {
  const acc = store.qualityGates.get(agentId)?.benchmark_accuracy;
  return acc === undefined ? 'Not yet benchmarked' : `Benchmark accuracy ${Math.round(acc * 100)}%`;
}
