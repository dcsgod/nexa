/**
 * LLM adapter contract (spec §3.3, §16.3, §52).
 *
 * The LLM answers ONE question: "why do we interpret this technical entity as
 * this business concept?" — as a concise, evidence-GROUNDED explanation, never
 * hidden chain-of-thought and never as the source of technical truth.
 *
 * Mock is the default (deterministic, grounded in the provided context). A live
 * implementation targets Databricks Model Serving / a foundation model API and
 * is selected with NEXA_MODE=live. Sensitive raw samples must never be sent to
 * the LLM (spec §36.4) — callers pass metadata/statistics only.
 */

export interface InterpretationContext {
  concept_name: string;
  concept_definition?: string;
  concept_synonyms?: string[];
  asset_id: string;
  asset_name: string;
  asset_description?: string;
  asset_type?: string; // data type for columns
  asset_tags?: string[];
  /** Safe, non-sensitive signals only. */
  signals?: {
    monetary?: boolean;
    lineage_to_concept?: boolean;
    similar_to_approved?: number; // 0..1
    aggregation_hint?: string; // e.g. "SUM(net_sales) seen in queries"
  };
}

export interface GroundingLine {
  ok: boolean;
  text: string;
}

export interface Interpretation {
  llm_version: string;
  llm_interpretation_id: string;
  confidence: number; // 0..1, the LLM's semantic confidence (separate from graph)
  interpretation: string; // one concise grounded sentence
  grounding: GroundingLine[]; // evidence-cited bullets, not reasoning
}

export interface LlmAdapter {
  readonly kind: 'mock' | 'live';
  readonly version: string;
  interpret(ctx: InterpretationContext): Promise<Interpretation>;
}
