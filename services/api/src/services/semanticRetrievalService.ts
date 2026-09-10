/**
 * Vector retrieval (spec §31). Finds semantically relevant candidate assets via
 * embedding cosine similarity. IMPORTANT: retrieval only proposes candidates —
 * it never determines a technical relationship on its own (spec §31, §52).
 */
import { aiClient } from '../adapters/ai/aiClient.js';
import { store } from '../store/ontologyStore.js';

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / ((Math.sqrt(na) * Math.sqrt(nb)) || 1);
}

export interface RetrievalHit {
  asset_id: string;
  name: string;
  node_type: string;
  score: number;
}

/** Semantic search over stored asset embeddings for a free-text query. */
export async function semanticSearch(query: string, topK = 10): Promise<RetrievalHit[]> {
  const embedded = await aiClient.embed([query]);
  if (!embedded) return [];
  const qv = embedded.vectors[0]!;
  const hits: RetrievalHit[] = [];
  for (const emb of store.embeddings.values()) {
    const node = store.nodes.get(emb.asset_id);
    if (!node) continue;
    hits.push({
      asset_id: emb.asset_id,
      name: node.name,
      node_type: node.node_type,
      score: Math.round(cosine(qv, emb.vector) * 1000) / 1000,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}

/** Cosine similarity between two already-embedded assets (0 if missing). */
export function assetSimilarity(a: string, b: string): number {
  const ea = store.embeddings.get(a);
  const eb = store.embeddings.get(b);
  if (!ea || !eb) return 0;
  return Math.round(cosine(ea.vector, eb.vector) * 1000) / 1000;
}
