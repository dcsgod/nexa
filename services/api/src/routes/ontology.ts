import type { FastifyInstance } from 'fastify';
import { runDiscovery } from '../services/discoveryPipeline.js';
import {
  getNode,
  listEdges,
  listNodes,
  overviewStats,
  subgraph,
} from '../services/graphService.js';
import { store } from '../store/ontologyStore.js';

export async function ontologyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/overview', async () => overviewStats());

  app.post('/api/v1/discovery/run', async (req) => {
    const catalog = (req.query as { catalog?: string }).catalog;
    return runDiscovery(catalog);
  });

  app.get('/api/v1/ontology/nodes', async (req) => {
    const q = req.query as Record<string, string>;
    return listNodes({
      type: q.type as never,
      catalog: q.catalog,
      schema: q.schema,
      q: q.q,
      minQuality: q.minQuality ? Number(q.minQuality) : undefined,
    });
  });

  app.get('/api/v1/ontology/nodes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const node = getNode(decodeURIComponent(id));
    if (!node) return reply.notFound('node not found');
    return { node, quality: store.quality.get(node.node_id) ?? null };
  });

  app.get('/api/v1/ontology/edges', async (req) => {
    const q = req.query as Record<string, string>;
    return listEdges({
      type: q.type as never,
      status: q.status as never,
      minConfidence: q.minConfidence ? Number(q.minConfidence) : undefined,
    });
  });

  app.get('/api/v1/ontology/subgraph', async (req, reply) => {
    const q = req.query as { node?: string; depth?: string };
    if (!q.node) return reply.badRequest('node query param required');
    return subgraph(decodeURIComponent(q.node), q.depth ? Number(q.depth) : 1);
  });

  app.get('/api/v1/confidence/:edgeId', async (req, reply) => {
    const { edgeId } = req.params as { edgeId: string };
    const cb = store.confidence.get(decodeURIComponent(edgeId));
    if (!cb) return reply.notFound('no confidence breakdown for edge');
    return cb;
  });
}
