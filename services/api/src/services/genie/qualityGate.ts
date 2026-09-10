/**
 * Genie Quality Gate (spec §26). Never deploy a generated agent without passing
 * this. Fails closed: a critical grain conflict, weak benchmarks, uncertified
 * sources, or below-threshold coverage/trust force HUMAN_REVIEW_REQUIRED.
 */
import type { GenieAgentConfig, QualityGateResult } from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';
import type { CompilerPlan } from '../compiler/types.js';
import { benchmarkAccuracy } from './benchmarkService.js';

const THRESHOLDS = {
  semantic_coverage: 0.7,
  metric_coverage: 0.6,
  relationship_trust: 0.8,
  benchmark_accuracy: 0.8,
  data_quality: 0.8,
};

export function evaluateGate(config: GenieAgentConfig): QualityGateResult {
  const plan = store.geniePlans.get(config.agent_id) as CompilerPlan | undefined;
  const scores = plan?.scores;
  const grainCritical = (plan?.grain_warnings ?? []).some((w) => w.severity === 'critical')
    || config.instructions.some((i) => i.startsWith('GRAIN SAFEGUARD'));

  const benchmark_accuracy = benchmarkAccuracy(config.agent_id);
  const source_certified = config.trusted_assets.length > 0;

  const semantic_coverage = scores?.semantic_coverage ?? 0.5;
  const metric_coverage = scores?.metric_coverage ?? 0.5;
  const relationship_trust = scores?.relationship_trust ?? 0.6;
  const data_quality = scores?.data_quality ?? 0.6;

  const failed_gates: string[] = [];
  if (semantic_coverage < THRESHOLDS.semantic_coverage) failed_gates.push('semantic_coverage');
  if (metric_coverage < THRESHOLDS.metric_coverage) failed_gates.push('metric_coverage');
  if (relationship_trust < THRESHOLDS.relationship_trust) failed_gates.push('relationship_trust');
  if (benchmark_accuracy < THRESHOLDS.benchmark_accuracy) failed_gates.push('benchmark_accuracy');
  if (data_quality < THRESHOLDS.data_quality) failed_gates.push('data_quality');
  if (!source_certified) failed_gates.push('source_certification');
  if (grainCritical) failed_gates.push('grain_safeguard');

  const overall = round(
    (semantic_coverage + metric_coverage + relationship_trust + benchmark_accuracy + data_quality) / 5,
  );

  const verdict = failed_gates.length === 0 ? 'READY_FOR_DEPLOYMENT' : 'HUMAN_REVIEW_REQUIRED';

  const result: QualityGateResult = {
    agent_id: config.agent_id,
    semantic_coverage,
    metric_coverage,
    relationship_trust,
    benchmark_accuracy,
    data_quality,
    governance_ok: true,
    source_certified,
    overall,
    verdict,
    failed_gates,
  };
  store.qualityGates.set(config.agent_id, result);
  return result;
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}
