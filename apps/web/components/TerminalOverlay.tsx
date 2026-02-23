'use client';

import { useNexusStore } from '@/store/agents';
import dynamic from 'next/dynamic';

const TerminalComponent = dynamic(
  () => import('./Terminal').then(mod => mod.Terminal),
  { ssr: false }
);

export function TerminalOverlay() {
  const { selectedAgentId, agents, selectAgent, terminalBuffers } = useNexusStore();
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  if (!selectedAgent) return null;

  const buffer = terminalBuffers.get(selectedAgent.id);
  const initialContent = buffer?.chunks.join('') || '';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
      <div className="w-full max-w-5xl h-[80vh] bg-gray-900 rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="font-medium text-white">{selectedAgent.name}</span>
            <span className="text-sm text-gray-400">({selectedAgent.sdk}/{selectedAgent.model.split('/').pop()})</span>
          </div>
          <button
            onClick={() => selectAgent(null)}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 p-2">
          <TerminalComponent
            agentId={selectedAgent.id}
            initialContent={initialContent}
          />
        </div>
      </div>
    </div>
  );
}
