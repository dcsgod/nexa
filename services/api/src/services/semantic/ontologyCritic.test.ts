import { describe, expect, it } from 'vitest';
import { critique } from './ontologyCritic.js';
import type { BusinessConcept, SemanticMapping, TechnicalNode } from '../../domain/types.js';

const concept: BusinessConcept = {
  concept_id: 'concept:revenue', name: 'Revenue', type: 'business_metric',
  status: 'proposed', updated_at: 'x',
};
const asset: TechnicalNode = {
  node_id: 'column:retail.sales.fact_sales.net_sales', node_type: 'column',
  name: 'net_sales', data_type: 'decimal(18,2)', technical_confidence: 1,
  fingerprint: 'f', version: 1, updated_at: 'x', quality_score: 0.95,
};

function mapping(over: Partial<SemanticMapping>): SemanticMapping {
  return {
    mapping_id: 'm', semantic_concept: 'Revenue', technical_asset: asset.node_id,
    confidence: 0.85, graph_confidence: 0.82, llm_confidence: 0.86, status: 'candidate',
    evidence_ids: ['ev-1'], version: 1, updated_at: 'x', ...over,
  };
}

describe('ontology critic (spec §18)', () => {
  it('PASS for a well-evidenced, agreeing, numeric metric mapping', () => {
    expect(critique(mapping({}), concept, asset).verdict).toBe('PASS');
  });

  it('REJECT when there is no evidence', () => {
    expect(critique(mapping({ evidence_ids: [] }), concept, asset).verdict).toBe('REJECT');
  });

  it('REJECT when combined confidence is below the floor', () => {
    expect(critique(mapping({ confidence: 0.4 }), concept, asset).verdict).toBe('REJECT');
  });

  it('REVIEW when graph and LLM strongly disagree', () => {
    const r = critique(mapping({ graph_confidence: 0.95, llm_confidence: 0.5 }), concept, asset);
    expect(r.verdict).toBe('REVIEW');
  });

  it('REJECT when a metric maps to a non-numeric column', () => {
    const stringAsset: TechnicalNode = { ...asset, data_type: 'string', node_id: 'column:x.y.z.name' };
    expect(critique(mapping({ technical_asset: stringAsset.node_id }), concept, stringAsset).verdict).toBe('REJECT');
  });
});
