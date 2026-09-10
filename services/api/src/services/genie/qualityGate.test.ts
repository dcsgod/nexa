import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, store } from '../../store/ontologyStore.js';
import { evaluateGate } from './qualityGate.js';
import { runBenchmarks } from './benchmarkService.js';
import type { GenieAgentConfig, Metric } from '../../domain/types.js';

function agent(over: Partial<GenieAgentConfig> = {}): GenieAgentConfig {
  return {
    agent_id: 'a1', name: 'A', domain: 'sales',
    data_assets: ['retail.sales.fact_sales'],
    instructions: ['Use "Revenue" = SUM(net_sales) at transaction grain.'],
    business_definitions: [{ term: 'Revenue', mapping: 'retail.sales.fact_sales', definition: 'net sales' }],
    synonyms: {}, joins: [{ left: 'a.b', right: 'c.d' }],
    sql_expressions: { Revenue: 'SUM(net_sales)' },
    example_questions: [], trusted_assets: ['retail.sales.fact_sales'],
    benchmark_questions: ['Compute total Revenue and verify against SUM(net_sales).'],
    status: 'draft', version: 1, updated_at: 'x', ...over,
  };
}

function goodPlan(agentId: string) {
  store.geniePlans.set(agentId, {
    scores: { semantic_coverage: 1, metric_coverage: 1, relationship_trust: 1, data_quality: 0.9, overall: 0.95 },
    grain_warnings: [],
  });
}

describe('quality gate (spec §26)', () => {
  beforeEach(() => {
    resetStore();
    const m: Metric = { metric_id: 'metric:revenue', name: 'Revenue', definition: '', expression: 'SUM(net_sales)', grain: 'transaction', dimensions: [], source: 'retail.sales.fact_sales', status: 'certified', updated_at: 'x' };
    store.metrics.set(m.metric_id, m);
  });

  it('is READY when scores, benchmarks, certification and grain all pass', () => {
    const a = agent();
    goodPlan(a.agent_id);
    store.genieAgents.set(a.agent_id, a);
    runBenchmarks(a);
    const gate = evaluateGate(a);
    expect(gate.verdict).toBe('READY_FOR_DEPLOYMENT');
    expect(gate.failed_gates).toHaveLength(0);
  });

  it('fails closed when a critical grain safeguard is present', () => {
    const a = agent({ instructions: ['GRAIN SAFEGUARD: do not join fact_sales and inventory_fact directly.'] });
    goodPlan(a.agent_id);
    store.genieAgents.set(a.agent_id, a);
    runBenchmarks(a);
    const gate = evaluateGate(a);
    expect(gate.verdict).toBe('HUMAN_REVIEW_REQUIRED');
    expect(gate.failed_gates).toContain('grain_safeguard');
  });

  it('fails when the source is not certified/trusted', () => {
    const a = agent({ trusted_assets: [] });
    goodPlan(a.agent_id);
    store.genieAgents.set(a.agent_id, a);
    runBenchmarks(a);
    const gate = evaluateGate(a);
    expect(gate.failed_gates).toContain('source_certification');
    expect(gate.verdict).toBe('HUMAN_REVIEW_REQUIRED');
  });
});
