# Nexus Phase 1 — 오케스트레이터 지시서

당신은 Nexus 프로젝트의 오케스트레이터입니다.
**DEV_GUIDE.md**를 꼼꼼히 읽고, 아래 순서대로 Phase 1을 완전히 구현하세요.

## 구현 순서

### Step 1: Turborepo 모노레포 셋업
- `pnpm-workspace.yaml` — workspace 패키지 목록
- `turbo.json` — build/dev/lint pipeline
- 루트 `package.json` — workspace 루트, scripts (dev, build, lint)
- `.env.example` — 필요한 환경변수 목록
- `.gitignore` — node_modules, .env, .next, dist 등

### Step 2: packages/shared
- `packages/shared/package.json`
- `packages/shared/src/types.ts` — Agent, Task, AgentStatus, StreamChunk, CostEntry, AgentConfig 타입 전체

### Step 3: packages/db
- `packages/db/package.json` (better-sqlite3 의존성)
- `packages/db/src/schema.sql` — agents, tasks, costs, terminal_logs 테이블 + 인덱스
- `packages/db/src/index.ts` — DB 연결(~/.nexus/nexus.db), 스키마 실행, 타입 안전한 쿼리 함수 전체

### Step 4: packages/adapters
- `packages/adapters/package.json` (@anthropic-ai/claude-agent-sdk 의존성)
- `packages/adapters/src/types.ts` — AgentAdapter 인터페이스 + StreamChunk
- `packages/adapters/src/claude.ts` — ClaudeAgentAdapter 완전 구현
  - query() async iterator → StreamChunk 변환
  - 기본 allowedTools: ["Read", "Edit", "Bash"]
  - 시스템 프롬프트에 "[TASK_COMPLETE]" 지시 포함
  - getAvailableModels(): claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5
- `packages/adapters/src/index.ts` — export all

### Step 5: apps/server
- `apps/server/package.json` (fastify, @fastify/websocket, ws, better-sqlite3, zod, uuid)
- `apps/server/src/index.ts` — Fastify 서버 진입점, 플러그인 등록, 라우트 마운트
- `apps/server/src/db/index.ts` — packages/db 래핑, 서버용 DB 싱글톤
- `apps/server/src/agents/manager.ts` — AgentManager 클래스
  - adapters Map<agentId, AgentAdapter>
  - spawnAgent(config): Promise<string>
  - runTask(agentId, taskId, prompt): Promise<void> — 스트리밍 → WebSocket 브로드캐스트
  - terminateAgent(agentId): Promise<void>
  - getStatus(agentId): AgentStatus
- `apps/server/src/ws/handler.ts` — WebSocket 연결 관리
  - /ws/agent/:id/terminal → 해당 에이전트 스트림 구독
  - /ws/dashboard → 전체 상태 브로드캐스트
  - 클라이언트 → 서버: { type: 'prompt', agentId, text }
- `apps/server/src/routes/agents.ts` — POST/GET/DELETE /agents
- `apps/server/src/routes/tasks.ts` — POST/GET /tasks, POST /tasks/:id/retry
- `apps/server/src/routes/budget.ts` — GET /budget

### Step 6: apps/web 기본 구조
- `apps/web/package.json` (next, react, tailwindcss, xterm, zustand, @tanstack/react-query, ws)
- `apps/web/app/layout.tsx` — 루트 레이아웃, QueryClientProvider, 전역 스타일
- `apps/web/app/page.tsx` — Office 계층 레이아웃 기본 구조
- `apps/web/store/agents.ts` — Zustand store (agents, selectedAgentId, budget, terminal chunks)
- `apps/web/hooks/useWebSocket.ts` — WebSocket 연결 관리, 재연결 로직, 메시지 → store 업데이트
- `apps/web/tailwind.config.ts` — Nexus 색상 팔레트 (IDLE/RUNNING/DONE/FAILED)
- `apps/web/next.config.ts`

## 주의사항
- pnpm 사용 (npm 아님)
- TypeScript strict mode
- 각 패키지 간 의존성 올바르게 설정 (e.g., apps/server은 packages/adapters, packages/db 참조)
- 실제 동작하는 코드 (의사코드 금지)
- DEV_GUIDE.md의 코드 스니펫을 적극 활용

## 완료 후
모든 파일 생성이 끝나면 아래를 실행하라:
```
node /Users/bliss/.openclaw/source/openclaw.mjs system event --text "Nexus Phase 1 완료: 모노레포 구조 + server + web 기본 구조 생성됨" --mode now
```
