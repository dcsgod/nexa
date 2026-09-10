import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { StatCard, Loading } from '../components/ui';

export function Overview() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const rescan = useMutation({
    mutationFn: api.runDiscovery,
    onSuccess: () => qc.invalidateQueries(),
  });

  if (overview.isLoading || !overview.data) return <Loading what="overview" />;
  const d = overview.data;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1>Enterprise Semantic Health</h1>
          <div className="muted">
            Ontology v{d.ontology_version}
            {d.last_scan && ` · last scan ${new Date(d.last_scan).toLocaleString()}`}
          </div>
        </div>
        <button className="btn ghost" onClick={() => rescan.mutate()} disabled={rescan.isPending}>
          {rescan.isPending ? 'Scanning…' : '↻ Re-run discovery'}
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Technical Assets" value={d.technical_assets} sub={`${d.columns} columns`} />
        <StatCard label="Business Concepts" value={d.business_concepts} tone="accent" />
        <StatCard label="Trusted Relationships" value={d.trusted_relationships} tone="good" />
        <StatCard
          label="Semantic Conflicts"
          value={d.semantic_conflicts}
          tone={d.semantic_conflicts > 0 ? 'bad' : 'good'}
          sub={d.semantic_conflicts > 0 ? 'need human review' : 'none'}
        />
        <StatCard label="Data Quality" value={`${Math.round(d.avg_data_quality * 100)}%`}
          tone={d.avg_data_quality >= 0.9 ? 'good' : 'warn'} />
        <StatCard label="Candidate Relationships" value={d.candidate_relationships} tone="accent" />
        <StatCard label="Genie Agents" value={d.genie_agents} />
        <StatCard label="Drift Events" value={d.drift_events ?? 0} tone={(d.drift_events ?? 0) > 0 ? 'warn' : undefined} />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Platform principle</h3>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          Technical truth first — the knowledge graph is discovered from Unity Catalog and never
          silently overwritten by AI. Every relationship above carries evidence, and every
          low-confidence or conflicting interpretation is held back for human review rather than
          auto-certified.
        </p>
      </div>
    </div>
  );
}
