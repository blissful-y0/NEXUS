'use client';

import { useState, useEffect } from 'react';
import { useNexusStore } from '@/store/agents';
import type { AgentSDK } from '@nexus/shared';

interface Props {
  onClose: () => void;
}

const SDK_OPTIONS: { value: AgentSDK; label: string; color: string }[] = [
  { value: 'claude', label: 'Claude Code', color: 'bg-orange-500' },
  { value: 'codex', label: 'Codex CLI', color: 'bg-green-500' },
  { value: 'opencode', label: 'OpenCode', color: 'bg-blue-500' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function CreateAgentModal({ onClose }: Props) {
  const { addAgent } = useNexusStore();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [sdk, setSdk] = useState<AgentSDK>('claude');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [isOrchestrator, setIsOrchestrator] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchModels = async () => {
      setModelsLoading(true);
      setModels([]);
      setModel('');
      try {
        const res = await fetch(`${API_URL}/models/${sdk}`);
        if (res.ok) {
          const data = await res.json();
          setModels(data.models);
          setModel(data.models[0] ?? '');
        }
      } catch {
        // 서버 미응답 시 폴백 없음
      } finally {
        setModelsLoading(false);
      }
    };
    fetchModels();
  }, [sdk]);

  const handleSdkChange = (newSdk: AgentSDK) => {
    setSdk(newSdk);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, sdk, model, isOrchestrator, systemPrompt: systemPrompt || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '생성 실패');
      }

      const data = await res.json();
      addAgent(data.agent);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">새 에이전트 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: Alpha Worker"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">역할</label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="예: 백엔드 개발, UI 구현, 코드 리뷰..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">SDK</label>
            <div className="flex gap-2">
              {SDK_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSdkChange(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${
                    sdk === opt.value
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${opt.color} mr-1.5`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              모델
              {modelsLoading && <span className="ml-2 text-xs text-gray-500">불러오는 중...</span>}
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              disabled={modelsLoading || models.length === 0}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
            >
              {models.length === 0 && !modelsLoading && (
                <option value="">모델을 불러올 수 없습니다</option>
              )}
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">시스템 프롬프트 (선택)</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="기본 역할 지시사항을 입력하세요..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isOrchestrator}
              onChange={e => setIsOrchestrator(e.target.checked)}
              className="w-4 h-4 rounded accent-purple-500"
            />
            <span className="text-sm text-gray-300">오케스트레이터로 설정</span>
          </label>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !role.trim() || !model}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              {loading ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
