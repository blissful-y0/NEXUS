import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import type { Agent, AgentConfig, AgentStatus, Task, CostEntry } from '@nexus/shared';

const DB_DIR = join(homedir(), '.nexus');
const DB_PATH = process.env.NEXUS_DB_PATH || join(DB_DIR, 'nexus.db');

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

export const db: InstanceType<typeof Database> = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  const schemaPath = join(__dirname, 'schema.sql');

  try {
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  } catch {
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
  }
}

export function closeDatabase(): void {
  db.close();
}

// ============ Agents ============

export function createAgent(config: AgentConfig): Agent {
  const id = generateId();
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
  const row = stmt.get(id) as Record<string, unknown> | undefined;

  if (!row) return null;

  return mapAgentRow(row);
}

export function listAgents(): Agent[] {
  const stmt = db.prepare(`SELECT * FROM agents ORDER BY created_at DESC`);
  const rows = stmt.all() as Record<string, unknown>[];

  return rows.map(mapAgentRow);
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
  const id = generateId();
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
  const row = stmt.get(id) as Record<string, unknown> | undefined;

  if (!row) return null;

  return mapTaskRow(row);
}

export function listTasks(agentId?: string): Task[] {
  const stmt = agentId
    ? db.prepare(`SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC`)
    : db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC`);

  const rows = (agentId ? stmt.all(agentId) : stmt.all()) as Record<string, unknown>[];

  return rows.map(mapTaskRow);
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
  const rows = stmt.all(agentId, limit) as Record<string, unknown>[];

  return rows.reverse().map((row) => ({
    chunkType: row.chunk_type as string,
    content: row.content as string,
    createdAt: row.created_at as string,
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

// ============ Helpers ============

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function mapAgentRow(row: Record<string, unknown>): Agent {
  return {
    id: row.id as string,
    name: row.name as string,
    role: row.role as string,
    sdk: row.sdk as Agent['sdk'],
    model: row.model as string,
    status: row.status as AgentStatus,
    currentTask: row.current_task as string | null,
    isOrchestrator: row.is_orchestrator === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapTaskRow(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    prompt: row.prompt as string,
    status: row.status as Task['status'],
    resultSummary: row.result_summary as string | null,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | null,
  };
}
