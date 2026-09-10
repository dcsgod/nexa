import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, store } from '../store/ontologyStore.js';
import { analyzeImpact } from './impactService.js';
import { MockDatabricksAdapter } from '../adapters/databricks/mock/mockAdapter.js';
import type { GenieAgentConfig, Metric, SemanticMapping, TechnicalNode } from '../domain/types.js';

function col(id: string, name: string): TechnicalNode {
  return { node_id: id, node_type: 'column', catalog: 'retail', schema: 'sales', name, data_type: 'decimal', technical_confidence: 1, fingerprint: 'f', version: 1, updated_at: 'x' };
}

describe('impact analysis (spec §29)', () => {
  beforeEach(() => {
    resetStore();
    store.nodes.set('column:retail.sales.fact_sales.net_sales', col('column:retail.sales.fact_sales.net_sales', 'net_sales'));
    const metric: Metric = { metric_id: 'metric:revenue', name: 'Revenue', definition: '', expression: 'SUM(net_sales)', grain: 'transaction', dimensions: [], source: 'retail.sales.fact_sales', status: 'certified', updated_at: 'x' };
    store.metrics.set(metric.metric_id, metric);
    const mapping: SemanticMapping = { mapping_id: 'map:revenue', semantic_concept: 'Revenue', technical_asset: 'column:retail.sales.fact_sales.net_sales', confidence: 0.9, status: 'approved', evidence_ids: [], version: 1, updated_at: 'x' };
    store.mappings.set(mapping.mapping_id, mapping);
    const agent: GenieAgentConfig = { agent_id: 'a1', name: 'Sales Agent', domain: 'sales', data_assets: ['retail.sales.fact_sales'], instructions: [], business_definitions: [{ term: 'Revenue', mapping: 'retail.sales.fact_sales', definition: '' }], synonyms: {}, joins: [], sql_expressions: { Revenue: 'SUM(net_sales)' }, example_questions: [], trusted_assets: ['retail.sales.fact_sales'], benchmark_questions: [], status: 'deployed', version: 1, updated_at: 'x' };
    store.genieAgents.set(agent.agent_id, agent);
  });

  it('finds affected metric, mapping and deployed agent for a changed column', () => {
    const i = analyzeImpact('column:retail.sales.fact_sales.net_sales');
    expect(i.affected_metrics.map((m) => m.name)).toContain('Revenue');
    expect(i.affected_mappings.map((m) => m.concept)).toContain('Revenue');
    expect(i.affected_agents.map((a) => a.name)).toContain('Sales Agent');
    expect(i.high_risk).toContain('Sales Agent');
  });

  it('returns empty impact for an unrelated asset', () => {
    const i = analyzeImpact('column:retail.crm.customer.email');
    expect(i.affected_metrics).toHaveLength(0);
    expect(i.affected_agents).toHaveLength(0);
  });
});

describe('mock schema-change simulation (spec §28)', () => {
  it('applies a column type change to the working catalog', async () => {
    const adapter = new MockDatabricksAdapter();
    const desc = adapter.simulateSchemaChange({ kind: 'change_type', table: 'retail.sales.fact_sales', column: 'net_sales', data_type: 'double' });
    expect(desc).toMatch(/net_sales/);
    const table = await adapter.getTable('retail.sales.fact_sales');
    expect(table?.columns.find((c) => c.name === 'net_sales')?.data_type).toBe('double');
  });

  it('drops a column from the working catalog', async () => {
    const adapter = new MockDatabricksAdapter();
    adapter.simulateSchemaChange({ kind: 'drop_column', table: 'retail.crm.orders', column: 'customer_id' });
    const table = await adapter.getTable('retail.crm.orders');
    expect(table?.columns.find((c) => c.name === 'customer_id')).toBeUndefined();
  });
});
