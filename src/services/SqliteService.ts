// sql.js - SQLite compiled to WebAssembly (no native compilation required)
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentInfo, PendingTask, ExternalRequest, FileLock, AgentMessage } from '../types/db';

// sql.js types
interface SqlJsDatabase {
    exec(sql: string): { columns: string[]; values: any[][] }[];
    run(sql: string, params?: any[]): void;
    prepare(sql: string): SqlJsStatement;
    close(): void;
}

interface SqlJsStatement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, any>;
    free(): void;
}

interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

export class SqliteService {
    private db: SqlJsDatabase | null = null;
    private dbPath: string;
    private logger: (msg: string) => void;
    private initPromise: Promise<void>;
    private extensionPath: string;

    constructor(storagePath: string, logger?: (msg: string) => void, extensionPath?: string) {
        this.logger = logger || console.log;
        this.dbPath = path.join(storagePath, 'agentboard.db');
        this.extensionPath = extensionPath || '';
        
        this.logger(`[SqliteService] ========== INIT DEBUG ==========`);
        this.logger(`[SqliteService] storagePath received: "${storagePath}"`);
        this.logger(`[SqliteService] Computed dbPath: "${this.dbPath}"`);
        this.logger(`[SqliteService] os.homedir(): "${os.homedir()}"`);
        this.logger(`[SqliteService] Expected MCP path: "${path.join(os.homedir(), '.memorybank', 'agentboard.db')}"`);
        this.logger(`[SqliteService] File exists at dbPath: ${fs.existsSync(this.dbPath)}`);
        this.logger(`[SqliteService] extensionPath: "${this.extensionPath}"`);
        this.logger(`[SqliteService] ================================`);
        
        this.initPromise = this.init();
    }

    private async init(): Promise<void> {
        if (!fs.existsSync(this.dbPath)) {
            this.logger(`[SqliteService] ERROR: Database file does not exist at ${this.dbPath}`);
            return;
        }
        
        try {
            // Use asm.js version of sql.js - it doesn't require WASM and avoids
            // all the WASM loading issues in VS Code's extension host
            const sqlAsmPath = path.join(__dirname, 'sql-asm.js');
            this.logger(`[SqliteService] Loading sql-asm.js from: ${sqlAsmPath}`);
            
            if (!fs.existsSync(sqlAsmPath)) {
                throw new Error(`sql-asm.js not found at: ${sqlAsmPath}`);
            }
            
            // Use eval to bypass webpack's require transformation
            // This loads the module using Node's native require
            const nodeRequire = eval('require');
            const initSqlJs = nodeRequire(sqlAsmPath);
            this.logger(`[SqliteService] initSqlJs loaded, type: ${typeof initSqlJs}`);
            
            let SQL: SqlJsStatic;
            const initFn = typeof initSqlJs === 'function' ? initSqlJs : initSqlJs.default;
            
            if (!initFn) {
                throw new Error(`sql-asm.js module is not callable: ${typeof initSqlJs}`);
            }
            
            // asm.js version doesn't need any config
            this.logger(`[SqliteService] Initializing SQL (asm.js)...`);
            SQL = await initFn();
            this.logger(`[SqliteService] sql.js initialized successfully`);
            
            // Read the database file
            const fileBuffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(new Uint8Array(fileBuffer));
            
            // Get tables
            const tablesResult = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            const tables = tablesResult.length > 0 ? tablesResult[0].values.map(v => v[0]) : [];
            this.logger(`[SqliteService] Connected via sql.js. Tables: ${tables.join(', ')}`);
            
            // DEBUG: Count agents in DB
            const countResult = this.db.exec('SELECT COUNT(*) as cnt FROM agents');
            const agentCount = countResult.length > 0 ? countResult[0].values[0][0] : 0;
            this.logger(`[SqliteService] Total agents in DB: ${agentCount}`);
            
            // DEBUG: Show all agents with their project_id
            const agentsResult = this.db.exec('SELECT id, project_id, status FROM agents');
            if (agentsResult.length > 0) {
                const allAgents = agentsResult[0].values.map(row => ({
                    id: row[0],
                    project_id: row[1],
                    status: row[2]
                }));
                this.logger(`[SqliteService] All agents: ${JSON.stringify(allAgents)}`);
            } else {
                this.logger(`[SqliteService] No agents found in DB`);
            }
            
        } catch (error) {
            this.logger(`[SqliteService] ERROR: Failed to open database: ${error}`);
            this.db = null;
        }
    }
    
    /**
     * Ensures the database is initialized before any operation
     */
    public async ensureInitialized(): Promise<boolean> {
        await this.initPromise;
        return this.db !== null;
    }

    // --- Agents ---

