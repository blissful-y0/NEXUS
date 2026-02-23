import { agentManager } from './manager';
import * as queries from '../db/queries';
import type { AgentConfig, AgentSDK } from '@nexus/shared';

export interface OrchestratorTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<string>;
}

export const orchestratorTools: OrchestratorTool[] = [
  {
    name: 'spawn_agent',
    description: 'Spawn a new worker agent with specified SDK and role',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Agent name' },
        role: { type: 'string', description: 'Agent role/specialty' },
        sdk: { type: 'string', enum: ['claude', 'codex', 'opencode'] },
        model: { type: 'string', description: 'Model to use' },
      },
      required: ['name', 'role', 'sdk', 'model'],
    },
    handler: async (input) => {
      const config: AgentConfig = {
        name: input.name as string,
        role: input.role as string,
        sdk: input.sdk as AgentSDK,
        model: input.model as string,
        isOrchestrator: false,
      };

      const agent = await agentManager.spawnAgent(config);
      return JSON.stringify({
        success: true,
        agentId: agent.id,
        message: `Spawned agent "${agent.name}" with ID ${agent.id}`,
      });
    },
  },

  {
    name: 'assign_task',
    description: 'Assign a task to a specific agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        prompt: { type: 'string' },
      },
      required: ['agentId', 'prompt'],
    },
    handler: async (input) => {
      const taskId = await agentManager.runTask(
        input.agentId as string,
        input.prompt as string
      );
      return JSON.stringify({
        success: true,
        taskId,
        message: `Task assigned to agent ${input.agentId}`,
      });
    },
  },

  {
    name: 'get_agent_result',
    description: 'Get the result/status of an agent\'s task',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        taskId: { type: 'string', description: 'Optional specific task ID' },
      },
      required: ['agentId'],
    },
    handler: async (input) => {
      const tasks = queries.listTasks(input.agentId as string);
      const task = input.taskId
        ? tasks.find(t => t.id === input.taskId)
        : tasks[0];

      if (!task) {
        return JSON.stringify({ success: false, error: 'No tasks found' });
      }

      return JSON.stringify({
        success: true,
        taskId: task.id,
        status: task.status,
        resultSummary: task.resultSummary,
        completedAt: task.completedAt,
      });
    },
  },

  {
    name: 'list_agents',
    description: 'List all active agents and their status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const agents = queries.listAgents();
      return JSON.stringify({
        success: true,
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          role: a.role,
          sdk: a.sdk,
          model: a.model,
          status: a.status,
          currentTask: a.currentTask,
          isOrchestrator: a.isOrchestrator,
        })),
      });
    },
  },

  {
    name: 'terminate_agent',
    description: 'Terminate a specific agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
      },
      required: ['agentId'],
    },
    handler: async (input) => {
      await agentManager.terminateAgent(input.agentId as string);
      return JSON.stringify({
        success: true,
        message: `Agent ${input.agentId} terminated`,
      });
    },
  },

  {
    name: 'get_budget',
    description: 'Get current budget usage',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const current = queries.getTotalCost();
      const limit = parseFloat(process.env.NEXUS_BUDGET_USD || '50');
      return JSON.stringify({
        success: true,
        currentUsd: current.toFixed(4),
        limitUsd: limit,
        remaining: (limit - current).toFixed(4),
        percentUsed: ((current / limit) * 100).toFixed(1),
      });
    },
  },
];

export function getOrchestratorSystemPrompt(): string {
  const toolDescriptions = orchestratorTools
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n');

  return `You are the Orchestrator agent in Nexus, an AI coding agent orchestration platform.

Your role is to:
1. Break down complex user requests into subtasks
2. Spawn appropriate worker agents for each subtask
3. Assign tasks and monitor progress
4. Aggregate results and report back

Available tools:
${toolDescriptions}

Guidelines:
- Use claude SDK for complex reasoning tasks
- Use codex SDK for code generation/editing
- Use opencode SDK when specific provider models are needed
- Monitor budget usage and warn if approaching limit
- When all subtasks complete, summarize results and output [TASK_COMPLETE]
- If critical failure, output [TASK_FAILED] with explanation

Current mode: Manual (user confirms spawning) or Auto (you decide autonomously)
Check mode before spawning agents.`;
}

export async function handleToolCall(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  const tool = orchestratorTools.find(t => t.name === toolName);
  if (!tool) {
    return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }
  return tool.handler(input);
}
