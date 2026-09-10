import type { NexaConfig } from '../../../config.js';
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

/**
 * Live Databricks adapter.
 *
 * Skeleton only for now (P0): the method bodies document exactly which native
 * Databricks surface each call maps to, so wiring real connectivity later is a
 * fill-in rather than a redesign. Nothing else in the platform changes — only
 * NEXA_MODE=live and these bodies.
 *
 *   listTables      -> system.information_schema.tables/columns (SQL warehouse)
 *   getLineage      -> system.access.table_lineage / column_lineage
 *   profile         -> SQL profiling query against the warehouse (masked)
 *   getUsageSignals -> system.query.history / access audit joins
 *   deployGenie     -> Genie / Agent provisioning REST API (versioned)
 *   chatGenie       -> Genie conversation API
 */
export class LiveDatabricksAdapter implements DatabricksAdapter {
  readonly kind = 'live' as const;
  readonly apiVersion = 'databricks-2.1';

  constructor(private readonly cfg: NexaConfig) {
    if (!cfg.databricks.host) {
      throw new Error(
        'NEXA_MODE=live requires DATABRICKS_HOST (and OAuth client or token). ' +
          'See .env.example.',
      );
    }
  }

  private notImplemented(surface: string): never {
    throw new Error(
      `LiveDatabricksAdapter.${surface} not implemented yet. ` +
        'Implement against the documented Databricks system tables / REST API, ' +
        'or run with NEXA_MODE=mock.',
    );
  }

  async listTables(_catalog?: string): Promise<UcTable[]> {
    return this.notImplemented('listTables');
  }
  async getTable(_fq: string): Promise<UcTable | null> {
    return this.notImplemented('getTable');
  }
  async getLineage(_catalog?: string): Promise<LineageEdge[]> {
    return this.notImplemented('getLineage');
  }
  async profile(_assetId: string): Promise<ProfileStats | null> {
    return this.notImplemented('profile');
  }
  async getUsageSignals(_catalog?: string): Promise<QueryUsageSignal[]> {
    return this.notImplemented('getUsageSignals');
  }
  async deployGenie(_req: GenieDeployRequest): Promise<GenieDeployResult> {
    return this.notImplemented('deployGenie');
  }
  async chatGenie(_agentId: string, _message: string): Promise<GenieChatTurn> {
    return this.notImplemented('chatGenie');
  }
}
