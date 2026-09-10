/** Typed client for the Nexa Node API. */

export interface Overview {
  technical_assets: number;
  columns: number;
  business_concepts: number;
  trusted_relationships: number;
  candidate_relationships: number;
  semantic_conflicts: number;
  avg_data_quality: number;
  genie_agents: number;
  drift_events?: number;
  ontology_version: number;
  last_scan: string | null;
}

export interface TechnicalNode {
  node_id: string;
  node_type: string;
  catalog?: string;
  schema?: string;
  name: string;
  data_type?: string;
  description?: string;
  tags?: string[];
  quality_score?: number;
  technical_confidence: number;
  version: number;
}

export interface TechnicalEdge {
  edge_id: string;
  source: string;
  target: string;
  edge_type: string;
  confidence: number;
  status: string;
  evidence_ids: string[];
}

export interface ConfidenceBreakdown {
  edge_id: string;
  signals: Record<string, number | string | null>;
  weighted_score: number;
  gates_passed: string[];
  gates_failed: string[];
  conflict: boolean;
  trusted: boolean;
}

export interface Evidence {
  evidence_id: string;
  type: string;
  source: string;
  source_entity?: string;
  target_entity?: string;
  detail?: Record<string, unknown>;
  observed_at: string;
  strength: number;
}

export interface ModelExplanation {
  model_version: string;
  prediction: number;
  top_signals: { signal: string; contribution: number }[];
}

export interface Explanation {
  explanation_id: string;
  subject_id: string;
  level_1_technical?: { ok: boolean; text: string }[];
  level_2_model?: ModelExplanation;
  level_3_llm?: { llm_version: string; interpretation: string; grounding: { ok: boolean; text: string }[] };
  generated_at: string;
}

export interface GovernanceEvent {
  event_id: string;
  action: string;
  actor: string;
  target_id: string;
  timestamp: string;
  previous_value?: unknown;
  new_value?: unknown;
  reason?: string;
}

export interface ReviewQueue {
  candidates: TechnicalEdge[];
  conflicts: TechnicalEdge[];
}

export interface ConceptSummary {
  concept_id: string;
  name: string;
  type: string;
  definition?: string;
  domain?: string;
  synonyms?: string[];
  status: string;
  mapping_count: number;
  best_confidence: number;
  has_conflict: boolean;
}

export interface SemanticMapping {
  mapping_id: string;
  semantic_concept: string;
  technical_asset: string;
  confidence: number;
  graph_confidence?: number;
  llm_confidence?: number;
  status: string;
  conflict?: boolean;
  explanation_id?: string;
}

export interface Metric {
  metric_id: string;
  name: string;
  definition: string;
  expression: string;
  grain: string;
  dimensions: string[];
  source: string;
  status: string;
}

export interface ConceptDetail {
  concept: ConceptSummary;
  metric?: Metric;
  mappings: SemanticMapping[];
}

export interface MappingHistoryRow {
  mapping_id: string;
  business_concept: string;
  technical_asset: string;
  version: number;
  valid_from: string;
  valid_to: string | null;
  status: string;
  graph_confidence?: number;
  llm_confidence?: number;
  approved_by: string;
  approval_reason?: string;
}

export interface MappingDiff {
  business_concept: string;
  from: { version: number; technical_asset: string; status: string; confidence?: number };
  to: { version: number; technical_asset: string; status: string; confidence?: number };
  technical_asset_changed: boolean;
  status_changed: boolean;
  confidence_delta: number;
  affected_genie_agents: { agent_id: string; name: string }[];
}

export interface LlmExplanation {
  llm_version: string;
  interpretation: string;
  grounding: { ok: boolean; text: string }[];
}

export interface CompilerPlan {
  intent: {
    request: string;
    domain: string;
    concepts: string[];
    metrics: string[];
    dimensions: string[];
    entities: string[];
    time_comparison: boolean;
  };
  selected_assets: {
    asset_id: string;
    role: string;
    certified: boolean;
    trusted: boolean;
    quality: number;
    reason: string;
    supports: string[];
  }[];
  metrics: { name: string; expression: string; grain: string; status: string }[];
  joins: { left_table: string; right_table: string; edge_status: string; confidence: number }[];
  grain_warnings: { severity: string; message: string; tables: string[]; grains: string[] }[];
  scores: {
    semantic_coverage: number;
    metric_coverage: number;
    relationship_trust: number;
    data_quality: number;
    overall: number;
  };
  evidence: { ok: boolean; text: string }[];
}

