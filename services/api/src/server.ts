import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config.js';
import { ontologyRoutes } from './routes/ontology.js';
import { evidenceRoutes } from './routes/evidence.js';
import { governanceRoutes } from './routes/governance.js';
import { intelligenceRoutes } from './routes/intelligence.js';
import { semanticRoutes } from './routes/semantic.js';
import { genieRoutes } from './routes/genie.js';
import { driftRoutes } from './routes/drift.js';
import { simulateRoutes } from './routes/simulate.js';
import { runDiscovery } from './services/discoveryPipeline.js';
import { compileSemanticLayer } from './services/semantic/semanticMappingEngine.js';
import { getDatabricksAdapter } from './adapters/databricks/index.js';

export async function buildServer() {
  const app = Fastify({
    logger: { level: config.api.logLevel },
  });

  await app.register(sensible);
  await app.register(cors, { origin: config.api.webOrigin, credentials: true });

  app.get('/health', async () => {
    const adapter = getDatabricksAdapter();
    return {
      status: 'ok',
      mode: config.mode,
      adapter: { kind: adapter.kind, apiVersion: adapter.apiVersion },
    };
  });

  await app.register(ontologyRoutes);
  await app.register(evidenceRoutes);
  await app.register(governanceRoutes);
  await app.register(intelligenceRoutes);
  await app.register(semanticRoutes);
  await app.register(genieRoutes);
  await app.register(driftRoutes);
  await app.register(simulateRoutes);

  return app;
}

async function main() {
  const app = await buildServer();

  // In mock mode, warm the ontology on boot so the UI has data immediately.
  if (config.mode === 'mock') {
    const result = await runDiscovery();
    const semantic = await compileSemanticLayer();
    app.log.info({ result, semantic }, 'mock ontology + semantic layer warmed');
  }

  await app.listen({ port: config.api.port, host: '0.0.0.0' });
  app.log.info(`Nexa API listening on :${config.api.port} (mode=${config.mode})`);
}

// Run unless explicitly imported for tests (NEXA_NO_LISTEN=1).
if (process.env.NEXA_NO_LISTEN !== '1') {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
