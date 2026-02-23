export type AgentStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error'
  | 'terminated';

export type AgentSDK = 'claude' | 'codex' | 'opencode';

export interface Agent {
  id: string;
  name: string;
  role: string;
  sdk: AgentSDK;
  model: string;
  status: AgentStatus;
  currentTask: string | null;
  isOrchestrator: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfig {
  name: string;
  role: string;
  sdk: AgentSDK;
  model: string;
  isOrchestrator?: boolean;
  systemPrompt?: string;
}

export interface Task {
  id: string;
  agentId: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultSummary: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CostEntry {
  agentId: string;
  taskId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
}

export interface Budget {
  current: number;
  limit: number;
}

export interface WsMessage {
  type: 'chunk' | 'status' | 'prompt' | 'error';
  agentId: string;
  data?: string;
  status?: AgentStatus;
  error?: string;
}
