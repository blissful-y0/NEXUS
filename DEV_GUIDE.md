# Nexus Development Guide

> **작성일**: 2026-02-23  
> **상태**: Draft  
> **기반 문서**: Nexus-Project-Plan.md  
> **목적**: 개발자가 즉시 코딩을 시작할 수 있는 실행 가이드

---

## 목차

1. [Prerequisites](#1-prerequisites)
2. [레포지토리 초기 셋업](#2-레포지토리-초기-셋업)
3. [패키지 구조 상세](#3-패키지-구조-상세)
4. [packages/adapters 구현](#4-packagesadapters-구현)
5. [apps/server 구현](#5-appsserver-구현)
6. [apps/web 구현](#6-appsweb-구현)
7. [환경 변수](#7-환경-변수)
8. [개발 서버 실행](#8-개발-서버-실행)
9. [Phase별 구현 순서](#9-phase별-구현-순서)
10. [자주 마주치는 문제 & 해결](#10-자주-마주치는-문제--해결)

---

## 1. Prerequisites

### Node.js 버전

```bash
# Node.js 22+ 필수
node --version  # v22.0.0 이상

# nvm 사용 시
nvm install 22
nvm use 22
```

### pnpm 설치

```bash
# corepack 활성화 (Node.js 16.13+ 내장)
corepack enable

# pnpm 설치 확인
pnpm --version  # 9.0.0 이상 권장
```

### API 키 준비

| 서비스 | 환경변수 | 발급처 |
|--------|----------|--------|
| Anthropic | `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com |

### CLI 도구 설치 확인

```bash
# Claude Code CLI (claude-agent-sdk 사용 시 필요)
claude --version

# Codex CLI (선택적 - SDK만 사용 가능)
codex --version

# OpenCode CLI
opencode --version
```

> **체크포인트**: `node --version`이 22+, `pnpm --version`이 9+면 다음 단계로.

---

## 2. 레포지토리 초기 셋업

### 2.1 프로젝트 생성

```bash
mkdir nexus && cd nexus
pnpm init

# Turborepo 설치
pnpm add -D turbo typescript @types/node
```

### 2.2 루트 package.json

```json
{
  "name": "nexus",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "clean": "turbo clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  }
}
```

### 2.3 pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 2.4 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 2.5 디렉토리 구조 생성

```bash
# apps 생성
mkdir -p apps/web apps/server

# packages 생성
mkdir -p packages/adapters/src
mkdir -p packages/shared/src
mkdir -p packages/db/src

# Next.js 15 앱 생성
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack
cd ../..

# Fastify 서버 셋업
cd apps/server
pnpm init
pnpm add fastify @fastify/websocket @fastify/cors better-sqlite3 dotenv nanoid
pnpm add -D @types/better-sqlite3 tsx
cd ../..

# packages 초기화
cd packages/adapters && pnpm init && cd ../..
cd packages/shared && pnpm init && cd ../..
cd packages/db && pnpm init && cd ../..
```

### 2.6 packages/shared/package.json

```json
{
  "name": "@nexus/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

### 2.7 packages/adapters/package.json

```json
{
  "name": "@nexus/adapters",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@anthropic-ai/claude-code": "^1.0.0",
    "@openai/codex": "^1.0.0",
    "@nexus/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

### 2.8 packages/db/package.json

```json
{
  "name": "@nexus/db",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "@nexus/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "typescript": "^5.7.0"
  }
}
```

### 2.9 의존성 설치

```bash
# 루트에서 전체 의존성 설치
pnpm install
```

> **체크포인트**: `pnpm install` 성공, `apps/web`, `apps/server`, `packages/*` 구조 확인.

---

## 3. 패키지 구조 상세

```
nexus/
├── apps/
│   ├── web/                      # Next.js 15 (App Router)
│   │   ├── app/
│   │   │   ├── page.tsx          # 메인 대시보드
│   │   │   ├── layout.tsx        # 루트 레이아웃
│   │   │   └── globals.css       # Tailwind 스타일
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── OrchestratorCard.tsx
│   │   │   ├── AgentCard.tsx
│   │   │   ├── TerminalOverlay.tsx
│   │   │   └── TaskInput.tsx
│   │   ├── store/
│   │   │   └── agents.ts         # Zustand store
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── server/                   # Fastify
│       ├── src/
│       │   ├── index.ts          # 서버 진입점
│       │   ├── db/
│       │   │   ├── schema.ts     # SQLite 초기화
│       │   │   └── queries.ts    # 쿼리 함수
│       │   ├── agents/
│       │   │   ├── manager.ts    # AgentManager
│       │   │   └── orchestrator.ts
│       │   ├── ws/
│       │   │   └── handler.ts    # WebSocket 핸들러
│       │   └── routes/
│       │       ├── agents.ts
│       │       └── tasks.ts
│       └── package.json
│
├── packages/
│   ├── adapters/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts          # AgentAdapter 인터페이스
│   │   │   ├── claude.ts         # ClaudeAdapter
│   │   │   ├── codex.ts          # CodexAdapter
│   │   │   └── opencode.ts       # OpenCodeAdapter
│   │   └── package.json
│   │
│   ├── shared/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── types.ts          # 공유 타입
│   │   └── package.json
│   │
│   └── db/
│       ├── src/
│       │   ├── index.ts
│       │   └── schema.sql
│       └── package.json
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── .gitignore
```

---

## 4. packages/adapters 구현

### 4.1 packages/shared/src/types.ts

```typescript
// packages/shared/src/types.ts

export type AgentStatus = 
  | 'idle' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'error' 
  | 'terminated';

export type AgentSDK = 'claude' | 'codex' | 'opencode';

export interface Agent {
  id: string;
  name: string;
  role: string;
  sdk: AgentSDK;
  model: string;
  status: AgentStatus;
  currentTask: string | null;
  isOrchestrator: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfig {
  name: string;
  role: string;
  sdk: AgentSDK;
  model: string;
  isOrchestrator?: boolean;
  systemPrompt?: string;
}

export interface Task {
  id: string;
  agentId: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultSummary: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CostEntry {
  agentId: string;
  taskId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
}

export interface Budget {
  current: number;
  limit: number;
}

// WebSocket 메시지 타입
export interface WsMessage {
  type: 'chunk' | 'status' | 'prompt' | 'error';
  agentId: string;
  data?: string;
  status?: AgentStatus;
  error?: string;
}
```

### 4.2 packages/shared/src/index.ts

```typescript
// packages/shared/src/index.ts
export * from './types';
```

### 4.3 packages/adapters/src/types.ts

```typescript
// packages/adapters/src/types.ts

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'usage' | 'done' | 'error';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AdapterConfig {
  model: string;
  systemPrompt?: string;
  workingDirectory?: string;
  allowedTools?: string[];
}

export interface AgentAdapter {
  /** 새 태스크 실행 */
  run(prompt: string): AsyncGenerator<StreamChunk>;
  
  /** 기존 컨텍스트에서 재개 */
  resume(prompt: string): AsyncGenerator<StreamChunk>;
  
  /** 모델 변경 */
  switchModel(model: string): void;
  
  /** 사용 가능한 모델 목록 */
  getAvailableModels(): Promise<string[]>;
  
  /** 에이전트 종료 */
  terminate(): Promise<void>;
  
  /** 현재 모델 */
  readonly currentModel: string;
}
```

### 4.4 packages/adapters/src/claude.ts

```typescript
// packages/adapters/src/claude.ts

import { spawn, ChildProcess } from 'child_process';
import { AgentAdapter, AdapterConfig, StreamChunk } from './types';

const CLAUDE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-haiku-20241022',
];

const DEFAULT_SYSTEM_PROMPT = `You are a skilled software engineer working on a coding task.
When you complete the task successfully, output exactly: [TASK_COMPLETE]
If you encounter an unrecoverable error, output exactly: [TASK_FAILED]`;

export class ClaudeAdapter implements AgentAdapter {
  private config: AdapterConfig;
  private process: ChildProcess | null = null;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(config: AdapterConfig) {
    this.config = {
      ...config,
      model: config.model || 'claude-sonnet-4-20250514',
      systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      allowedTools: config.allowedTools || ['Read', 'Edit', 'Bash', 'Write'],
    };
  }

  get currentModel(): string {
    return this.config.model;
  }

  switchModel(model: string): void {
    if (!CLAUDE_MODELS.includes(model)) {
      throw new Error(`Invalid model: ${model}. Available: ${CLAUDE_MODELS.join(', ')}`);
    }
    this.config.model = model;
  }

  async getAvailableModels(): Promise<string[]> {
    return CLAUDE_MODELS;
  }

  async *run(prompt: string): AsyncGenerator<StreamChunk> {
    // 새 대화 시작
    this.conversationHistory = [];
    yield* this.executePrompt(prompt);
  }

  async *resume(prompt: string): AsyncGenerator<StreamChunk> {
    // 기존 컨텍스트 유지하며 계속
    yield* this.executePrompt(prompt);
  }

  private async *executePrompt(prompt: string): AsyncGenerator<StreamChunk> {
    this.conversationHistory.push({ role: 'user', content: prompt });

    // Claude CLI를 subprocess로 실행 (--print 모드로 스트리밍)
    const args = [
      '--print',
      '--model', this.config.model,
      '--allowedTools', this.config.allowedTools!.join(','),
    ];

    if (this.config.systemPrompt) {
      args.push('--system-prompt', this.config.systemPrompt);
    }

    if (this.config.workingDirectory) {
      args.push('--cwd', this.config.workingDirectory);
    }

    // 이전 대화 컨텍스트를 resume 파일로 전달
    const fullPrompt = this.conversationHistory
      .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    args.push('-p', fullPrompt);

    this.process = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.workingDirectory || process.cwd(),
    });

    let buffer = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // stdout 스트리밍
    for await (const chunk of this.process.stdout!) {
      const text = chunk.toString();
      buffer += text;

      // 줄 단위로 파싱
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        // JSON 이벤트 파싱 시도
        try {
          const event = JSON.parse(line);
          
          if (event.type === 'assistant') {
            yield {
              type: 'text',
              content: event.content || '',
            };
          } else if (event.type === 'tool_use') {
            yield {
              type: 'tool_call',
              content: `Calling ${event.name}...`,
              toolName: event.name,
              toolInput: event.input,
            };
          } else if (event.type === 'tool_result') {
            yield {
              type: 'tool_result',
              content: event.content || '',
            };
          } else if (event.type === 'usage') {
            totalInputTokens += event.input_tokens || 0;
            totalOutputTokens += event.output_tokens || 0;
          }
        } catch {
          // JSON이 아닌 일반 텍스트 출력
          yield {
            type: 'text',
            content: line,
          };
        }
      }
    }

    // 남은 버퍼 처리
    if (buffer.trim()) {
      yield {
        type: 'text',
        content: buffer,
      };
    }

    // stderr 에러 체크
    let stderr = '';
    for await (const chunk of this.process.stderr!) {
      stderr += chunk.toString();
    }

    if (stderr && !stderr.includes('warning')) {
      yield {
        type: 'error',
        content: stderr,
      };
    }

    // 사용량 보고
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      yield {
        type: 'usage',
        content: '',
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
    }

    // 완료
    yield {
      type: 'done',
      content: '',
    };

    this.process = null;
  }

  async terminate(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      
      // 3초 후에도 살아있으면 SIGKILL
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 3000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
    }
    this.conversationHistory = [];
  }
}
```

### 4.5 packages/adapters/src/codex.ts

```typescript
// packages/adapters/src/codex.ts

import { spawn, ChildProcess } from 'child_process';
import { AgentAdapter, AdapterConfig, StreamChunk } from './types';

const CODEX_MODELS = [
  'o3',
  'o4-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
];

const DEFAULT_SYSTEM_PROMPT = `You are a skilled software engineer.
When task is complete, output: [TASK_COMPLETE]
If unrecoverable error, output: [TASK_FAILED]`;

export class CodexAdapter implements AgentAdapter {
  private config: AdapterConfig;
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;

  constructor(config: AdapterConfig) {
    this.config = {
      ...config,
      model: config.model || 'o4-mini',
      systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    };
  }

  get currentModel(): string {
    return this.config.model;
  }

  switchModel(model: string): void {
    if (!CODEX_MODELS.includes(model)) {
      throw new Error(`Invalid model: ${model}. Available: ${CODEX_MODELS.join(', ')}`);
    }
    this.config.model = model;
  }

  async getAvailableModels(): Promise<string[]> {
    return CODEX_MODELS;
  }

  async *run(prompt: string): AsyncGenerator<StreamChunk> {
    // 새 세션 시작
    this.sessionId = null;
    yield* this.executePrompt(prompt, false);
  }

  async *resume(prompt: string): AsyncGenerator<StreamChunk> {
    yield* this.executePrompt(prompt, true);
  }

  private async *executePrompt(prompt: string, isResume: boolean): AsyncGenerator<StreamChunk> {
    const args = [
      '--model', this.config.model,
      '--approval-mode', 'auto-edit',  // 자동 승인
      '--quiet',  // 최소 출력
    ];

    if (this.config.workingDirectory) {
      args.push('--cwd', this.config.workingDirectory);
    }

    // 프롬프트 전달
    args.push(prompt);

    this.process = spawn('codex', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.workingDirectory || process.cwd(),
      env: {
        ...process.env,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      },
    });

    let buffer = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // stdout 스트리밍
    if (this.process.stdout) {
      for await (const chunk of this.process.stdout) {
        const text = chunk.toString();
        buffer += text;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          // Codex JSON 이벤트 파싱
          try {
            const event = JSON.parse(line);

            if (event.type === 'message') {
              yield {
                type: 'text',
                content: event.content || '',
              };
            } else if (event.type === 'function_call') {
              yield {
                type: 'tool_call',
                content: `Executing ${event.name}...`,
                toolName: event.name,
                toolInput: event.arguments,
              };
            } else if (event.type === 'function_result') {
              yield {
                type: 'tool_result',
                content: typeof event.output === 'string' 
                  ? event.output 
                  : JSON.stringify(event.output),
              };
            } else if (event.type === 'usage') {
              totalInputTokens += event.prompt_tokens || 0;
              totalOutputTokens += event.completion_tokens || 0;
            } else if (event.type === 'session') {
              this.sessionId = event.id;
            }
          } catch {
            // 일반 텍스트
            yield {
              type: 'text',
              content: line,
            };
          }
        }
      }
    }

    // 남은 버퍼
    if (buffer.trim()) {
      yield {
        type: 'text',
        content: buffer,
      };
    }

    // 에러 체크
    if (this.process.stderr) {
      let stderr = '';
      for await (const chunk of this.process.stderr) {
        stderr += chunk.toString();
      }
      if (stderr && stderr.includes('error')) {
        yield {
          type: 'error',
          content: stderr,
        };
      }
    }

    // 사용량
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      yield {
        type: 'usage',
        content: '',
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
    }

    yield {
      type: 'done',
      content: '',
    };

    this.process = null;
  }

  async terminate(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 3000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.process = null;
    }
    this.sessionId = null;
  }
}
```

### 4.6 packages/adapters/src/opencode.ts

```typescript
// packages/adapters/src/opencode.ts

import { spawn, ChildProcess } from 'child_process';
import { AgentAdapter, AdapterConfig, StreamChunk } from './types';

// OpenCode는 다양한 provider 지원
const OPENCODE_MODELS = [
  'anthropic/claude-sonnet-4-20250514',
  'anthropic/claude-opus-4-20250514',
  'openai/gpt-4.1',
  'google/gemini-2.5-pro',
];

const DEFAULT_SYSTEM_PROMPT = `You are a skilled software engineer.
When task is complete, output: [TASK_COMPLETE]
If unrecoverable error, output: [TASK_FAILED]`;

export class OpenCodeAdapter implements AgentAdapter {
  private config: AdapterConfig;
  private process: ChildProcess | null = null;
  private serverPort: number;
  private sessionId: string | null = null;

  constructor(config: AdapterConfig, portOffset: number = 0) {
    this.config = {
      ...config,
      model: config.model || 'anthropic/claude-sonnet-4-20250514',
      systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    };
    // 에이전트마다 고유 포트 (충돌 방지)
    this.serverPort = 4096 + portOffset;
  }

  get currentModel(): string {
    return this.config.model;
  }

  switchModel(model: string): void {
    this.config.model = model;
  }

  async getAvailableModels(): Promise<string[]> {
    // OpenCode는 동적으로 provider에서 모델 조회 가능
    // 여기서는 기본 목록 반환
    try {
      const response = await fetch(`http://localhost:${this.serverPort}/api/config`);
      if (response.ok) {
        const config = await response.json();
        return config.models || OPENCODE_MODELS;
      }
    } catch {
      // 서버 미실행 시 기본값
    }
    return OPENCODE_MODELS;
  }

  async *run(prompt: string): AsyncGenerator<StreamChunk> {
    this.sessionId = null;
    yield* this.executePrompt(prompt);
  }

  async *resume(prompt: string): AsyncGenerator<StreamChunk> {
    yield* this.executePrompt(prompt);
  }

  private async *executePrompt(prompt: string): AsyncGenerator<StreamChunk> {
    // OpenCode CLI 실행
    const args = [
      '--model', this.config.model,
      '--non-interactive',
    ];

    if (this.config.workingDirectory) {
      args.push('--cwd', this.config.workingDirectory);
    }

    args.push('-m', prompt);

    this.process = spawn('opencode', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.workingDirectory || process.cwd(),
    });

    let buffer = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    if (this.process.stdout) {
      for await (const chunk of this.process.stdout) {
        const text = chunk.toString();
        buffer += text;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          // JSON 이벤트 파싱 시도
          try {
            const event = JSON.parse(line);

            switch (event.type) {
              case 'text':
              case 'assistant':
                yield {
                  type: 'text',
                  content: event.content || event.text || '',
                };
                break;

              case 'tool_call':
                yield {
                  type: 'tool_call',
                  content: `Calling ${event.tool || event.name}...`,
                  toolName: event.tool || event.name,
                  toolInput: event.input || event.args,
                };
                break;

              case 'tool_result':
                yield {
                  type: 'tool_result',
                  content: event.result || event.output || '',
                };
                break;

              case 'usage':
                totalInputTokens += event.input_tokens || 0;
                totalOutputTokens += event.output_tokens || 0;
                break;

              case 'session':
                this.sessionId = event.id;
                break;

              default:
                // 알 수 없는 타입은 텍스트로
                if (event.content) {
                  yield {
                    type: 'text',
                    content: event.content,
                  };
                }
            }
          } catch {
            // 일반 텍스트
            yield {
              type: 'text',
              content: line,
            };
          }
        }
      }
    }

    if (buffer.trim()) {
      yield {
        type: 'text',
        content: buffer,
      };
    }

    // stderr
    if (this.process.stderr) {
      let stderr = '';
      for await (const chunk of this.process.stderr) {
        stderr += chunk.toString();
      }
      if (stderr && stderr.toLowerCase().includes('error')) {
        yield {
          type: 'error',
          content: stderr,
        };
      }
    }

    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      yield {
        type: 'usage',
        content: '',
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
    }

    yield {
      type: 'done',
      content: '',
    };

    this.process = null;
  }

  async terminate(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 3000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.process = null;
    }
    this.sessionId = null;
  }
}
```

### 4.7 packages/adapters/src/index.ts

```typescript
// packages/adapters/src/index.ts

