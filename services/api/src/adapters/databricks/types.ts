/**
 * Databricks adapter contract (spec §3.6, §24, §52).
 *
 * All Databricks-specific behavior lives behind this versioned interface so
 * the rest of the platform never depends on hard-coded API payloads. A mock
 * implementation is the default; a live implementation is swapped in via
 * NEXA_MODE=live. Genie access is intentionally isolated here too.
 */

export interface UcColumn {
  name: string;
  data_type: string;
  nullable: boolean;
  comment?: string;
  tags?: string[];
  is_primary_key?: boolean;
  foreign_key?: { table: string; column: string };
}

export interface UcTable {
  catalog: string;
  schema: string;
  name: string;
  table_type: 'MANAGED' | 'VIEW' | 'MATERIALIZED_VIEW' | 'EXTERNAL' | 'METRIC_VIEW';
  comment?: string;
  owner?: string;
  tags?: string[];
  properties?: Record<string, string>;
  columns: UcColumn[];
  updated_at: string;
}

export interface LineageEdge {
  source: string; // fully-qualified table or column
  target: string;
  level: 'table' | 'column';
  source_system: string; // e.g. "system.access.column_lineage"
  observed_at: string;
}

export interface QueryUsageSignal {
  entity_a: string;
  entity_b: string;
  join_count: number;
  query_count: number;
  last_seen: string;
}

export interface ProfileStats {
  asset_id: string;
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
  sample_masked?: string[];
}

export interface GenieDeployRequest {
  name: string;
  domain: string;
  data_assets: string[];
  instructions: string[];
  synonyms: Record<string, string[]>;
  joins: { left: string; right: string }[];
  sql_expressions: Record<string, string>;
  example_questions: string[];
  trusted_assets: string[];
}

export interface GenieDeployResult {
  agent_id: string;
  space_id: string;
  status: string;
  url?: string;
}

export interface GenieChatTurn {
  answer: string;
  sql?: string;
  data_sources: string[];
  confidence?: number;
}

/** The stable contract every implementation must satisfy. */
export interface DatabricksAdapter {
  readonly kind: 'mock' | 'live';
  readonly apiVersion: string;

  // --- Discovery (P0) ---
  listTables(catalog?: string): Promise<UcTable[]>;
  getTable(fqName: string): Promise<UcTable | null>;

  // --- Lineage (P0) ---
  getLineage(catalog?: string): Promise<LineageEdge[]>;

  // --- Profiling (P0) ---
  profile(assetId: string): Promise<ProfileStats | null>;

  // --- Behavioral (P1) ---
  getUsageSignals(catalog?: string): Promise<QueryUsageSignal[]>;

  // --- Genie (P4) ---
  deployGenie(req: GenieDeployRequest): Promise<GenieDeployResult>;
  chatGenie(agentId: string, message: string): Promise<GenieChatTurn>;
}
