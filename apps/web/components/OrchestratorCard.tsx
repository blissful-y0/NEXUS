'use client';

import { useNexusStore } from '@/store/agents';
import type { Agent } from '@nexus/shared';

interface Props {
  agent: Agent;
}

const statusColors: Record<string, string> = {
  idle: 'bg-gray-500',
  running: 'bg-blue-500 animate-pulse',
  paused: 'bg-yellow-500',
  completed: 'bg-green-500',
  error: 'bg-red-500',
  terminated: 'bg-gray-700',
};

export function OrchestratorCard({ agent }: Props) {
  const { selectAgent, selectedAgentId } = useNexusStore();
  const isSelected = selectedAgentId === agent.id;

  return (
    <div
      onClick={() => selectAgent(agent.id)}
      className={`
        p-6 rounded-xl cursor-pointer transition-all
        bg-gradient-to-br from-purple-900/50 to-indigo-900/50
        border-2 ${isSelected ? 'border-purple-500' : 'border-purple-800'}
        hover:border-purple-600 hover:shadow-lg hover:shadow-purple-500/20
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">{agent.name}</h2>
          </div>
          <p className="text-purple-300 text-sm mt-1">{agent.role}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${statusColors[agent.status]}`} />
          <span className="text-sm text-gray-300 capitalize">{agent.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-400">SDK:</span>{' '}
          <span className="text-white font-medium">{agent.sdk}</span>
        </div>
        <div>
          <span className="text-gray-400">Model:</span>{' '}
          <span className="text-white font-medium">{agent.model.split('/').pop()}</span>
        </div>
      </div>

      {agent.currentTask && (
        <div className="mt-4 p-3 bg-black/30 rounded-lg">
          <p className="text-xs text-gray-400">Current Task:</p>
          <p className="text-sm text-white truncate">{agent.currentTask}</p>
        </div>
      )}
    </div>
  );
}
