export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'usage' | 'done' | 'error';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AdapterConfig {
  model: string;
  systemPrompt?: string;
  workingDirectory?: string;
  allowedTools?: string[];
}

export interface AgentAdapter {
  run(prompt: string): AsyncGenerator<StreamChunk>;
  resume(prompt: string): AsyncGenerator<StreamChunk>;
  switchModel(model: string): void;
  getAvailableModels(): Promise<string[]>;
  terminate(): Promise<void>;
  readonly currentModel: string;
}
