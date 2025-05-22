'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

/**
 * Service for working with file trees in the local filesystem
 */
class FileTreeService {
    constructor(logger) {
        this.logger = logger || console;
        // Get workspace folders
        this.workspaceRoot = vscode.workspace.workspaceFolders ? 
            vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    }

    /**
     * Get the workspace folder path
     * @returns {string|undefined} Workspace path or undefined if not available
     */
    getWorkspacePath() {
        return this.workspaceRoot;
    }

    /**
     * Get a file tree starting from the root workspace folder or specified path
     * @param {string} rootPath - Optional start path relative to workspace
     * @returns {Promise<Array>} Array of tree nodes representing the file structure
     */
    async getFileTree(rootPath = '') {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder open');
        }

        const startPath = path.join(this.workspaceRoot, rootPath);
        this.logger.appendLine(`Building file tree from: ${startPath}`);
        
        try {
            const stats = await promisify(fs.stat)(startPath);
            if (!stats.isDirectory()) {
                throw new Error(`Path is not a directory: ${startPath}`);
            }

            // Get gitignore patterns if .gitignore exists
            const ignorePatterns = await this.getIgnorePatterns();
            
            // Build the tree recursively
            return await this.buildDirectoryTree(startPath, ignorePatterns);
        } catch (error) {
            this.logger.appendLine(`Error building file tree: ${error.message}`);
            throw error;
        }
    }

    /**
     * Read .gitignore files and return patterns to ignore
     * @returns {Promise<Array<string>>} Array of glob patterns to ignore
     */
    async getIgnorePatterns() {
        const patterns = [];
        const gitignorePath = path.join(this.workspaceRoot, '.gitignore');

        try {
            if (fs.existsSync(gitignorePath)) {
                const content = await promisify(fs.readFile)(gitignorePath, 'utf8');
                const lines = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                
                patterns.push(...lines);
            }
        } catch (error) {
            this.logger.appendLine(`Error reading .gitignore: ${error.message}`);
        }

        // Add common ignore patterns for development files
        patterns.push('node_modules', 'dist', '.git', '.vscode', '*.vsix');
        
        return patterns;
    }

    /**
     * Check if a file/directory should be ignored based on patterns
     * @param {string} filePath - Path to check
     * @param {Array<string>} ignorePatterns - Patterns to ignore
     * @returns {boolean} True if the path should be ignored
     */
    shouldIgnore(filePath, ignorePatterns) {
        const relativePath = path.relative(this.workspaceRoot, filePath);
        
        for (const pattern of ignorePatterns) {
            if (pattern.startsWith('!')) continue; // Skip negated patterns for simplicity
            
            // Handle directory wildcards (e.g., "**/node_modules")
            if (pattern.includes('**')) {
                const regexPattern = pattern
                    .replace(/\./g, '\\.')
                    .replace(/\*/g, '.*')
                    .replace(/\*\*\//g, '(.*\\/)?');
                const regex = new RegExp(`^${regexPattern}$`);
                if (regex.test(relativePath)) return true;
            }
            // Simple pattern match (direct or directory path)
            else if (
                relativePath === pattern || 
                relativePath.startsWith(`${pattern}/`) ||
                path.basename(filePath) === pattern
            ) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Recursively build directory tree
     * @param {string} dirPath - Directory to scan
     * @param {Array<string>} ignorePatterns - Patterns to ignore
     * @param {number} depth - Current recursion depth
     * @returns {Promise<Array>} Array of tree nodes
     */
    async buildDirectoryTree(dirPath, ignorePatterns, depth = 0) {
        // Limit recursion depth for performance
        if (depth > 15) {
            this.logger.appendLine(`Reached maximum depth at: ${dirPath}`);
            return [];
        }

        try {
            const entries = await promisify(fs.readdir)(dirPath, { withFileTypes: true });
            const result = [];

            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);
                
                // Skip if should be ignored
                if (this.shouldIgnore(entryPath, ignorePatterns)) {
                    continue;
                }

                const isDirectory = entry.isDirectory();
                
                // Create node object
                const node = {
                    path: entryPath,
                    label: entry.name,
                    isDirectory,
                    isFile: !isDirectory,
                    children: []
                };

                // If directory, recursively get children
                if (isDirectory) {
                    node.children = await this.buildDirectoryTree(entryPath, ignorePatterns, depth + 1);
                }

                result.push(node);
            }

            // Sort: directories first, then files, both alphabetically
            result.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.label.localeCompare(b.label);
            });

            return result;
        } catch (error) {
            this.logger.appendLine(`Error reading directory ${dirPath}: ${error.message}`);
            return [];
        }
    }

    /**
     * Read a file from the workspace
     * @param {string} filePath - Path to the file
     * @returns {Promise<string>} File contents as string
     */
    async readFile(filePath) {
        try {
            return await promisify(fs.readFile)(filePath, 'utf8');
        } catch (error) {
            this.logger.appendLine(`Error reading file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create directory recursively
     * @param {string} dirPath - Directory path to create
     */
    async createDirectory(dirPath) {
        try {
            await promisify(fs.mkdir)(dirPath, { recursive: true });
        } catch (error) {
            this.logger.appendLine(`Error creating directory ${dirPath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Write contents to a file, creating parent directories if needed
     * @param {string} filePath - Path to the file
     * @param {string} contents - Contents to write
     */
    async writeFile(filePath, contents) {
        try {
            const dirPath = path.dirname(filePath);
            await this.createDirectory(dirPath);
            await promisify(fs.writeFile)(filePath, contents, 'utf8');
        } catch (error) {
            this.logger.appendLine(`Error writing file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if a file exists
     * @param {string} filePath - Path to the file
     * @returns {Promise<boolean>} True if the file exists
     */
    async fileExists(filePath) {
        try {
            await promisify(fs.access)(filePath, fs.constants.F_OK);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Find files matching a pattern in the workspace
     * @param {string} pattern - Glob pattern to match
     * @returns {Promise<Array<string>>} Matching file paths
     */
    async findFiles(pattern) {
        try {
            const files = await vscode.workspace.findFiles(pattern);
            return files.map(file => file.fsPath);
        } catch (error) {
            this.logger.appendLine(`Error finding files with pattern ${pattern}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = { FileTreeService };