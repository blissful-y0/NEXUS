# Nexus 프로젝트 계획서

> **여러 AI 코딩 에이전트를 단일 웹 UI에서 지휘하는 로컬 오케스트레이션 플랫폼**

---

| 항목 | 내용 |
|------|------|
| **프로젝트명** | Nexus |
| **상태** | Draft |
| **작성일** | 2026-02-23 |
| **작성자** | BLISS |

---

## 1. 문제 정의

### 1.1 현재 상황

AI 코딩 에이전트의 시대가 도래했다. Claude Code, Codex CLI, OpenCode 등 강력한 에이전트들이 등장했지만, 이들을 **동시에 활용**하는 워크플로우는 여전히 원시적이다.

현재의 작업 방식:
- 터미널 탭 3~4개를 열어두고 수동으로 전환
- 각 에이전트의 상태를 머릿속으로 추적
- 한 에이전트가 완료되면 결과를 복사해서 다른 에이전트에게 전달
- 비용은 월말 청구서를 받아야 알 수 있음

### 1.2 고통 포인트

| 문제 | 설명 |
|------|------|
| **컨텍스트 스위칭** | 4개 에이전트 = 4개 터미널 = 끊임없는 탭 전환 |
| **상태 추적 불가** | "저 에이전트 아직 돌고 있나?" → 직접 확인해야 함 |
| **비용 블랙박스** | 실시간 비용 파악 불가, 예산 초과 감지 지연 |
| **실패 감지 지연** | 에이전트가 막혀 있어도 알아차리기 어려움 |
| **수동 조율** | 사용자가 직접 PM 역할 수행 (태스크 분배, 결과 취합) |

### 1.3 해결 목표

**"AI 회사" 구조**를 구현한다.

```
┌─────────────────────────────────────────────┐
│                 사용자 (임원)                │
│          "이 기능 만들어줘"                  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│          오케스트레이터 (Claude Opus)        │
│     태스크 분해 → 에이전트 스폰 → 조율       │
└─────┬───────────┬───────────┬───────────────┘
      │           │           │
      ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Agent A │ │ Agent B │ │ Agent C │
│ Claude  │ │  Codex  │ │OpenCode │
│ Backend │ │Frontend │ │  Test   │
└─────────┘ └─────────┘ └─────────┘
```

사용자는 **PM이 아니라 임원**처럼 행동한다. 고수준 목표만 전달하면, 오케스트레이터가 팀을 구성하고 에이전트들에게 태스크를 위임한다.

---

## 2. 핵심 철학과 운영 모드

### 2.1 핵심 철학

Nexus의 근본적인 질문: **"왜 사람이 AI들 사이에서 PM을 해야 하는가?"**

AI가 충분히 똑똑하다면, AI가 AI를 지휘해야 한다. 사용자는 전략적 의사결정에만 집중하고, 실행은 AI 팀에게 맡긴다.

### 2.2 운영 모드

Nexus는 두 가지 모드를 제공한다. 이 이중 모드 설계는 **자율성과 통제권의 균형**을 위한 것이다.

#### Manual Mode (직접 지휘)

```
유저 → UI → 에이전트 직접 제어
```

- 사용자가 각 에이전트에게 직접 프롬프트 전송
- 에이전트 생성/종료를 수동으로 수행
- 모델 선택, workdir 지정 등 세부 설정 가능
- **언제 사용?**: 실험적 작업, 특정 에이전트 디버깅, 학습 목적

#### Auto Mode (자율 오케스트레이션)

```
유저 → 오케스트레이터 → 오케스트레이터가 에이전트 스폰/지시
```

- 사용자는 오케스트레이터에게만 고수준 목표 전달
- 오케스트레이터가 스스로 팀 구성 (어떤 SDK, 어떤 모델, 몇 명)
- 태스크 분배, 결과 취합, 재시도 판단 모두 자동
- **언제 사용?**: 프로덕션 작업, 복잡한 멀티스텝 태스크

**왜 두 모드가 모두 필요한가?**

완전 자동화는 매력적이지만, 블랙박스가 되면 신뢰가 무너진다. Manual Mode는 "열어서 들여다볼 수 있는 뚜껑"이다. 문제가 생기면 Auto에서 Manual로 전환해 직접 개입할 수 있다.

---

## 3. 기술 스택

### 3.1 스택 선정 원칙

