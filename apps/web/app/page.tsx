'use client';

import { useEffect, useState } from 'react';
import { useNexusStore } from '@/store/agents';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Header } from '@/components/Header';
import { OrchestratorCard } from '@/components/OrchestratorCard';
import { AgentCard } from '@/components/AgentCard';
import { TerminalOverlay } from '@/components/TerminalOverlay';
import { TaskInput } from '@/components/TaskInput';
import { CreateAgentModal } from '@/components/CreateAgentModal';

export default function Dashboard() {
  const { agents, setAgents, selectedAgentId } = useNexusStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useWebSocket();

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/agents`);
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents);
        }
      } catch {
        // server not available
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [setAgents]);

  const orchestrator = agents.find(a => a.isOrchestrator);
  const workers = agents.filter(a => !a.isOrchestrator);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Header onCreateAgent={() => setShowCreateModal(true)} />

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {orchestrator && (
          <div className="max-w-2xl mx-auto">
            <OrchestratorCard agent={orchestrator} />
          </div>
        )}

        {workers.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-300 mb-4">
              워커 에이전트
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {workers.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        )}

        {agents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
            <p className="text-lg">에이전트가 없습니다.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              + 에이전트 생성
            </button>
          </div>
        )}
      </main>

      <TaskInput />

      {selectedAgentId && <TerminalOverlay />}
      {showCreateModal && <CreateAgentModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
