import * as Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { AgentInfo, PendingTask, ExternalRequest, FileLock, AgentMessage } from '../types/db';

export class SqliteService {
    private db: Database.Database | null = null;
    private dbPath: string;

    constructor(storagePath: string) {
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
        this.dbPath = path.join(storagePath, 'agents_v1.db');
        this.init();
    }

    private init() {
        try {
            this.db = new Database(this.dbPath);
            this.createTables();
        } catch (error) {
            console.error('Failed to initialize SQLite database:', error);
            this.db = null;
        }
    }

    private createTables() {
        if (!this.db) return;

        // Active Agents
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS agents (
                agent_id TEXT PRIMARY KEY,
                project_id TEXT,
                status TEXT,
                focus TEXT,
                session_id TEXT,
                last_heartbeat TEXT
            )
        `);

        // Pending Tasks
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS pending_tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                title TEXT,
                assigned_to TEXT,
                from_source TEXT,
                status TEXT,
                created_at TEXT
            )
        `);

        // External Requests
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS external_requests (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                title TEXT,
                from_project TEXT,
                context TEXT,
                status TEXT,
                received_at TEXT
            )
        `);

        // File Locks
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS file_locks (
                pattern TEXT,
                project_id TEXT,
                claimed_by TEXT,
                since TEXT,
                PRIMARY KEY (pattern, project_id)
            )
        `);

        // Agent Messages
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS agent_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT,
                message TEXT,
                timestamp TEXT
            )
        `);
    }

    // --- Agents ---

    public getActiveAgents(projectId: string): AgentInfo[] {
        if (!this.db) return [];
        const stmt = this.db.prepare('SELECT * FROM agents WHERE project_id = ?');
        const rows = stmt.all(projectId) as any[];
        return rows.map(r => ({
            id: r.agent_id,
            projectId: r.project_id,
            status: r.status,
            focus: r.focus,
            sessionId: r.session_id,
            lastHeartbeat: r.last_heartbeat
        }));
    }

    public updateAgent(agent: AgentInfo): void {
        if (!this.db) return;
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO agents (agent_id, project_id, status, focus, session_id, last_heartbeat)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(agent.id, agent.projectId, agent.status, agent.focus, agent.sessionId, agent.lastHeartbeat);
    }

    public removeAgent(agentId: string, projectId: string): void {
        if (!this.db) return;
        this.db.prepare('DELETE FROM agents WHERE agent_id = ? AND project_id = ?').run(agentId, projectId);
    }

    // --- Tasks ---

    public getPendingTasks(projectId: string): PendingTask[] {
        if (!this.db) return [];
        const stmt = this.db.prepare('SELECT * FROM pending_tasks WHERE project_id = ?');
        const rows = stmt.all(projectId) as any[];
        return rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            title: r.title,
            assignedTo: r.assigned_to,
            from: r.from_source,
            status: r.status,
            createdAt: r.created_at
        }));
    }

    public addPendingTask(task: PendingTask): void {
        if (!this.db) return;
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO pending_tasks (id, project_id, title, assigned_to, from_source, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(task.id, task.projectId, task.title, task.assignedTo, task.from, task.status, task.createdAt);
    }

    public updateTaskStatus(taskId: string, status: string): void {
        if (!this.db) return;
        this.db.prepare('UPDATE pending_tasks SET status = ? WHERE id = ?').run(status, taskId);
    }

    // --- External Requests ---

    public getExternalRequests(projectId: string): ExternalRequest[] {
        if (!this.db) return [];
        const stmt = this.db.prepare('SELECT * FROM external_requests WHERE project_id = ?');
        const rows = stmt.all(projectId) as any[];
        return rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            title: r.title,
            fromProject: r.from_project,
            context: r.context,
            status: r.status,
            receivedAt: r.received_at
        }));
    }

    public addExternalRequest(request: ExternalRequest): void {
        if (!this.db) return;
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO external_requests (id, project_id, title, from_project, context, status, received_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(request.id, request.projectId, request.title, request.fromProject, request.context, request.status, request.receivedAt);
    }

    public updateExternalRequestStatus(requestId: string, status: string): void {
        if (!this.db) return;
        this.db.prepare('UPDATE external_requests SET status = ? WHERE id = ?').run(status, requestId);
    }

    // --- File Locks ---

    public getFileLocks(projectId: string): FileLock[] {
        if (!this.db) return [];
        const stmt = this.db.prepare('SELECT * FROM file_locks WHERE project_id = ?');
        const rows = stmt.all(projectId) as any[];
        return rows.map(r => ({
            pattern: r.pattern,
            projectId: r.project_id,
            claimedBy: r.claimed_by,
            since: r.since
        }));
    }

    public addFileLock(lock: FileLock): void {
        if (!this.db) return;
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO file_locks (pattern, project_id, claimed_by, since)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(lock.pattern, lock.projectId, lock.claimedBy, lock.since);
    }

    public releaseFileLock(pattern: string, projectId: string): void {
        if (!this.db) return;
        this.db.prepare('DELETE FROM file_locks WHERE pattern = ? AND project_id = ?').run(pattern, projectId);
    }

    // --- Messages ---
    
    public getMessages(projectId: string, limit: number = 20): AgentMessage[] {
        if (!this.db) return [];
        const stmt = this.db.prepare('SELECT * FROM agent_messages WHERE project_id = ? ORDER BY id DESC LIMIT ?');
        const rows = stmt.all(projectId, limit) as any[];
        return rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            message: r.message,
            timestamp: r.timestamp
        }));
    }

    public addMessage(projectId: string, message: string): void {
        if (!this.db) return;
        const timestamp = new Date().toISOString();
        const stmt = this.db.prepare('INSERT INTO agent_messages (project_id, message, timestamp) VALUES (?, ?, ?)');
        stmt.run(projectId, message, timestamp);
    }

    public close() {
        if (this.db) {
            this.db.close();
        }
    }
}