export * from './types';
export { ClaudeAdapter } from './claude';
export { CodexAdapter } from './codex';
export { OpenCodeAdapter } from './opencode';

import { AgentAdapter, AdapterConfig } from './types';
import { ClaudeAdapter } from './claude';
import { CodexAdapter } from './codex';
import { OpenCodeAdapter } from './opencode';
import type { AgentSDK } from '@nexus/shared';

let portOffset = 0;

export function createAdapter(sdk: AgentSDK, config: AdapterConfig): AgentAdapter {
  switch (sdk) {
    case 'claude':
      return new ClaudeAdapter(config);
    case 'codex':
      return new CodexAdapter(config);
    case 'opencode':
      return new OpenCodeAdapter(config, portOffset++);
    default:
      throw new Error(`Unknown SDK: ${sdk}`);
  }
}
```

> **체크포인트**: `packages/adapters` 빌드 성공 (`pnpm --filter @nexus/adapters build`)

---

## 5. apps/server 구현

### 5.1 packages/db/src/schema.sql

```sql
-- packages/db/src/schema.sql

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  sdk TEXT NOT NULL CHECK (sdk IN ('claude', 'codex', 'opencode')),
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle' 
    CHECK (status IN ('idle', 'running', 'paused', 'completed', 'error', 'terminated')),
  current_task TEXT,
  is_orchestrator INTEGER NOT NULL DEFAULT 0,
  system_prompt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS terminal_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  chunk_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_terminal_logs_agent_id ON terminal_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_costs_agent_id ON costs(agent_id);