1. **로컬 퍼스트**: 클라우드 의존 없이 개인 머신에서 완결
2. **빠른 프로토타이핑**: 익숙한 도구, 낮은 학습 곡선
3. **타입 안전성**: TypeScript 전면 채용
4. **경량화**: 과도한 추상화 지양, SQLite로 충분

### 3.2 Frontend

| 기술 | 선정 이유 |
|------|----------|
| **Next.js 15 (App Router)** | React 생태계 + SSR/SSG 옵션 + 파일 기반 라우팅 |
| **Tailwind CSS** | 유틸리티 퍼스트, 빠른 스타일링, 일관된 디자인 시스템 |
| **xterm.js** | 브라우저 내 터미널 에뮬레이션 (에이전트 출력 렌더링) |
| **Zustand** | Redux 대비 보일러플레이트 90% 감소, 간결한 상태 관리 |
| **TanStack Query** | 서버 상태 캐싱, 재검증, 로딩/에러 상태 자동 처리 |

**왜 xterm.js인가?**

에이전트의 출력은 ANSI 컬러, 커서 이동 등 터미널 이스케이프 시퀀스를 포함한다. 이를 브라우저에서 충실히 렌더링하려면 전용 터미널 에뮬레이터가 필수다.

### 3.3 Backend

| 기술 | 선정 이유 |
|------|----------|
| **Node.js** | 프론트엔드와 언어 통일, 에이전트 SDK 네이티브 지원 |
| **Fastify** | Express 대비 2~3배 빠른 처리 속도, 스키마 기반 검증 |
| **better-sqlite3** | 동기 API로 간결한 코드, WAL 모드로 동시 읽기 지원 |
| **WebSocket (ws)** | 실시간 스트리밍, 양방향 통신, 네이티브 Node.js 지원 |

**왜 SQLite인가?**

- 로컬 앱에 PostgreSQL/MySQL은 과잉
- 파일 하나 = 데이터베이스 전체 → 백업/이동 용이
- better-sqlite3는 Node.js에서 가장 빠른 SQLite 바인딩

### 3.4 모노레포

```
nexus/
├── apps/
│   ├── web/          # Next.js 프론트엔드
│   └── server/       # Fastify 백엔드
├── packages/
│   ├── adapters/     # SDK 어댑터들
│   ├── shared/       # 공유 타입, 유틸리티
│   └── db/           # 데이터베이스 스키마, 쿼리
├── turbo.json
└── package.json
```

**Turborepo 선정 이유:**
- 패키지간 의존성 자동 해석
- 캐시 기반 빌드로 CI 시간 단축
- Nx 대비 설정 단순

### 3.5 에이전트 SDK 3종

#### Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

- **모델**: Claude 시리즈 (Opus, Sonnet, Haiku)
- **특징**: async iterator 기반 스트리밍
- **장점**: Anthropic의 공식 SDK, 안정적인 도구 호출

#### Codex SDK (`@openai/codex-sdk`)

- **모델**: OpenAI 시리즈 (GPT-4.1, o3, o4-mini 등)
- **특징**: 스레드 기반 대화, 도구 실행
- **장점**: OpenAI 생태계, 다양한 모델 옵션

#### OpenCode SDK (`@opencode-ai/sdk`)

- **모델**: 75+ 모델 지원 (Anthropic, OpenAI, Google, 로컬 등)
- **특징**: 서버/클라이언트 분리 아키텍처
- **장점**: 멀티 프로바이더, 로컬 모델 지원, 유연한 설정

**왜 3개 SDK 모두 지원하는가?**

각 SDK는 고유한 강점이 있다:
- Claude: 장문 컨텍스트, 신중한 추론
- Codex: 빠른 반복, 코드 특화
- OpenCode: 비용 최적화 (저렴한 모델 선택 가능)

오케스트레이터가 태스크 특성에 맞는 SDK/모델 조합을 선택할 수 있어야 진정한 "AI 팀"이 된다.

---

## 4. 아키텍처 설계

### 4.1 UI 레이아웃 — Office 계층 구조

전통적인 사이드바 + 메인 영역 레이아웃을 버리고, **조직도(org-chart) 형태**를 채택한다.

