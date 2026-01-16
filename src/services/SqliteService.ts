// Use require for native module - ES imports don't work well with native addons
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentInfo, PendingTask, ExternalRequest, FileLock, AgentMessage } from '../types/db';

export class SqliteService {
    private db: any = null;  // better-sqlite3 Database instance
    private dbPath: string;
    private logger: (msg: string) => void;

    constructor(storagePath: string, logger?: (msg: string) => void) {
        this.logger = logger || console.log;
        this.dbPath = path.join(storagePath, 'agentboard.db');
        
        // CRITICAL DEBUG: Log EVERYTHING about paths
        this.logger(`[SqliteService] ========== INIT DEBUG ==========`);
        this.logger(`[SqliteService] storagePath received: "${storagePath}"`);
        this.logger(`[SqliteService] Computed dbPath: "${this.dbPath}"`);
        this.logger(`[SqliteService] os.homedir(): "${os.homedir()}"`);
        this.logger(`[SqliteService] Expected MCP path: "${path.join(os.homedir(), '.memorybank', 'agentboard.db')}"`);
        this.logger(`[SqliteService] File exists at dbPath: ${fs.existsSync(this.dbPath)}`);
        this.logger(`[SqliteService] ================================`);
        
        this.init();
    }

    private init() {
        if (!fs.existsSync(this.dbPath)) {
            this.logger(`[SqliteService] ERROR: Database file does not exist at ${this.dbPath}`);
            return;
        }
        
        try {
            this.db = new Database(this.dbPath, { fileMustExist: true });
            const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name: string}[];
            this.logger(`[SqliteService] Connected. Tables: ${tables.map(t => t.name).join(', ')}`);
            
            // DEBUG: Count agents in DB
            const agentCount = this.db.prepare('SELECT COUNT(*) as cnt FROM agents').get() as {cnt: number};
            this.logger(`[SqliteService] Total agents in DB: ${agentCount.cnt}`);
            
            // DEBUG: Show all agents with their project_id
            const allAgents = this.db.prepare('SELECT id, project_id, status FROM agents').all() as any[];
            this.logger(`[SqliteService] All agents: ${JSON.stringify(allAgents)}`);
            
        } catch (error) {
            this.logger(`[SqliteService] ERROR: Failed to open database: ${error}`);
            this.db = null;
        }
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
            const distinctProjects = this.db.prepare('SELECT DISTINCT project_id FROM agents').all() as any[];
            this.logger(`[SqliteService] Distinct project_ids in agents table: ${JSON.stringify(distinctProjects.map(p => p.project_id))}`);
            
            const rows = this.db.prepare('SELECT * FROM agents WHERE project_id = ?').all(projectId) as any[];
            this.logger(`[SqliteService] Query result: ${rows.length} agents for project "${projectId}"`);
            
            return rows.map(r => ({
                id: r.id,
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
        if (!this.db) return [];
        try {
            const rows = this.db.prepare(
                "SELECT * FROM tasks WHERE project_id = ? AND (from_project IS NULL OR from_project = '') AND status != 'COMPLETED'"
            ).all(projectId) as any[];

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
            this.logger(`[SqliteService] ERROR querying pending tasks: ${e}`);
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
            const rows = this.db.prepare(
                "SELECT * FROM tasks WHERE project_id = ? AND from_project IS NOT NULL AND from_project != ''"
            ).all(projectId) as any[];
            
            return rows.map(r => ({
                id: r.id,
                projectId: r.project_id,
                title: r.title,
                fromProject: r.from_project,
                context: r.description || '',
                status: r.status,
                receivedAt: r.created_at
            }));
        } catch (e) {
            this.logger(`[SqliteService] ERROR querying external requests: ${e}`);
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
            const rows = this.db.prepare('SELECT * FROM locks WHERE project_id = ?').all(projectId) as any[];
            return rows.map(r => ({
                pattern: r.resource,
                projectId: r.project_id,
                claimedBy: r.agent_id,
                since: r.acquired_at
            }));
        } catch (e) {
            this.logger(`[SqliteService] ERROR querying locks: ${e}`);
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
            const rows = this.db.prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY id DESC LIMIT ?').all(projectId, limit) as any[];
            return rows.map(r => ({
                id: r.id,
                projectId: r.project_id,
                message: r.message,
                timestamp: r.timestamp
            }));
        } catch (e) {
            this.logger(`[SqliteService] ERROR querying messages: ${e}`);
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