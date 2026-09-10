/** Read/query layer over the enterprise semantic layer. */
import type { BusinessConcept, Metric, SemanticMapping } from '../../domain/types.js';
import { store } from '../../store/ontologyStore.js';

export interface ConceptSummary extends BusinessConcept {
  mapping_count: number;
  best_confidence: number;
  has_conflict: boolean;
}

export function listConcepts(q?: string): ConceptSummary[] {
  const concepts = [...store.concepts.values()].filter(
    (c) => !q || `${c.name} ${(c.synonyms ?? []).join(' ')}`.toLowerCase().includes(q.toLowerCase()),
  );
  return concepts.map((c) => {
    const maps = mappingsForConcept(c.name);
    return {
      ...c,
      mapping_count: maps.length,
      best_confidence: maps.reduce((m, x) => Math.max(m, x.confidence), 0),
      has_conflict: maps.some((m) => m.conflict),
    };
  });
}

export function mappingsForConcept(conceptName: string): SemanticMapping[] {
  return [...store.mappings.values()]
    .filter((m) => m.semantic_concept === conceptName)
    .sort((a, b) => b.confidence - a.confidence);
}

export interface ConceptDetail {
  concept: BusinessConcept;
  metric?: Metric;
  mappings: (SemanticMapping & { explanation_id?: string })[];
}

export function conceptDetail(conceptId: string): ConceptDetail | null {
  const concept = store.concepts.get(conceptId);
  if (!concept) return null;
  const metric = [...store.metrics.values()].find((m) => m.name === concept.name);
  const mappings = mappingsForConcept(concept.name).map((m) => ({
    ...m,
    explanation_id: store.explanations.get(m.mapping_id)?.explanation_id,
  }));
  return { concept, metric, mappings };
}

export function listMetrics(): Metric[] {
  return [...store.metrics.values()];
}

export function semanticConflicts(): SemanticMapping[] {
  return [...store.mappings.values()].filter((m) => m.conflict);
}
