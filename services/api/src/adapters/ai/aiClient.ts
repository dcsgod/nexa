/**
 * Client for the Python AI engine (spec §5.3).
 *
 * The AI engine owns model-heavy work (embeddings, graph ML, attribution). This
 * client is resilient: if the engine is unreachable the platform degrades to
 * deterministic local scoring rather than failing — trust signals just lose the
 * ML contribution until the engine is back.
 */
import { config } from '../../config.js';

const TIMEOUT_MS = 4000;

export interface EdgeScoreResult {
  edge_id: string;
  model_version: string;
  prediction: number;
  embedding_similarity: number;
  attribution: { signal: string; contribution: number }[];
}

export interface PredictEdgesResponse {
  model_version: string;
  mlflow: { logged: boolean; run_id?: string; model_version: string };
  scores: EdgeScoreResult[];
}

export interface EdgeCandidatePayload {
  edge_id: string;
  source_text: string;
  target_text: string;
  source_features: Record<string, unknown>;
  target_features: Record<string, unknown>;
  lineage: number;
  behavioral: number;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${config.aiEngineUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`AI engine ${res.status} on ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const aiClient = {
  async health(): Promise<{ ok: boolean; detail?: Record<string, unknown> }> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(`${config.aiEngineUrl}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return { ok: false };
      return { ok: true, detail: (await res.json()) as Record<string, unknown> };
    } catch {
      return { ok: false };
    }
  },

  async embed(texts: string[]): Promise<{ model_id: string; vectors: number[][] } | null> {
    try {
      return await post('/embed', { texts });
    } catch {
      return null;
    }
  },

  async predictEdges(candidates: EdgeCandidatePayload[]): Promise<PredictEdgesResponse | null> {
    if (candidates.length === 0) return { model_version: 'none', mlflow: { logged: false, model_version: 'none' }, scores: [] };
    try {
      return await post('/predict-edges', candidates);
    } catch {
      return null;
    }
  },
};
