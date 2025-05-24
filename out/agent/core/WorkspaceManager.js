/**
 * WorkspaceManager
 * Manages isolated workspaces for agent operations
 */

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const crypto = require('crypto');

class WorkspaceManager {
    /**
     * Initialize the Workspace Manager
     * @param {Object} agent - The parent agent instance
     */
    constructor(agent) {
        this.agent = agent;
        this.logger = agent.getLogger();
        this.workspacePath = '';
        this.sessionId = '';
    }

    /**
     * Initialize the workspace manager
     * @returns {Promise<boolean>} - True if initialization was successful
     */
    async initialize() {
        try {
            this.logger.appendLine("Initializing Workspace Manager");
            
            // Create a new session ID
            this.sessionId = this.generateSessionId();
            
            // Create workspace path
            await this.createWorkspace();
            
            this.logger.appendLine(`Workspace Manager initialized with workspace at: ${this.workspacePath}`);
            return true;
        } catch (error) {
            this.logger.appendLine(`Error initializing Workspace Manager: ${error.message}`);
            return false;
        }
    }

    /**
     * Generate a unique session ID
     * @returns {string} - Unique session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    /**
     * Create a workspace for the current session
     * @returns {Promise<string>} - Path to the created workspace
     */
    async createWorkspace() {
        try {
            // Get global storage path from extension context
            const extensionContext = this.agent.context;
            const basePath = extensionContext ? 
                extensionContext.globalStorageUri.fsPath : 
                path.join(this.getTempDir(), 'grec0ai_agent');
            
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
        } catch (error) {
            this.logger.appendLine(`Error creating workspace: ${error.message}`);
            // Fallback to system temp directory
            const fallbackPath = path.join(this.getTempDir(), 'grec0ai_agent', this.sessionId);
            if (!fs.existsSync(fallbackPath)) {
                fs.mkdirSync(fallbackPath, { recursive: true });
            }
            this.workspacePath = fallbackPath;
            return fallbackPath;
        }
    }

    /**
     * Get path to a temporary directory
     * @returns {string} - Path to temporary directory
     */
    getTempDir() {
        return fs.mkdtempSync(path.join(require('os').tmpdir(), 'grec0ai_'));
    }

    /**
     * Get the path to the current workspace
     * @returns {string} - Workspace path
     */
    getWorkspacePath() {
        return this.workspacePath;
    }

    /**
     * Get a path within the workspace
     * @param {string} subPath - Relative path within workspace
     * @returns {string} - Full path
     */
    getPath(subPath) {
        return path.join(this.workspacePath, subPath);
    }

    /**
     * Write a file to the workspace
     * @param {string} filePath - Relative path within workspace
     * @param {string|Buffer} content - File content
     * @returns {Promise<string>} - Full path of the written file
     */
    async writeFile(filePath, content) {
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
        } catch (error) {
            this.logger.appendLine(`Error writing file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Read a file from the workspace
     * @param {string} filePath - Relative path within workspace
     * @returns {Promise<string>} - File content
     */
    async readFile(filePath) {
        try {
            const fullPath = this.getPath(filePath);
            
            if (!fs.existsSync(fullPath)) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            return fs.readFileSync(fullPath, 'utf8');
        } catch (error) {
            this.logger.appendLine(`Error reading file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clean up old workspaces
     * @param {number} maxAgeDays - Maximum age in days for workspaces to keep
     * @returns {Promise<number>} - Number of workspaces cleaned
     */
    async cleanOldWorkspaces(maxAgeDays = 7) {
        try {
            const extensionContext = this.agent.context;
            const basePath = extensionContext ? 
                extensionContext.globalStorageUri.fsPath : 
                path.join(require('os').tmpdir(), 'grec0ai_agent');
            
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
        } catch (error) {
            this.logger.appendLine(`Error cleaning old workspaces: ${error.message}`);
            return 0;
        }
    }

    /**
     * Delete a directory recursively
     * @param {string} dirPath - Path to directory
     */
    deleteDirectory(dirPath) {
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
}

module.exports = WorkspaceManager;