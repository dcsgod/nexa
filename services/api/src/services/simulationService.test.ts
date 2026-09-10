import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, store } from '../store/ontologyStore.js';
import { runSimulation } from './simulationService.js';
import type { SemanticMapping } from '../domain/types.js';

function mapping(id: string, concept: string, asset: string, status: SemanticMapping['status'], graph: number, llm: number): SemanticMapping {
  return { mapping_id: id, semantic_concept: concept, technical_asset: asset, confidence: graph * 0.55 + llm * 0.45, graph_confidence: graph, llm_confidence: llm, status, evidence_ids: [], version: 1, updated_at: 'x' };
}

describe('§56 counterfactual simulation', () => {
  beforeEach(() => {
    resetStore();
    // Two candidate mappings that would flip to approved under a low threshold.
    store.mappings.set('m1', mapping('m1', 'Revenue', 'column:r.s.f.net_sales', 'candidate', 0.55, 0.55));
    store.mappings.set('m2', mapping('m2', 'Revenue', 'column:r.s.f.gross_sales', 'candidate', 0.52, 0.52));
  });

  it('previews mappings flipping to approved under a lower threshold', () => {
    const run = runSimulation({ confidence_threshold_override: 0.5 }, 'ravi');
    expect(run.status).toBe('complete');
    expect(run.summary!.newly_flipped_mappings.length).toBe(2);
    expect(run.summary!.newly_flipped_mappings[0]!.to).toBe('approved');
  });

  it('detects a new conflict when two assets would be approved for one concept', () => {
    const run = runSimulation({ confidence_threshold_override: 0.5 }, 'ravi');
    expect(run.summary!.newly_created_conflicts.length).toBeGreaterThanOrEqual(1);
    expect(run.summary!.newly_created_conflicts[0]!.concept).toBe('Revenue');
  });

  it('NEVER mutates real state', () => {
    const before = JSON.stringify([...store.mappings.values()]);
    runSimulation({ confidence_threshold_override: 0.5 }, 'ravi');
    runSimulation({ deprecated_assets: ['column:r.s.f.net_sales'] }, 'ravi');
    const after = JSON.stringify([...store.mappings.values()]);
    expect(after).toBe(before); // real mappings untouched
  });
});
