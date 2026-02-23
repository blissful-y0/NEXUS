'use client';

import { create } from 'zustand';
import type { Agent, AgentStatus, Budget } from '@nexus/shared';

interface TerminalBuffer {
  chunks: string[];
  maxSize: number;
}

interface NexusStore {
  agents: Agent[];
  selectedAgentId: string | null;
  budget: Budget;
  terminalBuffers: Map<string, TerminalBuffer>;
  isAutoMode: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';

  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  setAgentStatus: (id: string, status: AgentStatus) => void;

  selectAgent: (id: string | null) => void;

  appendTerminalChunk: (agentId: string, chunk: string) => void;
  clearTerminalBuffer: (agentId: string) => void;

  setBudget: (budget: Budget) => void;
  setAutoMode: (enabled: boolean) => void;
  setConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

export const useNexusStore = create<NexusStore>((set) => ({
  agents: [],
  selectedAgentId: null,
  budget: { current: 0, limit: 50 },
  terminalBuffers: new Map(),
  isAutoMode: false,
  connectionStatus: 'disconnected',

  setAgents: (agents) => set({ agents }),

  addAgent: (agent) => set((state) => ({
    agents: [...state.agents, agent],
  })),

  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    ),
  })),

  removeAgent: (id) => set((state) => ({
    agents: state.agents.filter((a) => a.id !== id),
    selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
  })),

  setAgentStatus: (id, status) => set((state) => ({
    agents: state.agents.map((a) =>
      a.id === id ? { ...a, status } : a
    ),
  })),

  selectAgent: (id) => set({ selectedAgentId: id }),

  appendTerminalChunk: (agentId, chunk) => set((state) => {
    const buffers = new Map(state.terminalBuffers);
    const existing = buffers.get(agentId) || { chunks: [], maxSize: 10000 };

    const newChunks = [...existing.chunks, chunk];
    const trimmed = newChunks.length > existing.maxSize
      ? newChunks.slice(-existing.maxSize)
      : newChunks;

    buffers.set(agentId, { ...existing, chunks: trimmed });
    return { terminalBuffers: buffers };
  }),

  clearTerminalBuffer: (agentId) => set((state) => {
    const buffers = new Map(state.terminalBuffers);
    buffers.delete(agentId);
    return { terminalBuffers: buffers };
  }),

  setBudget: (budget) => set({ budget }),
  setAutoMode: (enabled) => set({ isAutoMode: enabled }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
