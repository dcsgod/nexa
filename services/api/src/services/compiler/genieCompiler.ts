/**
 * Genie configuration compiler (spec §24, §25). Assembles a governed
 * GenieAgentConfig from a validated plan: instructions, business definitions,
 * synonyms, joins, SQL expressions, example + benchmark questions, trusted
 * assets. Does NOT deploy — that is gated in P4.
 */
import type { GenieAgentConfig, Metric } from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';
import { nowIso } from '../../util/ids.js';
import type { CompilerPlan, Intent, PlannedJoin, SelectedAsset } from './types.js';

function shortTable(fq: string): string {
  return fq.split('.').slice(-1)[0]!;
}
function tableOf(assetId: string): string {
  return assetId.replace(/^(column|table):/, '').split('.').slice(0, 3).join('.');
}

export function compileGenieConfig(
  intent: Intent,
  assets: SelectedAsset[],
  metrics: Metric[],
  joins: PlannedJoin[],
  plan: Pick<CompilerPlan, 'grain_warnings'>,
): GenieAgentConfig {
  const data_assets = assets.map((a) => tableOf(a.asset_id));
  const trusted_assets = assets.filter((a) => a.certified || a.trusted).map((a) => tableOf(a.asset_id));

  const business_definitions = metrics.map((m) => ({
    term: m.name,
    mapping: m.source,
    definition: m.definition,
  }));

  const synonyms: Record<string, string[]> = {};
  for (const name of intent.concepts) {
    const c = store.concepts.get(`concept:${slug(name)}`);
    if (c?.synonyms?.length) synonyms[name] = c.synonyms;
  }

  const sql_expressions: Record<string, string> = {};
  for (const m of metrics) sql_expressions[m.name] = m.expression;

  const instructions: string[] = [];
  for (const m of metrics) {
    instructions.push(`Use "${m.name}" = ${m.expression} at ${m.grain} grain when the user asks for ${m.name.toLowerCase()}.`);
  }
  // Disambiguation between synonym metrics (spec §25).
  if (metrics.some((m) => m.name === 'Revenue') && metrics.some((m) => m.name === 'Gross Sales')) {
    instructions.push('Use Revenue (net sales) unless the user explicitly asks for Gross Sales.');
  }
  for (const j of joins) {
    instructions.push(`Join ${shortTable(j.left_table)} to ${shortTable(j.right_table)} on the verified relationship.`);
  }
  for (const w of plan.grain_warnings) {
    if (w.severity === 'critical') {
      instructions.push(`GRAIN SAFEGUARD: do not join ${w.tables.map(shortTable).join(' and ')} directly; aggregate to a common grain first.`);
    }
  }

  const example_questions = buildExamples(intent, metrics);
  const benchmark_questions = buildBenchmarks(intent, metrics);

  return {
    agent_id: `agent_${slug(intent.domain)}_${Date.now().toString(36)}`,
    name: `${titleCase(intent.domain)} Intelligence Agent`,
    domain: intent.domain,
    data_assets,
    instructions,
    business_definitions,
    synonyms,
    joins: joins.map((j) => ({ left: `${j.left_table}.${col(j.left)}`, right: `${j.right_table}.${col(j.right)}` })),
    sql_expressions,
    example_questions,
    trusted_assets,
    benchmark_questions,
    status: 'draft',
    version: 1,
    updated_at: nowIso(),
  };
}

function buildExamples(intent: Intent, metrics: Metric[]): string[] {
  const dim = intent.dimensions[0] ?? 'region';
  const out: string[] = [];
  for (const m of metrics.slice(0, 3)) {
    out.push(`What was ${m.name} by ${dim.toLowerCase()} last month?`);
    if (intent.time_comparison) out.push(`How did ${m.name} change over the last 3 months?`);
  }
  return [...new Set(out)];
}

function buildBenchmarks(intent: Intent, metrics: Metric[]): string[] {
  return metrics.slice(0, 3).map((m) => `Compute total ${m.name} for the ${intent.domain} domain and verify against ${m.expression}.`);
}

function col(assetId: string): string {
  return assetId.replace(/^column:/, '').split('.').slice(3).join('.');
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
