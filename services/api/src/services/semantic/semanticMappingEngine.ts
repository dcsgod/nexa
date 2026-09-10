/**
 * Semantic mapping engine (spec §7, §16.3, §17, §18, §23).
 *
 * Derives concept ↔ technical-asset mappings. Keeps GRAPH confidence (technical
 * evidence) and LLM confidence (semantic interpretation) SEPARATE per §3.3, runs
 * every mapping through the Ontology Critic, and fails closed. Business synonyms
 * are not assumed to be identical metrics.
 */
import { getLlmAdapter, type InterpretationContext } from '../../adapters/llm/index.js';
import type {
  BusinessConcept,
  Explanation,
  Metric,
  SemanticMapping,
  TechnicalNode,
} from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';
import { nowIso, uuid } from '../../util/ids.js';
import { recordEvidence } from '../evidenceService.js';
import { semanticSearch } from '../semanticRetrievalService.js';
import { SEED_CONCEPTS, SEED_METRICS } from './glossarySeed.js';
import { critique } from './ontologyCritic.js';
import { appendMappingHistory } from './mappingHistoryService.js';

function seedGlossary(): void {
  if (store.concepts.size === 0) {
    for (const c of SEED_CONCEPTS) {
      const concept_id = `concept:${slug(c.name)}`;
      store.concepts.set(concept_id, { concept_id, ...c });
    }
  }
  if (store.metrics.size === 0) {
    for (const m of SEED_METRICS) {
      const metric_id = `metric:${slug(m.name)}`;
      store.metrics.set(metric_id, { metric_id, ...m });
    }
  }
}

export interface CompileResult {
  concepts: number;
  metrics: number;
  mappings: number;
  approved: number;
  review: number;
  rejected: number;
  conflicts: number;
}

export async function compileSemanticLayer(): Promise<CompileResult> {
  seedGlossary();
  store.mappings.clear();

  const llm = getLlmAdapter();
  let approved = 0;
  let review = 0;
  let rejected = 0;

  for (const concept of store.concepts.values()) {
    const candidates = await discoverCandidates(concept);
    for (const cand of candidates) {
      const node = store.nodes.get(cand.asset_id);
      if (!node) continue;

      const graph_confidence = graphConfidence(concept, node, cand.score);

      const ctx: InterpretationContext = {
        concept_name: concept.name,
        concept_definition: concept.definition,
        concept_synonyms: concept.synonyms,
        asset_id: node.node_id,
        asset_name: node.name,
        asset_description: node.description,
        asset_type: node.data_type,
        asset_tags: node.tags,
        signals: {
          monetary: node.tags?.includes('monetary'),
          lineage_to_concept: hasLineage(node.node_id),
          similar_to_approved: cand.score,
          aggregation_hint: aggregationHint(concept, node),
        },
      };
      const interp = await llm.interpret(ctx);

      const confidence = round(0.55 * graph_confidence + 0.45 * interp.confidence);

      const simEv = recordEvidence({
        type: 'semantic_similarity',
        source: 'nexa-embeddings',
        source_entity: concept.concept_id,
        target_entity: node.node_id,
        strength: cand.score,
      });
      const llmEv = recordEvidence({
        type: 'llm_interpretation',
        source: interp.llm_version,
        source_entity: concept.concept_id,
        target_entity: node.node_id,
        strength: interp.confidence,
        detail: { interpretation: interp.interpretation, grounding: interp.grounding },
      });

      const mapping: SemanticMapping = {
        mapping_id: `map:${slug(concept.name)}:${node.node_id}`,
        semantic_concept: concept.name,
        technical_asset: node.node_id,
        confidence,
        graph_confidence,
        llm_confidence: interp.confidence,
        status: 'candidate',
        evidence_ids: [simEv.evidence_id, llmEv.evidence_id],
        llm_interpretation_id: interp.llm_interpretation_id,
        human_validation: null,
        version: 1,
        updated_at: nowIso(),
      };

      const verdict = critique(mapping, concept, node);
      mapping.status = verdict.verdict === 'REJECT' ? 'rejected' : verdict.verdict === 'PASS' ? 'approved' : 'candidate';
      if (verdict.verdict === 'PASS') approved++;
      else if (verdict.verdict === 'REVIEW') review++;
      else rejected++;

      // Level-3 LLM explanation (grounded) stored per mapping.
      const explanation: Explanation = {
        explanation_id: `exp-${uuid().slice(0, 8)}`,
        subject_id: mapping.mapping_id,
        level_1_technical: verdict.checks.map((c) => ({ ok: c.ok, text: `${c.name}${c.note ? ` — ${c.note}` : ''}` })),
        level_3_llm: {
          llm_version: interp.llm_version,
          interpretation: interp.interpretation,
          grounding: interp.grounding,
        },
        generated_at: nowIso(),
      };
      store.explanations.set(mapping.mapping_id, explanation);
      store.mappings.set(mapping.mapping_id, mapping);
      // §55: record the mapping's initial/updated state in the append-only history.
      if (mapping.status !== 'rejected') appendMappingHistory(mapping, 'auto');
    }
  }

  const conflicts = detectConflicts();

  return {
    concepts: store.concepts.size,
    metrics: store.metrics.size,
    mappings: store.mappings.size,
    approved,
    review,
    rejected,
    conflicts,
  };
}

