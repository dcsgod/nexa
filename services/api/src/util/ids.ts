import { createHash, randomUUID } from 'node:crypto';

export function uuid(): string {
  return randomUUID();
}

/** Stable schema fingerprint (spec §8.2). */
export function fingerprint(input: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 16);
}

export const nodeId = {
  catalog: (c: string) => `catalog:${c}`,
  schema: (c: string, s: string) => `schema:${c}.${s}`,
  table: (fq: string) => `table:${fq}`,
  column: (fq: string, col: string) => `column:${fq}.${col}`,
};

export function nowIso(): string {
  return new Date().toISOString();
}
