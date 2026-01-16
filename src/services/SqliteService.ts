import * as Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { AgentInfo, PendingTask, ExternalRequest, FileLock, AgentMessage } from '../types/db';

export class SqliteService {
    private db: Database.Database | null = null;
    private dbPath: string;
    private logger: (msg: string) => void;
    private useFallback: boolean = false;

    constructor(storagePath: string, logger?: (msg: string) => void) {
        this.logger = logger || console.log;
        // Do not create directory if we are looking for existing DB in global path
        this.dbPath = path.join(storagePath, 'agentboard.db');
        this.logger(`[SqliteService] Initializing with DB path: ${this.dbPath}`);
        this.init();
    }

    private init() {
        try {
            this.logger(`[SqliteService] Attempting to open database with better-sqlite3...`);
            this.db = new Database(this.dbPath, { fileMustExist: false, verbose: this.logger });
            this.logger(`[SqliteService] Database opened successfully.`);
        } catch (error) {
            this.logger(`[SqliteService] Failed to initialize SQLite native driver: ${error}. Switching to fallback mode (system node).`);
            this.db = null;
            this.useFallback = true;
        }
    }

    private runQueryFallback(sql: string, params: any[]): any[] {
        if (!this.useFallback) return [];
        
        const script = `
        try {
            const Database = require(process.env.MODULE_PATH);
            const db = new Database(process.env.DB_PATH, { fileMustExist: false });
            const stmt = db.prepare(process.env.SQL);
            console.log(JSON.stringify(stmt.all(...JSON.parse(process.env.PARAMS))));
        } catch(e) { console.error(e); process.exit(1); }
        `;
        
        try {
            // Find better-sqlite3 path relative to this file or from node_modules
            // We assume 'better-sqlite3' is resolvable. If not, we might need a fixed path.
            let modulePath = '';
            try {
                modulePath = require.resolve('better-sqlite3');
            } catch {
                modulePath = 'better-sqlite3'; // Hope it's in node_path
            }

            const env = { 
                ...process.env, 
                DB_PATH: this.dbPath, 
                SQL: sql, 
                PARAMS: JSON.stringify(params),
                MODULE_PATH: modulePath
            };
            
            // Prefer full path to node if possible, but 'node' from PATH is usually safe on dev machines
            const res = cp.spawnSync('node', ['-e', script], { env, encoding: 'utf-8' });
            
            if (res.status !== 0) {
                this.logger(`[SqliteService] Fallback query failed: ${res.stderr}`);
                return [];
            }
            if (!res.stdout) return [];
            return JSON.parse(res.stdout);
        } catch (e) {
            this.logger(`[SqliteService] Fallback execution error: ${e}`);
            return [];
        }
    }

    // --- Agents ---

    public getActiveAgents(projectId: string): AgentInfo[] {
        if (!this.db && !this.useFallback) return [];
        try {
            // Table: agents (id, project_id, session_id, status, focus, last_heartbeat, created_at)
            const sql = 'SELECT * FROM agents WHERE project_id = ?';
            
            let rows: any[] = [];
            if (this.db) {
                const stmt = this.db.prepare(sql);
                rows = stmt.all(projectId) as any[];
            } else {
                rows = this.runQueryFallback(sql, [projectId]);
            }

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
        // Updates only supported in native mode for now or need implementing fallback exec
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
        if (!this.db && !this.useFallback) return [];
        try {
            // Table: tasks (id, project_id, title, description, from_project, from_agent, status, claimed_by, created_at...)
            // Local tasks: from_project IS NULL or empty
            const sql = "SELECT * FROM tasks WHERE project_id = ? AND (from_project IS NULL OR from_project = '') AND status != 'COMPLETED'";
            
            let rows: any[] = [];
            if (this.db) {
                const stmt = this.db.prepare(sql);
                rows = stmt.all(projectId) as any[];
            } else {
                rows = this.runQueryFallback(sql, [projectId]);
            }

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
        if (!this.db && !this.useFallback) return [];
        try {
            // External requests: from_project IS NOT NULL
            const sql = "SELECT * FROM tasks WHERE project_id = ? AND from_project IS NOT NULL AND from_project != ''";
            
            let rows: any[] = [];
            if (this.db) {
                const stmt = this.db.prepare(sql);
                rows = stmt.all(projectId) as any[];
            } else {
                rows = this.runQueryFallback(sql, [projectId]);
            }
            
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
        if (!this.db && !this.useFallback) return [];
        try {
            // Table: locks (resource, project_id, agent_id, acquired_at)
            const sql = 'SELECT * FROM locks WHERE project_id = ?';
            
            let rows: any[] = [];
            if (this.db) {
                const stmt = this.db.prepare(sql);
                rows = stmt.all(projectId) as any[];
            } else {
                rows = this.runQueryFallback(sql, [projectId]);
            }

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
        if (!this.db && !this.useFallback) return [];
        try {
            // Table: messages (id, project_id, agent_id, message, timestamp)
            const sql = 'SELECT * FROM messages WHERE project_id = ? ORDER BY id DESC LIMIT ?';
            
            let rows: any[] = [];
            if (this.db) {
                const stmt = this.db.prepare(sql);
                rows = stmt.all(projectId, limit) as any[];
            } else {
                rows = this.runQueryFallback(sql, [projectId, limit]);
            }

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