'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useNexusStore } from '@/store/agents';
import type { WsMessage } from '@nexus/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const {
    setAgentStatus,
    appendTerminalChunk,
    setConnectionStatus,
  } = useNexusStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket(`${WS_URL}/ws/dashboard`);

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'chunk':
            if (msg.agentId && msg.data) {
              appendTerminalChunk(msg.agentId, msg.data);
            }
            break;

          case 'status':
            if (msg.agentId && msg.status) {
              setAgentStatus(msg.agentId, msg.status);
            }
            break;

          case 'error':
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wsRef.current = null;

      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // handled by onclose
    };

    wsRef.current = ws;
  }, [setConnectionStatus, appendTerminalChunk, setAgentStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendPrompt = useCallback((agentId: string, prompt: string) => {
    sendMessage({
      type: 'prompt',
      agentId,
      data: prompt,
    });
  }, [sendMessage]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    sendMessage,
    sendPrompt,
    reconnect: connect,
  };
}
