/** Semantic Compiler types (spec §20-23, §26). */
import type { GenieAgentConfig } from '../../domain/types.js';

export interface Intent {
  request: string;
  domain: string;
  concepts: string[]; // matched business concept names
  metrics: string[]; // metric concept names
  dimensions: string[]; // dimension concept names
  entities: string[];
  time_comparison: boolean; // "increase", "trend", "over time", "vs last..."
}

export interface SelectedAsset {
  asset_id: string; // technical node id (table)
  role: 'fact' | 'dimension' | 'entity';
  certified: boolean;
  trusted: boolean;
  quality: number;
  reason: string;
  supports: string[]; // concept/metric names it supports
}

export interface PlannedJoin {
  left: string; // column node id
  right: string; // column node id
  left_table: string;
  right_table: string;
  edge_status: string;
  confidence: number;
}

export interface GrainWarning {
  severity: 'warning' | 'critical';
  message: string;
  tables: string[];
  grains: string[];
}

export interface PlanScores {
  semantic_coverage: number;
  metric_coverage: number;
  relationship_trust: number;
  data_quality: number;
  overall: number;
}

export interface CompilerPlan {
  intent: Intent;
  selected_assets: SelectedAsset[];
  metrics: { name: string; expression: string; grain: string; status: string }[];
  joins: PlannedJoin[];
  grain_warnings: GrainWarning[];
  scores: PlanScores;
  evidence: { ok: boolean; text: string }[];
}

export interface CompileOutput {
  plan: CompilerPlan;
  config: GenieAgentConfig;
}
