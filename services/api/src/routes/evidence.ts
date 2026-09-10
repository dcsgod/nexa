import type { FastifyInstance } from 'fastify';
import { getEvidence } from '../services/evidenceService.js';
import { store } from '../store/ontologyStore.js';

export async function evidenceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/evidence/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ev = getEvidence(id);
    if (!ev) return reply.notFound('evidence not found');
    return ev;
  });

  app.get('/api/v1/evidence', async () => [...store.evidence.values()]);
}
