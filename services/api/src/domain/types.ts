/**
 * Nexa core domain model.
 *
 * Encodes the two-layer ontology from the specification:
 *   Layer A — Technical Knowledge Graph (machine-grounded, source of truth)
 *   Layer B — Enterprise Semantic Layer (governed interpretation)
 *
 * Design rule (spec §3, §52): the semantic layer must never silently replace
 * the technical layer. Every semantic interpretation traces to technical
 * evidence. Types here keep those two worlds explicitly separate.
 */

// ─────────────────────────────────────────────────────────────
// Layer A — Technical Knowledge Graph
// ─────────────────────────────────────────────────────────────

export type TechnicalNodeType =
  | 'catalog'
  | 'schema'
  | 'table'
  | 'view'
  | 'materialized_view'
  | 'metric_view'
  | 'column'
  | 'model'
  | 'dashboard'
  | 'job'
  | 'notebook'
  | 'metric'
  | 'data_product'
  | 'external_asset'
  | 'technical_domain';

export type TechnicalEdgeType =
  | 'contains'
  | 'belongs_to'
  | 'references'
  | 'foreign_key_to'
  | 'lineage_to'
  | 'derived_from'
  | 'joined_with'
  | 'used_by'
  | 'feeds'
  | 'produces'
  | 'depends_on'
  | 'queried_with'
  | 'same_entity_as';

export type EdgeStatus = 'candidate' | 'trusted' | 'rejected' | 'conflict';

export interface TechnicalNode {
  node_id: string; // e.g. "table:retail.sales.fact_sales"
  node_type: TechnicalNodeType;
  catalog?: string;
  schema?: string;
  name: string;
  data_type?: string; // for columns
  nullable?: boolean; // for columns
  description?: string;
  tags?: string[];
  owner?: string;
  quality_score?: number; // 0..1, separate from semantic confidence
  technical_confidence: number; // 1.0 = observed directly from Unity Catalog
  fingerprint: string;
  version: number;
  updated_at: string; // ISO
}

