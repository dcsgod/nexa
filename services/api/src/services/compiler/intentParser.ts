/**
 * Natural-language intent parser (spec §20). Deterministic: matches the request
 * against the governed glossary (concept names + synonyms) and detects
 * time-comparison intent. It proposes an interpretation; the planner and critic
 * still validate everything against technical truth.
 */
import { store } from '../../store/ontologyStore.js';
import type { Intent } from './types.js';

const TIME_WORDS = /\b(increas|decreas|trend|over time|growth|change|vs\.?|versus|compared|last (month|week|quarter|year)|yoy|mom)\b/i;

export function parseIntent(request: string): Intent {
  const text = request.toLowerCase();
  const concepts: string[] = [];
  const metrics: string[] = [];
  const dimensions: string[] = [];
  const entities: string[] = [];
  const domains = new Map<string, number>();

  for (const c of store.concepts.values()) {
    const terms = [c.name, ...(c.synonyms ?? [])].map((t) => t.toLowerCase());
    // Also match the distinctive leading token of a multi-word concept name,
    // e.g. "Inventory Units" should match a request mentioning "inventory".
    const leadToken = c.name.toLowerCase().split(/\s+/)[0]!;
    if (c.name.includes(' ') && leadToken.length >= 5) terms.push(leadToken);
    const hit = terms.some((t) => new RegExp(`\\b${escapeRe(t)}\\b`).test(text));
    if (!hit) continue;
    concepts.push(c.name);
    if (c.domain) domains.set(c.domain, (domains.get(c.domain) ?? 0) + 1);
    if (c.type === 'business_metric' || c.type === 'kpi') metrics.push(c.name);
    else if (c.type === 'dimension') dimensions.push(c.name);
    else if (c.type === 'business_entity') entities.push(c.name);
  }

  // Domain: most-referenced domain, else infer from keywords.
  let domain = [...domains.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'general';
  if (domains.size === 0) {
    if (/inventory|supply|warehouse|supplier|fulfil/i.test(text)) domain = 'supply_chain';
    else if (/sales|revenue|store/i.test(text)) domain = 'sales';
    else if (/customer|order/i.test(text)) domain = 'crm';
  }

  return {
    request,
    domain,
    concepts: unique(concepts),
    metrics: unique(metrics),
    dimensions: unique(dimensions),
    entities: unique(entities),
    time_comparison: TIME_WORDS.test(text),
  };
}

function unique<T>(a: T[]): T[] {
  return [...new Set(a)];
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