    public getActiveAgents(projectId: string): AgentInfo[] {
        this.logger(`[SqliteService] getActiveAgents called with projectId: "${projectId}"`);
        this.logger(`[SqliteService] DB connection active: ${!!this.db}`);
        
        if (!this.db) {
            this.logger(`[SqliteService] ERROR: No DB connection!`);
            return [];
        }
        
        try {
            // First, let's see what project_ids exist in the agents table
            const distinctResult = this.db.exec('SELECT DISTINCT project_id FROM agents');
            if (distinctResult.length > 0) {
                const distinctProjects = distinctResult[0].values.map(v => v[0]);
                this.logger(`[SqliteService] Distinct project_ids in agents table: ${JSON.stringify(distinctProjects)}`);
            }
            
            // Query with parameter binding using sql.js syntax
            const stmt = this.db.prepare('SELECT * FROM agents WHERE project_id = ?');
            stmt.bind([projectId]);
            
            const rows: AgentInfo[] = [];
            while (stmt.step()) {
                const row = stmt.getAsObject() as any;
                rows.push({
                    id: row.id,
                    projectId: row.project_id,
                    status: row.status,
                    focus: row.focus,
                    sessionId: row.session_id,
                    lastHeartbeat: row.last_heartbeat
                });
            }
            stmt.free();
            
            this.logger(`[SqliteService] Query result: ${rows.length} agents for project "${projectId}"`);
            
            return rows;
        } catch (e) {
            this.logger(`[SqliteService] ERROR querying agents: ${e}`);
            return [];
        }
    }