```
┌─────────────────────────────────────────────────────────────┐
│  💰 $12.34 / $50.00                    [Manual] [Auto]      │  ← 헤더: 예산, 모드 전환
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌─────────────────┐                      │
│                    │  🧠 Orchestrator │                      │
│                    │  Claude Opus    │                      │
│                    │  ● RUNNING      │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│              ┌──────────────┼──────────────┐                │
│              │              │              │                │
│              ▼              ▼              ▼                │
│       ┌───────────┐  ┌───────────┐  ┌───────────┐          │
│       │  Backend  │  │  Frontend │  │   Test    │          │
│       │  Claude   │  │   Codex   │  │ OpenCode  │          │
│       │ ● RUNNING │  │  ● IDLE   │  │  ● DONE   │          │
│       └───────────┘  └───────────┘  └───────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**설계 결정:**

1. **사이드바 없음**: 에이전트 관계가 핵심 정보. 사이드바에 숨기면 "회사" 느낌이 사라짐
2. **상단 중앙 오케스트레이터**: 시각적 계층 명확화, 지휘 구조 직관적 표현
3. **에이전트 카드**: 역할, SDK, 모델, 상태를 한눈에 파악
4. **클릭 시 풀스크린 오버레이**: 터미널 출력은 넓은 화면이 필요

### 4.2 Adapter 패턴 — SDK 추상화

3개의 SDK는 각각 다른 API를 가진다. 통일된 인터페이스 없이는 코드가 `if-else` 지옥이 된다.

```typescript
interface AgentAdapter {
  /** 새 태스크 시작 */
  run(prompt: string): AsyncGenerator<StreamChunk>
  
  /** 기존 세션에 추가 프롬프트 */
  resume(prompt: string): AsyncGenerator<StreamChunk>
  
  /** 모델 변경 (IDLE 상태에서만) */
  switchModel(model: string): void
  
  /** 사용 가능한 모델 목록 */
  getAvailableModels(): Promise<string[]>
  
  /** 에이전트 강제 종료 */
  terminate(): Promise<void>
}

type StreamChunk = {
  type: 'text' | 'tool_call' | 'tool_result' | 'usage' | 'done'
  content: string
  usage?: { input_tokens: number; output_tokens: number }
}
```

**구현체:**
- `ClaudeAgentAdapter`: Claude Agent SDK 래핑
- `CodexAdapter`: Codex SDK 래핑  
- `OpenCodeAdapter`: OpenCode SDK 래핑

**왜 AsyncGenerator인가?**

에이전트 출력은 스트리밍된다. Promise는 "완료될 때까지 기다림"이고, AsyncGenerator는 "오는 대로 처리"다. 실시간 터미널 렌더링을 위해 필수.

### 4.3 오케스트레이터 도구 (Orchestrator Tools)

오케스트레이터(Claude Opus)가 Nexus 시스템을 **직접 제어**할 수 있도록 커스텀 도구를 주입한다.

```typescript
const orchestratorTools = [
  {
    name: 'spawn_agent',
    description: '새 에이전트를 생성하고 태스크를 할당',
    parameters: {
      sdk: 'claude | codex | opencode',
      model: 'string',
      role: 'string (예: Backend Developer)',
      task: 'string (수행할 태스크 설명)',
      workdir: 'string (작업 디렉토리)'
    },
    returns: 'agent_id'
  },
  {
    name: 'get_agent_result',
    description: '완료된 에이전트의 결과 조회',
    parameters: { agent_id: 'string' },
    returns: 'result_summary | null (아직 미완료시)'
  },
  {
    name: 'list_agents',
    description: '현재 활성 에이전트 목록과 상태',
    parameters: {},
    returns: 'Agent[]'
  },
  {
    name: 'terminate_agent',
    description: '에이전트 강제 종료',
    parameters: { agent_id: 'string' },
    returns: 'boolean'
  }
]
```

**이 설계의 핵심:**

오케스트레이터는 "Nexus라는 시스템을 조작하는 도구"를 가진 에이전트다. 자체적으로 코드를 실행하는 것이 아니라, `spawn_agent`를 호출해 워커 에이전트를 생성하고, `get_agent_result`로 결과를 수집한다.

### 4.4 에이전트 설정 구조

각 에이전트는 **SDK(엔진)**와 **Model(연료)**을 독립적으로 설정한다.

```typescript
type AgentConfig = {
  sdk: 'claude' | 'codex' | 'opencode'
  model: string  // SDK별 유효한 모델 ID
  role: string
  workdir: string
  systemPrompt?: string
}
```

**모델 동적 조회:**

OpenCode의 경우 런타임에 사용 가능한 모델 목록을 조회할 수 있다:

```typescript
const opencode = new OpenCodeClient()
const providers = await opencode.config.providers()
// → [{ name: 'anthropic', models: [...] }, { name: 'openai', models: [...] }, ...]
```

이 동적 조회 결과를 UI의 모델 선택 드롭다운에 반영한다.

---

## 5. 데이터베이스 스키마

### 5.1 ERD 개요

```
┌──────────────┐       ┌──────────────┐
│   agents     │       │    tasks     │
├──────────────┤       ├──────────────┤
│ id (PK)      │◄──────│ agent_id(FK) │
│ role         │       │ id (PK)      │
│ sdk          │       │ title        │
│ model        │       │ prompt       │
│ workdir      │       │ status       │
│ spawned_by   │       │ result_sum   │
│ status       │       │ retry_count  │
│ created_at   │       │ started_at   │
└──────────────┘       │ completed_at │
       │               └──────────────┘
       │                      │
       ▼                      ▼
