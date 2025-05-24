/**
 * WriteFileTool
 * Tool for writing content to a file
 */

const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');

class WriteFileTool extends BaseTool {
    constructor(agent) {
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
                default: 'utf8'
            },
            mode: {
                description: 'Write mode: "write" (overwrite file), "append" (add to end), or "create" (only if file does not exist)',
                type: 'string',
                enum: ['write', 'append', 'create'],
                default: 'write'
            }
        };
    }

    /**
     * Write content to file
     * @param {Object} params - Tool parameters
     * @returns {Promise<Object>} - Result of the write operation
     */
    async run_impl(params) {
        const { filePath, content, encoding = 'utf8', mode = 'write' } = params;
        
        try {
            // Create directory if it doesn't exist
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Check if file exists
            const fileExists = fs.existsSync(filePath);
            
            // Handle different write modes
            if (mode === 'create' && fileExists) {
                throw new Error(`File already exists: ${filePath}`);
            }
            
            // Perform the write operation
            if (mode === 'append' && fileExists) {
                fs.appendFileSync(filePath, content, encoding);
            } else {
                fs.writeFileSync(filePath, content, encoding);
            }
            
            // Get file stats after writing
            const stats = fs.statSync(filePath);
            
            return {
                success: true,
                filePath,
                size: stats.size,
                modified: stats.mtime,
                created: !fileExists,
                mode
            };
        } catch (error) {
            throw new Error(`Error writing to file: ${error.message}`);
        }
    }
}

module.exports = WriteFileTool;