/**
 * WorkspaceManager
 * Manages isolated workspaces for agent operations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as os from 'os';
import { Agent } from './Agent';

export class WorkspaceManager {
    private agent: Agent;
    private logger: vscode.OutputChannel;
    private workspacePath: string;
    private sessionId: string;

    /**
     * Initialize the Workspace Manager
     * @param agent - The parent agent instance
     */
    constructor(agent: Agent) {
        this.agent = agent;
        this.logger = agent.getLogger();
        this.workspacePath = '';
        this.sessionId = '';
    }

    /**
     * Initialize the workspace manager
     * @returns True if initialization was successful
     */
    async initialize(): Promise<boolean> {
        try {
            this.logger.appendLine("Initializing Workspace Manager");
            
            // Create a new session ID
            this.sessionId = this.generateSessionId();
            
            // Create workspace path
            await this.createWorkspace();
            
            this.logger.appendLine(`Workspace Manager initialized with workspace at: ${this.workspacePath}`);
            return true;
        } catch (error: any) {
            this.logger.appendLine(`Error initializing Workspace Manager: ${error.message}`);
            return false;
        }
    }

    /**
     * Generate a unique session ID
     * @returns Unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    /**
     * Create a workspace for the current session
     * @returns Path to the created workspace
     */
    async createWorkspace(): Promise<string> {
        try {
            // Get global storage path from extension context
            const extensionContext = this.agent.context;
            const basePath = extensionContext.globalStorageUri ? 
                extensionContext.globalStorageUri.fsPath : 
                path.join(this.getTempDir(), 'memorybank_agent');
            
            // Create specific workspace for this session
            const workspacePath = path.join(basePath, this.sessionId);
            
            // Ensure directory exists
            if (!fs.existsSync(workspacePath)) {
                fs.mkdirSync(workspacePath, { recursive: true });
            }
            
            // Create subdirectories
            const dirs = ['temp', 'output', 'context', 'logs'];
            for (const dir of dirs) {
                const dirPath = path.join(workspacePath, dir);
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
            }
            
            // Set workspace path and return it
            this.workspacePath = workspacePath;
            return workspacePath;
        } catch (error: any) {
            this.logger.appendLine(`Error creating workspace: ${error.message}`);
            // Fallback to system temp directory
            const fallbackPath = path.join(this.getTempDir(), 'memorybank_agent', this.sessionId);
            if (!fs.existsSync(fallbackPath)) {
                fs.mkdirSync(fallbackPath, { recursive: true });
            }
            this.workspacePath = fallbackPath;
            return fallbackPath;
        }
    }

    /**
     * Get path to a temporary directory
     * @returns Path to temporary directory
     */
    private getTempDir(): string {
        return fs.mkdtempSync(path.join(os.tmpdir(), 'memorybank_'));
    }

    /**
     * Get the path to the current workspace
     * @returns Workspace path
     */
    getWorkspacePath(): string {
        return this.workspacePath;
    }

    /**
     * Get a path within the workspace
     * @param subPath - Relative path within workspace
     * @returns Full path
     */
    getPath(subPath: string): string {
        return path.join(this.workspacePath, subPath);
    }

    /**
     * Write a file to the workspace
     * @param filePath - Relative path within workspace
     * @param content - File content
     * @returns Full path of the written file
     */
    async writeFile(filePath: string, content: string | Buffer): Promise<string> {
        try {
            const fullPath = this.getPath(filePath);
            
            // Ensure directory exists
            const dirPath = path.dirname(fullPath);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            
            // Write file
            fs.writeFileSync(fullPath, content);
            
            this.logger.appendLine(`File written: ${fullPath}`);
            return fullPath;
        } catch (error: any) {
            this.logger.appendLine(`Error writing file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Read a file from the workspace
     * @param filePath - Relative path within workspace
     * @returns File content
     */
    async readFile(filePath: string): Promise<string> {
        try {
            const fullPath = this.getPath(filePath);
            
            if (!fs.existsSync(fullPath)) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            return fs.readFileSync(fullPath, 'utf8');
        } catch (error: any) {
            this.logger.appendLine(`Error reading file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clean up old workspaces
     * @param maxAgeDays - Maximum age in days for workspaces to keep
     * @returns Number of workspaces cleaned
     */
    async cleanOldWorkspaces(maxAgeDays: number = 7): Promise<number> {
        try {
            const extensionContext = this.agent.context;
            const basePath = extensionContext.globalStorageUri ? 
                extensionContext.globalStorageUri.fsPath : 
                path.join(os.tmpdir(), 'memorybank_agent');
            
            if (!fs.existsSync(basePath)) {
                return 0;
            }
            
            const now = Date.now();
            const maxAge = maxAgeDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
            
            const entries = fs.readdirSync(basePath, { withFileTypes: true });
            let cleaned = 0;
            
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('session_')) {
                    const dirPath = path.join(basePath, entry.name);
                    const stats = fs.statSync(dirPath);
                    
                    if (now - stats.ctimeMs > maxAge) {
                        // Directory is older than maxAgeDays, delete it
                        this.deleteDirectory(dirPath);
                        cleaned++;
                    }
                }
            }
            
            this.logger.appendLine(`Cleaned ${cleaned} old workspaces`);
            return cleaned;
        } catch (error: any) {
            this.logger.appendLine(`Error cleaning old workspaces: ${error.message}`);
            return 0;
        }
    }

    /**
     * Delete a directory recursively
     * @param dirPath - Path to directory
     */
    private deleteDirectory(dirPath: string): void {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const curPath = path.join(dirPath, file);
                
                if (fs.lstatSync(curPath).isDirectory()) {
                    this.deleteDirectory(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            
            fs.rmdirSync(dirPath);
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // Clean up resources if needed
    }

    /**
     * Get the path to the user's workspace (the VS Code workspace)
     * @returns User workspace path or null if not available
     */
    getUserWorkspacePath(): string | null {
        try {
            // Intentar obtener de VS Code
            const vscode = require('vscode');
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (workspaceFolders && workspaceFolders.length > 0) {
                const userWorkspacePath = workspaceFolders[0].uri.fsPath;
                this.logger.appendLine(`Found user workspace at: ${userWorkspacePath}`);
                return userWorkspacePath;
            }
        } catch (error: any) {
            this.logger.appendLine(`Error getting user workspace: ${error.message}`);
        }
        
        return null;
    }

    /**
     * Get the primary workspace path for file operations
     * @returns Best workspace path to use (user workspace if available, agent workspace if not)
     */
    getPrimaryWorkspacePath(): string {
        // Primero intentar obtener el workspace del usuario
        const userWorkspace = this.getUserWorkspacePath();
        if (userWorkspace) {
            return userWorkspace;
        }
        
        // Si no hay workspace de usuario, usar el del agente
        return this.workspacePath;
    }
} 