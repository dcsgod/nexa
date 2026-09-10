import { beforeEach, describe, expect, it } from 'vitest';
import { validateGrain } from './grainValidator.js';
import { parseIntent } from './intentParser.js';
import { resetStore, store } from '../../store/ontologyStore.js';
import type { Metric } from '../../domain/types.js';
import type { PlannedJoin, SelectedAsset } from './types.js';

function metric(name: string, source: string, grain: string): Metric {
  return { metric_id: name, name, definition: '', expression: `SUM(${name})`, grain, dimensions: [], source, status: 'certified', updated_at: 'x' };
}

describe('grain validator (spec §22)', () => {
  const salesAsset: SelectedAsset = { asset_id: 'table:r.s.fact_sales', role: 'fact', certified: true, trusted: true, quality: 0.9, reason: '', supports: [] };
  const invAsset: SelectedAsset = { asset_id: 'table:r.p.inventory_fact', role: 'fact', certified: true, trusted: true, quality: 0.9, reason: '', supports: [] };
  const join: PlannedJoin = { left: 'x', right: 'y', left_table: 'r.s.fact_sales', right_table: 'r.p.inventory_fact', edge_status: 'trusted', confidence: 1 };

  it('flags CRITICAL when incompatible-grain facts are joined', () => {
    const w = validateGrain(
      [salesAsset, invAsset],
      [metric('Revenue', 'r.s.fact_sales', 'transaction'), metric('Inventory Units', 'r.p.inventory_fact', 'product_store_day')],
      [join],
    );
    expect(w).toHaveLength(1);
    expect(w[0]!.severity).toBe('critical');
    expect(w[0]!.message).toMatch(/inflated/i);
  });

  it('is silent when both facts share the same grain', () => {
    const w = validateGrain(
      [salesAsset, invAsset],
      [metric('Revenue', 'r.s.fact_sales', 'transaction'), metric('Gross', 'r.p.inventory_fact', 'transaction')],
      [join],
    );
    expect(w).toHaveLength(0);
  });

  it('is silent with a single fact', () => {
    expect(validateGrain([salesAsset], [metric('Revenue', 'r.s.fact_sales', 'transaction')], [])).toHaveLength(0);
  });
});

describe('intent parser (spec §20)', () => {
  beforeEach(() => {
    resetStore();
    store.concepts.set('concept:inventory_units', { concept_id: 'concept:inventory_units', name: 'Inventory Units', type: 'business_metric', domain: 'supply_chain', synonyms: ['on hand'], status: 'proposed', updated_at: 'x' });
    store.concepts.set('concept:region', { concept_id: 'concept:region', name: 'Region', type: 'dimension', domain: 'sales', synonyms: ['market'], status: 'proposed', updated_at: 'x' });
  });

  it('matches a concept by its distinctive leading token', () => {
    const i = parseIntent('why is inventory increasing over time');
    expect(i.metrics).toContain('Inventory Units');
    expect(i.time_comparison).toBe(true);
    expect(i.domain).toBe('supply_chain');
  });

  it('matches a dimension by synonym', () => {
    const i = parseIntent('show me sales by market');
    expect(i.dimensions).toContain('Region');
  });
});
