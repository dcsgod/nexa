import type {
  DatabricksAdapter,
  GenieChatTurn,
  GenieDeployRequest,
  GenieDeployResult,
  LineageEdge,
  ProfileStats,
  QueryUsageSignal,
  UcTable,
} from '../types.js';
import {
  MOCK_LINEAGE,
  MOCK_PROFILES,
  MOCK_TABLES,
  MOCK_USAGE,
  fqName,
} from './seed.js';

export type SchemaChange =
  | { kind: 'add_column'; table: string; column: string; data_type: string }
  | { kind: 'drop_column'; table: string; column: string }
  | { kind: 'change_type'; table: string; column: string; data_type: string }
  | { kind: 'rename_column'; table: string; column: string; to: string };

/** Fully local adapter — the default. Requires no Databricks connectivity. */
export class MockDatabricksAdapter implements DatabricksAdapter {
  readonly kind = 'mock' as const;
  readonly apiVersion = 'mock-2026-09';

  // Mutable working copy so drift can be simulated at runtime.
  private tables: UcTable[] = structuredClone(MOCK_TABLES);

  async listTables(catalog?: string): Promise<UcTable[]> {
    return this.tables.filter((t) => !catalog || t.catalog === catalog);
  }

  async getTable(fq: string): Promise<UcTable | null> {
    return this.tables.find((t) => fqName(t) === fq) ?? null;
  }

  /**
   * Mock-only: apply a schema change so a subsequent scan detects drift.
   * Returns a human-readable description of what changed.
   */
  simulateSchemaChange(change: SchemaChange): string {
    const table = this.tables.find((t) => fqName(t) === change.table);
    if (!table) throw new Error(`table not found: ${change.table}`);
    table.updated_at = new Date().toISOString();
    switch (change.kind) {
      case 'add_column':
        table.columns.push({ name: change.column, data_type: change.data_type, nullable: true });
        return `Added column ${change.column} ${change.data_type} to ${change.table}`;
      case 'drop_column':
        table.columns = table.columns.filter((c) => c.name !== change.column);
        return `Dropped column ${change.column} from ${change.table}`;
      case 'change_type': {
        const col = table.columns.find((c) => c.name === change.column);
        if (col) col.data_type = change.data_type;
        return `Changed ${change.column} type to ${change.data_type} in ${change.table}`;
      }
      case 'rename_column': {
        const col = table.columns.find((c) => c.name === change.column);
        if (col) col.name = change.to;
        return `Renamed ${change.column} → ${change.to} in ${change.table}`;
      }
    }
  }

  async getLineage(catalog?: string): Promise<LineageEdge[]> {
    if (!catalog) return MOCK_LINEAGE;
    return MOCK_LINEAGE.filter(
      (e) => e.source.startsWith(`${catalog}.`) || e.target.startsWith(`${catalog}.`),
    );
  }

  async profile(assetId: string): Promise<ProfileStats | null> {
    return MOCK_PROFILES[assetId] ?? null;
  }

  async getUsageSignals(catalog?: string): Promise<QueryUsageSignal[]> {
    if (!catalog) return MOCK_USAGE;
    return MOCK_USAGE.filter(
      (u) => u.entity_a.startsWith(`${catalog}.`) || u.entity_b.startsWith(`${catalog}.`),
    );
  }

  async deployGenie(req: GenieDeployRequest): Promise<GenieDeployResult> {
    const agent_id = `genie_mock_${req.domain}_${Date.now().toString(36)}`;
    return {
      agent_id,
      space_id: 'mock-space',
      status: 'DEPLOYED',
      url: `https://mock.databricks/genie/${agent_id}`,
    };
  }

  async chatGenie(agentId: string, message: string): Promise<GenieChatTurn> {
    // Deterministic canned response demonstrating the SQL + evidence contract.
    return {
      answer: `(${agentId}) Based on the semantic model, here is a grounded answer to: "${message}".`,
      sql: 'SELECT dim_store.region, SUM(fact_sales.net_sales) AS revenue\nFROM retail.sales.fact_sales\nJOIN retail.sales.dim_store USING (store_id)\nGROUP BY region',
      data_sources: ['retail.sales.fact_sales', 'retail.sales.dim_store'],
      confidence: 0.93,
    };
  }
}
