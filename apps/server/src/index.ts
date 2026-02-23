import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { config } from 'dotenv';

import { initializeDatabase, closeDatabase } from './db/schema';
import { agentRoutes } from './routes/agents';
import { taskRoutes } from './routes/tasks';
import { budgetRoutes } from './routes/budget';
import { setupWebSocketHandlers } from './ws/handler';

config();

const PORT = parseInt(process.env.SERVER_PORT || '3001', 10);

async function main() {
  const fastify = Fastify({
    logger: true,
  });

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(fastifyWebsocket);

  initializeDatabase();

  await fastify.register(agentRoutes);
  await fastify.register(taskRoutes);
  await fastify.register(budgetRoutes);

  setupWebSocketHandlers(fastify);

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  const shutdown = async () => {
    closeDatabase();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
