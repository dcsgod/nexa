-- Enterprise Semantic Layer + governance storage (spec §7, §19, §32, §55).

CREATE TABLE IF NOT EXISTS ontology_business_concepts (
  concept_id STRING,
  name STRING,
  type STRING,
  definition STRING,
  domain STRING,
  synonyms ARRAY<STRING>,
  status STRING,
  updated_at TIMESTAMP
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology_metrics (
  metric_id STRING,
  name STRING,
  definition STRING,
  expression STRING,
  grain STRING,
  dimensions ARRAY<STRING>,
  source STRING,
  status STRING,
  updated_at TIMESTAMP
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology_semantic_mappings (
  mapping_id STRING,
  semantic_concept STRING,
  technical_asset STRING,
  confidence DOUBLE,
  graph_confidence DOUBLE,
  llm_confidence DOUBLE,
  status STRING,
  evidence_ids ARRAY<STRING>,
  llm_interpretation_id STRING,
  human_validation STRING,
  version INT,
  updated_at TIMESTAMP
) USING DELTA;

-- Append-only mapping history (spec §55.2). Never UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS semantic_mapping_history (
  mapping_id STRING,
  business_concept STRING,
  technical_asset STRING,
  version INT,
  valid_from TIMESTAMP,
  valid_to TIMESTAMP,
  status STRING,
  graph_confidence DOUBLE,
  llm_confidence DOUBLE,
  evidence_ref STRING,
  approved_by STRING,
  approval_reason STRING,
  superseded_by_mapping_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS semantic_conflict_log (
  conflict_id STRING,
  business_concept STRING,
  mapping_id_a STRING,
  mapping_id_b STRING,
  detected_at TIMESTAMP,
  resolution STRING,
  resolved_by STRING,
  resolution_notes STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology_governance_events (
  event_id STRING,
  action STRING,
  actor STRING,
  target_id STRING,
  timestamp TIMESTAMP,
  previous_value STRING,
  new_value STRING,
  reason STRING,
  evidence_ids ARRAY<STRING>
) USING DELTA;

-- Genie + benchmarks + simulation (spec §24-26, §56).
CREATE TABLE IF NOT EXISTS ontology_genie_agents (
  agent_id STRING, name STRING, domain STRING,
  config_json STRING, status STRING, version INT, updated_at TIMESTAMP
) USING DELTA;

CREATE TABLE IF NOT EXISTS ontology_benchmark_results (
  agent_id STRING, benchmark_version STRING, question STRING,
  passed BOOLEAN, detail STRING, run_at TIMESTAMP
) USING DELTA;

CREATE TABLE IF NOT EXISTS simulation_run (
  simulation_id STRING, requested_by STRING, created_at TIMESTAMP,
  overlay_json STRING, status STRING, summary_json STRING
) USING DELTA;
