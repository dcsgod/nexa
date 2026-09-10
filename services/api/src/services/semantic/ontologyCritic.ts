/**
 * Ontology Critic (spec §18). A separate evaluation component that gates
 * semantic mappings BEFORE they can be certified. Fails closed (spec §3.8):
 * low-confidence, unsupported, or conflicting mappings go to REVIEW/REJECT.
 */
import type { BusinessConcept, SemanticMapping, TechnicalNode } from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';

export type CriticVerdict = 'PASS' | 'REVIEW' | 'REJECT';

export interface CriticResult {
  verdict: CriticVerdict;
  checks: { name: string; ok: boolean; note?: string }[];
}

export function critique(
  mapping: SemanticMapping,
  concept: BusinessConcept,
  asset: TechnicalNode | undefined,
): CriticResult {
  const checks: CriticResult['checks'] = [];

  // 1. Evidence must exist (no unsupported claims).
  const hasEvidence = mapping.evidence_ids.length > 0;
  checks.push({ name: 'has_evidence', ok: hasEvidence, note: hasEvidence ? undefined : 'no evidence records' });

  // 2. Source asset quality floor.
  const q = asset ? (store.quality.get(`table:${tableOf(asset)}`)?.overall ?? asset.quality_score ?? 0.8) : 0;
  const qualityOk = q >= 0.7;
  checks.push({ name: 'source_quality', ok: qualityOk, note: `quality ${Math.round(q * 100)}%` });

  // 3. Graph and LLM must not strongly disagree (spec §17).
  const gap = Math.abs((mapping.graph_confidence ?? 0) - (mapping.llm_confidence ?? 0));
  const noConflict = gap <= 0.25;
  checks.push({ name: 'graph_llm_agreement', ok: noConflict, note: `gap ${Math.round(gap * 100)}%` });

  // 4. Minimum combined confidence.
  const confOk = mapping.confidence >= 0.6;
  checks.push({ name: 'min_confidence', ok: confOk, note: `${Math.round(mapping.confidence * 100)}%` });

  // 5. Concept must be a sensible type target for the asset.
  const typeOk = conceptAssetTypeCompatible(concept, asset);
  checks.push({ name: 'type_compatibility', ok: typeOk });

  const failed = checks.filter((c) => !c.ok).length;
  let verdict: CriticVerdict;
  if (!hasEvidence || !confOk || !typeOk) verdict = 'REJECT';
  else if (failed > 0 || !noConflict) verdict = 'REVIEW';
  else verdict = 'PASS';

  return { verdict, checks };
}

function conceptAssetTypeCompatible(concept: BusinessConcept, asset?: TechnicalNode): boolean {
  if (!asset) return false;
  // metrics should map to numeric/monetary columns; dimensions/entities to keys/strings.
  const isNumeric = /int|decimal|double|float|bigint/i.test(asset.data_type ?? '');
  if (concept.type === 'business_metric' || concept.type === 'kpi') return isNumeric || asset.node_type === 'table';
  return true;
}

function tableOf(asset: TechnicalNode): string {
  return asset.node_id.replace(/^(column|table):/, '').split('.').slice(0, 3).join('.');
}
