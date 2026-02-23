import { spawn, type ChildProcess } from 'child_process';
import type { AgentAdapter, AdapterConfig, StreamChunk } from './types';

const OPENCODE_MODELS = [
  'anthropic/claude-sonnet-4-20250514',
  'anthropic/claude-opus-4-20250514',
  'openai/gpt-4.1',
  'google/gemini-2.5-pro',
];

const DEFAULT_SYSTEM_PROMPT = `You are a skilled software engineer.
When task is complete, output: [TASK_COMPLETE]
If unrecoverable error, output: [TASK_FAILED]`;

export class OpenCodeAdapter implements AgentAdapter {
  private config: AdapterConfig;
  private process: ChildProcess | null = null;
  private serverPort: number;
  private sessionId: string | null = null;

  constructor(config: AdapterConfig, portOffset: number = 0) {
    this.config = {
      ...config,
      model: config.model || 'anthropic/claude-sonnet-4-20250514',
      systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    };
    this.serverPort = 4096 + portOffset;
  }

  get currentModel(): string {
    return this.config.model;
  }

  switchModel(model: string): void {
    this.config = { ...this.config, model };
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`http://localhost:${this.serverPort}/api/config`);
      if (response.ok) {
        const config = await response.json();
        return config.models || OPENCODE_MODELS;
      }
    } catch {
      // Server not running, return defaults
    }
    return OPENCODE_MODELS;
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
      '--non-interactive',
    ];

    if (this.config.workingDirectory) {
      args.push('--cwd', this.config.workingDirectory);
    }

    args.push('-m', prompt);

    this.process = spawn('opencode', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.workingDirectory || process.cwd(),
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

            switch (event.type) {
              case 'text':
              case 'assistant':
                yield {
                  type: 'text',
                  content: event.content || event.text || '',
                };
                break;

              case 'tool_call':
                yield {
                  type: 'tool_call',
                  content: `Calling ${event.tool || event.name}...`,
                  toolName: event.tool || event.name,
                  toolInput: event.input || event.args,
                };
                break;

              case 'tool_result':
                yield {
                  type: 'tool_result',
                  content: event.result || event.output || '',
                };
                break;

              case 'usage':
                totalInputTokens += event.input_tokens || 0;
                totalOutputTokens += event.output_tokens || 0;
                break;

              case 'session':
                this.sessionId = event.id;
                break;

              default:
                if (event.content) {
                  yield {
                    type: 'text',
                    content: event.content,
                  };
                }
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
      if (stderr && stderr.toLowerCase().includes('error')) {
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
