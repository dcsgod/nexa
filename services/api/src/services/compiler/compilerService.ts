/**
 * Enterprise Semantic Compiler orchestrator (spec §20). Transforms a natural
 * language request into a governed, grain-validated Genie configuration:
 *
 *   parse intent → select assets → plan joins → validate grain → compile config
 */
import type { GenieAgentConfig } from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';
import { parseIntent } from './intentParser.js';
import { planAssets } from './semanticPlanner.js';
import { planJoins } from './joinPlanner.js';
import { validateGrain } from './grainValidator.js';
import { compileGenieConfig } from './genieCompiler.js';
import type { CompileOutput, CompilerPlan, PlanScores } from './types.js';

export function plan(request: string): CompilerPlan {
  const intent = parseIntent(request);
  const { assets, metrics } = planAssets(intent);
  const joins = planJoins(assets);
  const grain_warnings = validateGrain(assets, metrics, joins);

  const scores = scorePlan(intent, assets, joins);
  const evidence = buildEvidence(intent, assets, joins, grain_warnings.length);

  return {
    intent,
    selected_assets: assets,
    metrics: metrics.map((m) => ({ name: m.name, expression: m.expression, grain: m.grain, status: m.status })),
    joins,
    grain_warnings,
    scores,
    evidence,
  };
}

export function compile(request: string): CompileOutput {
  const p = plan(request);
  const { assets, metrics } = planAssets(p.intent);
  const config = compileGenieConfig(p.intent, assets, metrics, p.joins, p);
  store.genieAgents.set(config.agent_id, config);
  store.geniePlans.set(config.agent_id, p);
  return { plan: p, config };
}

export function getAgent(agentId: string): GenieAgentConfig | undefined {
  return store.genieAgents.get(agentId);
}

export function listAgents(): GenieAgentConfig[] {
  return [...store.genieAgents.values()];
}

function scorePlan(
  intent: CompilerPlan['intent'],
  assets: CompilerPlan['selected_assets'],
  joins: CompilerPlan['joins'],
): PlanScores {
  const semantic_coverage = intent.concepts.length ? 1 : 0.4;
  // A metric is "covered" when an asset supporting it was actually selected.
  const supported = new Set(assets.flatMap((a) => a.supports));
  const metric_coverage = intent.metrics.length
    ? clamp(intent.metrics.filter((m) => supported.has(m)).length / intent.metrics.length)
    : 0.8;
  const relationship_trust = joins.length
    ? round(joins.reduce((s, j) => s + j.confidence, 0) / joins.length)
    : 0.6;
  const data_quality = assets.length
    ? round(assets.reduce((s, a) => s + a.quality, 0) / assets.length)
    : 0;
  const overall = round((semantic_coverage + metric_coverage + relationship_trust + data_quality) / 4);
  return { semantic_coverage, metric_coverage, relationship_trust, data_quality, overall };
}

function buildEvidence(
  intent: CompilerPlan['intent'],
  assets: CompilerPlan['selected_assets'],
  joins: CompilerPlan['joins'],
  grainWarnings: number,
): { ok: boolean; text: string }[] {
  const out: { ok: boolean; text: string }[] = [];
  out.push({ ok: intent.concepts.length > 0, text: `Interpreted ${intent.concepts.length} business concept(s) in domain "${intent.domain}"` });
  out.push({ ok: assets.some((a) => a.role === 'fact'), text: `Selected ${assets.length} asset(s), ${assets.filter((a) => a.certified).length} certified` });
  out.push({ ok: joins.every((j) => j.edge_status === 'trusted'), text: `${joins.length} join(s) from verified relationships` });
  out.push({ ok: grainWarnings === 0, text: grainWarnings === 0 ? 'No grain conflicts detected' : `${grainWarnings} grain safeguard(s) raised` });
  return out;
}

function clamp(x: number): number {
  return Math.max(0, Math.min(1, round(x)));
}
function round(x: number): number {
  return Math.round(x * 100) / 100;
}
