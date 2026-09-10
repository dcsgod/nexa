/** Central runtime configuration, read once from the environment. */

export type NexaMode = 'mock' | 'live';

export interface NexaConfig {
  mode: NexaMode;
  api: { port: number; logLevel: string; webOrigin: string };
  aiEngineUrl: string;
  databricks: {
    host?: string;
    clientId?: string;
    clientSecret?: string;
    token?: string;
    warehouseId?: string;
    catalog: string;
  };
  genie: { spaceId?: string };
}

function env(key: string, fallback?: string): string | undefined {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

export const config: NexaConfig = {
  mode: (env('NEXA_MODE', 'mock') as NexaMode) ?? 'mock',
  api: {
    port: Number(env('API_PORT', '8080')),
    logLevel: env('API_LOG_LEVEL', 'info')!,
    webOrigin: env('WEB_ORIGIN', 'http://localhost:5173')!,
  },
  aiEngineUrl: env('AI_ENGINE_URL', 'http://localhost:8100')!,
  databricks: {
    host: env('DATABRICKS_HOST'),
    clientId: env('DATABRICKS_CLIENT_ID'),
    clientSecret: env('DATABRICKS_CLIENT_SECRET'),
    token: env('DATABRICKS_TOKEN'),
    warehouseId: env('DATABRICKS_WAREHOUSE_ID'),
    catalog: env('DATABRICKS_CATALOG', 'main')!,
  },
  genie: { spaceId: env('GENIE_SPACE_ID') },
};

export const isMock = config.mode === 'mock';