```

### 5.2 apps/server/src/db/schema.ts

```typescript
// apps/server/src/db/schema.ts

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';

const DB_DIR = join(homedir(), '.nexus');
const DB_PATH = process.env.NEXUS_DB_PATH || join(DB_DIR, 'nexus.db');

// 디렉토리 생성
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  // schema.sql 읽어서 실행
  const schemaPath = join(__dirname, '../../../packages/db/src/schema.sql');
  
  try {
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    console.log('✅ Database initialized:', DB_PATH);
  } catch (error) {
    // 상대 경로 실패 시 직접 실행
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        sdk TEXT NOT NULL,
        model TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        current_task TEXT,
        is_orchestrator INTEGER NOT NULL DEFAULT 0,
        system_prompt TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result_summary TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS terminal_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        task_id TEXT,
        chunk_type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        task_id TEXT,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    console.log('✅ Database initialized with inline schema:', DB_PATH);
  }
}

export function closeDatabase(): void {
  db.close();
}
```

### 5.3 apps/server/src/db/queries.ts

```typescript
// apps/server/src/db/queries.ts

import { db } from './schema';
import type { Agent, AgentConfig, AgentStatus, Task, CostEntry } from '@nexus/shared';
import { nanoid } from 'nanoid';

// ============ Agents ============

export function createAgent(config: AgentConfig): Agent {
  const id = nanoid(12);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO agents (id, name, role, sdk, model, is_orchestrator, system_prompt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    config.name,
    config.role,
    config.sdk,
    config.model,
    config.isOrchestrator ? 1 : 0,
    config.systemPrompt || null,
    now,
    now
  );

  return getAgent(id)!;
}

