import type { FastifyInstance } from 'fastify';
import { agentManager } from '../agents/manager';
import * as queries from '../db/queries';
import type { AgentConfig, AgentSDK } from '@nexus/shared';

interface CreateAgentBody {
  name: string;
  role: string;
  sdk: AgentSDK;
  model: string;
  isOrchestrator?: boolean;
  systemPrompt?: string;
}

interface AgentParams {
  id: string;
}

export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/agents', async () => {
    const agents = queries.listAgents();
    return { agents };
  });

  fastify.post<{ Body: CreateAgentBody }>('/agents', async (req, reply) => {
    const { name, role, sdk, model, isOrchestrator, systemPrompt } = req.body;

    if (!name || !role || !sdk || !model) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const config: AgentConfig = {
      name,
      role,
      sdk,
      model,
      isOrchestrator: isOrchestrator || false,
      systemPrompt,
    };

    try {
      const agent = await agentManager.spawnAgent(config);
      return { agent };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: msg });
    }
  });

  fastify.get<{ Params: AgentParams }>('/agents/:id', async (req, reply) => {
    const agent = queries.getAgent(req.params.id);
    if (!agent) {
      return reply.status(404).send({ error: 'Agent not found' });
    }
    return { agent };
  });

  fastify.delete<{ Params: AgentParams }>('/agents/:id', async (req, reply) => {
    try {
      await agentManager.terminateAgent(req.params.id);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: msg });
    }
  });

  fastify.get<{ Params: AgentParams }>('/agents/:id/models', async (req, reply) => {
    const adapter = agentManager.getAdapter(req.params.id);
    if (!adapter) {
      return reply.status(404).send({ error: 'Agent not found' });
    }
    const models = await adapter.getAvailableModels();
    return { models };
  });
}
