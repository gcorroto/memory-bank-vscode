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
        this.logger(`[SqliteService] ===== CONSTRUCTOR DEBUG =====`);
        this.logger(`[SqliteService] storagePath received: ${storagePath}`);
        this.logger(`[SqliteService] Full DB path: ${this.dbPath}`);
        this.logger(`[SqliteService] File exists: ${fs.existsSync(this.dbPath)}`);
        
        if (fs.existsSync(this.dbPath)) {
            const stats = fs.statSync(this.dbPath);
            this.logger(`[SqliteService] File size: ${stats.size} bytes`);
            this.logger(`[SqliteService] Last modified: ${stats.mtime.toISOString()}`);
        }
        
        this.init();
    }

    private init() {
        if (!fs.existsSync(this.dbPath)) {
            this.logger(`[SqliteService] ERROR: Database file does not exist at ${this.dbPath}`);
            this.db = null;
            return;
        }
        
        try {
            this.logger(`[SqliteService] Attempting to open database with better-sqlite3...`);
            this.db = new Database(this.dbPath, { fileMustExist: true });
            this.logger(`[SqliteService] Database opened successfully!`);
            
            // Quick sanity check - list tables
            try {
                const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name: string}[];
                this.logger(`[SqliteService] Tables in DB: ${tables.map(t => t.name).join(', ')}`);
            } catch (e) {
                this.logger(`[SqliteService] Could not list tables: ${e}`);
            }
        } catch (error) {
            this.logger(`[SqliteService] Failed to initialize SQLite native driver: ${error}`);
            this.logger(`[SqliteService] Switching to fallback mode (system node).`);
            this.db = null;
            this.useFallback = true;
        }
    }

    private runQueryFallback(sql: string, params: any[]): any[] {
        this.logger(`[SqliteService] runQueryFallback called - useFallback: ${this.useFallback}`);
        if (!this.useFallback) {
            this.logger(`[SqliteService] Fallback not enabled, returning empty`);
            return [];
        }
        
        // Use a simple inline script that requires better-sqlite3 from the extension's node_modules
        // The script receives DB_PATH, SQL and PARAMS via environment variables
        const extensionRoot = path.resolve(__dirname, '..', '..');
        const modulePath = path.join(extensionRoot, 'node_modules', 'better-sqlite3');
        
        this.logger(`[SqliteService] Fallback extensionRoot: ${extensionRoot}`);
        this.logger(`[SqliteService] Fallback modulePath: ${modulePath}`);
        this.logger(`[SqliteService] Fallback dbPath: ${this.dbPath}`);
        this.logger(`[SqliteService] Fallback SQL: ${sql}`);
        this.logger(`[SqliteService] Fallback params: ${JSON.stringify(params)}`);
        
        const script = `
const Database = require('${modulePath.replace(/\\/g, '\\\\')}');
const db = new Database('${this.dbPath.replace(/\\/g, '\\\\')}', { fileMustExist: true });
const stmt = db.prepare(\`${sql}\`);
const params = ${JSON.stringify(params)};
const result = stmt.all(...params);
console.log(JSON.stringify(result));
        `;
        
        try {
            this.logger(`[SqliteService] Executing fallback via system node...`);
            const res = cp.spawnSync('node', ['-e', script], { 
                encoding: 'utf-8',
                timeout: 10000 
            });
            
            this.logger(`[SqliteService] Fallback exit code: ${res.status}`);
            
            if (res.stderr) {
                this.logger(`[SqliteService] Fallback stderr: ${String(res.stderr)}`);
            }
            
            if (res.status !== 0) {
                this.logger(`[SqliteService] Fallback query failed with code ${res.status}`);
                return [];
            }
            
            const stdout = String(res.stdout || '');
            if (!stdout || stdout.trim() === '') {
                this.logger(`[SqliteService] Fallback returned empty stdout`);
                return [];
            }
            
            this.logger(`[SqliteService] Fallback stdout: ${stdout.substring(0, 500)}`);
            const result = JSON.parse(stdout);
            this.logger(`[SqliteService] Fallback parsed ${result.length} rows`);
            return result;
        } catch (e) {
            this.logger(`[SqliteService] Fallback execution error: ${e}`);
            return [];
        }
    }

    // --- Agents ---

    public getActiveAgents(projectId: string): AgentInfo[] {
        this.logger(`[SqliteService] ===== getActiveAgents DEBUG =====`);
        this.logger(`[SqliteService] projectId: "${projectId}"`);
        this.logger(`[SqliteService] this.db is set: ${!!this.db}`);
        this.logger(`[SqliteService] this.useFallback: ${this.useFallback}`);
        
        if (!this.db && !this.useFallback) {
            this.logger(`[SqliteService] ABORT: No DB and no fallback available`);
            return [];
        }
        
        try {
            // Table: agents (id, project_id, session_id, status, focus, last_heartbeat, created_at)
            const sql = 'SELECT * FROM agents WHERE project_id = ?';
            this.logger(`[SqliteService] SQL: ${sql}`);
            this.logger(`[SqliteService] Params: [${projectId}]`);
            
            let rows: any[] = [];
            if (this.db) {
                this.logger(`[SqliteService] Using native better-sqlite3`);
                const stmt = this.db.prepare(sql);
                rows = stmt.all(projectId) as any[];
            } else {
                this.logger(`[SqliteService] Using fallback (system node)`);
                rows = this.runQueryFallback(sql, [projectId]);
            }
            
            this.logger(`[SqliteService] Raw rows returned: ${rows.length}`);
            if (rows.length > 0) {
                this.logger(`[SqliteService] First row: ${JSON.stringify(rows[0])}`);
            }
            
            // Also check ALL agents in DB regardless of project
            if (this.db) {
                const allAgents = this.db.prepare('SELECT * FROM agents').all() as any[];
                this.logger(`[SqliteService] Total agents in DB (all projects): ${allAgents.length}`);
                if (allAgents.length > 0) {
                    this.logger(`[SqliteService] All project_ids in DB: ${[...new Set(allAgents.map((a: any) => a.project_id))].join(', ')}`);
                }
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
            this.logger(`[SqliteService] ERROR querying agents: ${e}`);
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