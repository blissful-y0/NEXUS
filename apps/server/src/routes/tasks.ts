import type { FastifyInstance } from 'fastify';
import { agentManager } from '../agents/manager';
import * as queries from '../db/queries';

interface CreateTaskBody {
  agentId: string;
  prompt: string;
}

interface TaskParams {
  id: string;
}

export async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/tasks', async (req) => {
    const { agentId } = req.query as { agentId?: string };
    const tasks = queries.listTasks(agentId);
    return { tasks };
  });

  fastify.post<{ Body: CreateTaskBody }>('/tasks', async (req, reply) => {
    const { agentId, prompt } = req.body;

    if (!agentId || !prompt) {
      return reply.status(400).send({ error: 'Missing agentId or prompt' });
    }

    try {
      const taskId = await agentManager.runTask(agentId, prompt);
      return { taskId, status: 'running' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: msg });
    }
  });

  fastify.get<{ Params: TaskParams }>('/tasks/:id', async (req, reply) => {
    const task = queries.getTask(req.params.id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    return { task };
  });

  fastify.post<{ Params: TaskParams }>('/tasks/:id/retry', async (req, reply) => {
    const task = queries.getTask(req.params.id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    try {
      const newTaskId = await agentManager.runTask(task.agentId, task.prompt);
      return { taskId: newTaskId, status: 'running' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: msg });
    }
  });
}
