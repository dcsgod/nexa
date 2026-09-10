-- Nexa ontology storage model (spec §32).
-- Unity Catalog managed Delta tables. Versioned + timestamped throughout.
-- The mock adapter mirrors these shapes in-memory; live mode writes here.

CREATE TABLE IF NOT EXISTS ontology_catalog_nodes (
  node_id STRING,
  node_type STRING,
  catalog STRING,
  schema STRING,
  name STRING,
  data_type STRING,
  nullable BOOLEAN,
  description STRING,
  tags ARRAY<STRING>,
  owner STRING,
  quality_score DOUBLE,
  technical_confidence DOUBLE,
  fingerprint STRING,
  version INT,
  updated_at TIMESTAMP
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology_catalog_edges (
  edge_id STRING,
  source STRING,
  target STRING,
  edge_type STRING,
  confidence DOUBLE,
  status STRING,             -- candidate | trusted | rejected | conflict
  evidence_ids ARRAY<STRING>,
  model_version STRING,
  updated_at TIMESTAMP
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology_profiles (
  asset_id STRING,
  row_count BIGINT,
  null_pct DOUBLE,
  distinct_count BIGINT,
  approx_cardinality BIGINT,
  uniqueness DOUBLE,
  duplicate_rate DOUBLE,
  freshness_ts TIMESTAMP,
  computed_at TIMESTAMP
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology_embeddings (
  asset_id STRING,
  model_id STRING,
  vector ARRAY<DOUBLE>,
  generated_description STRING,
  source_fingerprint STRING,
  generated_at TIMESTAMP
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology_quality (
  asset_id STRING,
  completeness DOUBLE,
  freshness DOUBLE,
  uniqueness DOUBLE,
  validity DOUBLE,
  consistency DOUBLE,
  overall DOUBLE,
  computed_at TIMESTAMP
) USING DELTA;

-- Evidence Engine (spec §15) — append-only / auditable.
CREATE TABLE IF NOT EXISTS ontology_evidence (
  evidence_id STRING,
  type STRING,
  source STRING,
  source_entity STRING,
  target_entity STRING,
  detail STRING,            -- JSON
  observed_at TIMESTAMP,
  strength DOUBLE
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology_confidence (
  edge_id STRING,
  signals STRING,           -- JSON of ConfidenceSignals
  weighted_score DOUBLE,
  gates_passed ARRAY<STRING>,
  gates_failed ARRAY<STRING>,
  conflict BOOLEAN,
  trusted BOOLEAN,
  computed_at TIMESTAMP
) USING DELTA;
