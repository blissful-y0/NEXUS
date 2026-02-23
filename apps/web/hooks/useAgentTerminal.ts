'use client';

import { useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export function useAgentTerminal(agentId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const onChunkRef = useRef<((chunk: string) => void) | null>(null);

  const connect = useCallback((onChunk: (chunk: string) => void) => {
    if (!agentId) return;

    onChunkRef.current = onChunk;
    const ws = new WebSocket(`${WS_URL}/ws/agent/${agentId}/terminal`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data && onChunkRef.current) {
          onChunkRef.current(msg.data);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [agentId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendStdin = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stdin', data }));
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendStdin,
  };
}
