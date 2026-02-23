'use client';

import { useNexusStore } from '@/store/agents';
import type { Agent } from '@nexus/shared';

interface Props {
  agent: Agent;
}

const sdkColors: Record<string, string> = {
  claude: 'bg-orange-500',
  codex: 'bg-green-500',
  opencode: 'bg-blue-500',
};

const statusColors: Record<string, string> = {
  idle: 'bg-gray-500',
  running: 'bg-blue-500 animate-pulse',
  paused: 'bg-yellow-500',
  completed: 'bg-green-500',
  error: 'bg-red-500',
  terminated: 'bg-gray-700',
};

const statusLabels: Record<string, string> = {
  idle: '대기',
  running: '실행 중',
  paused: '일시정지',
  completed: '완료',
  error: '오류',
  terminated: '종료',
};

export function AgentCard({ agent }: Props) {
  const { selectAgent, selectedAgentId } = useNexusStore();
  const isSelected = selectedAgentId === agent.id;

  return (
    <div
      onClick={() => selectAgent(agent.id)}
      className={`
        p-4 rounded-lg cursor-pointer transition-all
        bg-gray-800 border ${isSelected ? 'border-blue-500' : 'border-gray-700'}
        hover:border-gray-600
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${sdkColors[agent.sdk]}`}>
            {agent.sdk.toUpperCase()}
          </span>
          <h3 className="font-medium text-white">{agent.name}</h3>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`} />
          <span className="text-xs text-gray-400">{statusLabels[agent.status] ?? agent.status}</span>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-2">{agent.role}</p>

      <div className="text-xs text-gray-500">
        {agent.model.split('/').pop()}
      </div>

      {agent.currentTask && (
        <div className="mt-3 p-2 bg-gray-900 rounded text-xs text-gray-300 truncate">
          {agent.currentTask}
        </div>
      )}
    </div>
  );
}
