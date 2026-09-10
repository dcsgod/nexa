/** Phase 1 — Discover: Unity Catalog scanner (spec §8.1). Incremental + idempotent. */
import { getDatabricksAdapter } from '../adapters/databricks/index.js';
import type { UcTable } from '../adapters/databricks/index.js';
import type { TechnicalNode } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';
import { fingerprint, nodeId, nowIso } from '../util/ids.js';
import { recordEvidence } from './evidenceService.js';

function upsertNode(node: TechnicalNode): void {
  const existing = store.nodes.get(node.node_id);
  if (existing && existing.fingerprint === node.fingerprint) return; // unchanged
  node.version = existing ? existing.version + 1 : 1;
  store.nodes.set(node.node_id, node);
}

export async function scanCatalog(catalog?: string): Promise<{ scanned: number }> {
  const adapter = getDatabricksAdapter();
  const tables = await adapter.listTables(catalog);
  const seenCatalogs = new Set<string>();
  const seenSchemas = new Set<string>();
  let scanned = 0;

  for (const t of tables) {
    const fq = `${t.catalog}.${t.schema}.${t.name}`;

    // catalog node
    if (!seenCatalogs.has(t.catalog)) {
      seenCatalogs.add(t.catalog);
      upsertNode({
        node_id: nodeId.catalog(t.catalog),
        node_type: 'catalog',
        name: t.catalog,
        technical_confidence: 1,
        fingerprint: fingerprint(['catalog', t.catalog]),
        version: 1,
        updated_at: nowIso(),
      });
    }
    // schema node
    const schemaKey = `${t.catalog}.${t.schema}`;
    if (!seenSchemas.has(schemaKey)) {
      seenSchemas.add(schemaKey);
      upsertNode({
        node_id: nodeId.schema(t.catalog, t.schema),
        node_type: 'schema',
        catalog: t.catalog,
        name: t.schema,
        technical_confidence: 1,
        fingerprint: fingerprint(['schema', schemaKey]),
        version: 1,
        updated_at: nowIso(),
      });
    }
    // table node
    upsertNode({
      node_id: nodeId.table(fq),
      node_type: mapTableType(t),
      catalog: t.catalog,
      schema: t.schema,
      name: t.name,
      description: t.comment,
      tags: t.tags,
      owner: t.owner,
      technical_confidence: 1,
      fingerprint: fingerprint(tableFingerprintInput(t)),
      version: 1,
      updated_at: nowIso(),
    });
    // column nodes
    for (const c of t.columns) {
      upsertNode({
        node_id: nodeId.column(fq, c.name),
        node_type: 'column',
        catalog: t.catalog,
        schema: t.schema,
        name: c.name,
        data_type: c.data_type,
        nullable: c.nullable,
        description: c.comment,
        tags: c.tags,
        technical_confidence: 1,
        fingerprint: fingerprint([fq, c.name, c.data_type, c.nullable]),
        version: 1,
        updated_at: nowIso(),
      });
    }
    scanned++;
  }

  buildStructuralEdges(tables);
  store.meta.lastScan = nowIso();
  store.meta.ontologyVersion++;
  return { scanned };
}

function mapTableType(t: UcTable): TechnicalNode['node_type'] {
  switch (t.table_type) {
    case 'VIEW':
      return 'view';
    case 'MATERIALIZED_VIEW':
      return 'materialized_view';
    case 'METRIC_VIEW':
      return 'metric_view';
    case 'EXTERNAL':
      return 'external_asset';
    default:
      return 'table';
  }
}

function tableFingerprintInput(t: UcTable) {
  return [
    t.catalog,
    t.schema,
    t.name,
    t.table_type,
    t.comment ?? '',
    t.columns.map((c) => `${c.name}:${c.data_type}:${c.nullable}`),
  ];
}

/** Deterministic structural edges: contains, belongs_to, and declared FKs. */
function buildStructuralEdges(tables: UcTable[]): void {
  for (const t of tables) {
    const fq = `${t.catalog}.${t.schema}.${t.name}`;
    addEdge(nodeId.schema(t.catalog, t.schema), nodeId.table(fq), 'contains', 1);
    addEdge(nodeId.catalog(t.catalog), nodeId.schema(t.catalog, t.schema), 'contains', 1);
    for (const c of t.columns) {
      addEdge(nodeId.table(fq), nodeId.column(fq, c.name), 'contains', 1);
      if (c.foreign_key) {
        const src = nodeId.column(fq, c.name);
        const tgt = nodeId.column(c.foreign_key.table, c.foreign_key.column);
        const ev = recordEvidence({
          type: 'metadata',
          source: 'unity_catalog.foreign_key',
          source_entity: src,
          target_entity: tgt,
          strength: 1,
          detail: { declared: true },
        });
        addEdge(src, tgt, 'foreign_key_to', 1, 'trusted', [ev.evidence_id]);
      }
    }
  }
}

function addEdge(
  source: string,
  target: string,
  edge_type: TechnicalNode extends never ? never : import('../domain/types.js').TechnicalEdgeType,
  confidence: number,
  status: import('../domain/types.js').EdgeStatus = 'trusted',
  evidence_ids: string[] = [],
): void {
  const edge_id = `edge:${edge_type}:${source}->${target}`;
  store.edges.set(edge_id, {
    edge_id,
    source,
    target,
    edge_type,
    confidence,
    status,
    evidence_ids,
    updated_at: nowIso(),
  });
}
