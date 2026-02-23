import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { agentManager } from '../agents/manager';
import { getTerminalLogs } from '../db/queries';
import type { WsMessage } from '@nexus/shared';
import type { StreamChunk } from '@nexus/adapters';

const dashboardClients: Set<WebSocket> = new Set();
const agentClients: Map<string, Set<WebSocket>> = new Map();

export function setupWebSocketHandlers(fastify: FastifyInstance): void {
  fastify.get('/ws/dashboard', { websocket: true }, (socket) => {
    dashboardClients.add(socket);

    socket.on('close', () => {
      dashboardClients.delete(socket);
    });

    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        handleDashboardMessage(msg);
      } catch {
        socket.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });
  });

  fastify.get('/ws/agent/:id/terminal', { websocket: true }, (socket, req) => {
    const agentId = (req.params as { id: string }).id;

    if (!agentClients.has(agentId)) {
      agentClients.set(agentId, new Set());
    }
    agentClients.get(agentId)!.add(socket);

    const logs = getTerminalLogs(agentId, 500);
    for (const log of logs) {
      socket.send(JSON.stringify({
        type: 'chunk',
        agentId,
        data: log.content,
        chunkType: log.chunkType,
      }));
    }

    socket.on('close', () => {
      agentClients.get(agentId)?.delete(socket);
    });

    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleAgentMessage(agentId, msg);
      } catch {
        socket.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });
  });

  agentManager.on('chunk', (agentId: string, chunk: StreamChunk) => {
    const message: WsMessage = {
      type: 'chunk',
      agentId,
      data: chunk.content,
    };
    broadcastToAgent(agentId, message);
    broadcastToDashboard(message);
  });

  agentManager.on('status', (agentId: string, status: string) => {
    const message: WsMessage = {
      type: 'status',
      agentId,
      status: status as WsMessage['status'],
    };
    broadcastToAgent(agentId, message);
    broadcastToDashboard(message);
  });

  agentManager.on('error', (agentId: string, error: Error) => {
    const message: WsMessage = {
      type: 'error',
      agentId,
      error: error.message,
    };
    broadcastToAgent(agentId, message);
    broadcastToDashboard(message);
  });
}

function handleDashboardMessage(msg: WsMessage): void {
  if (msg.type === 'prompt' && msg.agentId && msg.data) {
    agentManager.runTask(msg.agentId, msg.data);
  }
}

function handleAgentMessage(_agentId: string, _msg: Record<string, unknown>): void {
  // stdin forwarding — reserved for future implementation
}

function broadcastToDashboard(message: WsMessage): void {
  const data = JSON.stringify(message);
  for (const client of dashboardClients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

function broadcastToAgent(agentId: string, message: WsMessage): void {
  const clients = agentClients.get(agentId);
  if (!clients) return;

  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}
