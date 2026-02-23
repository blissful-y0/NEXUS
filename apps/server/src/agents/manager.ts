import { EventEmitter } from 'events';
import { createAdapter, type AgentAdapter, type StreamChunk } from '@nexus/adapters';
import type { Agent, AgentConfig, AgentStatus } from '@nexus/shared';
import * as queries from '../db/queries';

const COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'claude-opus-4-20250514': { input: 0.015 / 1000, output: 0.075 / 1000 },
  'o4-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
  'gpt-4.1': { input: 0.002 / 1000, output: 0.008 / 1000 },
  'default': { input: 0.001 / 1000, output: 0.003 / 1000 },
};

export class AgentManager extends EventEmitter {
  private adapters: Map<string, AgentAdapter> = new Map();
  private runningTasks: Map<string, string> = new Map();

  constructor() {
    super();
  }

  async spawnAgent(config: AgentConfig): Promise<Agent> {
    const agent = queries.createAgent(config);

    const adapter = createAdapter(config.sdk, {
      model: config.model,
      systemPrompt: config.systemPrompt,
    });

    this.adapters.set(agent.id, adapter);

    return agent;
  }

  async runTask(agentId: string, prompt: string): Promise<string> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const task = queries.createTask(agentId, prompt);
    this.runningTasks.set(agentId, task.id);

    queries.updateAgentStatus(agentId, 'running', prompt.substring(0, 100));
    this.emit('status', agentId, 'running');

    this.executeTask(agentId, task.id, adapter, prompt);

    return task.id;
  }

  private async executeTask(
    agentId: string,
    taskId: string,
    adapter: AgentAdapter,
    prompt: string
  ): Promise<void> {
    let resultSummary = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      for await (const chunk of adapter.run(prompt)) {
        this.emit('chunk', agentId, chunk);

        if (chunk.content) {
          queries.logTerminalChunk(agentId, taskId, chunk.type, chunk.content);
        }

        switch (chunk.type) {
          case 'text':
            resultSummary += chunk.content;
            if (chunk.content.includes('[TASK_COMPLETE]')) {
              queries.updateTaskStatus(taskId, 'completed', resultSummary);
              queries.updateAgentStatus(agentId, 'completed');
              this.emit('status', agentId, 'completed');
            }
            if (chunk.content.includes('[TASK_FAILED]')) {
              queries.updateTaskStatus(taskId, 'failed', resultSummary);
              queries.updateAgentStatus(agentId, 'error');
              this.emit('status', agentId, 'error');
            }
            break;

          case 'usage':
            if (chunk.usage) {
              totalInputTokens += chunk.usage.inputTokens;
              totalOutputTokens += chunk.usage.outputTokens;
            }
            break;

          case 'done': {
            const costRate = COST_PER_TOKEN[adapter.currentModel] || COST_PER_TOKEN['default'];
            const costUsd =
              totalInputTokens * costRate.input +
              totalOutputTokens * costRate.output;

            queries.logCost({
              agentId,
              taskId,
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              costUsd,
            });

            const agent = queries.getAgent(agentId);
            if (agent?.status === 'running') {
              queries.updateAgentStatus(agentId, 'idle');
              queries.updateTaskStatus(taskId, 'completed', resultSummary.substring(0, 500));
              this.emit('status', agentId, 'idle');
            }
            break;
          }

          case 'error':
            queries.updateTaskStatus(taskId, 'failed', chunk.content);
            queries.updateAgentStatus(agentId, 'error');
            this.emit('error', agentId, new Error(chunk.content));
            break;
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      queries.updateTaskStatus(taskId, 'failed', errMsg);
      queries.updateAgentStatus(agentId, 'error');
      this.emit('error', agentId, error as Error);
    } finally {
      this.runningTasks.delete(agentId);
    }
  }

  async resumeAgent(agentId: string, prompt: string): Promise<string> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const task = queries.createTask(agentId, prompt);
    this.runningTasks.set(agentId, task.id);

    queries.updateAgentStatus(agentId, 'running', prompt.substring(0, 100));
    this.emit('status', agentId, 'running');

    this.executeTaskResume(agentId, task.id, adapter, prompt);

    return task.id;
  }

  private async executeTaskResume(
    agentId: string,
    taskId: string,
    adapter: AgentAdapter,
    prompt: string
  ): Promise<void> {
    let resultSummary = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      for await (const chunk of adapter.resume(prompt)) {
        this.emit('chunk', agentId, chunk);

        if (chunk.content) {
          queries.logTerminalChunk(agentId, taskId, chunk.type, chunk.content);
        }

        if (chunk.type === 'text') {
          resultSummary += chunk.content;
        } else if (chunk.type === 'usage' && chunk.usage) {
          totalInputTokens += chunk.usage.inputTokens;
          totalOutputTokens += chunk.usage.outputTokens;
        } else if (chunk.type === 'done') {
          const costRate = COST_PER_TOKEN[adapter.currentModel] || COST_PER_TOKEN['default'];
          const costUsd = totalInputTokens * costRate.input + totalOutputTokens * costRate.output;
          queries.logCost({ agentId, taskId, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, costUsd });
          queries.updateAgentStatus(agentId, 'idle');
          queries.updateTaskStatus(taskId, 'completed', resultSummary.substring(0, 500));
          this.emit('status', agentId, 'idle');
        }
      }
    } catch (error) {
      queries.updateTaskStatus(taskId, 'failed', String(error));
      queries.updateAgentStatus(agentId, 'error');
      this.emit('error', agentId, error as Error);
    }
  }

  async terminateAgent(agentId: string): Promise<void> {
    const adapter = this.adapters.get(agentId);
    if (adapter) {
      await adapter.terminate();
      this.adapters.delete(agentId);
    }

    queries.updateAgentStatus(agentId, 'terminated');
    this.emit('status', agentId, 'terminated');
  }

  getStatus(agentId: string): AgentStatus {
    const agent = queries.getAgent(agentId);
    return agent?.status || 'terminated';
  }

  listAgents(): Agent[] {
    return queries.listAgents();
  }

  getAdapter(agentId: string): AgentAdapter | undefined {
    return this.adapters.get(agentId);
  }
}

export const agentManager = new AgentManager();
