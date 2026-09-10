import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api, type TechnicalEdge } from '../api/client';
import { Loading } from '../components/ui';
import { EdgeInspector } from '../components/EdgeInspector';

const REL_TYPES = new Set(['foreign_key_to', 'references', 'lineage_to', 'same_entity_as']);
const STATUS_COLOR: Record<string, string> = {
  trusted: '#35c491',
  candidate: '#4f8cff',
  conflict: '#e5675f',
  rejected: '#6b7688',
};

export function TechnicalOntology() {
  const nodesQ = useQuery({ queryKey: ['nodes', 'table'], queryFn: () => api.nodes({ type: 'table' }) });
  const edgesQ = useQuery({ queryKey: ['edges'], queryFn: () => api.edges() });
  const [selected, setSelected] = useState<TechnicalEdge | null>(null);
  const [minConf, setMinConf] = useState(0);

  const { rfNodes, rfEdges, relEdges } = useMemo(() => {
    const tables = nodesQ.data ?? [];
    const allEdges = edgesQ.data ?? [];
    // table-level relationship edges derived from column edges
    const rel = allEdges.filter((e) => REL_TYPES.has(e.edge_type) && e.confidence >= minConf);
    const tableFq = (nodeId: string) =>
      nodeId.replace(/^(table|column):/, '').split('.').slice(0, 3).join('.');

    // group rel edges by table pair
    const pairMap = new Map<string, TechnicalEdge>();
    for (const e of rel) {
      const a = tableFq(e.source);
      const b = tableFq(e.target);
      if (a === b) continue;
      const key = [a, b].sort().join('__');
      const existing = pairMap.get(key);
      if (!existing || e.confidence > existing.confidence) {
        pairMap.set(key, { ...e, source: `table:${a}`, target: `table:${b}` });
      }
    }
    const relEdges = [...pairMap.values()];

    const R = 240;
    const cx = 340;
    const cy = 280;
    const rfNodes: Node[] = tables.map((t, i) => {
      const angle = (i / Math.max(tables.length, 1)) * Math.PI * 2;
      return {
        id: t.node_id,
        position: { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) },
        data: { label: `${t.schema}.${t.name}` },
        style: {
          background: 'var(--bg-elev-2)',
          color: 'var(--text)',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          fontSize: 12,
          padding: '8px 12px',
          width: 150,
        },
      };
    });
    const rfEdges: Edge[] = relEdges.map((e) => ({
      id: e.edge_id,
      source: e.source,
      target: e.target,
      label: e.edge_type.replace(/_/g, ' '),
      animated: e.status === 'candidate',
      style: { stroke: STATUS_COLOR[e.status] ?? '#888', strokeWidth: 1.6 },
      labelStyle: { fill: 'var(--text-dim)', fontSize: 10 },
      labelBgStyle: { fill: 'var(--bg)' },
    }));
    return { rfNodes, rfEdges, relEdges };
  }, [nodesQ.data, edgesQ.data, minConf]);

  if (nodesQ.isLoading || edgesQ.isLoading) return <Loading what="ontology" />;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1>Technical Knowledge Graph</h1>
          <div className="muted">Machine-grounded relationships from Unity Catalog, lineage & usage</div>
        </div>
        <div className="row">
          <span className="faint" style={{ fontSize: 12 }}>min confidence</span>
          <input type="range" min={0} max={1} step={0.05} value={minConf}
            onChange={(e) => setMinConf(Number(e.target.value))} />
          <span className="mono" style={{ width: 34 }}>{Math.round(minConf * 100)}%</span>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'stretch', gap: 16 }}>
        <div className="card" style={{ flex: 1, height: 560, padding: 0, overflow: 'hidden' }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            fitView
            onEdgeClick={(_, e) => {
              const found = relEdges.find((r) => r.edge_id === e.id) ?? null;
              setSelected(found);
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#233" gap={22} />
            <Controls />
          </ReactFlow>
        </div>
        <div style={{ width: 380, flexShrink: 0 }}>
          {selected ? (
            <EdgeInspector edge={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="card" style={{ height: '100%' }}>
              <h3>Explainability</h3>
              <p className="muted" style={{ lineHeight: 1.6 }}>
                Click any relationship in the graph to see <strong>why the platform believes it
                exists</strong> — the multi-factor confidence breakdown (lineage, structure, value
                overlap, behavioral usage) and the underlying evidence records.
              </p>
              <div style={{ marginTop: 16 }}>
                <Legend color={STATUS_COLOR.trusted} label="Trusted — gates passed" />
                <Legend color={STATUS_COLOR.candidate} label="Candidate — needs more evidence" />
                <Legend color={STATUS_COLOR.conflict} label="Conflict — human review required" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="row" style={{ gap: 8, marginBottom: 8 }}>
      <span style={{ width: 20, height: 3, background: color, borderRadius: 2 }} />
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
    </div>
  );
}
