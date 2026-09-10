/**
 * Self-healing loop (spec §28.1). When drift affects a deployed agent, propose a
 * regenerated version: recompile from the original intent, re-run the quality
 * gate, and diff against the live config. It NEVER auto-redeploys — a human
 * approves, then redeploy goes through the same gated path (spec §28: do not
 * silently rewrite trusted semantics).
 */
import type { CompilerPlan } from './compiler/types.js';
import type { GenieAgentConfig, QualityGateResult } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { compile } from './compiler/compilerService.js';
import { runBenchmarks } from './genie/benchmarkService.js';
import { evaluateGate } from './genie/qualityGate.js';
import { deployAgent } from './genie/deployService.js';

export interface HealingProposal {
  original_agent_id: string;
  candidate_agent_id: string;
  request: string;
  gate: QualityGateResult;
  diff: {
    added_assets: string[];
    removed_assets: string[];
    instruction_delta: number;
    grain_now_flagged: boolean;
  };
  recommendation: 'safe_to_redeploy' | 'human_review_required';
}

export function proposeHealing(agentId: string): HealingProposal {
  const original = store.genieAgents.get(agentId);
  if (!original) throw new Error(`agent not found: ${agentId}`);
  const plan = store.geniePlans.get(agentId) as CompilerPlan | undefined;
  const request = plan?.intent.request;
  if (!request) throw new Error(`no original request recorded for ${agentId}`);

  // Recompile against the CURRENT (post-drift) ontology.
  const { config: candidate, plan: newPlan } = compile(request);
  runBenchmarks(candidate);
  const gate = evaluateGate(candidate);

  const oldAssets = new Set(original.data_assets);
  const newAssets = new Set(candidate.data_assets);
  const added = [...newAssets].filter((a) => !oldAssets.has(a));
  const removed = [...oldAssets].filter((a) => !newAssets.has(a));
  const grain_now_flagged = newPlan.grain_warnings.some((w) => w.severity === 'critical');

  return {
    original_agent_id: agentId,
    candidate_agent_id: candidate.agent_id,
    request,
    gate,
    diff: {
      added_assets: added,
      removed_assets: removed,
      instruction_delta: candidate.instructions.length - original.instructions.length,
      grain_now_flagged,
    },
    recommendation:
      gate.verdict === 'READY_FOR_DEPLOYMENT' && !grain_now_flagged
        ? 'safe_to_redeploy'
        : 'human_review_required',
  };
}

/** Human-approved redeploy of a healed candidate; supersedes the original. */
export async function approveHealing(
  candidateAgentId: string,
  originalAgentId: string,
  actor: string,
): Promise<{ deployed: boolean; agent: GenieAgentConfig; reason?: string }> {
  const result = await deployAgent(candidateAgentId, actor);
  if (result.deployed) {
    const original = store.genieAgents.get(originalAgentId);
    if (original) {
      original.status = 'needs_review'; // superseded; kept for audit
      original.updated_at = new Date().toISOString();
    }
    // Mark related drift events resolved.
    for (const d of store.drift) if (d.status !== 'resolved') d.status = 'resolved';
  }
  return { deployed: result.deployed, agent: result.agent, reason: result.reason };
}
