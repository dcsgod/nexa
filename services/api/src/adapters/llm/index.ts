import { config } from '../../config.js';
import type { LlmAdapter } from './types.js';
import { MockLlmAdapter } from './mockLlm.js';
import { LiveLlmAdapter } from './liveLlm.js';

let singleton: LlmAdapter | null = null;

export function getLlmAdapter(): LlmAdapter {
  if (singleton) return singleton;
  singleton = config.mode === 'live' ? new LiveLlmAdapter() : new MockLlmAdapter();
  return singleton;
}

export * from './types.js';
