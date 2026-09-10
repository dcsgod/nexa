import type { Interpretation, InterpretationContext, LlmAdapter } from './types.js';

/**
 * Live LLM adapter — targets Databricks Model Serving / a foundation model API.
 *
 * Skeleton for now: the prompt contract is documented so wiring is a fill-in.
 * The prompt MUST instruct the model to return a grounded, evidence-cited
 * interpretation (not chain-of-thought) and MUST NOT include raw sensitive
 * samples (spec §36.4). Output is parsed into the same Interpretation shape the
 * mock returns, so nothing downstream changes.
 */
export class LiveLlmAdapter implements LlmAdapter {
  readonly kind = 'live' as const;
  readonly version = 'databricks-model-serving';

  async interpret(_ctx: InterpretationContext): Promise<Interpretation> {
    throw new Error(
      'LiveLlmAdapter.interpret not implemented. Wire to Databricks Model Serving ' +
        'with a grounded-interpretation prompt, or run with NEXA_MODE=mock.',
    );
  }
}
