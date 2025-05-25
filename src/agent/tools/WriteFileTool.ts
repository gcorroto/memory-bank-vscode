/**
 * WriteFileTool
 * Tool for writing content to a file
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import { Agent } from '../core/Agent';

type WriteMode = 'write' | 'append' | 'create';

interface WriteFileResult {
    success: boolean;
    filePath: string;
    size: number;
    modified: Date;
    created: boolean;
    mode: WriteMode;
}

export class WriteFileTool extends BaseTool {
    constructor(agent: Agent) {
        super(agent);
        this.name = 'WriteFileTool';
        this.description = 'Writes content to a file';
        this.parameters = {
            filePath: {
                description: 'Path to the file to write',
                type: 'string',
                required: true
            },
            content: {
                description: 'Content to write to the file',
                type: 'string',
                required: true
            },
            encoding: {
                description: 'File encoding',
                type: 'string',
                required: false,
                default: 'utf8'
            },
            mode: {
                description: 'Write mode: "write" (overwrite file), "append" (add to end), or "create" (only if file does not exist)',
                type: 'string',
                required: false,
                default: 'write'
            }
        };
    }

    /**
     * Write content to file
     * @param params - Tool parameters
     * @returns Result of the write operation
     */
    protected async run_impl(params: Record<string, any>): Promise<WriteFileResult> {
        const { filePath, content, encoding = 'utf8', mode = 'write' } = params;
        
        try {
            // Normalizar la ruta del archivo
            const normalizedFilePath = this.normalizePath(filePath);
            this.logger.appendLine(`Attempting to write to file: ${normalizedFilePath}`);
            
            // Create directory if it doesn't exist
            const dir = path.dirname(normalizedFilePath);
            if (!fs.existsSync(dir)) {
                this.logger.appendLine(`Creating directory structure: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Check if file exists
            const fileExists = this.fileExists(normalizedFilePath);
            
            // Handle different write modes
            if (mode === 'create' && fileExists) {
                throw new Error(`File already exists: ${normalizedFilePath}`);
            }
            
            // Perform the write operation
            if (mode === 'append' && fileExists) {
                this.logger.appendLine(`Appending to file: ${normalizedFilePath}`);
                fs.appendFileSync(normalizedFilePath, content, { encoding: encoding as BufferEncoding });
            } else {
                this.logger.appendLine(`Writing to file: ${normalizedFilePath}`);
                fs.writeFileSync(normalizedFilePath, content, { encoding: encoding as BufferEncoding });
            }
            
            // Get file stats after writing
            const stats = fs.statSync(normalizedFilePath);
            
            return {
                success: true,
                filePath: normalizedFilePath,
                size: stats.size,
                modified: stats.mtime,
                created: !fileExists,
                mode: mode as WriteMode
            };
        } catch (error: any) {
            throw new Error(`Error writing to file: ${error.message}`);
        }
    }
} 