export interface GenieAgentConfig {
  agent_id: string;
  name: string;
  domain: string;
  data_assets: string[];
  instructions: string[];
  business_definitions: { term: string; mapping: string; definition: string }[];
  synonyms: Record<string, string[]>;
  joins: { left: string; right: string }[];
  sql_expressions: Record<string, string>;
  example_questions: string[];
  trusted_assets: string[];
  benchmark_questions: string[];
  status: string;
  version: number;
}

export interface CompileOutput {
  plan: CompilerPlan;
  config: GenieAgentConfig;
}

export interface QualityGateResult {
  agent_id: string;
  semantic_coverage: number;
  metric_coverage: number;
  relationship_trust: number;
  benchmark_accuracy?: number;
  data_quality: number;
  source_certified: boolean;
  overall: number;
  verdict: 'READY_FOR_DEPLOYMENT' | 'HUMAN_REVIEW_REQUIRED';
  failed_gates: string[];
}

export interface BenchmarkResult {
  question: string;
  expected: string;
  passed: boolean;
  detail: string;
}

export interface ValidateResult {
  gate: QualityGateResult;
  benchmarks: BenchmarkResult[];
}

export interface DeployResult {
  deployed: boolean;
  gate: QualityGateResult;
  agent: GenieAgentConfig;
  provisioning?: { agent_id: string; url?: string; status: string };
  reason?: string;
}

export interface ChatResponse {
  answer: string;
  sql?: string;
  data_sources: string[];
  semantic_definitions: { term: string; definition: string }[];
  confidence?: number;
}

export interface GenieExplanation {
  agent_id: string;
  decision_path: { from: string; to: string; kind: string }[];
  evidence: { ok: boolean; text: string }[];
}

export interface DriftEvent {
  drift_id: string;
  asset_id: string;
  table: string;
  change_type: string;
  detail: string;
  detected_at: string;
  status: string;
}

export interface ImpactAnalysis {
  asset_id: string;
  table: string;
  downstream_assets: string[];
  affected_mappings: { mapping_id: string; concept: string; status: string }[];
  affected_metrics: { metric_id: string; name: string }[];
  affected_agents: { agent_id: string; name: string; status: string; reason: string }[];
  high_risk: string[];
}

export interface SimulationRun {
  simulation_id: string;
  status: string;
  overlay: Record<string, unknown>;
  summary?: {
    affected_genie_agents: { agent_id: string; name: string; config_diff: string; materially_changed: boolean }[];
    affected_metrics: { metric_id: string; name: string }[];
    newly_flipped_mappings: { mapping_id: string; concept: string; from: string; to: string }[];
    newly_created_conflicts: { concept: string; asset_a: string; asset_b: string }[];
  };
}

export interface HealingProposal {
  original_agent_id: string;
  candidate_agent_id: string;
  request: string;
  gate: QualityGateResult;
  diff: { added_assets: string[]; removed_assets: string[]; instruction_delta: number; grain_now_flagged: boolean };
  recommendation: 'safe_to_redeploy' | 'human_review_required';
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  // Only set a JSON content-type when we actually send a body — an empty body
  // with application/json makes Fastify reject the request as malformed.
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (init?.body != null) headers['content-type'] = 'application/json';
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => j<{ status: string; mode: string; adapter: { kind: string } }>('/health'),
  overview: () => j<Overview>('/api/v1/overview'),
  runDiscovery: () => j<Record<string, number>>('/api/v1/discovery/run', { method: 'POST' }),
  nodes: (params: Record<string, string> = {}) =>
    j<TechnicalNode[]>('/api/v1/ontology/nodes?' + new URLSearchParams(params)),
  node: (id: string) =>
    j<{ node: TechnicalNode; quality: unknown }>(`/api/v1/ontology/nodes/${encodeURIComponent(id)}`),
  edges: (params: Record<string, string> = {}) =>
    j<TechnicalEdge[]>('/api/v1/ontology/edges?' + new URLSearchParams(params)),
  subgraph: (node: string, depth = 1) =>
    j<{ nodes: TechnicalNode[]; edges: TechnicalEdge[] }>(
      `/api/v1/ontology/subgraph?node=${encodeURIComponent(node)}&depth=${depth}`,
    ),
  confidence: (edgeId: string) =>
    j<ConfidenceBreakdown>(`/api/v1/confidence/${encodeURIComponent(edgeId)}`),
  evidence: (id: string) => j<Evidence>(`/api/v1/evidence/${encodeURIComponent(id)}`),
  explanation: (subjectId: string) =>
    j<Explanation>(`/api/v1/explanations/${encodeURIComponent(subjectId)}`),
  aiStatus: () => j<{ ok: boolean; detail?: Record<string, unknown> }>('/api/v1/ai/status'),
  semanticSearch: (q: string) =>
    j<{ asset_id: string; name: string; node_type: string; score: number }[]>(
      '/api/v1/semantic/search?q=' + encodeURIComponent(q),
    ),
  reviewQueue: () => j<ReviewQueue>('/api/v1/governance/review-queue'),
  governanceLog: () => j<GovernanceEvent[]>('/api/v1/governance/log'),
  approve: (target_id: string, actor: string, reason: string) =>
    j<GovernanceEvent>('/api/v1/governance/approve', {
      method: 'POST',
      body: JSON.stringify({ target_id, actor, reason }),
    }),
  reject: (target_id: string, actor: string, reason: string) =>
    j<GovernanceEvent>('/api/v1/governance/reject', {
      method: 'POST',
      body: JSON.stringify({ target_id, actor, reason }),
    }),
  resolveConflict: (target_id: string, actor: string, resolution: 'trusted' | 'rejected', reason: string) =>
    j<GovernanceEvent>('/api/v1/governance/resolve-conflict', {
      method: 'POST',
      body: JSON.stringify({ target_id, actor, resolution, reason }),
    }),

