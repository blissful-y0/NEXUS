import { spawn, type ChildProcess } from 'child_process';
import type { AgentAdapter, AdapterConfig, StreamChunk } from './types';

const CLAUDE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-haiku-20241022',
];

const DEFAULT_SYSTEM_PROMPT = `You are a skilled software engineer working on a coding task.
When you complete the task successfully, output exactly: [TASK_COMPLETE]
If you encounter an unrecoverable error, output exactly: [TASK_FAILED]`;

export class ClaudeAdapter implements AgentAdapter {
  private config: AdapterConfig;
  private process: ChildProcess | null = null;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(config: AdapterConfig) {
    this.config = {
      ...config,
      model: config.model || 'claude-sonnet-4-20250514',
      systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      allowedTools: config.allowedTools || ['Read', 'Edit', 'Bash', 'Write'],
    };
  }

  get currentModel(): string {
    return this.config.model;
  }

  switchModel(model: string): void {
    if (!CLAUDE_MODELS.includes(model)) {
      throw new Error(`Invalid model: ${model}. Available: ${CLAUDE_MODELS.join(', ')}`);
    }
    this.config = { ...this.config, model };
  }

  async getAvailableModels(): Promise<string[]> {
    return CLAUDE_MODELS;
  }

  async *run(prompt: string): AsyncGenerator<StreamChunk> {
    this.conversationHistory = [];
    yield* this.executePrompt(prompt);
  }

  async *resume(prompt: string): AsyncGenerator<StreamChunk> {
    yield* this.executePrompt(prompt);
  }

  private async *executePrompt(prompt: string): AsyncGenerator<StreamChunk> {
    this.conversationHistory = [
      ...this.conversationHistory,
      { role: 'user', content: prompt },
    ];

    const args = [
      '--print',
      '--model', this.config.model,
      '--allowedTools', this.config.allowedTools!.join(','),
    ];

    if (this.config.systemPrompt) {
      args.push('--system-prompt', this.config.systemPrompt);
    }

    if (this.config.workingDirectory) {
      args.push('--cwd', this.config.workingDirectory);
    }

    const fullPrompt = this.conversationHistory
      .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    args.push('-p', fullPrompt);

    this.process = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.workingDirectory || process.cwd(),
    });

    let buffer = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for await (const chunk of this.process.stdout!) {
      const text = chunk.toString();
      buffer += text;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);

          if (event.type === 'assistant') {
            yield {
              type: 'text',
              content: event.content || '',
            };
          } else if (event.type === 'tool_use') {
            yield {
              type: 'tool_call',
              content: `Calling ${event.name}...`,
              toolName: event.name,
              toolInput: event.input,
            };
          } else if (event.type === 'tool_result') {
            yield {
              type: 'tool_result',
              content: event.content || '',
            };
          } else if (event.type === 'usage') {
            totalInputTokens += event.input_tokens || 0;
            totalOutputTokens += event.output_tokens || 0;
          }
        } catch {
          yield {
            type: 'text',
            content: line,
          };
        }
      }
    }

    if (buffer.trim()) {
      yield {
        type: 'text',
        content: buffer,
      };
    }

    let stderr = '';
    for await (const chunk of this.process.stderr!) {
      stderr += chunk.toString();
    }

    if (stderr && !stderr.includes('warning')) {
      yield {
        type: 'error',
        content: stderr,
      };
    }

    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      yield {
        type: 'usage',
        content: '',
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
    }

    yield {
      type: 'done',
      content: '',
    };

    this.process = null;
  }

  async terminate(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 3000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
    }
    this.conversationHistory = [];
  }
}
