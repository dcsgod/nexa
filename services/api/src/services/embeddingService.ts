/**
 * Embedding generation (spec §12). Builds a text representation for each table
 * and column from safe metadata (name, schema context, type, description) — no
 * raw sensitive samples — and stores reproducible vectors keyed by asset id.
 */
import { aiClient } from '../adapters/ai/aiClient.js';
import type { TechnicalNode } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { nowIso } from '../util/ids.js';

/** Safe text for embedding — metadata only. */
export function assetText(node: TechnicalNode): string {
  const parts = [node.name.replace(/_/g, ' ')];
  if (node.schema) parts.push(node.schema);
  if (node.data_type) parts.push(node.data_type.replace(/\(.*\)/, ''));
  if (node.description) parts.push(node.description);
  if (node.tags?.length) parts.push(node.tags.join(' '));
  return parts.join(' ');
}

export async function generateEmbeddings(): Promise<{ embedded: number; available: boolean }> {
  const nodes = [...store.nodes.values()].filter(
    (n) => n.node_type === 'table' || n.node_type === 'column' || n.node_type === 'view',
  );
  const texts = nodes.map(assetText);
  const result = await aiClient.embed(texts);
  if (!result) return { embedded: 0, available: false };

  const at = nowIso();
  nodes.forEach((n, i) => {
    store.embeddings.set(n.node_id, {
      asset_id: n.node_id,
      model_id: result.model_id,
      vector: result.vectors[i]!,
      text: texts[i]!,
      generated_at: at,
    });
  });
  return { embedded: nodes.length, available: true };
}