  // Semantic layer (P2)
  compileSemantic: () => j<Record<string, number>>('/api/v1/semantic/compile', { method: 'POST' }),
  concepts: (q?: string) =>
    j<ConceptSummary[]>('/api/v1/semantic/concepts' + (q ? '?q=' + encodeURIComponent(q) : '')),
  conceptDetail: (id: string) =>
    j<ConceptDetail>(`/api/v1/semantic/concepts/${encodeURIComponent(id)}`),
  conceptHistory: (id: string) =>
    j<MappingHistoryRow[]>(`/api/v1/semantic/concepts/${encodeURIComponent(id)}/history`),
  conceptDiff: (id: string, from: number, to: number) =>
    j<MappingDiff>(`/api/v1/semantic/concepts/${encodeURIComponent(id)}/diff?from=${from}&to=${to}`),
  metrics: () => j<Metric[]>('/api/v1/semantic/metrics'),
  decideMapping: (
    action: 'approve_mapping' | 'reject_mapping' | 'certify_metric',
    target_id: string,
    actor: string,
    reason: string,
  ) =>
    j<GovernanceEvent>('/api/v1/governance/mapping', {
      method: 'POST',
      body: JSON.stringify({ action, target_id, actor, reason }),
    }),

  // Semantic compiler (P3)
  geniePlan: (request: string) =>
    j<CompilerPlan>('/api/v1/genie/plan', { method: 'POST', body: JSON.stringify({ request }) }),
  genieCompile: (request: string) =>
    j<CompileOutput>('/api/v1/genie/compile', { method: 'POST', body: JSON.stringify({ request }) }),
  listGenie: () => j<GenieAgentConfig[]>('/api/v1/genie'),

  // Genie automation (P4)
  validateGenie: (id: string) =>
    j<ValidateResult>(`/api/v1/genie/${encodeURIComponent(id)}/validate`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  deployGenie: (id: string, actor: string) =>
    j<DeployResult>(`/api/v1/genie/${encodeURIComponent(id)}/deploy`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    }),
  chatGenie: (id: string, message: string) =>
    j<ChatResponse>(`/api/v1/genie/${encodeURIComponent(id)}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  explainGenie: (id: string) =>
    j<GenieExplanation>(`/api/v1/genie/${encodeURIComponent(id)}/explain`),

  // Self-healing (P5)
  driftEvents: () => j<DriftEvent[]>('/api/v1/drift/events'),
  detectDrift: () => j<{ new_events: number }>('/api/v1/drift/detect', { method: 'POST', body: JSON.stringify({}) }),
  simulateDrift: (change: Record<string, string>) =>
    j<{ description: string; new_events: number }>('/api/v1/drift/simulate', {
      method: 'POST',
      body: JSON.stringify(change),
    }),
  impact: (assetId: string) => j<ImpactAnalysis>(`/api/v1/impact/${encodeURIComponent(assetId)}`),
  proposeHeal: (agentId: string) =>
    j<HealingProposal>(`/api/v1/genie/${encodeURIComponent(agentId)}/heal/propose`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  approveHeal: (candidate_agent_id: string, original_agent_id: string, actor: string) =>
    j<{ deployed: boolean; agent: GenieAgentConfig }>('/api/v1/genie/heal/approve', {
      method: 'POST',
      body: JSON.stringify({ candidate_agent_id, original_agent_id, actor }),
    }),

  // §56 Counterfactual simulation
  simulate: (overlay: Record<string, unknown>) =>
    j<SimulationRun>('/api/v1/simulate', { method: 'POST', body: JSON.stringify(overlay) }),
};
