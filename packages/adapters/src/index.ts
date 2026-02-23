export * from './types';
export { ClaudeAdapter } from './claude';
export { CodexAdapter } from './codex';
export { OpenCodeAdapter } from './opencode';

import type { AgentAdapter, AdapterConfig } from './types';
import { ClaudeAdapter } from './claude';
import { CodexAdapter } from './codex';
import { OpenCodeAdapter } from './opencode';
import type { AgentSDK } from '@nexus/shared';

let portOffset = 0;

export function createAdapter(sdk: AgentSDK, config: AdapterConfig): AgentAdapter {
  switch (sdk) {
    case 'claude':
      return new ClaudeAdapter(config);
    case 'codex':
      return new CodexAdapter(config);
    case 'opencode':
      return new OpenCodeAdapter(config, portOffset++);
    default:
      throw new Error(`Unknown SDK: ${sdk}`);
  }
}

export async function getModelsBySdk(sdk: AgentSDK): Promise<string[]> {
  const adapter = createAdapter(sdk, { model: '' });
  return adapter.getAvailableModels();
}
