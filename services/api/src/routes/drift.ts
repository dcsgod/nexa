import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDatabricksAdapter } from '../adapters/databricks/index.js';
import type { MockDatabricksAdapter, SchemaChange } from '../adapters/databricks/mock/mockAdapter.js';
import { detectDrift, driftEvents } from '../services/driftService.js';
import { analyzeImpact } from '../services/impactService.js';
import { approveHealing, proposeHealing } from '../services/selfHealService.js';

export async function driftRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/drift/events', async () => driftEvents());
  app.post('/api/v1/drift/detect', async () => detectDrift());

  app.get('/api/v1/impact/:assetId', async (req) => {
    const { assetId } = req.params as { assetId: string };
    return analyzeImpact(decodeURIComponent(assetId));
  });

  // Mock-only: simulate a schema change so drift can be demonstrated.
  app.post('/api/v1/drift/simulate', async (req, reply) => {
    const adapter = getDatabricksAdapter();
    if (adapter.kind !== 'mock') return reply.badRequest('simulation is only available in mock mode');
    const schema = z.object({
      kind: z.enum(['add_column', 'drop_column', 'change_type', 'rename_column']),
      table: z.string(),
      column: z.string(),
      data_type: z.string().optional(),
      to: z.string().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    const description = (adapter as MockDatabricksAdapter).simulateSchemaChange(p.data as SchemaChange);
    const result = await detectDrift();
    return { description, ...result };
  });

  // Self-healing
  app.post('/api/v1/genie/:id/heal/propose', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      return proposeHealing(id);
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });

  app.post('/api/v1/genie/heal/approve', async (req, reply) => {
    const schema = z.object({ candidate_agent_id: z.string(), original_agent_id: z.string(), actor: z.string().default('you@enterprise') });
    const p = schema.safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    return approveHealing(p.data.candidate_agent_id, p.data.original_agent_id, p.data.actor);
  });
}