    public updateAgent(agent: AgentInfo): void {
        if (!this.db) return; 
        try {
            this.db.run(`
                INSERT OR REPLACE INTO agents (id, project_id, status, focus, session_id, last_heartbeat)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [agent.id, agent.projectId, agent.status, agent.focus, agent.sessionId, agent.lastHeartbeat]);
        } catch (e) {
            console.error('Error updating agent:', e);
        }
    }

    public removeAgent(agentId: string, projectId: string): void {
        if (!this.db) return;
        try {
            this.db.run('DELETE FROM agents WHERE id = ? AND project_id = ?', [agentId, projectId]);
        } catch (e) {
            console.error('Error removing agent:', e);
        }
    }

    // --- Tasks (Merged PendingTasks + ExternalRequests) ---

    public getPendingTasks(projectId: string): PendingTask[] {
        if (!this.db) return [];
        try {
            const stmt = this.db.prepare(
                "SELECT * FROM tasks WHERE project_id = ? AND (from_project IS NULL OR from_project = '') AND status != 'COMPLETED'"
            );
            stmt.bind([projectId]);
            
            const rows: PendingTask[] = [];
            while (stmt.step()) {
                const r = stmt.getAsObject() as any;
                rows.push({
                    id: r.id,
                    projectId: r.project_id,
                    title: r.title,
                    assignedTo: r.claimed_by || '', 
                    from: r.from_agent || 'Local',
                    status: r.status,
                    createdAt: r.created_at
                });
            }
            stmt.free();
            return rows;
        } catch (e) {
            this.logger(`[SqliteService] ERROR querying pending tasks: ${e}`);
            return [];
        }
    }

    public addPendingTask(task: PendingTask): void {
        if (!this.db) return;
        try {
            this.db.run(`
                INSERT OR REPLACE INTO tasks (id, project_id, title, claimed_by, from_agent, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [task.id, task.projectId, task.title, task.assignedTo, task.from, task.status, task.createdAt]);
        } catch (e) {
             console.error('Error adding pending task:', e);
        }
    }

    public updateTaskStatus(taskId: string, status: string): void {
        if (!this.db) return;
         try {
            this.db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, taskId]);
         } catch (e) {
             console.error('Error updating task status:', e);
         }
    }

    // --- External Requests ---

    public getExternalRequests(projectId: string): ExternalRequest[] {
        if (!this.db) return [];
        try {
            const stmt = this.db.prepare(
                "SELECT * FROM tasks WHERE project_id = ? AND from_project IS NOT NULL AND from_project != ''"
            );
            stmt.bind([projectId]);
            
            const rows: ExternalRequest[] = [];
            while (stmt.step()) {
                const r = stmt.getAsObject() as any;
                rows.push({
                    id: r.id,
                    projectId: r.project_id,
                    title: r.title,
                    fromProject: r.from_project,
                    context: r.description || '',
                    status: r.status,
                    receivedAt: r.created_at
                });
            }
            stmt.free();
            return rows;
        } catch (e) {
            this.logger(`[SqliteService] ERROR querying external requests: ${e}`);
            return [];
        }
    }

    public addExternalRequest(request: ExternalRequest): void {
        if (!this.db) return;
        try {
            this.db.run(`
                INSERT OR REPLACE INTO tasks (id, project_id, title, from_project, description, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [request.id, request.projectId, request.title, request.fromProject, request.context, request.status, request.receivedAt]);
        } catch (e) {
             console.error('Error adding external request:', e);
        }
    }

    public updateExternalRequestStatus(requestId: string, status: string): void {
        if (!this.db) return;
        try {
            this.db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, requestId]);
        } catch (e) {
             console.error('Error updating external request status:', e);
        }
    }

    // --- File Locks ---

    public getFileLocks(projectId: string): FileLock[] {
        if (!this.db) return [];
        try {
            const stmt = this.db.prepare('SELECT * FROM locks WHERE project_id = ?');
            stmt.bind([projectId]);
            
            const rows: FileLock[] = [];
            while (stmt.step()) {
                const r = stmt.getAsObject() as any;
                rows.push({
                    pattern: r.resource,
                    projectId: r.project_id,
                    claimedBy: r.agent_id,
                    since: r.acquired_at
                });
            }
            stmt.free();
            return rows;
        } catch (e) {
            this.logger(`[SqliteService] ERROR querying locks: ${e}`);
            return [];
        }
    }

    public addFileLock(lock: FileLock): void {
        if (!this.db) return;
        try {
            this.db.run(`
                INSERT OR REPLACE INTO locks (resource, project_id, agent_id, acquired_at)
                VALUES (?, ?, ?, ?)
            `, [lock.pattern, lock.projectId, lock.claimedBy, lock.since]);
        } catch (e) {
            console.error('Error adding lock:', e);
        }
    }

    public releaseFileLock(pattern: string, projectId: string): void {
        if (!this.db) return;
         try {
            this.db.run('DELETE FROM locks WHERE resource = ? AND project_id = ?', [pattern, projectId]);
         } catch (e) {
             console.error('Error releasing lock:', e);
         }
    }

    // --- Messages ---
    
    public getMessages(projectId: string, limit: number = 20): AgentMessage[] {
        if (!this.db) return [];
        try {
            const stmt = this.db.prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY id DESC LIMIT ?');
            stmt.bind([projectId, limit]);
            
            const rows: AgentMessage[] = [];
            while (stmt.step()) {
                const r = stmt.getAsObject() as any;
                rows.push({
                    id: r.id,
                    projectId: r.project_id,
                    message: r.message,
                    timestamp: r.timestamp
                });
            }
            stmt.free();
            return rows;
        } catch (e) {
            this.logger(`[SqliteService] ERROR querying messages: ${e}`);
            return [];
        }
    }

    public addMessage(projectId: string, message: string): void {
        if (!this.db) return;
        try {
            const timestamp = new Date().toISOString();
            this.db.run('INSERT INTO messages (project_id, agent_id, message, timestamp) VALUES (?, ?, ?, ?)',
                [projectId, 'SYSTEM', message, timestamp]);
        } catch (e) {
             console.error('Error adding message:', e);
        }
    }

    public close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    // --- Sync (Updated for sql.js) ---
    
    public syncAgents(agents: AgentInfo[]) {
        if (!this.db || agents.length === 0) return;
        const projectId = agents[0].projectId;

        try {
            this.db.run('DELETE FROM agents WHERE project_id = ?', [projectId]);
            for (const agent of agents) {
                this.db.run(`
                    INSERT INTO agents (id, project_id, status, focus, session_id, last_heartbeat)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [agent.id, agent.projectId, agent.status, agent.focus, agent.sessionId, agent.lastHeartbeat]);
            }
        } catch (e) {
             console.error('Error syncing agents:', e);
        }
    }

    public syncPendingTasks(tasks: PendingTask[]) {
        if (!this.db || tasks.length === 0) return;
        try {
            for (const task of tasks) {
                this.db.run(`
                    INSERT OR REPLACE INTO tasks (id, project_id, title, claimed_by, from_agent, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [task.id, task.projectId, task.title, task.assignedTo, task.from, task.status, task.createdAt]);
            }
        } catch (e) {
            console.error('Error syncing pending tasks:', e);
        }
    }

    public syncExternalRequests(requests: ExternalRequest[]) {
        if (!this.db || requests.length === 0) return;
        try {
            for (const req of requests) {
                this.db.run(`
                    INSERT OR REPLACE INTO tasks (id, project_id, title, from_project, description, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [req.id, req.projectId, req.title, req.fromProject, req.context, req.status, req.receivedAt]);
            }
        } catch (e) {
             console.error('Error syncing external requests:', e);
        }
    }

    public syncFileLocks(locks: FileLock[]) {
        if (!this.db || locks.length === 0) return;
        const projectId = locks[0].projectId;

        try {
            this.db.run('DELETE FROM locks WHERE project_id = ?', [projectId]);
            for (const lock of locks) {
                this.db.run(`
                    INSERT INTO locks (resource, project_id, agent_id, acquired_at)
                    VALUES (?, ?, ?, ?)
                `, [lock.pattern, lock.projectId, lock.claimedBy, lock.since]);
            }
        } catch (e) {
             console.error('Error syncing locks:', e);
        }
    }
}