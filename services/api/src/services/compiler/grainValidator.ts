/**
 * Grain awareness (spec §22). Detects dangerous joins that can multiply/inflate
 * metrics when facts of incompatible grain are combined (e.g. sales at
 * transaction grain × inventory at product×store×day grain). This is a critical
 * enterprise analytics safeguard — flagged, never silently allowed.
 */
import type { Metric } from '../../domain/types.js';
import type { GrainWarning, PlannedJoin, SelectedAsset } from './types.js';

function tableOf(assetId: string): string {
  return assetId.replace(/^(column|table):/, '').split('.').slice(0, 3).join('.');
}

export function validateGrain(
  assets: SelectedAsset[],
  metrics: Metric[],
  joins: PlannedJoin[],
): GrainWarning[] {
  const warnings: GrainWarning[] = [];

  // Map fact tables → their metric grain(s).
  const factGrains = new Map<string, Set<string>>();
  for (const m of metrics) {
    const t = tableOf(`table:${m.source}`);
    const set = factGrains.get(t) ?? new Set<string>();
    set.add(m.grain);
    factGrains.set(t, set);
  }

  const facts = [...factGrains.keys()];
  if (facts.length < 2) return warnings;

  const distinctGrains = new Set<string>();
  for (const set of factGrains.values()) for (const g of set) distinctGrains.add(g);
  if (distinctGrains.size < 2) return warnings; // same grain — safe

  // Are the incompatible-grain facts connected (directly or via a shared dim)?
  const joinTables = new Set<string>();
  for (const j of joins) {
    joinTables.add(j.left_table);
    joinTables.add(j.right_table);
  }
  const factsInJoinGraph = facts.filter((f) => joinTables.has(f));

  if (factsInJoinGraph.length >= 2) {
    const inflatable = metrics.find((m) => facts.includes(tableOf(`table:${m.source}`)));
    warnings.push({
      severity: 'critical',
      message:
        `Grain mismatch: joining facts at different grains (${[...distinctGrains].join(', ')}) ` +
        `can multiply rows. "${inflatable?.name ?? 'A metric'}" may be inflated. ` +
        'Aggregate each fact to a common grain before joining, or expose them as separate agents.',
      tables: facts,
      grains: [...distinctGrains],
    });
  } else {
    warnings.push({
      severity: 'warning',
      message:
        `Selected metrics span multiple grains (${[...distinctGrains].join(', ')}). ` +
        'Confirm they are not combined in a single aggregation.',
      tables: facts,
      grains: [...distinctGrains],
    });
  }
  return warnings;
}