┌──────────────┐       ┌──────────────┐
│terminal_logs │       │    costs     │
├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │
│ agent_id(FK) │       │ agent_id(FK) │
│ content      │       │ task_id(FK)  │
│ logged_at    │       │ input_tokens │
└──────────────┘       │ output_tokens│
                       │ cost_usd     │
                       │ logged_at    │
                       └──────────────┘
```

### 5.2 테이블 정의

```sql
-- 에이전트 (워커 + 오케스트레이터 모두 포함)
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  sdk TEXT NOT NULL CHECK (sdk IN ('claude', 'codex', 'opencode')),
  model TEXT NOT NULL,
  workdir TEXT NOT NULL,
  spawned_by TEXT REFERENCES agents(id),  -- NULL이면 수동 생성
  status TEXT NOT NULL DEFAULT 'IDLE' 
    CHECK (status IN ('IDLE', 'RUNNING', 'DONE', 'FAILED', 'SPAWNING')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 태스크 (에이전트에게 할당된 작업 단위)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')),
  result_summary TEXT,
  started_at TEXT,
  completed_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

-- 비용 추적
CREATE TABLE costs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 터미널 출력 로그 (청크 단위 저장)
CREATE TABLE terminal_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 인덱스
CREATE INDEX idx_tasks_agent ON tasks(agent_id);
CREATE INDEX idx_costs_agent ON costs(agent_id);
CREATE INDEX idx_logs_agent ON terminal_logs(agent_id);
```

### 5.3 설계 결정

**`spawned_by` 컬럼:**

- `NULL`: 사용자가 Manual Mode에서 직접 생성
- `orchestrator_id`: Auto Mode에서 오케스트레이터가 `spawn_agent`로 생성

이 구분으로 "누가 이 에이전트를 만들었나"를 추적할 수 있고, 디버깅과 감사(audit)에 유용하다.

**`terminal_logs` 분리:**

에이전트 출력은 수천~수만 줄이 될 수 있다. `agents` 테이블에 넣으면 쿼리 성능이 급격히 저하된다. 별도 테이블 + 스트리밍 저장으로 해결.

---

## 6. 핵심 기술 문제 및 해결

### 6.1 완료 감지

**문제:** 에이전트가 "언제 완료되었는지" 신뢰성 있게 감지해야 한다.

**솔루션: 3단계 검증**

```
┌─────────────────────────────────────────┐
│ 1차: SDK 이터레이터 종료                 │
│    → AsyncGenerator가 done: true 반환   │
├─────────────────────────────────────────┤
│ 2차: [TASK_COMPLETE] 마커               │
│    → 시스템 프롬프트에 출력 강제 지시    │
├─────────────────────────────────────────┤
│ 3차: 5분 무출력 타임아웃                 │
│    → Fallback, FAILED 처리              │
└─────────────────────────────────────────┘
```

**시스템 프롬프트 예시:**

```
When you complete the assigned task, output exactly:
[TASK_COMPLETE]

This signals the orchestration system that you have finished.
```

### 6.2 에이전트간 컨텍스트 전달

**문제:** Agent A의 결과를 Agent B가 알아야 할 때가 있다.

**Phase 1 솔루션: 파일시스템 공유**

- 모든 에이전트가 같은 `workdir`에서 작업
- Agent A가 파일 생성 → Agent B가 파일 읽기
- 가장 단순하고 에이전트 친화적 (파일 읽기는 모든 에이전트가 잘함)

**Phase 2 솔루션: 명시적 결과 전달**

```typescript
// 오케스트레이터 로직 (의사 코드)
const backendResult = await getAgentResult(backendAgentId)
await spawnAgent({
  sdk: 'codex',
  role: 'Frontend Developer',
  task: `
    Backend API가 완성되었습니다:
    ${backendResult.summary}
    
    이 API를 사용하는 React 컴포넌트를 만드세요.
  `
})
```

오케스트레이터가 `get_agent_result`로 결과를 수집하고, 다음 에이전트의 프롬프트에 prepend한다.

### 6.3 비용 추적

**SDK별 토큰 정보 위치:**

| SDK | 위치 |
|-----|------|
| Claude Agent SDK | 스트림 메시지의 `usage` 필드 |
| Codex SDK | `result.usage` 객체 |
| OpenCode | 세션 메타데이터 파싱 |

**비용 계산 로직:**

```typescript
function calculateCost(sdk: string, model: string, usage: Usage): number {
  const pricing = PRICING_TABLE[sdk][model]
  return (
    (usage.input_tokens / 1_000_000) * pricing.inputPerMillion +
    (usage.output_tokens / 1_000_000) * pricing.outputPerMillion
  )
}
```

**실시간 표시:**

헤더에 `$12.34 / $50.00` 형태로 현재 비용 / 예산 표시. 예산의 80% 도달 시 경고, 100% 도달 시 Auto Mode 자동 중지.

---

## 7. 에이전트 상태 정의

| 상태 | 색상 | 의미 |
|------|------|------|
| **IDLE** | `#4ade80` (연녹색) | 대기 중, 새 태스크 받을 준비 완료 |
| **SPAWNING** | `#fbbf24` (노랑) | 오케스트레이터가 스폰 중 (SDK 초기화) |
| **RUNNING** | `#60a5fa` (파랑) | 태스크 실행 중, 스트리밍 출력 활성 |
| **DONE** | `#a78bfa` (보라) | 태스크 성공적 완료 |
| **FAILED** | `#f87171` (빨강) | 에러 발생 또는 타임아웃 |

**상태 전이 다이어그램:**

```
          spawn_agent()           run()
              │                     │
              ▼                     ▼
┌────────┐   ┌──────────┐   ┌─────────┐
│ (생성) │──▶│ SPAWNING │──▶│  IDLE   │◄─────┐
└────────┘   └──────────┘   └────┬────┘      │
                                 │           │
                            run()│           │resume()
                                 ▼           │
                            ┌─────────┐      │
                            │ RUNNING │──────┘
                            └────┬────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                success                    error
                    │                         │
                    ▼                         ▼
               ┌────────┐               ┌────────┐
               │  DONE  │               │ FAILED │
               └────────┘               └────────┘
```

---

## 8. MVP 로드맵

### Phase 1: 핵심 뼈대 (1주)

**목표:** 단일 에이전트를 웹 UI에서 제어할 수 있는 최소 기능

| 태스크 | 설명 | 예상 시간 |
|--------|------|----------|
| 모노레포 셋업 | Turborepo + apps/web, apps/server | 2h |
| DB 스키마 | SQLite + better-sqlite3 + 마이그레이션 | 2h |
| Claude Adapter | Claude Agent SDK 래핑, AsyncGenerator 구현 | 4h |
| WebSocket 서버 | Fastify + ws, 스트리밍 프로토콜 정의 | 3h |
| 터미널 렌더링 | xterm.js + 피트애드온, 스트림 연결 | 4h |
| Office UI 기본 | 오케스트레이터 + 워커 카드 레이아웃 | 4h |
| 에이전트 오버레이 | 카드 클릭 → 풀스크린 터미널 | 3h |

**Phase 1 완료 기준:**
- [x] 웹 UI에서 Claude 에이전트 생성
- [x] 프롬프트 전송 → 스트리밍 응답 터미널에 표시
- [x] 에이전트 상태 변화 실시간 반영

### Phase 2: 다중 에이전트 + 자율 오케스트레이션 (2주차)

**목표:** Auto Mode 동작, 오케스트레이터가 팀을 지휘

| 태스크 | 설명 | 예상 시간 |
|--------|------|----------|
| Codex Adapter | Codex SDK 래핑 | 4h |
| OpenCode Adapter | OpenCode SDK 래핑, 모델 동적 조회 | 4h |
| 오케스트레이터 도구 | spawn_agent, get_agent_result 등 구현 | 6h |
| Auto Mode 흐름 | 오케스트레이터 → 워커 스폰 → 결과 수집 | 8h |
| 비용 추적 | SDK별 usage 파싱, 실시간 합산 | 4h |
| 예산 UI | 헤더 비용 표시, 경고/중지 로직 | 2h |
| 완료 감지 | 3단계 검증 구현 | 3h |
| 재시도 로직 | FAILED → 재시도 (최대 2회) | 2h |

**Phase 2 완료 기준:**
- [x] 3개 SDK 모두 동작
- [x] Auto Mode: "이 기능 만들어줘" → 오케스트레이터가 알아서 팀 구성
- [x] 실시간 비용 추적, 예산 초과 경고

### Phase 3: 고도화 (이후)

| 기능 | 설명 |
|------|------|
| 의존성 체인 | Agent A 완료 → 자동으로 Agent B에 컨텍스트 전달 |
| 태스크 DAG | 시각적 의존성 그래프, 진행 상황 표시 |
| 모델 핫스왑 | IDLE 상태에서 모델 런타임 변경 |
| SOLARIS 연계 | GM 에이전트와 Nexus 연동 (선택적) |

---

## 9. Won't Have (초기 제외)

명확한 스코프 정의를 위해, MVP에서 **의도적으로 제외**하는 기능:

| 제외 항목 | 이유 |
|----------|------|
| **클라우드 배포** | 로컬 퍼스트 철학. 보안, 비용, 복잡도 증가 |
| **멀티유저 / 팀 협업** | 개인 도구로 시작. 인증/권한 시스템은 나중에 |
| **에이전트 자율 크론** | 스케줄링은 별도 시스템 (cron, n8n 등) 영역 |
| **Slack/Discord 알림** | 웹 UI 알림으로 충분. 외부 연동은 Phase 3+ |
| **멀티 워크스페이스** | 단일 프로젝트 집중. 워크스페이스 전환은 나중에 |

**철학:** 작게 시작하고, 실제 사용하면서 필요한 기능을 추가한다.

---

## 10. 레퍼런스

### beewee22 (@beewee22) — "AI 회사" 시스템

Twitter에서 화제가 된 개인 AI 오케스트레이션 시스템.

**핵심 참고 포인트:**
- 비용 추적 UI: `$25.09 / $80.00` 형태의 예산 표시
- CRITICAL 알림: 긴급 상황 시 시각적 경고
- 에이전트 그리드 뷰: 여러 에이전트 상태를 한눈에
- "회사" 메타포: AI를 직원처럼 다루는 UX

**Nexus에 적용:**
- 헤더 비용 표시 형식 차용
- 그리드 대신 org-chart로 계층 강조
- CRITICAL 상태 → FAILED 색상 강조

### Fleet Shell — 역할 기반 팀 구조

AI 에이전트들에게 명확한 역할(Role)을 부여하는 개념.

**핵심 참고 포인트:**
- Backend, Frontend, QA 등 역할 분리
- 역할별 시스템 프롬프트 특화
- 팀 구성의 유연성

**Nexus에 적용:**
- `role` 필드로 에이전트 역할 명시
- 오케스트레이터가 태스크 특성에 맞는 역할 조합 결정
- UI에서 역할별 아이콘/색상 구분

---

## 11. 부록: 주요 결정 요약

| 결정 | 선택 | 이유 |
|------|------|------|
| UI 레이아웃 | Org-chart (사이드바 없음) | 계층 구조가 핵심 정보 |
| 상태 관리 | Zustand | Redux 대비 간결함 |
| 데이터베이스 | SQLite | 로컬 앱에 최적 |
| SDK 추상화 | Adapter 패턴 | 3개 SDK 통일 인터페이스 |
| 완료 감지 | 3단계 검증 | 신뢰성 확보 |
| 컨텍스트 전달 | 파일시스템 공유 (Phase 1) | 가장 단순하고 범용적 |
| 운영 모드 | Manual + Auto | 자율성과 통제권 균형 |

---

## 12. 다음 단계

1. **저장소 생성**: `nexus` 모노레포 초기화
2. **Phase 1 착수**: Turborepo + Claude Adapter부터 시작
3. **일일 진행 기록**: 이 문서의 로드맵 체크리스트 업데이트

---

*이 문서는 프로젝트 진행에 따라 지속적으로 업데이트됩니다.*
