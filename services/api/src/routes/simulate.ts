import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getSimulation, runSimulation } from '../services/simulationService.js';
import type { HypotheticalOverlay } from '../domain/types.js';

const overlaySchema = z.object({
  concept_mapping_changes: z
    .array(z.object({ concept: z.string(), technical_asset: z.string(), status: z.string().optional() }))
    .optional(),
  confidence_threshold_override: z.number().min(0).max(1).optional(),
  deprecated_assets: z.array(z.string()).optional(),
  requested_by: z.string().default('you@enterprise'),
});

export async function simulateRoutes(app: FastifyInstance): Promise<void> {
  // Kick off a counterfactual simulation (§56). Returns immediately with a run.
  app.post('/api/v1/simulate', async (req, reply) => {
    const p = overlaySchema.safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    const { requested_by, ...overlay } = p.data;
    return runSimulation(overlay as HypotheticalOverlay, requested_by);
  });

  app.get('/api/v1/simulate/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const run = getSimulation(id);
    if (!run) return reply.notFound('simulation not found');
    return run;
  });
}
