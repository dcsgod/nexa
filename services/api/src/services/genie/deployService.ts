/**
 * Genie provisioning + deploy gate (spec §24, §26). Deploy is ONLY allowed
 * after benchmarks run and the quality gate returns READY_FOR_DEPLOYMENT.
 * Provisioning goes through the Databricks adapter (mock default).
 */
import { getDatabricksAdapter } from '../../adapters/databricks/index.js';
import type { GenieAgentConfig, QualityGateResult } from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';
import { nowIso } from '../../util/ids.js';
import { recordEvidence } from '../evidenceService.js';
import { runBenchmarks } from './benchmarkService.js';
import { evaluateGate } from './qualityGate.js';

export interface ValidateResult {
  gate: QualityGateResult;
  benchmarks: ReturnType<typeof runBenchmarks>;
}

/** Run benchmarks + gate (no deploy). */
export function validateAgent(agentId: string): ValidateResult {
  const config = store.genieAgents.get(agentId);
  if (!config) throw new Error(`agent not found: ${agentId}`);
  const benchmarks = runBenchmarks(config);
  const gate = evaluateGate(config);
  config.status = gate.verdict === 'READY_FOR_DEPLOYMENT' ? 'ready' : 'needs_review';
  config.updated_at = nowIso();
  return { gate, benchmarks };
}

export interface DeployResult {
  deployed: boolean;
  gate: QualityGateResult;
  agent: GenieAgentConfig;
  provisioning?: { agent_id: string; url?: string; status: string };
  reason?: string;
}

export async function deployAgent(agentId: string, actor: string): Promise<DeployResult> {
  const config = store.genieAgents.get(agentId);
  if (!config) throw new Error(`agent not found: ${agentId}`);

  // Always (re)validate immediately before deploy — never trust a stale gate.
  runBenchmarks(config);
  const gate = evaluateGate(config);

  if (gate.verdict !== 'READY_FOR_DEPLOYMENT') {
    config.status = 'needs_review';
    return { deployed: false, gate, agent: config, reason: `Quality gate failed: ${gate.failed_gates.join(', ')}` };
  }

  const adapter = getDatabricksAdapter();
  const provisioning = await adapter.deployGenie({
    name: config.name,
    domain: config.domain,
    data_assets: config.data_assets,
    instructions: config.instructions,
    synonyms: config.synonyms,
    joins: config.joins,
    sql_expressions: config.sql_expressions,
    example_questions: config.example_questions,
    trusted_assets: config.trusted_assets,
  });

  config.status = 'deployed';
  config.version += 1;
  config.updated_at = nowIso();

  const ev = recordEvidence({
    type: 'benchmark_result',
    source: `governance:${actor}`,
    detail: { deployed: true, gate_overall: gate.overall, provisioning },
    strength: gate.overall,
  });
  store.governance.push({
    event_id: `gov-${ev.evidence_id}`,
    action: 'mark_trusted',
    actor,
    target_id: agentId,
    timestamp: nowIso(),
    previous_value: 'ready',
    new_value: 'deployed',
    reason: `Quality gate passed (${Math.round(gate.overall * 100)}%)`,
    evidence_ids: [ev.evidence_id],
  });

  return {
    deployed: true,
    gate,
    agent: config,
    provisioning: { agent_id: provisioning.agent_id, url: provisioning.url, status: provisioning.status },
  };
}
