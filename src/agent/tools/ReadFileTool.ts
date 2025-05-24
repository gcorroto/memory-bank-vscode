/**
 * ReadFileTool
 * Tool for reading file content
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import { Agent } from '../core/Agent';
import * as vscode from 'vscode';

interface ReadFileResult {
    content: string;
    filePath: string;
    language: string;
    size: number;
    modified: Date;
    truncated: boolean;
}

export class ReadFileTool extends BaseTool {
    constructor(agent: Agent) {
        super(agent);
        this.name = 'ReadFileTool';
        this.description = 'Reads content from a file';
        this.parameters = {
            filePath: {
                description: 'Path to the file to read',
                type: 'string',
                required: true
            },
            encoding: {
                description: 'File encoding',
                type: 'string',
                required: false,
                default: 'utf8'
            },
            maxLines: {
                description: 'Maximum number of lines to read (0 = all)',
                type: 'number',
                required: false,
                default: 0
            },
            startLine: {
                description: 'Starting line number (0-based)',
                type: 'number',
                required: false,
                default: 0
            }
        };
    }

    /**
     * Read file content
     * @param params - Tool parameters
     * @returns File content and metadata
     */
    protected async run_impl(params: Record<string, any>): Promise<ReadFileResult> {
        let { filePath, encoding = 'utf8', maxLines = 0, startLine = 0 } = params;
        
        // Additional validation for filePath
        if (!filePath) {
            // Try to get active editor file as fallback
            try {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    filePath = editor.document.uri.fsPath;
                    this.logger.appendLine(`No filePath provided, using active editor file: ${filePath}`);
                } else {
                    throw new Error('Required parameter filePath is missing and no active editor available');
                }
            } catch (e) {
                throw new Error('Required parameter filePath is missing and could not determine active file');
            }
        }
        
        // Handle common placeholders
        if (filePath === '$SELECTED_FILE' || filePath === 'path_to_selected_file') {
            try {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    filePath = editor.document.uri.fsPath;
                    this.logger.appendLine(`Resolved $SELECTED_FILE to: ${filePath}`);
                } else {
                    throw new Error('No active editor available to resolve $SELECTED_FILE');
                }
            } catch (e) {
                throw new Error('Could not resolve $SELECTED_FILE variable: No active editor');
            }
        }
        
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            // Read file content
            let content = fs.readFileSync(filePath, { encoding: encoding as BufferEncoding });
            
            // Get file stats
            const stats = fs.statSync(filePath);
            
            // Handle line range if specified
            if (startLine > 0 || maxLines > 0) {
                const lines = content.split('\n');
                const endLine = maxLines > 0 ? startLine + maxLines : lines.length;
                const selectedLines = lines.slice(startLine, endLine);
                content = selectedLines.join('\n');
            }
            
            // Get file extension for language detection
            const ext = path.extname(filePath).toLowerCase().substring(1);
            
            // Map common extensions to languages
            const languageMap: Record<string, string> = {
                'js': 'javascript',
                'ts': 'typescript',
                'py': 'python',
                'java': 'java',
                'rb': 'ruby',
                'php': 'php',
                'c': 'c',
                'cpp': 'cpp',
                'cs': 'csharp',
                'go': 'go',
                'rs': 'rust',
                'swift': 'swift',
                'html': 'html',
                'css': 'css',
                'json': 'json',
                'md': 'markdown',
                'yaml': 'yaml',
                'yml': 'yaml',
                'xml': 'xml',
                'sql': 'sql'
            };
            
            // Try to determine language from extension
            const language = languageMap[ext] || 'text';
            
            return {
                content,
                filePath,
                language,
                size: stats.size,
                modified: stats.mtime,
                truncated: (startLine > 0 || maxLines > 0)
            };
        } catch (error: any) {
            throw new Error(`Error reading file: ${error.message}`);
        }
    }
} 