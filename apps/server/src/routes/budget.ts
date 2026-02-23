import type { FastifyInstance } from 'fastify';
import * as queries from '../db/queries';

export async function budgetRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/budget', async () => {
    const current = queries.getTotalCost();
    const limit = parseFloat(process.env.NEXUS_BUDGET_USD || '50');
    return {
      current: parseFloat(current.toFixed(4)),
      limit,
      remaining: parseFloat((limit - current).toFixed(4)),
      percentUsed: parseFloat(((current / limit) * 100).toFixed(1)),
    };
  });
}
