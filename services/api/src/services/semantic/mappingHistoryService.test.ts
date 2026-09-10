import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, store } from '../../store/ontologyStore.js';
import { appendMappingHistory, conceptHistory, diffConcept, listConflicts } from './mappingHistoryService.js';
import type { SemanticMapping } from '../../domain/types.js';

function mapping(over: Partial<SemanticMapping> = {}): SemanticMapping {
  return {
    mapping_id: 'map:revenue:col', semantic_concept: 'Revenue', technical_asset: 'column:r.s.f.net_sales',
    confidence: 0.85, graph_confidence: 0.82, llm_confidence: 0.86, status: 'approved',
    evidence_ids: ['ev1'], version: 1, updated_at: 'x', ...over,
  };
}

describe('§55 mapping history (append-only)', () => {
  beforeEach(() => resetStore());

  it('appends a new row and closes the prior open row on status change', () => {
    const m = mapping();
    appendMappingHistory(m, 'auto');
    appendMappingHistory({ ...m, status: 'certified' }, 'ravi', 'certified for exec');
    const rows = conceptHistory('Revenue');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.valid_to).not.toBeNull(); // prior row closed
    expect(rows[1]!.valid_to).toBeNull(); // current row open
    expect(rows[1]!.status).toBe('certified');
    expect(rows[1]!.approved_by).toBe('ravi');
  });

  it('is idempotent when nothing changed (no duplicate row)', () => {
    const m = mapping();
    appendMappingHistory(m, 'auto');
    appendMappingHistory(m, 'auto');
    expect(conceptHistory('Revenue')).toHaveLength(1);
  });

  it('computes a diff across versions', () => {
    const m = mapping();
    appendMappingHistory(m, 'auto');
    appendMappingHistory({ ...m, status: 'certified' }, 'ravi');
    const diff = diffConcept('Revenue', 1, 2);
    expect(diff?.status_changed).toBe(true);
    expect(diff?.from.status).toBe('approved');
    expect(diff?.to.status).toBe('certified');
  });

  it('logs a conflict when two different assets are approved for one concept', () => {
    appendMappingHistory(mapping({ mapping_id: 'map:revenue:a', technical_asset: 'column:r.s.f.net_sales' }), 'auto');
    appendMappingHistory(mapping({ mapping_id: 'map:revenue:b', technical_asset: 'column:r.s.f.gross_sales' }), 'auto');
    expect(listConflicts('pending').length).toBeGreaterThanOrEqual(1);
  });
});
