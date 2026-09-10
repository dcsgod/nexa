import type { FastifyInstance } from 'fastify';
import { aiClient } from '../adapters/ai/aiClient.js';
import { semanticSearch } from '../services/semanticRetrievalService.js';
import { store } from '../store/ontologyStore.js';

export async function intelligenceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/ai/status', async () => aiClient.health());

  app.get('/api/v1/semantic/search', async (req, reply) => {
    const q = (req.query as { q?: string; topK?: string }).q;
    if (!q) return reply.badRequest('q query param required');
    const topK = Number((req.query as { topK?: string }).topK ?? 10);
    return semanticSearch(q, topK);
  });

  // Level-2 model explanation for an edge (spec §16.2).
  app.get('/api/v1/explanations/:subjectId', async (req, reply) => {
    const { subjectId } = req.params as { subjectId: string };
    const exp = store.explanations.get(decodeURIComponent(subjectId));
    if (!exp) return reply.notFound('no explanation for subject');
    return exp;
  });
}