export interface TechnicalEdge {
  edge_id: string;
  source: string; // node_id
  target: string; // node_id
  edge_type: TechnicalEdgeType;
  /** Governed trust — NOT a raw average. See ConfidenceBreakdown. */
  confidence: number;
  status: EdgeStatus;
  evidence_ids: string[];
  model_version?: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// Multi-factor relationship confidence (spec §14)
// ─────────────────────────────────────────────────────────────

export interface ConfidenceSignals {
  semantic_similarity?: number;
  structural_compatibility?: number;
  value_overlap?: number;
  lineage?: number;
  behavioral_usage?: number;
  data_quality?: number;
  model_prediction?: number;
  human_validation?: 'approved' | 'rejected' | null;
}

export interface ConfidenceBreakdown {
  edge_id: string;
  signals: ConfidenceSignals;
  weighted_score: number;
  gates_passed: string[];
  gates_failed: string[];
  conflict: boolean;
  trusted: boolean;
  computed_at: string;
}

// ─────────────────────────────────────────────────────────────
// Evidence Engine (spec §15) — immutable, auditable
// ─────────────────────────────────────────────────────────────

export type EvidenceType =
  | 'metadata'
  | 'lineage'
  | 'column_lineage'
  | 'column_statistics'
  | 'value_overlap'
  | 'query_behavior'
  | 'semantic_similarity'
  | 'model_prediction'
  | 'llm_interpretation'
  | 'business_rule'
  | 'human_approval'
  | 'benchmark_result';

export interface Evidence {
  evidence_id: string;
  type: EvidenceType;
  source: string; // e.g. "system.access.column_lineage"
  source_entity?: string;
  target_entity?: string;
  detail?: Record<string, unknown>;
  observed_at: string;
  strength: number; // 0..1
}

// ─────────────────────────────────────────────────────────────
// Data quality (spec §9) — kept separate from semantic confidence
// ─────────────────────────────────────────────────────────────

export interface QualitySignal {
  asset_id: string;
  completeness?: number;
  freshness?: number;
  uniqueness?: number;
  validity?: number;
  consistency?: number;
  volume_anomaly?: number;
  distribution_drift?: number;
  schema_drift?: number;
  overall: number;
  computed_at: string;
}

export interface ColumnProfile {
  asset_id: string; // column node_id
  row_count?: number;
  null_pct?: number;
  distinct_count?: number;
  approx_cardinality?: number;
  min?: string | number;
  max?: string | number;
  avg_length?: number;
  uniqueness?: number;
  duplicate_rate?: number;
  freshness_ts?: string;
  sample_masked?: string[]; // never raw sensitive values
  computed_at: string;
}

// ─────────────────────────────────────────────────────────────
// Layer B — Enterprise Semantic Layer (spec §7)
// ─────────────────────────────────────────────────────────────

export type SemanticNodeType =
  | 'business_concept'
  | 'business_metric'
  | 'kpi'
  | 'dimension'
  | 'business_entity'
  | 'business_process'
  | 'business_domain'
  | 'synonym'
  | 'business_rule'
  | 'metric_definition'
  | 'semantic_term'
  | 'glossary_term';

export type GovernanceStatus =
  | 'candidate'
  | 'proposed'
  | 'approved'
  | 'certified'
  | 'rejected'
  | 'deprecated'
  | 'superseded';

export interface BusinessConcept {
  concept_id: string;
  name: string; // "Revenue"
  type: SemanticNodeType;
  definition?: string;
  domain?: string;
  synonyms?: string[];
  status: GovernanceStatus;
  updated_at: string;
}

export interface Metric {
  metric_id: string;
  name: string;
  definition: string;
  expression: string; // e.g. "SUM(net_sales)"
  grain: string; // e.g. "transaction"
  dimensions: string[];
  source: string; // technical asset
  status: GovernanceStatus;
  updated_at: string;
}

/** Concept ↔ technical asset mapping (spec §7.3). */
export interface SemanticMapping {
  mapping_id: string;
  semantic_concept: string; // concept_id or name
  technical_asset: string; // fully-qualified asset id
  confidence: number;
  graph_confidence?: number;
  llm_confidence?: number;
  status: GovernanceStatus;
  evidence_ids: string[];
  llm_interpretation_id?: string | null;
  human_validation?: string | null;
  conflict?: boolean;
  version: number;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// Explainability (spec §16) — three separate levels
// ─────────────────────────────────────────────────────────────

export interface Explanation {
  explanation_id: string;
  subject_id: string; // edge_id / mapping_id / agent decision id
  level_1_technical: EvidenceLine[]; // technical evidence
  level_2_model?: ModelExplanation; // graph-ML feature attribution
  level_3_llm?: LlmExplanation; // grounded semantic interpretation
  generated_at: string;
}

export interface EvidenceLine {
  ok: boolean;
  text: string;
  evidence_id?: string;
}

export interface ModelExplanation {
  model_version: string;
  prediction: number;
  top_signals: { signal: string; contribution: number }[];
}

export interface LlmExplanation {
  llm_version: string;
  interpretation: string;
  grounding: EvidenceLine[]; // grounded, not chain-of-thought
}

// ─────────────────────────────────────────────────────────────
// Governance (spec §19)
// ─────────────────────────────────────────────────────────────

export type GovernanceAction =
  | 'approve_relationship'
  | 'reject_relationship'
  | 'edit_relationship'
  | 'approve_mapping'
  | 'reject_mapping'
  | 'edit_definition'
  | 'certify_metric'
  | 'deprecate_definition'
  | 'mark_trusted'
  | 'resolve_conflict';

export interface GovernanceEvent {
  event_id: string;
  action: GovernanceAction;
  actor: string;
  target_id: string;
  timestamp: string;
  previous_value?: unknown;
  new_value?: unknown;
  reason?: string;
  evidence_ids?: string[];
}

// ─────────────────────────────────────────────────────────────
// Genie (spec §24-27)
// ─────────────────────────────────────────────────────────────

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
  status: 'draft' | 'validated' | 'ready' | 'deployed' | 'needs_review';
  version: number;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// §55 — Semantic mapping history (append-only) + conflict log
// ─────────────────────────────────────────────────────────────

export interface MappingHistoryRow {
  mapping_id: string;
  business_concept: string;
  technical_asset: string;
  version: number;
  valid_from: string;
  valid_to: string | null; // null = current
  status: GovernanceStatus;
  graph_confidence?: number;
  llm_confidence?: number;
  evidence_ref?: string;
  approved_by: string; // user id or 'auto'
  approval_reason?: string;
  superseded_by_mapping_id?: string | null;
}

export interface ConflictLogRow {
  conflict_id: string;
  business_concept: string;
  mapping_id_a: string;
  mapping_id_b: string;
  detected_at: string;
  resolution: 'pending' | 'resolved_a' | 'resolved_b' | 'both_valid_context_dependent';
  resolved_by?: string;
  resolution_notes?: string;
}

// ─────────────────────────────────────────────────────────────
// §56 — Counterfactual "Simulate Impact" (overlay, no real writes)
// ─────────────────────────────────────────────────────────────

export interface HypotheticalOverlay {
  concept_mapping_changes?: { concept: string; technical_asset: string; status?: GovernanceStatus }[];
  confidence_threshold_override?: number; // e.g. 0.8
  deprecated_assets?: string[]; // table/column node ids
}

export interface SimulationSummary {
  affected_genie_agents: { agent_id: string; name: string; config_diff: string; materially_changed: boolean }[];
  affected_metrics: { metric_id: string; name: string }[];
  newly_flipped_mappings: { mapping_id: string; concept: string; from: string; to: string }[];
  newly_created_conflicts: { concept: string; asset_a: string; asset_b: string }[];
}

export interface SimulationRun {
  simulation_id: string;
  requested_by: string;
  created_at: string;
  overlay: HypotheticalOverlay;
  status: 'running' | 'complete' | 'failed';
  summary?: SimulationSummary;
}

export type DriftChangeType =
  | 'table_added'
  | 'table_removed'
  | 'column_added'
  | 'column_removed'
  | 'column_type_changed'
  | 'column_renamed';

export interface DriftEvent {
  drift_id: string;
  asset_id: string; // node id affected
  table: string; // fully-qualified table
  change_type: DriftChangeType;
  detail: string;
  previous_fingerprint?: string;
  new_fingerprint?: string;
  detected_at: string;
  status: 'open' | 'healing' | 'resolved';
}

export interface ImpactAnalysis {
  asset_id: string;
  table: string;
  downstream_assets: string[];
  affected_mappings: { mapping_id: string; concept: string; status: string }[];
  affected_metrics: { metric_id: string; name: string }[];
  affected_agents: { agent_id: string; name: string; status: string; reason: string }[];
  affected_dashboards: string[];
  high_risk: string[];
}

export interface BenchmarkResult {
  agent_id: string;
  benchmark_version: string;
  question: string;
  expected: string;
  passed: boolean;
  detail: string;
  run_at: string;
}

export interface GenieDecisionStep {
  from: string;
  to: string;
  kind: 'term_to_concept' | 'concept_to_metric' | 'metric_to_asset' | 'asset_join';
}

export interface QualityGateResult {
  agent_id: string;
  semantic_coverage: number;
  metric_coverage: number;
  relationship_trust: number;
  sql_correctness?: number;
  benchmark_accuracy?: number;
  data_quality: number;
  ambiguity?: number;
  governance_ok: boolean;
  source_certified: boolean;
  overall: number;
  verdict: 'READY_FOR_DEPLOYMENT' | 'HUMAN_REVIEW_REQUIRED';
  failed_gates: string[];
}
