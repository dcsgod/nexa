/** Read/query layer over the technical knowledge graph. */
import type { TechnicalEdge, TechnicalNode } from '../domain/types.js';
import { store } from '../store/ontologyStore.js';

export interface NodeFilter {
  type?: TechnicalNode['node_type'];
  catalog?: string;
  schema?: string;
  q?: string;
  minQuality?: number;
}

export function listNodes(filter: NodeFilter = {}): TechnicalNode[] {
  return [...store.nodes.values()].filter((n) => {
    if (filter.type && n.node_type !== filter.type) return false;
    if (filter.catalog && n.catalog !== filter.catalog) return false;
    if (filter.schema && n.schema !== filter.schema) return false;
    if (filter.minQuality !== undefined && (n.quality_score ?? 0) < filter.minQuality)
      return false;
    if (filter.q && !`${n.name} ${n.description ?? ''}`.toLowerCase().includes(filter.q.toLowerCase()))
      return false;
    return true;
  });
}

export function getNode(id: string): TechnicalNode | undefined {
  return store.nodes.get(id);
}

export interface EdgeFilter {
  type?: TechnicalEdge['edge_type'];
  status?: TechnicalEdge['status'];
  minConfidence?: number;
}

export function listEdges(filter: EdgeFilter = {}): TechnicalEdge[] {
  return [...store.edges.values()].filter((e) => {
    if (filter.type && e.edge_type !== filter.type) return false;
    if (filter.status && e.status !== filter.status) return false;
    if (filter.minConfidence !== undefined && e.confidence < filter.minConfidence) return false;
    return true;
  });
}

/** Neighborhood subgraph up to `depth` hops from a node. */
export function subgraph(nodeId: string, depth = 1): { nodes: TechnicalNode[]; edges: TechnicalEdge[] } {
  const nodeIds = new Set<string>([nodeId]);
  const edges: TechnicalEdge[] = [];
  let frontier = [nodeId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const e of store.edges.values()) {
      if (frontier.includes(e.source) && !nodeIds.has(e.target)) {
        nodeIds.add(e.target);
        next.push(e.target);
      }
      if (frontier.includes(e.target) && !nodeIds.has(e.source)) {
        nodeIds.add(e.source);
        next.push(e.source);
      }
      if (frontier.includes(e.source) || frontier.includes(e.target)) {
        if (!edges.find((x) => x.edge_id === e.edge_id)) edges.push(e);
      }
    }
    frontier = next;
  }
  return {
    nodes: [...nodeIds].map((id) => store.nodes.get(id)).filter((n): n is TechnicalNode => !!n),
    edges,
  };
}

export function overviewStats() {
  const nodes = [...store.nodes.values()];
  const edges = [...store.edges.values()];
  const q = [...store.quality.values()];
  return {
    technical_assets: nodes.filter((n) => n.node_type === 'table' || n.node_type === 'view').length,
    columns: nodes.filter((n) => n.node_type === 'column').length,
    business_concepts: store.concepts.size,
    trusted_relationships: edges.filter((e) => e.status === 'trusted').length,
    candidate_relationships: edges.filter((e) => e.status === 'candidate').length,
    semantic_conflicts: edges.filter((e) => e.status === 'conflict').length,
    avg_data_quality: q.length ? round(q.reduce((s, x) => s + x.overall, 0) / q.length) : 0,
    genie_agents: store.genieAgents.size,
    drift_events: store.drift.filter((d) => d.status !== 'resolved').length,
    ontology_version: store.meta.ontologyVersion,
    last_scan: store.meta.lastScan ?? null,
  };
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}