export function getAgent(id: string): Agent | null {
  const stmt = db.prepare(`SELECT * FROM agents WHERE id = ?`);
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    role: row.role,
    sdk: row.sdk,
    model: row.model,
    status: row.status,
    currentTask: row.current_task,
    isOrchestrator: row.is_orchestrator === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listAgents(): Agent[] {
  const stmt = db.prepare(`SELECT * FROM agents ORDER BY created_at DESC`);
  const rows = stmt.all() as any[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    sdk: row.sdk,
    model: row.model,
    status: row.status,
    currentTask: row.current_task,
    isOrchestrator: row.is_orchestrator === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateAgentStatus(id: string, status: AgentStatus, currentTask?: string | null): void {
  const stmt = db.prepare(`
    UPDATE agents 
    SET status = ?, current_task = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(status, currentTask ?? null, id);
}

export function deleteAgent(id: string): void {
  const stmt = db.prepare(`DELETE FROM agents WHERE id = ?`);
  stmt.run(id);
}

// ============ Tasks ============

export function createTask(agentId: string, prompt: string): Task {
  const id = nanoid(12);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO tasks (id, agent_id, prompt, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, agentId, prompt, now);

  return getTask(id)!;
}

export function getTask(id: string): Task | null {
  const stmt = db.prepare(`SELECT * FROM tasks WHERE id = ?`);
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    agentId: row.agent_id,
    prompt: row.prompt,
    status: row.status,
    resultSummary: row.result_summary,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function listTasks(agentId?: string): Task[] {
  const stmt = agentId
    ? db.prepare(`SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC`)
    : db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC`);
  
  const rows = (agentId ? stmt.all(agentId) : stmt.all()) as any[];

  return rows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    prompt: row.prompt,
    status: row.status,
    resultSummary: row.result_summary,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}

export function updateTaskStatus(
  id: string, 
  status: Task['status'], 
  resultSummary?: string
): void {
  const completedAt = status === 'completed' || status === 'failed' 
    ? new Date().toISOString() 
    : null;

  const stmt = db.prepare(`
    UPDATE tasks 
    SET status = ?, result_summary = ?, completed_at = ?
    WHERE id = ?
  `);
  stmt.run(status, resultSummary ?? null, completedAt, id);
}

// ============ Terminal Logs ============

export function logTerminalChunk(
  agentId: string, 
  taskId: string | null, 
  chunkType: string, 
  content: string
): void {
  const stmt = db.prepare(`
    INSERT INTO terminal_logs (agent_id, task_id, chunk_type, content)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(agentId, taskId, chunkType, content);
}

export function getTerminalLogs(agentId: string, limit: number = 1000): Array<{
  chunkType: string;
  content: string;
  createdAt: string;
}> {
  const stmt = db.prepare(`
    SELECT chunk_type, content, created_at 
    FROM terminal_logs 
    WHERE agent_id = ? 
    ORDER BY id DESC 
    LIMIT ?
  `);
  const rows = stmt.all(agentId, limit) as any[];
  
  return rows.reverse().map((row) => ({
    chunkType: row.chunk_type,
    content: row.content,
    createdAt: row.created_at,
  }));
}

// ============ Costs ============

export function logCost(data: Omit<CostEntry, 'timestamp'>): void {
  const stmt = db.prepare(`
    INSERT INTO costs (agent_id, task_id, input_tokens, output_tokens, cost_usd)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.agentId,
    data.taskId,
    data.inputTokens,
    data.outputTokens,
    data.costUsd
  );
}

export function getTotalCost(): number {
  const stmt = db.prepare(`SELECT COALESCE(SUM(cost_usd), 0) as total FROM costs`);
  const row = stmt.get() as { total: number };
  return row.total;
}

export function getAgentCost(agentId: string): number {
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as total 
    FROM costs 
    WHERE agent_id = ?
  `);
  const row = stmt.get(agentId) as { total: number };
  return row.total;
}
```

### 5.4 apps/server/src/agents/manager.ts

```typescript
// apps/server/src/agents/manager.ts

import { EventEmitter } from 'events';
import { createAdapter, AgentAdapter, StreamChunk } from '@nexus/adapters';
import type { Agent, AgentConfig, AgentStatus, AgentSDK } from '@nexus/shared';
import * as queries from '../db/queries';

// 토큰당 비용 (USD)
const COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'claude-opus-4-20250514': { input: 0.015 / 1000, output: 0.075 / 1000 },
  'o4-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
  'gpt-4.1': { input: 0.002 / 1000, output: 0.008 / 1000 },
  // 기본값
  'default': { input: 0.001 / 1000, output: 0.003 / 1000 },
};

export interface AgentManagerEvents {
  chunk: (agentId: string, chunk: StreamChunk) => void;
  status: (agentId: string, status: AgentStatus) => void;
  error: (agentId: string, error: Error) => void;
}

export class AgentManager extends EventEmitter {
  private adapters: Map<string, AgentAdapter> = new Map();
  private runningTasks: Map<string, string> = new Map(); // agentId → taskId

  constructor() {
    super();
  }

  async spawnAgent(config: AgentConfig): Promise<Agent> {
    // DB에 에이전트 생성
    const agent = queries.createAgent(config);

    // Adapter 생성
    const adapter = createAdapter(config.sdk, {
      model: config.model,
      systemPrompt: config.systemPrompt,
    });

    this.adapters.set(agent.id, adapter);

    console.log(`🤖 Agent spawned: ${agent.name} (${agent.id}) [${config.sdk}/${config.model}]`);
    return agent;
  }

  async runTask(agentId: string, prompt: string): Promise<string> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Task 생성
    const task = queries.createTask(agentId, prompt);
    this.runningTasks.set(agentId, task.id);

    // 상태 업데이트
    queries.updateAgentStatus(agentId, 'running', prompt.substring(0, 100));
    this.emit('status', agentId, 'running');

    // 비동기로 실행 (스트리밍)
    this.executeTask(agentId, task.id, adapter, prompt);

    return task.id;
  }

  private async executeTask(
    agentId: string,
    taskId: string,
    adapter: AgentAdapter,
    prompt: string
  ): Promise<void> {
    let resultSummary = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      for await (const chunk of adapter.run(prompt)) {
        // 청크 브로드캐스트
        this.emit('chunk', agentId, chunk);

        // 터미널 로그 저장
        if (chunk.content) {
          queries.logTerminalChunk(agentId, taskId, chunk.type, chunk.content);
        }

        // 타입별 처리
        switch (chunk.type) {
          case 'text':
            resultSummary += chunk.content;
            // [TASK_COMPLETE] 감지
            if (chunk.content.includes('[TASK_COMPLETE]')) {
              queries.updateTaskStatus(taskId, 'completed', resultSummary);
              queries.updateAgentStatus(agentId, 'completed');
              this.emit('status', agentId, 'completed');
            }
            // [TASK_FAILED] 감지
            if (chunk.content.includes('[TASK_FAILED]')) {
              queries.updateTaskStatus(taskId, 'failed', resultSummary);
              queries.updateAgentStatus(agentId, 'error');
              this.emit('status', agentId, 'error');
            }
            break;

          case 'usage':
            if (chunk.usage) {
              totalInputTokens += chunk.usage.inputTokens;
              totalOutputTokens += chunk.usage.outputTokens;
            }
            break;

          case 'done':
            // 비용 계산 및 저장
            const costRate = COST_PER_TOKEN[adapter.currentModel] || COST_PER_TOKEN['default'];
            const costUsd = 
              totalInputTokens * costRate.input + 
              totalOutputTokens * costRate.output;

            queries.logCost({
              agentId,
              taskId,
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              costUsd,
            });

            // 상태가 아직 running이면 idle로
            const agent = queries.getAgent(agentId);
            if (agent?.status === 'running') {
              queries.updateAgentStatus(agentId, 'idle');
              queries.updateTaskStatus(taskId, 'completed', resultSummary.substring(0, 500));
              this.emit('status', agentId, 'idle');
            }
            break;

          case 'error':
            queries.updateTaskStatus(taskId, 'failed', chunk.content);
            queries.updateAgentStatus(agentId, 'error');
            this.emit('error', agentId, new Error(chunk.content));
            break;
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      queries.updateTaskStatus(taskId, 'failed', errMsg);
      queries.updateAgentStatus(agentId, 'error');
      this.emit('error', agentId, error as Error);
    } finally {
      this.runningTasks.delete(agentId);
    }
  }

  async resumeAgent(agentId: string, prompt: string): Promise<string> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const task = queries.createTask(agentId, prompt);
    this.runningTasks.set(agentId, task.id);

    queries.updateAgentStatus(agentId, 'running', prompt.substring(0, 100));
    this.emit('status', agentId, 'running');

    // resume 사용 (기존 컨텍스트 유지)
    this.executeTaskResume(agentId, task.id, adapter, prompt);

    return task.id;
  }

  private async executeTaskResume(
    agentId: string,
    taskId: string,
    adapter: AgentAdapter,
    prompt: string
  ): Promise<void> {
    // executeTask와 동일하지만 adapter.resume() 사용
    let resultSummary = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      for await (const chunk of adapter.resume(prompt)) {
        this.emit('chunk', agentId, chunk);

        if (chunk.content) {
          queries.logTerminalChunk(agentId, taskId, chunk.type, chunk.content);
        }

        if (chunk.type === 'text') {
          resultSummary += chunk.content;
        } else if (chunk.type === 'usage' && chunk.usage) {
          totalInputTokens += chunk.usage.inputTokens;
          totalOutputTokens += chunk.usage.outputTokens;
        } else if (chunk.type === 'done') {
          const costRate = COST_PER_TOKEN[adapter.currentModel] || COST_PER_TOKEN['default'];
          const costUsd = totalInputTokens * costRate.input + totalOutputTokens * costRate.output;
          queries.logCost({ agentId, taskId, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, costUsd });
          queries.updateAgentStatus(agentId, 'idle');
          queries.updateTaskStatus(taskId, 'completed', resultSummary.substring(0, 500));
          this.emit('status', agentId, 'idle');
        }
      }
    } catch (error) {
      queries.updateTaskStatus(taskId, 'failed', String(error));
      queries.updateAgentStatus(agentId, 'error');
      this.emit('error', agentId, error as Error);
    }
  }

  async terminateAgent(agentId: string): Promise<void> {
    const adapter = this.adapters.get(agentId);
    if (adapter) {
      await adapter.terminate();
      this.adapters.delete(agentId);
    }

    queries.updateAgentStatus(agentId, 'terminated');
    this.emit('status', agentId, 'terminated');
    console.log(`❌ Agent terminated: ${agentId}`);
  }

  getStatus(agentId: string): AgentStatus {
    const agent = queries.getAgent(agentId);
    return agent?.status || 'terminated';
  }

  listAgents(): Agent[] {
    return queries.listAgents();
  }

  getAdapter(agentId: string): AgentAdapter | undefined {
    return this.adapters.get(agentId);
  }
}

// 싱글톤 인스턴스
export const agentManager = new AgentManager();
```

### 5.5 apps/server/src/agents/orchestrator.ts

```typescript
// apps/server/src/agents/orchestrator.ts

import { agentManager } from './manager';
import * as queries from '../db/queries';
import type { AgentConfig, AgentSDK } from '@nexus/shared';

// 오케스트레이터에 주입되는 시스템 도구 정의
export interface OrchestratorTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<string>;
}

export const orchestratorTools: OrchestratorTool[] = [
  {
    name: 'spawn_agent',
    description: 'Spawn a new worker agent with specified SDK and role',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Agent name' },
        role: { type: 'string', description: 'Agent role/specialty' },
        sdk: { type: 'string', enum: ['claude', 'codex', 'opencode'] },
        model: { type: 'string', description: 'Model to use' },
      },
      required: ['name', 'role', 'sdk', 'model'],
    },
    handler: async (input) => {
      const config: AgentConfig = {
        name: input.name as string,
        role: input.role as string,
        sdk: input.sdk as AgentSDK,
        model: input.model as string,
        isOrchestrator: false,
      };

      const agent = await agentManager.spawnAgent(config);
      return JSON.stringify({
        success: true,
        agentId: agent.id,
        message: `Spawned agent "${agent.name}" with ID ${agent.id}`,
      });
    },
  },

  {
    name: 'assign_task',
    description: 'Assign a task to a specific agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        prompt: { type: 'string' },
      },
      required: ['agentId', 'prompt'],
    },
    handler: async (input) => {
      const taskId = await agentManager.runTask(
        input.agentId as string,
        input.prompt as string
      );
      return JSON.stringify({
        success: true,
        taskId,
        message: `Task assigned to agent ${input.agentId}`,
      });
    },
  },

  {
    name: 'get_agent_result',
    description: 'Get the result/status of an agent\'s task',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        taskId: { type: 'string', description: 'Optional specific task ID' },
      },
      required: ['agentId'],
    },
    handler: async (input) => {
      const tasks = queries.listTasks(input.agentId as string);
      const task = input.taskId 
        ? tasks.find(t => t.id === input.taskId)
        : tasks[0]; // 최신 태스크

      if (!task) {
        return JSON.stringify({ success: false, error: 'No tasks found' });
      }

      return JSON.stringify({
        success: true,
        taskId: task.id,
        status: task.status,
        resultSummary: task.resultSummary,
        completedAt: task.completedAt,
      });
    },
  },

  {
    name: 'list_agents',
    description: 'List all active agents and their status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const agents = queries.listAgents();
      return JSON.stringify({
        success: true,
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          role: a.role,
          sdk: a.sdk,
          model: a.model,
          status: a.status,
          currentTask: a.currentTask,
          isOrchestrator: a.isOrchestrator,
        })),
      });
    },
  },

  {
    name: 'terminate_agent',
    description: 'Terminate a specific agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
      },
      required: ['agentId'],
    },
    handler: async (input) => {
      await agentManager.terminateAgent(input.agentId as string);
      return JSON.stringify({
        success: true,
        message: `Agent ${input.agentId} terminated`,
      });
    },
  },

  {
    name: 'get_budget',
    description: 'Get current budget usage',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const current = queries.getTotalCost();
      const limit = parseFloat(process.env.NEXUS_BUDGET_USD || '50');
      return JSON.stringify({
        success: true,
        currentUsd: current.toFixed(4),
        limitUsd: limit,
        remaining: (limit - current).toFixed(4),
        percentUsed: ((current / limit) * 100).toFixed(1),
      });
    },
  },
];

// 오케스트레이터 시스템 프롬프트 생성
export function getOrchestratorSystemPrompt(): string {
  const toolDescriptions = orchestratorTools
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n');

  return `You are the Orchestrator agent in Nexus, an AI coding agent orchestration platform.

Your role is to:
1. Break down complex user requests into subtasks
2. Spawn appropriate worker agents for each subtask
3. Assign tasks and monitor progress
4. Aggregate results and report back

Available tools:
${toolDescriptions}

Guidelines:
- Use claude SDK for complex reasoning tasks
- Use codex SDK for code generation/editing
- Use opencode SDK when specific provider models are needed
- Monitor budget usage and warn if approaching limit
- When all subtasks complete, summarize results and output [TASK_COMPLETE]
- If critical failure, output [TASK_FAILED] with explanation

Current mode: Manual (user confirms spawning) or Auto (you decide autonomously)
Check mode before spawning agents.`;
}

// 도구 호출 핸들러
export async function handleToolCall(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  const tool = orchestratorTools.find(t => t.name === toolName);
  if (!tool) {
    return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }
  return tool.handler(input);
}
```

### 5.6 apps/server/src/ws/handler.ts

```typescript
// apps/server/src/ws/handler.ts

import { FastifyInstance } from 'fastify';
import { WebSocket } from '@fastify/websocket';
import { agentManager } from '../agents/manager';
import { getTerminalLogs } from '../db/queries';
import type { WsMessage, StreamChunk } from '@nexus/shared';

// 연결된 클라이언트 관리
const dashboardClients: Set<WebSocket> = new Set();
const agentClients: Map<string, Set<WebSocket>> = new Map(); // agentId → clients

export function setupWebSocketHandlers(fastify: FastifyInstance): void {
  // 대시보드 전체 상태 구독
  fastify.get('/ws/dashboard', { websocket: true }, (socket, req) => {
    dashboardClients.add(socket);
    console.log('📡 Dashboard client connected');

    socket.on('close', () => {
      dashboardClients.delete(socket);
      console.log('📡 Dashboard client disconnected');
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        handleDashboardMessage(socket, msg);
      } catch (err) {
        socket.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });
  });

  // 특정 에이전트 터미널 구독
  fastify.get('/ws/agent/:id/terminal', { websocket: true }, (socket, req) => {
    const agentId = (req.params as { id: string }).id;

    if (!agentClients.has(agentId)) {
      agentClients.set(agentId, new Set());
    }
    agentClients.get(agentId)!.add(socket);
    console.log(`📡 Terminal client connected for agent: ${agentId}`);

    // 기존 로그 전송 (히스토리 복원)
    const logs = getTerminalLogs(agentId, 500);
    for (const log of logs) {
      socket.send(JSON.stringify({
        type: 'chunk',
        agentId,
        data: log.content,
        chunkType: log.chunkType,
      }));
    }

    socket.on('close', () => {
      agentClients.get(agentId)?.delete(socket);
      console.log(`📡 Terminal client disconnected for agent: ${agentId}`);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleAgentMessage(agentId, socket, msg);
      } catch (err) {
        socket.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });
  });

  // AgentManager 이벤트 리스닝
  agentManager.on('chunk', (agentId: string, chunk: StreamChunk) => {
    const message: WsMessage = {
      type: 'chunk',
      agentId,
      data: chunk.content,
    };
    broadcastToAgent(agentId, message);
    broadcastToDashboard(message);
  });

  agentManager.on('status', (agentId: string, status: string) => {
    const message: WsMessage = {
      type: 'status',
      agentId,
      status: status as any,
    };
    broadcastToAgent(agentId, message);
    broadcastToDashboard(message);
  });

  agentManager.on('error', (agentId: string, error: Error) => {
    const message: WsMessage = {
      type: 'error',
      agentId,
      error: error.message,
    };
    broadcastToAgent(agentId, message);
    broadcastToDashboard(message);
  });
}

function handleDashboardMessage(socket: WebSocket, msg: WsMessage): void {
  // 대시보드에서 프롬프트 전송
  if (msg.type === 'prompt' && msg.agentId && msg.data) {
    agentManager.runTask(msg.agentId, msg.data);
  }
}

function handleAgentMessage(agentId: string, socket: WebSocket, msg: any): void {
  // stdin 전송 (향후 구현)
  if (msg.type === 'stdin' && msg.data) {
    // TODO: Adapter에 stdin 전달
    console.log(`stdin for ${agentId}: ${msg.data}`);
  }
}

function broadcastToDashboard(message: WsMessage): void {
  const data = JSON.stringify(message);
  for (const client of dashboardClients) {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  }
}

function broadcastToAgent(agentId: string, message: WsMessage): void {
  const clients = agentClients.get(agentId);
  if (!clients) return;

  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}
```

### 5.7 apps/server/src/routes/agents.ts

```typescript
// apps/server/src/routes/agents.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { agentManager } from '../agents/manager';
import * as queries from '../db/queries';
import type { AgentConfig, AgentSDK } from '@nexus/shared';

interface CreateAgentBody {
  name: string;
  role: string;
  sdk: AgentSDK;
  model: string;
  isOrchestrator?: boolean;
  systemPrompt?: string;
}

interface AgentParams {
  id: string;
}

export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  // 에이전트 목록
  fastify.get('/agents', async (req, reply) => {
    const agents = queries.listAgents();
    return { agents };
  });

  // 에이전트 생성
  fastify.post<{ Body: CreateAgentBody }>('/agents', async (req, reply) => {
    const { name, role, sdk, model, isOrchestrator, systemPrompt } = req.body;

    if (!name || !role || !sdk || !model) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const config: AgentConfig = {
      name,
      role,
      sdk,
      model,
      isOrchestrator: isOrchestrator || false,
      systemPrompt,
    };

    try {
      const agent = await agentManager.spawnAgent(config);
      return { agent };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: msg });
    }
  });

  // 에이전트 상세
  fastify.get<{ Params: AgentParams }>('/agents/:id', async (req, reply) => {
    const agent = queries.getAgent(req.params.id);
    if (!agent) {
      return reply.status(404).send({ error: 'Agent not found' });
    }
    return { agent };
  });

  // 에이전트 종료
  fastify.delete<{ Params: AgentParams }>('/agents/:id', async (req, reply) => {
    try {
      await agentManager.terminateAgent(req.params.id);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: msg });
    }
  });

  // 에이전트 모델 목록
  fastify.get<{ Params: AgentParams }>('/agents/:id/models', async (req, reply) => {
    const adapter = agentManager.getAdapter(req.params.id);
    if (!adapter) {
      return reply.status(404).send({ error: 'Agent not found' });
    }
    const models = await adapter.getAvailableModels();
    return { models };
  });
}
```

### 5.8 apps/server/src/routes/tasks.ts

```typescript
// apps/server/src/routes/tasks.ts

import { FastifyInstance } from 'fastify';
import { agentManager } from '../agents/manager';
import * as queries from '../db/queries';

interface CreateTaskBody {
  agentId: string;
  prompt: string;
}

interface TaskParams {
  id: string;
}

export async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  // 태스크 목록
  fastify.get('/tasks', async (req, reply) => {
    const { agentId } = req.query as { agentId?: string };
    const tasks = queries.listTasks(agentId);
    return { tasks };
  });

  // 태스크 생성 + 할당
  fastify.post<{ Body: CreateTaskBody }>('/tasks', async (req, reply) => {
    const { agentId, prompt } = req.body;

    if (!agentId || !prompt) {
      return reply.status(400).send({ error: 'Missing agentId or prompt' });
    }

    try {
      const taskId = await agentManager.runTask(agentId, prompt);
      return { taskId, status: 'running' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: msg });
    }
  });

  // 태스크 상세
  fastify.get<{ Params: TaskParams }>('/tasks/:id', async (req, reply) => {
    const task = queries.getTask(req.params.id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    return { task };
  });

  // 태스크 재시도
  fastify.post<{ Params: TaskParams }>('/tasks/:id/retry', async (req, reply) => {
    const task = queries.getTask(req.params.id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    try {
      const newTaskId = await agentManager.runTask(task.agentId, task.prompt);
      return { taskId: newTaskId, status: 'running' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: msg });
    }
  });

  // 예산 조회
  fastify.get('/budget', async (req, reply) => {
    const current = queries.getTotalCost();
    const limit = parseFloat(process.env.NEXUS_BUDGET_USD || '50');
    return {
      current: parseFloat(current.toFixed(4)),
      limit,
      remaining: parseFloat((limit - current).toFixed(4)),
      percentUsed: parseFloat(((current / limit) * 100).toFixed(1)),
    };
  });
}
```

### 5.9 apps/server/src/index.ts

```typescript
// apps/server/src/index.ts

import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { config } from 'dotenv';

import { initializeDatabase, closeDatabase } from './db/schema';
import { agentRoutes } from './routes/agents';
import { taskRoutes } from './routes/tasks';
import { setupWebSocketHandlers } from './ws/handler';

// 환경 변수 로드
config();

const PORT = parseInt(process.env.SERVER_PORT || '3001', 10);

async function main() {
  const fastify = Fastify({
    logger: true,
  });

  // 플러그인 등록
  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(fastifyWebsocket);

  // 데이터베이스 초기화
  initializeDatabase();

  // REST 라우트 등록
  await fastify.register(agentRoutes);
  await fastify.register(taskRoutes);

  // WebSocket 핸들러 설정
  setupWebSocketHandlers(fastify);

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down...');
    closeDatabase();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // 서버 시작
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n🚀 Nexus Server running at http://localhost:${PORT}`);
    console.log(`📡 WebSocket endpoints:`);
    console.log(`   - ws://localhost:${PORT}/ws/dashboard`);
    console.log(`   - ws://localhost:${PORT}/ws/agent/:id/terminal`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
```

### 5.10 apps/server/package.json (업데이트)

```json
{
  "name": "server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@fastify/cors": "^10.0.0",
    "@fastify/websocket": "^11.0.0",
    "@nexus/adapters": "workspace:*",
    "@nexus/shared": "workspace:*",
    "better-sqlite3": "^11.0.0",
    "dotenv": "^16.4.0",
    "fastify": "^5.0.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

> **체크포인트**: `pnpm --filter server dev` 실행 → `http://localhost:3001/health` 응답 확인

---

## 6. apps/web 구현

### 6.1 apps/web에 필요한 추가 의존성

```bash
cd apps/web
pnpm add zustand @xterm/xterm @xterm/addon-fit
pnpm add -D @types/node
cd ../..
```

### 6.2 apps/web/store/agents.ts

```typescript
// apps/web/store/agents.ts

import { create } from 'zustand';
import type { Agent, AgentStatus, Budget } from '@nexus/shared';

interface TerminalBuffer {
  chunks: string[];
  maxSize: number;
}

interface NexusStore {
  // State
  agents: Agent[];
  selectedAgentId: string | null;
  budget: Budget;
  terminalBuffers: Map<string, TerminalBuffer>;
  isAutoMode: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';

  // Actions
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

export const useNexusStore = create<NexusStore>((set, get) => ({
  // Initial state
  agents: [],
  selectedAgentId: null,
  budget: { current: 0, limit: 50 },
  terminalBuffers: new Map(),
  isAutoMode: false,
  connectionStatus: 'disconnected',

  // Agent actions
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

  // Selection
  selectAgent: (id) => set({ selectedAgentId: id }),

  // Terminal buffers
  appendTerminalChunk: (agentId, chunk) => set((state) => {
    const buffers = new Map(state.terminalBuffers);
    const buffer = buffers.get(agentId) || { chunks: [], maxSize: 10000 };
    
    buffer.chunks.push(chunk);
    
    // 버퍼 크기 제한
    if (buffer.chunks.length > buffer.maxSize) {
      buffer.chunks = buffer.chunks.slice(-buffer.maxSize);
    }
    
    buffers.set(agentId, buffer);
    return { terminalBuffers: buffers };
  }),
  
  clearTerminalBuffer: (agentId) => set((state) => {
    const buffers = new Map(state.terminalBuffers);
    buffers.delete(agentId);
    return { terminalBuffers: buffers };
  }),

  // Budget & Mode
  setBudget: (budget) => set({ budget }),
  setAutoMode: (enabled) => set({ isAutoMode: enabled }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
```

### 6.3 apps/web/hooks/useWebSocket.ts

```typescript
// apps/web/hooks/useWebSocket.ts

import { useEffect, useRef, useCallback } from 'react';
import { useNexusStore } from '@/store/agents';
import type { WsMessage } from '@nexus/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const {
    setAgentStatus,
    appendTerminalChunk,
    setConnectionStatus,
    updateAgent,
  } = useNexusStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket(`${WS_URL}/ws/dashboard`);

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        
        switch (msg.type) {
          case 'chunk':
            if (msg.agentId && msg.data) {
              appendTerminalChunk(msg.agentId, msg.data);
            }
            break;
            
          case 'status':
            if (msg.agentId && msg.status) {
              setAgentStatus(msg.agentId, msg.status);
            }
            break;
            
          case 'error':
            console.error('WS Error:', msg.error);
            break;
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('❌ WebSocket disconnected');
      setConnectionStatus('disconnected');
      wsRef.current = null;
      
      // Exponential backoff 재연결
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current})`);
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [setConnectionStatus, appendTerminalChunk, setAgentStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);

  const sendPrompt = useCallback((agentId: string, prompt: string) => {
    sendMessage({
      type: 'prompt',
      agentId,
      data: prompt,
    });
  }, [sendMessage]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    sendMessage,
    sendPrompt,
    reconnect: connect,
  };
}
```

### 6.4 apps/web/hooks/useAgentTerminal.ts

```typescript
// apps/web/hooks/useAgentTerminal.ts

import { useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export function useAgentTerminal(agentId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const onChunkRef = useRef<((chunk: string) => void) | null>(null);

  const connect = useCallback((onChunk: (chunk: string) => void) => {
    if (!agentId) return;

    onChunkRef.current = onChunk;
    const ws = new WebSocket(`${WS_URL}/ws/agent/${agentId}/terminal`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data && onChunkRef.current) {
          onChunkRef.current(msg.data);
        }
      } catch {
        // 무시
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [agentId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendStdin = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stdin', data }));
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendStdin,
  };
}
```

### 6.5 apps/web/components/Header.tsx

```typescript
// apps/web/components/Header.tsx

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
  const budgetPercent = (budget.current / budget.limit) * 100;

  // 예산 정보 주기적 업데이트
  useEffect(() => {
    const fetchBudget = async () => {
      try {
        const res = await fetch('http://localhost:3001/budget');
        if (res.ok) {
          const data = await res.json();
          setBudget({ current: data.current, limit: data.limit });
        }
      } catch {
        // 무시
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
        
        {/* 연결 상태 */}
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
        {/* 활성 에이전트 */}
        <div className="text-sm">
          <span className="text-gray-400">Active:</span>{' '}
          <span className="text-white font-medium">{activeAgents}</span>
          <span className="text-gray-500"> / {agents.length}</span>
        </div>

        {/* 예산 */}
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

        {/* Auto/Manual 토글 */}
        <button
          onClick={() => setAutoMode(!isAutoMode)}
          className={`px-3 py-1 rounded text-sm font-medium transition ${
            isAutoMode 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isAutoMode ? '🤖 Auto' : '👤 Manual'}
        </button>
      </div>
    </header>
  );
}
```

### 6.6 apps/web/components/OrchestratorCard.tsx

```typescript
// apps/web/components/OrchestratorCard.tsx

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
            <span className="text-2xl">🎯</span>
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
```

### 6.7 apps/web/components/AgentCard.tsx

```typescript
// apps/web/components/AgentCard.tsx

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

export function AgentCard({ agent }: Props) {
  const { selectAgent, selectedAgentId } = useNexusStore();
  const isSelected = selectedAgentId === agent.id;

  return (
    <div
      onClick={() => selectAgent(agent.id)}
      className={`
        p-4 rounded-lg cursor-pointer transition-all
        bg-gray-800 border ${isSelected ? 'border-blue-500' : 'border-gray-700'}
        hover:border-gray-600 hover:bg-gray-750
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
          <span className="text-xs text-gray-400 capitalize">{agent.status}</span>
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
```

### 6.8 apps/web/components/TerminalOverlay.tsx

```typescript
// apps/web/components/TerminalOverlay.tsx

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useNexusStore } from '@/store/agents';
import { useAgentTerminal } from '@/hooks/useAgentTerminal';
import dynamic from 'next/dynamic';

// xterm은 SSR 불가 → dynamic import
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-lg">💻</span>
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

        {/* Terminal */}
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
```

### 6.9 apps/web/components/Terminal.tsx

```typescript
// apps/web/components/Terminal.tsx

'use client';

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useAgentTerminal } from '@/hooks/useAgentTerminal';
import { useNexusStore } from '@/store/agents';
import '@xterm/xterm/css/xterm.css';

interface Props {
  agentId: string;
  initialContent?: string;
}

export function Terminal({ agentId, initialContent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { connect, disconnect, sendStdin } = useAgentTerminal(agentId);
  const { terminalBuffers } = useNexusStore();

  useEffect(() => {
    if (!containerRef.current) return;

    // xterm 초기화
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        selectionBackground: '#33467c',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // 초기 콘텐츠 출력
    if (initialContent) {
      terminal.write(initialContent);
    }

    // WebSocket 연결 & 청크 수신
    connect((chunk) => {
      terminal.write(chunk);
    });

    // 키 입력 → stdin
    terminal.onData((data) => {
      sendStdin(data);
    });

    // 리사이즈 처리
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disconnect();
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [agentId, connect, disconnect, sendStdin, initialContent]);

  // 새 청크가 버퍼에 추가되면 터미널에 write
  useEffect(() => {
    const buffer = terminalBuffers.get(agentId);
    if (!buffer || !terminalRef.current) return;
    
    const lastChunk = buffer.chunks[buffer.chunks.length - 1];
    if (lastChunk) {
      // 이미 초기 콘텐츠로 출력했으므로 새 청크만
      // (실제로는 WebSocket onChunk에서 처리되므로 여기선 불필요할 수 있음)
    }
  }, [terminalBuffers, agentId]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full"
    />
  );
}
```

### 6.10 apps/web/components/TaskInput.tsx

```typescript
// apps/web/components/TaskInput.tsx

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
      // Auto 모드: 오케스트레이터에게 전송
      const orchestrator = agents.find(a => a.isOrchestrator);
      if (orchestrator) {
        sendPrompt(orchestrator.id, prompt);
      }
    } else if (selectedAgentId) {
      // Manual 모드: 선택된 에이전트에게 전송
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
          <option value="">Select Agent...</option>
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
        placeholder={isAutoMode ? "Describe your task..." : "Enter prompt for agent..."}
        className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
      />

      <button
        type="submit"
        disabled={!isConnected || !prompt.trim() || (!isAutoMode && !selectedAgentId)}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        Send
      </button>
    </form>
  );
}
```

### 6.11 apps/web/app/page.tsx

```typescript
// apps/web/app/page.tsx

'use client';

import { useEffect } from 'react';
import { useNexusStore } from '@/store/agents';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Header } from '@/components/Header';
import { OrchestratorCard } from '@/components/OrchestratorCard';
import { AgentCard } from '@/components/AgentCard';
import { TerminalOverlay } from '@/components/TerminalOverlay';
import { TaskInput } from '@/components/TaskInput';

export default function Dashboard() {
  const { agents, setAgents, selectedAgentId } = useNexusStore();
  
  // WebSocket 연결
  useWebSocket();

  // 에이전트 목록 fetch
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('http://localhost:3001/agents');
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents);
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
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
      <Header />

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* 오케스트레이터 (상단 중앙) */}
        {orchestrator && (
          <div className="max-w-2xl mx-auto">
            <OrchestratorCard agent={orchestrator} />
          </div>
        )}

        {/* 워커 에이전트 그리드 */}
        {workers.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-300 mb-4">
              Worker Agents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {workers.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        )}

        {/* 에이전트가 없을 때 */}
        {agents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <span className="text-4xl mb-4">🤖</span>
            <p>No agents yet. Create one to get started.</p>
          </div>
        )}
      </main>

      <TaskInput />

      {/* 터미널 오버레이 */}
      {selectedAgentId && <TerminalOverlay />}
    </div>
  );
}
```

### 6.12 apps/web/app/layout.tsx

```typescript
// apps/web/app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nexus - AI Agent Orchestration',
  description: 'AI Coding Agent Orchestration Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### 6.13 apps/web/next.config.ts

```typescript
// apps/web/next.config.ts

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@nexus/shared'],
  
  // xterm.js를 위한 설정
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
```

> **체크포인트**: `pnpm --filter web dev` → `http://localhost:3000` 대시보드 렌더링 확인

---

## 7. 환경 변수

### .env.example (루트)

```env
# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Database
NEXUS_DB_PATH=~/.nexus/nexus.db

# Budget
NEXUS_BUDGET_USD=50

# Server
SERVER_PORT=3001

# Client (Next.js)
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 설정 방법

```bash
# 루트에 .env 생성
cp .env.example .env

# API 키 설정
# 에디터로 .env 열어서 실제 키 입력

# apps/web에도 NEXT_PUBLIC_ 변수 필요 시 복사
echo "NEXT_PUBLIC_WS_URL=ws://localhost:3001" >> apps/web/.env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" >> apps/web/.env.local
```

---

## 8. 개발 서버 실행

### 전체 동시 실행 (Turborepo)

```bash
# 루트에서
pnpm dev

# 출력:
# ├── web#dev: ready at http://localhost:3000
# └── server#dev: running at http://localhost:3001
```

### 개별 실행

```bash
# 서버만
pnpm --filter server dev

# 웹만
pnpm --filter web dev

# 특정 패키지 빌드
pnpm --filter @nexus/adapters build
```

### 확인 사항

| URL | 설명 |
|-----|------|
| `http://localhost:3000` | Next.js 대시보드 |
| `http://localhost:3001/health` | Fastify 헬스체크 |
| `http://localhost:3001/agents` | 에이전트 목록 API |
| `ws://localhost:3001/ws/dashboard` | 대시보드 WebSocket |

---

## 9. Phase별 구현 순서

### Day 1: 프로젝트 뼈대

| 순서 | 작업 | 체크포인트 |
|------|------|-----------|
| 1 | Turborepo 셋업 | `pnpm install` 성공 |
| 2 | 패키지 구조 생성 | `apps/`, `packages/` 폴더 존재 |
| 3 | `packages/shared` types.ts | `pnpm --filter @nexus/shared build` 성공 |
| 4 | `packages/db` schema.sql | SQL 문법 확인 |

### Day 2: 백엔드 기초

| 순서 | 작업 | 체크포인트 |
|------|------|-----------|
| 5 | `packages/adapters` types.ts | 타입 컴파일 성공 |
| 6 | `packages/adapters` claude.ts | ClaudeAdapter 클래스 존재 |
| 7 | `apps/server` schema.ts + queries.ts | DB 초기화 성공 |
| 8 | `apps/server` AgentManager | `pnpm --filter server dev` 실행 |
| 9 | `apps/server` WebSocket handler | `/ws/dashboard` 연결 테스트 |

### Day 3: 프론트엔드 기초

| 순서 | 작업 | 체크포인트 |
|------|------|-----------|
| 10 | `apps/web` Zustand store | 상태 관리 동작 |
| 11 | `apps/web` useWebSocket hook | 연결 상태 표시 |
| 12 | `apps/web` Terminal 컴포넌트 | xterm 렌더링 성공 |

### Day 4: UI 조립

| 순서 | 작업 | 체크포인트 |
|------|------|-----------|
| 13 | Header, OrchestratorCard | 레이아웃 표시 |
| 14 | AgentCard 그리드 | 워커 카드 표시 |
| 15 | TerminalOverlay | 클릭 시 터미널 열림 |
| 16 | TaskInput | 프롬프트 전송 동작 |

### Day 5: 다중 에이전트

| 순서 | 작업 | 체크포인트 |
|------|------|-----------|
| 17 | codex.ts 어댑터 | Codex SDK 연동 |
| 18 | opencode.ts 어댑터 | OpenCode CLI 연동 |
| 19 | REST API 전체 | `/agents`, `/tasks` CRUD |
| 20 | 비용 추적 | `/budget` 응답 확인 |

### Day 6: 오케스트레이터 자율화

| 순서 | 작업 | 체크포인트 |
|------|------|-----------|
| 21 | orchestrator.ts tools | `spawn_agent` 호출 성공 |
| 22 | Auto Mode 흐름 | 오케스트레이터가 워커 생성 |
| 23 | 완료 감지 (`[TASK_COMPLETE]`) | 상태 자동 변경 |

### Day 7: 마무리

| 순서 | 작업 | 체크포인트 |
|------|------|-----------|
| 24 | 에러 처리 UI | 에러 상태 표시 |
| 25 | 재시도 버튼 | `/tasks/:id/retry` 동작 |
| 26 | 예산 경고 | 80% 초과 시 경고 |
| 27 | 통합 테스트 | E2E 플로우 성공 |

---

## 10. 자주 마주치는 문제 & 해결

### xterm.js SSR 이슈

**문제**: Next.js에서 xterm import 시 `window is not defined` 에러

**해결**:
```typescript
// dynamic import로 SSR 비활성화
import dynamic from 'next/dynamic';

const Terminal = dynamic(
  () => import('@/components/Terminal').then(m => m.Terminal),
  { ssr: false }
);
```

### OpenCode 서버 포트 충돌

**문제**: 여러 OpenCode 에이전트 실행 시 포트 충돌

**해결**:
```typescript
// 에이전트마다 고유 포트 할당
constructor(config: AdapterConfig, portOffset: number = 0) {
  this.serverPort = 4096 + portOffset;
}
```

### Claude Agent SDK 스트리밍 종료 감지

**문제**: 스트림 종료 시점 불명확

**해결**:
```typescript
// 시스템 프롬프트에 완료 마커 지시
const SYSTEM_PROMPT = `...완료 시 [TASK_COMPLETE] 출력...`;

// 청크에서 마커 감지
if (chunk.content.includes('[TASK_COMPLETE]')) {
  // 완료 처리
}
```

### WebSocket 재연결 시 터미널 히스토리 복원

**문제**: 재연결 후 이전 출력 손실

**해결**:
```typescript
// 서버에서 연결 시 기존 로그 전송
const logs = getTerminalLogs(agentId, 500);
for (const log of logs) {
  socket.send(JSON.stringify({ type: 'chunk', data: log.content }));
}
```

### better-sqlite3와 Fastify async 주의점

**문제**: better-sqlite3는 동기 API, Fastify는 async 핸들러

**해결**:
```typescript
// 쿼리 함수는 동기로 작성
export function getAgent(id: string): Agent | null {
  const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
  return stmt.get(id) as Agent | null;
}

// 라우트 핸들러에서 그대로 사용 (await 불필요)
fastify.get('/agents/:id', async (req, reply) => {
  const agent = getAgent(req.params.id); // 동기 호출
  return { agent };
});
```

### TypeScript 모노레포 경로 문제

**문제**: workspace 패키지 import 경로 오류

**해결**:
```json
// tsconfig.json (apps/server)
{
  "compilerOptions": {
    "paths": {
      "@nexus/shared": ["../../packages/shared/src"],
      "@nexus/adapters": ["../../packages/adapters/src"]
    }
  }
}
```

---

## 부록: 빠른 테스트 스크립트

### 에이전트 생성 테스트

```bash
# 오케스트레이터 생성
curl -X POST http://localhost:3001/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Conductor",
    "role": "Task orchestrator and coordinator",
    "sdk": "claude",
    "model": "claude-sonnet-4-20250514",
    "isOrchestrator": true
  }'

# 워커 생성
curl -X POST http://localhost:3001/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coder-1",
    "role": "Code implementation specialist",
    "sdk": "codex",
    "model": "o4-mini"
  }'
```

### 태스크 실행 테스트

```bash
# 태스크 할당 (agentId 교체 필요)
curl -X POST http://localhost:3001/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "AGENT_ID_HERE",
    "prompt": "Write a hello world function in TypeScript"
  }'
```

### WebSocket 테스트 (wscat)

```bash
# 설치
npm install -g wscat

# 대시보드 연결
wscat -c ws://localhost:3001/ws/dashboard

# 프롬프트 전송
> {"type":"prompt","agentId":"AGENT_ID","data":"hello"}
```

---

*End of Development Guide*
