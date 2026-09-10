/**
 * Graph-ML enrichment pass (spec §13, §16.2).
 *
 * After deterministic edge scoring, this pass sends candidate/conflict edges to
 * the Python AI engine for embedding-similarity + GraphSAGE link prediction,
 * folds those into the multi-factor confidence, re-applies the SAME gating
 * function, and stores a Level-2 model explanation (feature attribution).
 *
 * If the AI engine is unavailable it is a no-op — deterministic trust stands.
 */
import { aiClient, type EdgeCandidatePayload } from '../adapters/ai/aiClient.js';
import { assetText } from './embeddingService.js';
import { evaluate } from './edgeScoringService.js';
import { recordEvidence } from './evidenceService.js';
import type { Explanation, ModelExplanation } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { nowIso, uuid } from '../util/ids.js';

export async function enrichEdgesWithModel(): Promise<{
  enriched: number;
  available: boolean;
  model_version?: string;
  mlflow_run?: string;
}> {
  const targets = [...store.edges.values()].filter(
    (e) => e.edge_type === 'references' && (e.status === 'candidate' || e.status === 'conflict'),
  );
  if (targets.length === 0) return { enriched: 0, available: true };

  const payload: EdgeCandidatePayload[] = targets.map((e) => {
    const src = store.nodes.get(e.source);
    const tgt = store.nodes.get(e.target);
    const cb = store.confidence.get(e.edge_id);
    return {
      edge_id: e.edge_id,
      source_text: src ? assetText(src) : e.source,
      target_text: tgt ? assetText(tgt) : e.target,
      source_features: { id: e.source, name: src?.name, data_type: src?.data_type },
      target_features: { id: e.target, name: tgt?.name, data_type: tgt?.data_type },
      lineage: Number(cb?.signals.lineage ?? 0),
      behavioral: Number(cb?.signals.behavioral_usage ?? 0),
    };
  });

  const resp = await aiClient.predictEdges(payload);
  if (!resp) return { enriched: 0, available: false };

  for (const score of resp.scores) {
    const edge = store.edges.get(score.edge_id);
    const cb = store.confidence.get(score.edge_id);
    if (!edge || !cb) continue;

    // Fold model signals into the breakdown, then re-run the gate function.
    cb.signals.model_prediction = score.prediction;
    cb.signals.semantic_similarity = score.embedding_similarity;
    const re = evaluate(score.edge_id, cb.signals);
    store.confidence.set(score.edge_id, re);

    // Record model prediction as evidence.
    const ev = recordEvidence({
      type: 'model_prediction',
      source: score.model_version,
      source_entity: edge.source,
      target_entity: edge.target,
      strength: score.prediction,
      detail: { embedding_similarity: score.embedding_similarity, attribution: score.attribution },
    });

    // Store a Level-2 model explanation (attribution, NOT chain-of-thought).
    const modelExpl: ModelExplanation = {
      model_version: score.model_version,
      prediction: score.prediction,
      top_signals: score.attribution.map((a) => ({ signal: a.signal, contribution: a.contribution })),
    };
    const explanation: Explanation = {
      explanation_id: `exp-${uuid().slice(0, 8)}`,
      subject_id: score.edge_id,
      level_1_technical: [],
      level_2_model: modelExpl,
      generated_at: nowIso(),
    };
    store.explanations.set(score.edge_id, explanation);

    edge.confidence = re.weighted_score;
    edge.status = re.conflict ? 'conflict' : re.trusted ? 'trusted' : 'candidate';
    if (!edge.evidence_ids.includes(ev.evidence_id)) edge.evidence_ids.push(ev.evidence_id);
    edge.model_version = score.model_version;
    edge.updated_at = nowIso();
  }

  return {
    enriched: resp.scores.length,
    available: true,
    model_version: resp.model_version,
    mlflow_run: resp.mlflow.run_id,
  };
}