/** Candidate discovery: semantic retrieval + rule filter. Proposes, never decides. */
async function discoverCandidates(
  concept: BusinessConcept,
): Promise<{ asset_id: string; score: number }[]> {
  const query = [concept.name, ...(concept.synonyms ?? []), concept.definition ?? ''].join(' ');
  const hits = await semanticSearch(query, 12);
  const wantColumns = concept.type === 'business_metric' || concept.type === 'kpi' || concept.type === 'dimension';

  return hits
    .filter((h) => {
      const node = store.nodes.get(h.asset_id);
      if (!node) return false;
      if (wantColumns && node.node_type !== 'column') return false;
      if (!wantColumns && node.node_type !== 'table') return false;
      return h.score >= 0.3;
    })
    .slice(0, 3)
    .map((h) => ({ asset_id: h.asset_id, score: h.score }));
}

function graphConfidence(concept: BusinessConcept, node: TechnicalNode, simScore: number): number {
  let s = simScore * 0.6;
  const nameTokens = new Set(concept.name.toLowerCase().split(/\s+/));
  if ([...nameTokens].some((t) => node.name.toLowerCase().includes(t))) s += 0.2;
  if (node.tags?.includes('monetary') && /revenue|sales|value|margin/i.test(concept.name)) s += 0.12;
  // metric source-table alignment
  const metric = store.metrics.get(`metric:${slug(concept.name)}`);
  if (metric && node.node_id.includes(metric.source)) s += 0.1;
  return round(Math.min(1, s));
}

function aggregationHint(concept: BusinessConcept, node: TechnicalNode): string | undefined {
  const metric = store.metrics.get(`metric:${slug(concept.name)}`);
  if (metric && node.node_id.endsWith(metric.expression.replace(/^SUM\((.*)\)$/, '$1'))) {
    return `${metric.expression} appears in analysis of ${concept.domain} data`;
  }
  return undefined;
}

function hasLineage(nodeId: string): boolean {
  for (const e of store.edges.values()) {
    if (e.edge_type === 'lineage_to' && (e.source === nodeId || e.target === nodeId)) return true;
  }
  return false;
}

/**
 * Conflict detection (spec §17, §50): a single technical asset approved-mapped
 * to two or more DIFFERENT metric concepts is ambiguous → both go to conflict.
 */
function detectConflicts(): number {
  const byAsset = new Map<string, SemanticMapping[]>();
  for (const m of store.mappings.values()) {
    if (m.status === 'rejected') continue;
    const arr = byAsset.get(m.technical_asset) ?? [];
    arr.push(m);
    byAsset.set(m.technical_asset, arr);
  }
  let conflicts = 0;
  for (const maps of byAsset.values()) {
    const metricConcepts = maps.filter((m) => {
      const c = store.concepts.get(`concept:${slug(m.semantic_concept)}`);
      return c?.type === 'business_metric' || c?.type === 'kpi';
    });
    if (metricConcepts.length >= 2) {
      for (const m of metricConcepts) {
        m.status = 'candidate'; // hold for review
        m.conflict = true;
      }
      conflicts++;
    }
  }
  return conflicts;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function round(x: number): number {
  return Math.round(x * 100) / 100;
}
