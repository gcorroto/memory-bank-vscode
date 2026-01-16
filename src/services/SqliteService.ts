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
        this.dbPath = path.join(storagePath, 'agentboard.db');
        this.init();
    }

    private init() {
        try {
            this.db = new Database(this.dbPath, { fileMustExist: false });
            // Note: We don't force CreateTables here because we expect the schema to match agentboard.db
            // If it doesn't exist, we might want to create it, but adhering to the NEW schema.
            // But usually this DB is shared/managed by the server.
            // For safety, we can define the schema if not exists, but using the CORRECT schema.
        } catch (error) {
            console.error('Failed to initialize SQLite database:', error);
            this.db = null;
        }
    }

    // --- Agents ---

    public getActiveAgents(projectId: string): AgentInfo[] {
        if (!this.db) return [];
        try {
            // Table: agents (id, project_id, session_id, status, focus, last_heartbeat, created_at)
            const stmt = this.db.prepare('SELECT * FROM agents WHERE project_id = ?');
            const rows = stmt.all(projectId) as any[];
            return rows.map(r => ({
                id: r.id, // mapped from id
                projectId: r.project_id,
                status: r.status,
                focus: r.focus,
                sessionId: r.session_id,
                lastHeartbeat: r.last_heartbeat
            }));
        } catch (e) {
            console.error('Error querying agents:', e);
            return [];
        }
    }

    public updateAgent(agent: AgentInfo): void {
        if (!this.db) return;
        try {
             // We need to match columns: id, project_id, status, focus, session_id, last_heartbeat
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO agents (id, project_id, status, focus, session_id, last_heartbeat)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            stmt.run(agent.id, agent.projectId, agent.status, agent.focus, agent.sessionId, agent.lastHeartbeat);
        } catch (e) {
            console.error('Error updating agent:', e);
        }
    }

    public removeAgent(agentId: string, projectId: string): void {
        if (!this.db) return;
        try {
             this.db.prepare('DELETE FROM agents WHERE id = ? AND project_id = ?').run(agentId, projectId);
        } catch (e) {
            console.error('Error removing agent:', e);
        }
    }

    // --- Tasks (Merged PendingTasks + ExternalRequests) ---

    public getPendingTasks(projectId: string): PendingTask[] {
        if (!this.db) return [];
        try {
            // Table: tasks (id, project_id, title, description, from_project, from_agent, status, claimed_by, created_at...)
            // Local tasks: from_project IS NULL or empty
            const stmt = this.db.prepare("SELECT * FROM tasks WHERE project_id = ? AND (from_project IS NULL OR from_project = '') AND status != 'COMPLETED'");
            const rows = stmt.all(projectId) as any[];
            return rows.map(r => ({
                id: r.id,
                projectId: r.project_id,
                title: r.title,
                assignedTo: r.claimed_by || '', 
                from: r.from_agent || 'Local',
                status: r.status,
                createdAt: r.created_at
            }));
        } catch (e) {
            console.error('Error querying pending tasks:', e);
            return [];
        }
    }

    public addPendingTask(task: PendingTask): void {
        if (!this.db) return;
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO tasks (id, project_id, title, claimed_by, from_agent, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(task.id, task.projectId, task.title, task.assignedTo, task.from, task.status, task.createdAt);
        } catch (e) {
             console.error('Error adding pending task:', e);
        }
    }

    public updateTaskStatus(taskId: string, status: string): void {
        if (!this.db) return;
         try {
            this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, taskId);
         } catch (e) {
             console.error('Error updating task status:', e);
         }
    }

    // --- External Requests ---

    public getExternalRequests(projectId: string): ExternalRequest[] {
        if (!this.db) return [];
        try {
            // External requests: from_project IS NOT NULL
            const stmt = this.db.prepare("SELECT * FROM tasks WHERE project_id = ? AND from_project IS NOT NULL AND from_project != ''");
            const rows = stmt.all(projectId) as any[];
            return rows.map(r => ({
                id: r.id,
                projectId: r.project_id,
                title: r.title,
                fromProject: r.from_project,
                context: r.description || '', // mapped from description
                status: r.status,
                receivedAt: r.created_at // using created_at
            }));
        } catch (e) {
            console.error('Error querying external requests:', e);
            return [];
        }
    }

    public addExternalRequest(request: ExternalRequest): void {
        if (!this.db) return;
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO tasks (id, project_id, title, from_project, description, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(request.id, request.projectId, request.title, request.fromProject, request.context, request.status, request.receivedAt);
        } catch (e) {
             console.error('Error adding external request:', e);
        }
    }

    public updateExternalRequestStatus(requestId: string, status: string): void {
        if (!this.db) return;
        try {
            this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, requestId);
        } catch (e) {
             console.error('Error updating external request status:', e);
        }
    }

    // --- File Locks ---

    public getFileLocks(projectId: string): FileLock[] {
        if (!this.db) return [];
        try {
            // Table: locks (resource, project_id, agent_id, acquired_at)
            const stmt = this.db.prepare('SELECT * FROM locks WHERE project_id = ?');
            const rows = stmt.all(projectId) as any[];
            return rows.map(r => ({
                pattern: r.resource,
                projectId: r.project_id,
                claimedBy: r.agent_id,
                since: r.acquired_at
            }));
        } catch (e) {
            console.error('Error querying locks:', e);
            return [];
        }
    }

    public addFileLock(lock: FileLock): void {
        if (!this.db) return;
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO locks (resource, project_id, agent_id, acquired_at)
                VALUES (?, ?, ?, ?)
            `);
            stmt.run(lock.pattern, lock.projectId, lock.claimedBy, lock.since);
        } catch (e) {
            console.error('Error adding lock:', e);
        }
    }

    public releaseFileLock(pattern: string, projectId: string): void {
        if (!this.db) return;
         try {
            this.db.prepare('DELETE FROM locks WHERE resource = ? AND project_id = ?').run(pattern, projectId);
         } catch (e) {
             console.error('Error releasing lock:', e);
         }
    }

    // --- Messages ---
    
    public getMessages(projectId: string, limit: number = 20): AgentMessage[] {
        if (!this.db) return [];
        try {
            // Table: messages (id, project_id, agent_id, message, timestamp)
            const stmt = this.db.prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY id DESC LIMIT ?');
            const rows = stmt.all(projectId, limit) as any[];
            return rows.map(r => ({
                id: r.id,
                projectId: r.project_id,
                message: r.message,
                timestamp: r.timestamp
            }));
        } catch (e) {
             console.error('Error querying messages:', e);
             return [];
        }
    }

    public addMessage(projectId: string, message: string): void {
        if (!this.db) return;
        try {
            const timestamp = new Date().toISOString();
            // Assuming agent_id is optional or we put 'SYSTEM'
            const stmt = this.db.prepare('INSERT INTO messages (project_id, agent_id, message, timestamp) VALUES (?, ?, ?, ?)');
            stmt.run(projectId, 'SYSTEM', message, timestamp);
        } catch (e) {
             console.error('Error adding message:', e);
        }
    }

    public close() {
        if (this.db) {
            this.db.close();
        }
    }

    // --- Sync (Updated for new schema) ---
    
    public syncAgents(agents: AgentInfo[]) {
        if (!this.db || agents.length === 0) return;
        const projectId = agents[0].projectId;

        // Note: DELETE fails if schema mismatch?
        try {
            const deleteStmt = this.db.prepare('DELETE FROM agents WHERE project_id = ?');
            const insertStmt = this.db.prepare(`
                INSERT INTO agents (id, project_id, status, focus, session_id, last_heartbeat)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            this.db.transaction(() => {
                deleteStmt.run(projectId);
                for (const agent of agents) {
                    insertStmt.run(agent.id, agent.projectId, agent.status, agent.focus, agent.sessionId, agent.lastHeartbeat);
                }
            })();
        } catch (e) {
             console.error('Error syncing agents:', e);
        }
    }

    public syncPendingTasks(tasks: PendingTask[]) {
        if (!this.db || tasks.length === 0) return;
        // tasks table is mixed. If we assume provided tasks are ONLY "local", we should update/insert them.
        try {
            const insertStmt = this.db.prepare(`
                INSERT OR REPLACE INTO tasks (id, project_id, title, claimed_by, from_agent, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            this.db.transaction(() => {
                for (const task of tasks) {
                    insertStmt.run(task.id, task.projectId, task.title, task.assignedTo, task.from, task.status, task.createdAt);
                }
            })();
        } catch (e) {
            console.error('Error syncing pending tasks:', e);
        }
    }

    public syncExternalRequests(requests: ExternalRequest[]) {
        if (!this.db || requests.length === 0) return;
        try {
            const insertStmt = this.db.prepare(`
                INSERT OR REPLACE INTO tasks (id, project_id, title, from_project, description, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            this.db.transaction(() => {
                for (const req of requests) {
                    insertStmt.run(req.id, req.projectId, req.title, req.fromProject, req.context, req.status, req.receivedAt);
                }
            })();
        } catch (e) {
             console.error('Error syncing external requests:', e);
        }
    }

    public syncFileLocks(locks: FileLock[]) {
        if (!this.db || locks.length === 0) return;
        const projectId = locks[0].projectId;

        try {
            const deleteStmt = this.db.prepare('DELETE FROM locks WHERE project_id = ?');
            const insertStmt = this.db.prepare(`
                INSERT INTO locks (resource, project_id, agent_id, acquired_at)
                VALUES (?, ?, ?, ?)
            `);

            this.db.transaction(() => {
                deleteStmt.run(projectId);
                for (const lock of locks) {
                    insertStmt.run(lock.pattern, lock.projectId, lock.claimedBy, lock.since);
                }
            })();
        } catch (e) {
             console.error('Error syncing locks:', e);
        }
    }
}