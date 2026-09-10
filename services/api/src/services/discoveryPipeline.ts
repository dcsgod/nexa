/** Phase 1 orchestration (spec §8, §44): scan → lineage → profile → score → embed → model-enrich. */
import { scanCatalog } from './catalogService.js';
import { ingestLineage } from './lineageService.js';
import { profileAndScoreQuality } from './profilingService.js';
import { scoreCandidateEdges } from './edgeScoringService.js';
import { generateEmbeddings } from './embeddingService.js';
import { enrichEdgesWithModel } from './modelEnrichmentService.js';
import { store } from '../store/ontologyStore.js';

export interface DiscoveryResult {
  scanned_tables: number;
  lineage_edges: number;
  profiled_columns: number;
  scored_edges: number;
  embedded_assets: number;
  model_enriched_edges: number;
  ai_engine_available: boolean;
  model_version?: string;
  nodes: number;
  edges: number;
  ontology_version: number;
}

export async function runDiscovery(catalog?: string): Promise<DiscoveryResult> {
  const scan = await scanCatalog(catalog);
  const lineage = await ingestLineage(catalog);
  const prof = await profileAndScoreQuality();
  const scoring = await scoreCandidateEdges(catalog);

  // P1: semantic + graph-ML intelligence (best-effort; degrades if AI engine down).
  const emb = await generateEmbeddings();
  const enrich = await enrichEdgesWithModel();

  return {
    scanned_tables: scan.scanned,
    lineage_edges: lineage.edges,
    profiled_columns: prof.profiled,
    scored_edges: scoring.scored,
    embedded_assets: emb.embedded,
    model_enriched_edges: enrich.enriched,
    ai_engine_available: emb.available && enrich.available,
    model_version: enrich.model_version,
    nodes: store.nodes.size,
    edges: store.edges.size,
    ontology_version: store.meta.ontologyVersion,
  };
}
