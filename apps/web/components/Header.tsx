'use client';

import { useNexusStore } from '@/store/agents';
import { useEffect } from 'react';

export function Header() {
  const {
    budget,
    agents,
    isAutoMode,
    setAutoMode,
    connectionStatus,
    setBudget
  } = useNexusStore();

  const activeAgents = agents.filter(a => a.status === 'running').length;
  const budgetPercent = budget.limit > 0 ? (budget.current / budget.limit) * 100 : 0;

  useEffect(() => {
    const fetchBudget = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/budget`);
        if (res.ok) {
          const data = await res.json();
          setBudget({ current: data.current, limit: data.limit });
        }
      } catch {
        // ignore
      }
    };

    fetchBudget();
    const interval = setInterval(fetchBudget, 10000);
    return () => clearInterval(interval);
  }, [setBudget]);

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-white">Nexus</h1>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-red-500'
          }`} />
          <span className="text-xs text-gray-400">
            {connectionStatus === 'connected' ? 'Connected' :
             connectionStatus === 'connecting' ? 'Connecting...' :
             'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-sm">
          <span className="text-gray-400">Active:</span>{' '}
          <span className="text-white font-medium">{activeAgents}</span>
          <span className="text-gray-500"> / {agents.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm">
            <span className={budgetPercent > 80 ? 'text-red-400' : 'text-green-400'}>
              ${budget.current.toFixed(2)}
            </span>
            <span className="text-gray-500"> / ${budget.limit.toFixed(2)}</span>
          </div>
          <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                budgetPercent > 80 ? 'bg-red-500' :
                budgetPercent > 50 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => setAutoMode(!isAutoMode)}
          className={`px-3 py-1 rounded text-sm font-medium transition ${
            isAutoMode
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isAutoMode ? 'Auto' : 'Manual'}
        </button>
      </div>
    </header>
  );
}
