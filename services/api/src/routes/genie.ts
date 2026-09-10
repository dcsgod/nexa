import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { compile, getAgent, listAgents, plan } from '../services/compiler/compilerService.js';
import { deployAgent, validateAgent } from '../services/genie/deployService.js';
import { chat } from '../services/genie/genieChatService.js';
import { explainAgent } from '../services/genie/genieExplainService.js';
import { store } from '../store/ontologyStore.js';

const requestSchema = z.object({ request: z.string().min(3) });

export async function genieRoutes(app: FastifyInstance): Promise<void> {
  // Plan only — interpret + select + join + grain check, no config persisted.
  app.post('/api/v1/genie/plan', async (req, reply) => {
    const p = requestSchema.safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    return plan(p.data.request);
  });

  // Compile — produce and store a draft Genie config (validation/deploy in P4).
  app.post('/api/v1/genie/compile', async (req, reply) => {
    const p = requestSchema.safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    return compile(p.data.request);
  });

  app.get('/api/v1/genie', async () => listAgents());

  app.get('/api/v1/genie/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = getAgent(id);
    if (!agent) return reply.notFound('agent not found');
    return agent;
  });

  // Run benchmarks + quality gate (spec §26). No deploy.
  app.post('/api/v1/genie/:id/validate', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      return validateAgent(id);
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });

  app.get('/api/v1/genie/:id/benchmarks', async (req, reply) => {
    const { id } = req.params as { id: string };
    const results = store.benchmarks.get(id);
    if (!results) return reply.notFound('no benchmarks — run validate first');
    return results;
  });

  // Deploy — gated; provisions via the Databricks adapter only if gate passes.
  app.post('/api/v1/genie/:id/deploy', async (req, reply) => {
    const { id } = req.params as { id: string };
    const actor = (req.body as { actor?: string } | undefined)?.actor ?? 'you@enterprise';
    try {
      return await deployAgent(id, actor);
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });

  // Embedded Genie chat (answer + SQL + data sources + semantic definitions).
  app.post('/api/v1/genie/:id/chat', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = z.object({ message: z.string().min(1) }).safeParse(req.body);
    if (!p.success) return reply.badRequest(p.error.message);
    try {
      return await chat(id, p.data.message);
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });

  // Genie explainability — "why did Genie use these tables?"
  app.get('/api/v1/genie/:id/explain', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      return explainAgent(id);
    } catch (e) {
      return reply.notFound((e as Error).message);
    }
  });
}
