/**
 * Embedded Genie chat (spec §34.6). Returns the answer plus the transparency
 * envelope: SQL, data sources, the semantic definitions used, and a confidence.
 * The chat itself is served by the Databricks adapter (mock default).
 */
import { getDatabricksAdapter } from '../../adapters/databricks/index.js';
import { store } from '../../store/ontologyStore.js';

export interface ChatResponse {
  answer: string;
  sql?: string;
  data_sources: string[];
  semantic_definitions: { term: string; definition: string }[];
  confidence?: number;
}

export async function chat(agentId: string, message: string): Promise<ChatResponse> {
  const config = store.genieAgents.get(agentId);
  if (!config) throw new Error(`agent not found: ${agentId}`);

  const turn = await getDatabricksAdapter().chatGenie(agentId, message);

  // Attach the semantic definitions relevant to the question.
  const used = config.business_definitions.filter((d) =>
    message.toLowerCase().includes(d.term.toLowerCase()),
  );
  return {
    answer: turn.answer,
    sql: turn.sql,
    data_sources: turn.data_sources,
    semantic_definitions: (used.length ? used : config.business_definitions).map((d) => ({
      term: d.term,
      definition: d.definition,
    })),
    confidence: turn.confidence,
  };
}
