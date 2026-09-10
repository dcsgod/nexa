import type {
  GroundingLine,
  Interpretation,
  InterpretationContext,
  LlmAdapter,
} from './types.js';
import { uuid } from '../../util/ids.js';

/**
 * Deterministic, grounded mock LLM. It does NOT hallucinate: confidence and the
 * grounding bullets are derived only from the supplied context (concept terms,
 * asset name/description/tags, and safe signals). This mirrors what a real,
 * well-prompted evidence-grounded LLM should produce.
 */
export class MockLlmAdapter implements LlmAdapter {
  readonly kind = 'mock' as const;
  readonly version = 'nexa-mock-llm-v0';

  async interpret(ctx: InterpretationContext): Promise<Interpretation> {
    const conceptTerms = tokens(
      [ctx.concept_name, ...(ctx.concept_synonyms ?? []), ctx.concept_definition ?? ''].join(' '),
    );
    const assetTerms = tokens(
      [ctx.asset_name, ctx.asset_description ?? '', ...(ctx.asset_tags ?? [])].join(' '),
    );

    const overlap = jaccard(conceptTerms, assetTerms);
    const nameMatch = assetTerms.some((t) => conceptTerms.includes(t));

    const grounding: GroundingLine[] = [];
    let score = 0.35 + overlap * 0.4;

    if (nameMatch) {
      grounding.push({ ok: true, text: `Column/asset name matches "${ctx.concept_name}" terminology` });
      score += 0.1;
    }
    if (ctx.signals?.monetary && isMoneyConcept(ctx.concept_name)) {
      grounding.push({ ok: true, text: 'Monetary decimal type consistent with a value/amount concept' });
      score += 0.1;
    }
    if (ctx.signals?.aggregation_hint) {
      grounding.push({ ok: true, text: ctx.signals.aggregation_hint });
      score += 0.08;
    }
    if (ctx.signals?.lineage_to_concept) {
      grounding.push({ ok: true, text: 'Connected via lineage to related transactional facts' });
      score += 0.07;
    }
    if (typeof ctx.signals?.similar_to_approved === 'number' && ctx.signals.similar_to_approved > 0.6) {
      grounding.push({
        ok: true,
        text: `High similarity (${Math.round(ctx.signals.similar_to_approved * 100)}%) to approved ${ctx.concept_name} definitions`,
      });
      score += 0.08;
    }
    if (grounding.length === 0) {
      grounding.push({ ok: false, text: 'Weak lexical/semantic overlap; interpretation is tentative' });
    }

    const confidence = Math.max(0, Math.min(1, round(score)));
    const interpretation =
      confidence >= 0.6
        ? `"${ctx.asset_name}" most likely represents ${ctx.concept_name} based on its naming, type and usage context.`
        : `"${ctx.asset_name}" is a weak candidate for ${ctx.concept_name}; human confirmation recommended.`;

    return {
      llm_version: this.version,
      llm_interpretation_id: `llm-${uuid().slice(0, 8)}`,
      confidence,
      interpretation,
      grounding,
    };
  }
}

function tokens(s: string): string[] {
  return [...new Set(s.toLowerCase().replace(/[._]/g, ' ').split(/\s+/).filter((t) => t.length > 2))];
}
function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const uni = new Set([...a, ...b]).size || 1;
  return inter / uni;
}
function isMoneyConcept(name: string): boolean {
  return /revenue|sales|value|margin|cost|price|amount|order total/i.test(name);
}
function round(x: number): number {
  return Math.round(x * 100) / 100;
}
