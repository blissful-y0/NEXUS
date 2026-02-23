import { spawn, type ChildProcess } from 'child_process';
import type { AgentAdapter, AdapterConfig, StreamChunk } from './types';

const CODEX_MODELS = [
  'o3',
  'o4-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
];

const DEFAULT_SYSTEM_PROMPT = `You are a skilled software engineer.
When task is complete, output: [TASK_COMPLETE]
If unrecoverable error, output: [TASK_FAILED]`;

export class CodexAdapter implements AgentAdapter {
  private config: AdapterConfig;
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;

  constructor(config: AdapterConfig) {
    this.config = {
      ...config,
      model: config.model || 'o4-mini',
      systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    };
  }

  get currentModel(): string {
    return this.config.model;
  }

  switchModel(model: string): void {
    if (!CODEX_MODELS.includes(model)) {
      throw new Error(`Invalid model: ${model}. Available: ${CODEX_MODELS.join(', ')}`);
    }
    this.config = { ...this.config, model };
  }

  async getAvailableModels(): Promise<string[]> {
    return CODEX_MODELS;
  }

  async *run(prompt: string): AsyncGenerator<StreamChunk> {
    this.sessionId = null;
    yield* this.executePrompt(prompt);
  }

  async *resume(prompt: string): AsyncGenerator<StreamChunk> {
    yield* this.executePrompt(prompt);
  }

  private async *executePrompt(prompt: string): AsyncGenerator<StreamChunk> {
    const args = [
      '--model', this.config.model,
      '--approval-mode', 'auto-edit',
      '--quiet',
    ];

    if (this.config.workingDirectory) {
      args.push('--cwd', this.config.workingDirectory);
    }

    args.push(prompt);

    this.process = spawn('codex', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.workingDirectory || process.cwd(),
      env: {
        ...process.env,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      },
    });

    let buffer = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    if (this.process.stdout) {
      for await (const chunk of this.process.stdout) {
        const text = chunk.toString();
        buffer += text;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);

            if (event.type === 'message') {
              yield {
                type: 'text',
                content: event.content || '',
              };
            } else if (event.type === 'function_call') {
              yield {
                type: 'tool_call',
                content: `Executing ${event.name}...`,
                toolName: event.name,
                toolInput: event.arguments,
              };
            } else if (event.type === 'function_result') {
              yield {
                type: 'tool_result',
                content: typeof event.output === 'string'
                  ? event.output
                  : JSON.stringify(event.output),
              };
            } else if (event.type === 'usage') {
              totalInputTokens += event.prompt_tokens || 0;
              totalOutputTokens += event.completion_tokens || 0;
            } else if (event.type === 'session') {
              this.sessionId = event.id;
            }
          } catch {
            yield {
              type: 'text',
              content: line,
            };
          }
        }
      }
    }

    if (buffer.trim()) {
      yield {
        type: 'text',
        content: buffer,
      };
    }

    if (this.process.stderr) {
      let stderr = '';
      for await (const chunk of this.process.stderr) {
        stderr += chunk.toString();
      }
      if (stderr && stderr.includes('error')) {
        yield {
          type: 'error',
          content: stderr,
        };
      }
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
    this.sessionId = null;
  }
}
