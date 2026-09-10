/**
 * Ontology state store.
 *
 * In the full system this is Delta Lake / Unity Catalog managed tables
 * (spec §32). For P0 in mock mode it is an in-memory, versioned store with the
 * same shape and access patterns, so a Delta-backed implementation can replace
 * it behind the same interface without touching services.
 */
import type {
  BenchmarkResult,
  ConflictLogRow,
  DriftEvent,
  MappingHistoryRow,
  SimulationRun,
  BusinessConcept,
  ConfidenceBreakdown,
  Evidence,
  Explanation,
  GenieAgentConfig,
  GovernanceEvent,
  Metric,
  QualityGateResult,
  QualitySignal,
  SemanticMapping,
  TechnicalEdge,
  TechnicalNode,
} from '../domain/types.js';

export interface StoredEmbedding {
  asset_id: string;
  model_id: string;
  vector: number[];
  text: string;
  generated_at: string;
}

export interface OntologyStore {
  nodes: Map<string, TechnicalNode>;
  edges: Map<string, TechnicalEdge>;
  evidence: Map<string, Evidence>;
  confidence: Map<string, ConfidenceBreakdown>;
  embeddings: Map<string, StoredEmbedding>;
  quality: Map<string, QualitySignal>;
  concepts: Map<string, BusinessConcept>;
  metrics: Map<string, Metric>;
  mappings: Map<string, SemanticMapping>;
  explanations: Map<string, Explanation>;
  governance: GovernanceEvent[];
  genieAgents: Map<string, GenieAgentConfig>;
  geniePlans: Map<string, unknown>; // CompilerPlan per agent (kept loose to avoid coupling)
  benchmarks: Map<string, BenchmarkResult[]>;
  qualityGates: Map<string, QualityGateResult>;
  drift: DriftEvent[];
  mappingHistory: MappingHistoryRow[]; // append-only (spec §55)
  conflictLog: ConflictLogRow[];
  simulations: Map<string, SimulationRun>; // §56
  meta: { lastScan?: string; ontologyVersion: number };
}

export const store: OntologyStore = {
  nodes: new Map(),
  edges: new Map(),
  evidence: new Map(),
  confidence: new Map(),
  embeddings: new Map(),
  quality: new Map(),
  concepts: new Map(),
  metrics: new Map(),
  mappings: new Map(),
  explanations: new Map(),
  governance: [],
  genieAgents: new Map(),
  geniePlans: new Map(),
  benchmarks: new Map(),
  qualityGates: new Map(),
  drift: [],
  mappingHistory: [],
  conflictLog: [],
  simulations: new Map(),
  meta: { ontologyVersion: 0 },
};

export function resetStore(): void {
  store.nodes.clear();
  store.edges.clear();
  store.evidence.clear();
  store.confidence.clear();
  store.embeddings.clear();
  store.quality.clear();
  store.concepts.clear();
  store.metrics.clear();
  store.mappings.clear();
  store.explanations.clear();
  store.governance.length = 0;
  store.genieAgents.clear();
  store.geniePlans.clear();
  store.benchmarks.clear();
  store.qualityGates.clear();
  store.drift.length = 0;
  store.mappingHistory.length = 0;
  store.conflictLog.length = 0;
  store.simulations.clear();
  store.meta = { ontologyVersion: 0 };
}
