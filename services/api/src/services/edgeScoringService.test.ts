import { describe, expect, it } from 'vitest';
import { evaluate } from './edgeScoringService.js';

describe('confidence gating (spec §14.1)', () => {
  it('trusts a strong-lineage, structurally-compatible edge', () => {
    const cb = evaluate('e1', {
      semantic_similarity: 0.9,
      structural_compatibility: 1,
      value_overlap: 0.98,
      lineage: 1,
      behavioral_usage: 0.8,
      data_quality: 0.95,
      human_validation: null,
    });
    expect(cb.trusted).toBe(true);
    expect(cb.conflict).toBe(false);
    expect(cb.gates_failed).toHaveLength(0);
  });

  it('flags a conflict when similarity is high but there is no lineage or usage', () => {
    const cb = evaluate('e2', {
      semantic_similarity: 0.95,
      structural_compatibility: 1,
      value_overlap: 0.5,
      lineage: 0,
      behavioral_usage: 0,
      data_quality: 0.9,
      human_validation: null,
    });
    expect(cb.conflict).toBe(true);
    expect(cb.trusted).toBe(false);
  });

  it('fails the minimum-evidence gate without lineage/usage/human approval', () => {
    const cb = evaluate('e3', {
      semantic_similarity: 0.6,
      structural_compatibility: 1,
      value_overlap: 0.5,
      lineage: 0,
      behavioral_usage: 0.1,
      data_quality: 0.9,
      human_validation: null,
    });
    expect(cb.gates_failed).toContain('minimum_evidence');
    expect(cb.trusted).toBe(false);
  });

  it('does not trust when structural compatibility is below the floor', () => {
    const cb = evaluate('e4', {
      semantic_similarity: 0.9,
      structural_compatibility: 0.3,
      value_overlap: 0.9,
      lineage: 1,
      behavioral_usage: 0.8,
      data_quality: 0.9,
      human_validation: null,
    });
    expect(cb.gates_failed).toContain('structural_floor');
    expect(cb.trusted).toBe(false);
  });
});
