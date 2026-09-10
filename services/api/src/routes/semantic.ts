import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { compileSemanticLayer } from '../services/semantic/semanticMappingEngine.js';
import {
  conceptDetail,
  listConcepts,
  listMetrics,
  semanticConflicts,
} from '../services/semantic/semanticReadService.js';
import { decideMapping } from '../services/governanceService.js';
import {
  conceptHistory,
  diffConcept,
  listConflicts,
  resolveMappingConflict,
} from '../services/semantic/mappingHistoryService.js';
import { store } from '../store/ontologyStore.js';

export async function semanticRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/semantic/compile', async () => compileSemanticLayer());

  app.get('/api/v1/semantic/concepts', async (req) => {
    const q = (req.query as { q?: string }).q;
    return listConcepts(q);
  });

  app.get('/api/v1/semantic/concepts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const detail = conceptDetail(decodeURIComponent(id));
    if (!detail) return reply.notFound('concept not found');
    return detail;
  });

  app.get('/api/v1/semantic/metrics', async () => listMetrics());
  app.get('/api/v1/semantic/conflicts', async () => semanticConflicts());

  const mappingDecision = z.object({
    action: z.enum(['approve_mapping', 'reject_mapping', 'certify_metric']),
    actor: z.string().min(1),
    target_id: z.string().min(1),
    reason: z.string().optional(),
    simulation_id: z.string().optional(),
  });

  app.post('/api/v1/governance/mapping', async (req, reply) => {
    const p = mappingDecision.safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    try {
      return decideMapping(p.data);
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });

  // §55 — Concept Timeline: history, diff, conflict log.
  app.get('/api/v1/semantic/concepts/:id/history', async (req, reply) => {
    const { id } = req.params as { id: string };
    const concept = store.concepts.get(decodeURIComponent(id));
    if (!concept) return reply.notFound('concept not found');
    return conceptHistory(concept.name);
  });

  app.get('/api/v1/semantic/concepts/:id/diff', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { from?: string; to?: string };
    const concept = store.concepts.get(decodeURIComponent(id));
    if (!concept) return reply.notFound('concept not found');
    const diff = diffConcept(concept.name, Number(q.from ?? 1), Number(q.to ?? 2));
    if (!diff) return reply.notFound('not enough history to diff');
    return diff;
  });

  app.get('/api/v1/semantic/conflicts-log', async (req) => {
    const status = (req.query as { status?: string }).status;
    return listConflicts(status);
  });

  app.post('/api/v1/semantic/conflicts/:id/resolve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = z
      .object({
        resolution: z.enum(['resolved_a', 'resolved_b', 'both_valid_context_dependent']),
        resolved_by: z.string().default('you@enterprise'),
        notes: z.string().optional(),
      })
      .safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    try {
      return resolveMappingConflict(id, p.data.resolution, p.data.resolved_by, p.data.notes);
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });
}
