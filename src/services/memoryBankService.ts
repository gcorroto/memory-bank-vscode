/**
 * @fileoverview Memory Bank Service
 * Provides functions to read and parse Memory Bank data
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  IndexMetadata,
  FileEntry,
  ProjectDocsMetadata,
  ProjectInfo,
  KNOWN_DOC_TYPES
} from '../types/memoryBank';
import { SqliteService } from './SqliteService';

/**
 * Memory Bank Service
 * Singleton service for reading and managing Memory Bank data
 */
export class MemoryBankService {
  private static instance: MemoryBankService;
  private cachedIndexMetadata: IndexMetadata | null = null;
  private cachedProjects: Map<string, ProjectInfo> = new Map();
  private lastCacheTime: number = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds cache
  private sqliteService: SqliteService | null = null;
  private outputChannel: vscode.OutputChannel | null = null;

  private constructor() {}

  /**
   * Set the output channel for logging
   */
  public setOutputChannel(channel: vscode.OutputChannel): void {
    this.outputChannel = channel;
    // Reset SqliteService so it gets recreated with the proper logger
    this.sqliteService = null;
    this.log('[MemoryBank] OutputChannel configured, SqliteService reset');
  }

  private log(msg: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(msg);
    }
    console.log(msg);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MemoryBankService {
    if (!MemoryBankService.instance) {
      MemoryBankService.instance = new MemoryBankService();
    }
    return MemoryBankService.instance;
  }

  /**
   * Get the configured Memory Bank path
   * @returns Absolute path to the .memorybank folder
   */
  public getMemoryBankPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const config = vscode.workspace.getConfiguration('memorybank');
    const configuredPath = config.get<string>('path', '.memorybank');
    
    // If absolute path, use it directly
    if (path.isAbsolute(configuredPath)) {
      return configuredPath;
    }
    
