import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  decideRelationship,
  governanceLog,
  resolveConflict,
  reviewQueue,
} from '../services/governanceService.js';

const decisionSchema = z.object({
  actor: z.string().min(1),
  target_id: z.string().min(1),
  reason: z.string().optional(),
});

export async function governanceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/governance/review-queue', async () => reviewQueue());
  app.get('/api/v1/governance/log', async () => governanceLog());

  app.post('/api/v1/governance/approve', async (req, reply) => {
    const p = decisionSchema.safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    try {
      return decideRelationship({ ...p.data, action: 'approve_relationship' });
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });

  app.post('/api/v1/governance/reject', async (req, reply) => {
    const p = decisionSchema.safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    try {
      return decideRelationship({ ...p.data, action: 'reject_relationship' });
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });

  app.post('/api/v1/governance/resolve-conflict', async (req, reply) => {
    const schema = decisionSchema.extend({ resolution: z.enum(['trusted', 'rejected']) });
    const p = schema.safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    try {
      return resolveConflict({ ...p.data, action: 'resolve_conflict' });
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });
}
