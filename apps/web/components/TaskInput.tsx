'use client';

import { useState } from 'react';
import { useNexusStore } from '@/store/agents';
import { useWebSocket } from '@/hooks/useWebSocket';

export function TaskInput() {
  const [prompt, setPrompt] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const { agents, isAutoMode } = useNexusStore();
  const { sendPrompt, isConnected } = useWebSocket();

  const availableAgents = agents.filter(a =>
    a.status === 'idle' || a.status === 'completed'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    if (isAutoMode) {
      const orchestrator = agents.find(a => a.isOrchestrator);
      if (orchestrator) {
        sendPrompt(orchestrator.id, prompt);
      }
    } else if (selectedAgentId) {
      sendPrompt(selectedAgentId, prompt);
    }

    setPrompt('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 p-4 bg-gray-800 border-t border-gray-700"
    >
      {!isAutoMode && (
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">에이전트 선택...</option>
          {availableAgents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.sdk})
            </option>
          ))}
        </select>
      )}

      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={isAutoMode ? "오케스트레이터에게 목표를 입력하세요..." : "에이전트에게 전달할 프롬프트를 입력하세요..."}
        className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
      />

      <button
        type="submit"
        disabled={!isConnected || !prompt.trim() || (!isAutoMode && !selectedAgentId)}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        전송
      </button>
    </form>
  );
}
