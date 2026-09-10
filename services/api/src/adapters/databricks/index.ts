import { config } from '../../config.js';
import type { DatabricksAdapter } from './types.js';
import { MockDatabricksAdapter } from './mock/mockAdapter.js';
import { LiveDatabricksAdapter } from './live/liveAdapter.js';

let singleton: DatabricksAdapter | null = null;

/** Factory — the one place that decides mock vs live. */
export function getDatabricksAdapter(): DatabricksAdapter {
  if (singleton) return singleton;
  singleton =
    config.mode === 'live'
      ? new LiveDatabricksAdapter(config)
      : new MockDatabricksAdapter();
  return singleton;
}

export * from './types.js';