    // Otherwise, resolve relative to workspace
    return path.join(workspaceFolders[0].uri.fsPath, configuredPath);
  }

  public getSqliteService(): SqliteService | null {
    if (this.sqliteService) {
        this.log(`[MemoryBank] Returning cached SqliteService`);
        return this.sqliteService;
    }
    
    // CRITICAL: agentboard.db is ALWAYS at ~/.memorybank/ (global, not per-workspace)
    // This is where the MCP server writes it (see memory-bank-mcp/common/database.ts)
    const globalPath = path.join(os.homedir(), '.memorybank');
    const globalDbFile = path.join(globalPath, 'agentboard.db');
    
    this.log(`[MemoryBank] ===== getSqliteService DEBUG ====`);
    this.log(`[MemoryBank] os.homedir(): ${os.homedir()}`);
    this.log(`[MemoryBank] Expected global DB path: ${globalDbFile}`);
    this.log(`[MemoryBank] Global DB exists: ${fs.existsSync(globalDbFile)}`);
    
    // Also check workspace path for reference
    const workspacePath = this.getMemoryBankPath();
    if (workspacePath) {
        const workspaceDbFile = path.join(workspacePath, 'agentboard.db');
        this.log(`[MemoryBank] Workspace path: ${workspacePath}`);
        this.log(`[MemoryBank] Workspace DB file: ${workspaceDbFile}`);
        this.log(`[MemoryBank] Workspace DB exists: ${fs.existsSync(workspaceDbFile)}`);
    }
    
    // Use global path - this is the source of truth from MCP
    const dbPath = globalPath;
    
    if (!fs.existsSync(globalDbFile)) {
        this.log(`[MemoryBank] CRITICAL: agentboard.db NOT FOUND at ${globalDbFile}`);
        this.log(`[MemoryBank] The MCP server should create this file. Run memorybank_manage_agents first.`);
        return null;
    }
    
    try {
        this.log(`[MemoryBank] Initializing SqliteService with path: ${dbPath}`);
        // Pass the logger so SqliteService can log to the same OutputChannel
        const logFn = (msg: string) => this.log(msg);
        this.sqliteService = new SqliteService(dbPath, logFn);
        this.log(`[MemoryBank] SqliteService initialized successfully`);
        return this.sqliteService;
    } catch (e) {
        this.log(`[MemoryBank] Failed to initialize SqliteService: ${e}`);
        return null;
    }
  }

  /**
   * Check if Memory Bank exists and is accessible
   */
  public memoryBankExists(): boolean {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) return false;
    
    try {
      return fs.existsSync(mbPath) && fs.statSync(mbPath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Clear the cache to force fresh reads
   */
  public clearCache(): void {
    this.cachedIndexMetadata = null;
    this.cachedProjects.clear();
    this.lastCacheTime = 0;
  }

  /**
   * Load and parse index-metadata.json
   * @param forceRefresh Force bypass cache
   * @returns Parsed index metadata or null if not found
   */
  public async loadIndexMetadata(forceRefresh: boolean = false): Promise<IndexMetadata | null> {
    // Check cache
    if (!forceRefresh && this.cachedIndexMetadata && (Date.now() - this.lastCacheTime) < this.CACHE_TTL) {
      return this.cachedIndexMetadata;
    }

    const mbPath = this.getMemoryBankPath();
    if (!mbPath) return null;

    const indexPath = path.join(mbPath, 'index-metadata.json');
    
    try {
      if (!fs.existsSync(indexPath)) {
        return null;
      }

      const content = (await fs.promises.readFile(indexPath, 'utf8')).toString();
      this.cachedIndexMetadata = JSON.parse(content) as IndexMetadata;
      this.lastCacheTime = Date.now();
      
      return this.cachedIndexMetadata;
    } catch (error) {
      console.error('Error loading index-metadata.json:', error);
      return null;
    }
  }

  /**
   * Get list of available projects
   * @param forceRefresh Force bypass cache
   * @returns Array of project info objects
   */
  public async getProjects(forceRefresh: boolean = false): Promise<ProjectInfo[]> {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) return [];

    const projectsPath = path.join(mbPath, 'projects');
    
    try {
      if (!fs.existsSync(projectsPath)) {
        return [];
      }

      const entries = await fs.promises.readdir(projectsPath, { withFileTypes: true });
      const projects: ProjectInfo[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectId = entry.name;
          const docsPath = path.join(projectsPath, projectId, 'docs');
          
          // Check if docs folder exists
          if (fs.existsSync(docsPath)) {
            const projectInfo = await this.loadProjectInfo(projectId, docsPath, forceRefresh);
            if (projectInfo) {
              projects.push(projectInfo);
            }
          }
        }
      }

      // Sort by last updated (most recent first)
      projects.sort((a, b) => b.lastUpdated - a.lastUpdated);
      
      return projects;
    } catch (error) {
      console.error('Error loading projects:', error);
      return [];
    }
  }

  /**
   * Load project info from docs folder
   */
  private async loadProjectInfo(projectId: string, docsPath: string, forceRefresh: boolean): Promise<ProjectInfo | null> {
    // Check cache
    if (!forceRefresh && this.cachedProjects.has(projectId)) {
      return this.cachedProjects.get(projectId)!;
    }

    try {
      const metadataPath = path.join(docsPath, 'metadata.json');
      let metadata: ProjectDocsMetadata | undefined;
      let lastUpdated = 0;
      let docCount = 0;

      // Load metadata if exists
      if (fs.existsSync(metadataPath)) {
        const content = (await fs.promises.readFile(metadataPath, 'utf8')).toString();
        metadata = JSON.parse(content) as ProjectDocsMetadata;
        
        // Calculate stats from metadata
        for (const docType of Object.keys(metadata)) {
          docCount++;
          const doc = metadata[docType];
          if (doc.lastGenerated > lastUpdated) {
            lastUpdated = doc.lastGenerated;
          }
        }
      } else {
        // Count .md files directly
        const files = await fs.promises.readdir(docsPath);
        docCount = files.filter(f => f.endsWith('.md')).length;
        
        // Get most recent file modification time
        for (const file of files) {
          if (file.endsWith('.md')) {
            const stat = await fs.promises.stat(path.join(docsPath, file));
            if (stat.mtimeMs > lastUpdated) {
              lastUpdated = stat.mtimeMs;
            }
          }
        }
      }

      const projectInfo: ProjectInfo = {
        id: projectId,
        docsPath,
        docCount,
        lastUpdated,
        metadata
      };

      this.cachedProjects.set(projectId, projectInfo);
      return projectInfo;
    } catch (error) {
      console.error(`Error loading project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Get documents for a specific project
   * @param projectId Project identifier
   * @returns Map of document type to file path
   */
  public async getProjectDocs(projectId: string): Promise<Map<string, string>> {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) return new Map();

    const docsPath = path.join(mbPath, 'projects', projectId, 'docs');
    const docs = new Map<string, string>();

    try {
      if (!fs.existsSync(docsPath)) {
        return docs;
      }

      const files = await fs.promises.readdir(docsPath);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const docType = file.replace('.md', '');
          docs.set(docType, path.join(docsPath, file));
        }
      }

      return docs;
    } catch (error) {
      console.error(`Error loading docs for project ${projectId}:`, error);
      return docs;
    }
  }

  /**
   * Get project docs metadata
   * @param projectId Project identifier
   * @returns Project docs metadata or null
   */
  public async getProjectDocsMetadata(projectId: string): Promise<ProjectDocsMetadata | null> {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) return null;

    const metadataPath = path.join(mbPath, 'projects', projectId, 'docs', 'metadata.json');

    try {
      if (!fs.existsSync(metadataPath)) {
        return null;
      }

      const content = (await fs.promises.readFile(metadataPath, 'utf8')).toString();
      return JSON.parse(content) as ProjectDocsMetadata;
    } catch (error) {
      console.error(`Error loading metadata for project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Get files organized by folder structure
   * @returns Map of folder path to files
   */
  public async getIndexedFilesByFolder(): Promise<Map<string, Array<FileEntry & { path: string }>>> {
    const indexMetadata = await this.loadIndexMetadata();
    if (!indexMetadata) return new Map();

    const folderMap = new Map<string, Array<FileEntry & { path: string }>>();

    for (const [filePath, entry] of Object.entries(indexMetadata.files)) {
      const folder = path.dirname(filePath);
      
      if (!folderMap.has(folder)) {
        folderMap.set(folder, []);
      }
      
      folderMap.get(folder)!.push({
        ...entry,
        path: filePath
      });
    }

    return folderMap;
  }

  /**
   * Get total statistics from the index
   */
  public async getIndexStats(): Promise<{ totalFiles: number; totalChunks: number; lastIndexed: number }> {
    const indexMetadata = await this.loadIndexMetadata();
    if (!indexMetadata) {
      return { totalFiles: 0, totalChunks: 0, lastIndexed: 0 };
    }

    let totalChunks = 0;
    for (const entry of Object.values(indexMetadata.files)) {
      totalChunks += entry.chunkCount;
    }

    return {
      totalFiles: Object.keys(indexMetadata.files).length,
      totalChunks,
      lastIndexed: indexMetadata.lastIndexed
    };
  }

  /**
   * Delete a project and all its associated data
   * This includes:
   * 1. Deleting embeddings from LanceDB (filtered by project_id)
   * 2. Removing file entries from index-metadata.json
   * 3. Deleting the project directory from .memorybank/projects/
   * 
   * @param projectId The project identifier to delete
   * @returns Result with success status and details
   */
  public async deleteProject(projectId: string): Promise<{
    success: boolean;
    embeddingsDeleted: number;
    filesRemoved: number;
    error?: string;
  }> {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) {
      return { success: false, embeddingsDeleted: 0, filesRemoved: 0, error: 'Memory Bank path not configured' };
    }

    let embeddingsDeleted = 0;
    let filesRemoved = 0;

    try {
      // Step 1: Delete embeddings from LanceDB
      console.log(`[MemoryBank] Deleting embeddings for project: ${projectId}`);
      embeddingsDeleted = await this.deleteProjectEmbeddings(projectId, mbPath);
      console.log(`[MemoryBank] Deleted ${embeddingsDeleted} embeddings`);

      // Step 2: Remove file entries from index-metadata.json
      console.log(`[MemoryBank] Removing file entries from index-metadata.json`);
      filesRemoved = await this.removeProjectFilesFromIndex(projectId, mbPath);
      console.log(`[MemoryBank] Removed ${filesRemoved} file entries`);

      // Step 3: Delete the project directory
      const projectPath = path.join(mbPath, 'projects', projectId);
      console.log(`[MemoryBank] Deleting project directory: ${projectPath}`);
      
      if (fs.existsSync(projectPath)) {
        await this.deleteDirectoryRecursive(projectPath);
        console.log(`[MemoryBank] Project directory deleted`);
      }

      // Clear cache
      this.clearCache();

      return {
        success: true,
        embeddingsDeleted,
        filesRemoved
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MemoryBank] Error deleting project ${projectId}:`, error);
      return {
        success: false,
        embeddingsDeleted,
        filesRemoved,
        error: errorMessage
      };
    }
  }

  /**
   * Delete embeddings for a specific project from LanceDB
   */
  private async deleteProjectEmbeddings(projectId: string, mbPath: string): Promise<number> {
    try {
      // Dynamically import lancedb
      const lancedb = await import('@lancedb/lancedb');
      
      console.log(`[MemoryBank] Connecting to LanceDB at: ${mbPath}`);
      
      // Connect to LanceDB
      const db = await lancedb.connect(mbPath);
      const tableNames = await db.tableNames();
      
      console.log(`[MemoryBank] Available tables: ${tableNames.join(', ')}`);
      
      if (!tableNames.includes('code_chunks')) {
        console.log('[MemoryBank] No code_chunks table found, skipping embedding deletion');
        return 0;
      }

      const table = await db.openTable('code_chunks');
      
      // First, get all unique project_ids in the table for debugging
      const allRecords = await table.query().toArray();
      const uniqueProjectIds = new Set<string>();
      for (const record of allRecords as any[]) {
        if (record.project_id) {
          uniqueProjectIds.add(record.project_id);
        }
      }
      console.log(`[MemoryBank] Total chunks in DB: ${allRecords.length}`);
      console.log(`[MemoryBank] Unique project_ids in DB: ${Array.from(uniqueProjectIds).join(', ')}`);
      console.log(`[MemoryBank] Looking for project_id: '${projectId}'`);
      
      // Count how many chunks belong to this project
      const projectChunks = await table.query()
        .where(`project_id = '${projectId}'`)
        .toArray();
      
      const chunkCount = projectChunks.length;
      
      if (chunkCount === 0) {
        console.log(`[MemoryBank] No embeddings found for project '${projectId}'`);
        // Try case-insensitive search as fallback
        const matchingProjects = Array.from(uniqueProjectIds).filter(
          pid => pid.toLowerCase() === projectId.toLowerCase()
        );
        if (matchingProjects.length > 0) {
          console.log(`[MemoryBank] Found similar project_id with different case: ${matchingProjects.join(', ')}`);
          // Use the matching project_id
          const actualProjectId = matchingProjects[0];
          const actualChunks = await table.query()
            .where(`project_id = '${actualProjectId}'`)
            .toArray();
          if (actualChunks.length > 0) {
            console.log(`[MemoryBank] Deleting ${actualChunks.length} chunks with project_id='${actualProjectId}'`);
            await table.delete(`project_id = '${actualProjectId}'`);
            return actualChunks.length;
          }
        }
        return 0;
      }

      // Delete all chunks with this project_id
      console.log(`[MemoryBank] Deleting ${chunkCount} chunks with project_id='${projectId}'`);
      await table.delete(`project_id = '${projectId}'`);
      console.log(`[MemoryBank] Successfully deleted ${chunkCount} embeddings for project ${projectId}`);
      
      return chunkCount;
    } catch (error) {
      console.error(`[MemoryBank] Error deleting embeddings:`, error);
      // Don't fail the whole operation if embeddings deletion fails
      return 0;
    }
  }

  /**
   * Register an active agent in the Memory Bank
   * Updates agentBoard.md with the agent's status and session ID
   */
  public async registerAgent(projectId: string, agentId: string, status: string, focus: string): Promise<string> {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) return '';

    // Generate session ID
    const sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0];

    // Update SQLite
    try {
        const sqlite = this.getSqliteService();
        if (sqlite) {
            sqlite.updateAgent({
                id: agentId,
                projectId,
                status,
                focus,
                sessionId,
                lastHeartbeat: timestamp
            });
        }
    } catch (e) {
        console.error('[MemoryBank] Failed to update SQLite in registerAgent:', e);
    }

    const boardPath = path.join(mbPath, 'projects', projectId, 'docs', 'agentBoard.md');
    
    // Legacy Markdown update (for compatibility)
    if (!fs.existsSync(boardPath)) {
        return sessionId; // Fail silently or create board
    }

    try {
      const content = await fs.promises.readFile(boardPath, 'utf8');
      const lines = content.split('\n');
      const newLines: string[] = [];
      let inAgentsSection = false;
      let agentUpdated = false;

      for (const line of lines) {
        if (line.trim().startsWith('## Active Agents')) {
           inAgentsSection = true;
           newLines.push(line);
           continue;
        }
        
        if (inAgentsSection && line.startsWith('## ')) {
            inAgentsSection = false;
        }

        if (inAgentsSection) {
             // Check for existing agent row
            if ((line.includes(`| ${agentId} `) || line.includes(`|${agentId}|`)) && !line.includes('---')) {
                // Update existing row
                // | Agent ID | Status | Current Focus | Session ID | Last Heartbeat |
                newLines.push(`| ${agentId} | ${status} | ${focus} | ${sessionId} | ${timestamp} |`);
                agentUpdated = true;
                continue;
            }
            
            // If we are at the end of the table (empty line or next section) and haven't updated, 
            // we'll need to handle insertion. But simpler strategy:
            // Just rewrite the table if possible, or append if we can identify the end.
            // For now, only update is fully safe with this simple logic.
        }
        newLines.push(line);
      }
      
      if (!agentUpdated) {
          // If not found in the loop, we should ideally insert it. 
          // However, inserting into markdown table programmatically is fragile without a parser.
          console.warn(`[MemoryBank] Agent ${agentId} not found in Active Agents table. Registration incomplete (only updates supported).`);
      } else {
          await fs.promises.writeFile(boardPath, newLines.join('\n'), 'utf8');
      }
      
      return sessionId;
    } catch (e) {
      console.error('[MemoryBank] Failed to register agent:', e);
      return '';
    }
  }

  /**
   * Check if a file is locked by another agent
   */
  public async checkFileLock(projectId: string, filePath: string, requestingAgentId: string): Promise<boolean> {
      const mbPath = this.getMemoryBankPath();
      if (!mbPath) return false;
      
      const boardPath = path.join(mbPath, 'projects', projectId, 'docs', 'agentBoard.md');
      if (!fs.existsSync(boardPath)) return false;

      try {
          const content = await fs.promises.readFile(boardPath, 'utf8');
          // Parse File Locks section
          const lines = content.split('\n');
          let inLocksSection = false;
          
          for (const line of lines) {
              if (line.trim().startsWith('## File Locks')) {
                  inLocksSection = true;
                  continue;
              }
              if (inLocksSection && line.startsWith('## ')) break;
              
              if (inLocksSection && line.trim().startsWith('|') && !line.includes('---')) {
                  const parts = line.split('|').map(p => p.trim());
                  // | File Pattern | Claimed By | Since |
                  if (parts.length >= 4) { // part[0] is empty if line starts with |
                      const pattern = parts[1];
                      const claimedBy = parts[2];
                      
                      if (claimedBy !== requestingAgentId && this.isFileLocked(filePath, pattern)) {
                          return true;
                      }
                  }
              }
          }
          return false;
      } catch {
          return false;
      }
  }

  private isFileLocked(filePath: string, pattern: string): boolean {
      // Normalize both paths to use forward slashes
      const normFilePath = filePath.replace(/\\/g, '/');
      const normPattern = pattern.replace(/\\/g, '/');
      return normFilePath.includes(normPattern);
  }

  /**
   * Remove file entries for a project from index-metadata.json
   * Files are identified by checking if they belong to the project's sourcePath
   */
  private async removeProjectFilesFromIndex(projectId: string, mbPath: string): Promise<number> {
    const indexPath = path.join(mbPath, 'index-metadata.json');
    
    if (!fs.existsSync(indexPath)) {
      return 0;
    }

    try {
      const content = await fs.promises.readFile(indexPath, 'utf8');
      const indexMetadata = JSON.parse(content) as IndexMetadata;
      
      // First, try to get the sourcePath from the project's metadata
      const projectMetadataPath = path.join(mbPath, 'projects', projectId, 'docs', 'metadata.json');
      let sourcePath: string | null = null;
      
      if (fs.existsSync(projectMetadataPath)) {
        try {
          const projectMetadata = JSON.parse(await fs.promises.readFile(projectMetadataPath, 'utf8'));
          sourcePath = projectMetadata._projectConfig?.sourcePath;
        } catch {
          // Ignore errors reading project metadata
        }
      }

      // Count files to remove
      const filesToRemove: string[] = [];
      
      for (const filePath of Object.keys(indexMetadata.files)) {
        // Check if this file belongs to the project
        // Method 1: By sourcePath if available
        if (sourcePath && filePath.includes(sourcePath)) {
          filesToRemove.push(filePath);
          continue;
        }
        
        // Method 2: By project ID patterns in path
        const normalizedPath = filePath.toLowerCase();
        const normalizedProjectId = projectId.toLowerCase();
        
        // Check various patterns that might match the project
        if (normalizedPath.includes(normalizedProjectId) ||
            normalizedPath.includes(normalizedProjectId.replace(/_/g, '-')) ||
            normalizedPath.includes(normalizedProjectId.replace(/-/g, '_'))) {
          filesToRemove.push(filePath);
        }
      }

      // Remove the files
      for (const filePath of filesToRemove) {
        delete indexMetadata.files[filePath];
      }

      // Update lastIndexed timestamp
      indexMetadata.lastIndexed = Date.now();

      // Write back the updated metadata
      await fs.promises.writeFile(indexPath, JSON.stringify(indexMetadata, null, 2), 'utf8');
      
      return filesToRemove.length;
    } catch (error) {
      console.error(`[MemoryBank] Error removing files from index:`, error);
      return 0;
    }
  }

  /**
   * Recursively delete a directory
   */
  private async deleteDirectoryRecursive(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.deleteDirectoryRecursive(fullPath);
      } else {
        await fs.promises.unlink(fullPath);
      }
    }
    
    await fs.promises.rmdir(dirPath);
  }

  /**
   * Get information about orphaned embeddings without deleting them
   * Returns a list of project IDs and their chunk counts that don't have a corresponding project folder
   */
  public async getOrphanedEmbeddingsInfo(): Promise<Array<{ projectId: string; chunkCount: number }>> {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) {
      return [];
    }

    try {
      // Get list of existing project IDs
      const projects = await this.getProjects();
      const existingProjectIds = new Set(projects.map(p => p.id.toLowerCase()));

      // Dynamically import lancedb
      const lancedb = await import('@lancedb/lancedb');
      
      // Connect to LanceDB
      const db = await lancedb.connect(mbPath);
      const tableNames = await db.tableNames();
      
      if (!tableNames.includes('code_chunks')) {
        return [];
      }

      const table = await db.openTable('code_chunks');
      
      // Get all unique project_ids in the DB with counts
      const allRecords = await table.query().toArray();
      const projectIdCounts = new Map<string, number>();
      
      for (const record of allRecords as any[]) {
        const pid = record.project_id || 'unknown';
        projectIdCounts.set(pid, (projectIdCounts.get(pid) || 0) + 1);
      }

      // Find orphaned project IDs (in DB but not in projects folder)
      const orphanedProjects: Array<{ projectId: string; chunkCount: number }> = [];
      
      for (const [pid, count] of projectIdCounts.entries()) {
        // Check if this project exists (case-insensitive)
        const exists = existingProjectIds.has(pid.toLowerCase());
        
        if (!exists) {
          orphanedProjects.push({ projectId: pid, chunkCount: count });
        }
      }

      return orphanedProjects;
    } catch (error) {
      console.error(`[MemoryBank] Error getting orphaned embeddings info:`, error);
      return [];
    }
  }

  /**
   * Delete embeddings for a specific orphaned project by its project_id
   */
  public async deleteOrphanedProjectEmbeddings(projectId: string): Promise<{
    success: boolean;
    chunksDeleted: number;
    error?: string;
  }> {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) {
      return { success: false, chunksDeleted: 0, error: 'Memory Bank path not configured' };
    }

    try {
      const lancedb = await import('@lancedb/lancedb');
      const db = await lancedb.connect(mbPath);
      const tableNames = await db.tableNames();
      
      if (!tableNames.includes('code_chunks')) {
        return { success: true, chunksDeleted: 0 };
      }

      const table = await db.openTable('code_chunks');
      
      // Count chunks before deletion
      const chunks = await table.query()
        .where(`project_id = '${projectId}'`)
        .toArray();
      
      const chunkCount = chunks.length;
      
      if (chunkCount === 0) {
        return { success: true, chunksDeleted: 0 };
      }

      // Delete the chunks
      await table.delete(`project_id = '${projectId}'`);
      console.log(`[MemoryBank] Deleted ${chunkCount} orphaned chunks for project '${projectId}'`);

      return { success: true, chunksDeleted: chunkCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MemoryBank] Error deleting orphaned embeddings:`, error);
      return { success: false, chunksDeleted: 0, error: errorMessage };
    }
  }

  /**
   * Clean up orphaned embeddings - embeddings whose project no longer exists
   * This is useful after manual deletion of project folders
   */
  public async cleanupOrphanedEmbeddings(): Promise<{
    success: boolean;
    orphanedProjectIds: string[];
    chunksDeleted: number;
    error?: string;
  }> {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) {
      return { success: false, orphanedProjectIds: [], chunksDeleted: 0, error: 'Memory Bank path not configured' };
    }

    try {
      // Get list of existing project IDs
      const projects = await this.getProjects();
      const existingProjectIds = new Set(projects.map(p => p.id.toLowerCase()));
      
      console.log(`[MemoryBank] Existing projects: ${Array.from(existingProjectIds).join(', ')}`);

      // Dynamically import lancedb
      const lancedb = await import('@lancedb/lancedb');
      
      // Connect to LanceDB
      const db = await lancedb.connect(mbPath);
      const tableNames = await db.tableNames();
      
      if (!tableNames.includes('code_chunks')) {
        console.log('[MemoryBank] No code_chunks table found');
        return { success: true, orphanedProjectIds: [], chunksDeleted: 0 };
      }

      const table = await db.openTable('code_chunks');
      
      // Get all unique project_ids in the DB
      const allRecords = await table.query().toArray();
      const projectIdCounts = new Map<string, number>();
      
      for (const record of allRecords as any[]) {
        const pid = record.project_id || 'unknown';
        projectIdCounts.set(pid, (projectIdCounts.get(pid) || 0) + 1);
      }
      
      console.log(`[MemoryBank] Project IDs in DB:`);
      for (const [pid, count] of projectIdCounts.entries()) {
        console.log(`[MemoryBank]   - ${pid}: ${count} chunks`);
      }

      // Find orphaned project IDs (in DB but not in projects folder)
      const orphanedProjectIds: string[] = [];
      let totalChunksDeleted = 0;
      
      for (const [pid, count] of projectIdCounts.entries()) {
        // Check if this project exists (case-insensitive)
        const exists = existingProjectIds.has(pid.toLowerCase());
        
        if (!exists) {
          console.log(`[MemoryBank] Found orphaned project: '${pid}' with ${count} chunks`);
          orphanedProjectIds.push(pid);
          
          // Delete orphaned chunks
          await table.delete(`project_id = '${pid}'`);
          totalChunksDeleted += count;
          console.log(`[MemoryBank] Deleted ${count} orphaned chunks for project '${pid}'`);
        }
      }

      if (orphanedProjectIds.length === 0) {
        console.log('[MemoryBank] No orphaned embeddings found');
      } else {
        console.log(`[MemoryBank] Cleaned up ${totalChunksDeleted} orphaned chunks from ${orphanedProjectIds.length} projects`);
      }

      return {
        success: true,
        orphanedProjectIds,
        chunksDeleted: totalChunksDeleted
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MemoryBank] Error cleaning orphaned embeddings:`, error);
      return {
        success: false,
        orphanedProjectIds: [],
        chunksDeleted: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Get the project's source path from its metadata
   */
  public async getProjectSourcePath(projectId: string): Promise<string | null> {
    const mbPath = this.getMemoryBankPath();
    if (!mbPath) return null;

    const metadataPath = path.join(mbPath, 'projects', projectId, 'docs', 'metadata.json');
    
    try {
      if (!fs.existsSync(metadataPath)) {
        return null;
      }

      const content = await fs.promises.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(content);
      return metadata._projectConfig?.sourcePath || null;
    } catch {
      return null;
    }
  }
}

// Utility functions

/**
 * Format timestamp to relative time string
 * @param timestamp Milliseconds since epoch
 * @returns Human-readable relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) {
    return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
  }
  if (weeks > 0) {
    return weeks === 1 ? 'hace 1 semana' : `hace ${weeks} semanas`;
  }
  if (days > 0) {
    return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  }
  if (hours > 0) {
    return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
  }
  if (minutes > 0) {
    return minutes === 1 ? 'hace 1 minuto' : `hace ${minutes} minutos`;
  }
  return 'hace unos segundos';
}

/**
 * Abbreviate a hash to first 8 characters
 * @param hash Full hash string
 * @returns Abbreviated hash
 */
export function abbreviateHash(hash: string): string {
  return hash.substring(0, 8);
}

/**
 * Format token count for display
 * @param tokens Number of tokens
 * @returns Formatted string
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k tokens`;
  }
  return `${tokens} tokens`;
}

/**
 * Get file extension icon
 * @param filename File name
 * @returns VS Code ThemeIcon id
 */
export function getFileIcon(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  const iconMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.md': 'markdown',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'css',
    '.java': 'java',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.sql': 'database',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.xml': 'xml',
    '.gradle': 'gradle',
    '.sh': 'terminal',
    '.bat': 'terminal',
    '.dockerfile': 'docker',
    '.gitignore': 'git'
  };

  // Check for special files
  const basename = path.basename(filename).toLowerCase();
  if (basename === 'dockerfile') return 'docker';
  if (basename === 'jenkinsfile') return 'jenkins';
  if (basename.startsWith('.git')) return 'git';

  return iconMap[ext] || 'file';
}

// Export singleton instance getter
export function getMemoryBankService(): MemoryBankService {
  return MemoryBankService.getInstance();
}
