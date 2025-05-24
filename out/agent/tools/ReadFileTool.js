/**
 * ReadFileTool
 * Tool for reading file content
 */

const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');

class ReadFileTool extends BaseTool {
    constructor(agent) {
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
                default: 'utf8'
            },
            maxLines: {
                description: 'Maximum number of lines to read (0 = all)',
                type: 'number',
                default: 0
            },
            startLine: {
                description: 'Starting line number (0-based)',
                type: 'number',
                default: 0
            }
        };
    }

    /**
     * Read file content
     * @param {Object} params - Tool parameters
     * @returns {Promise<Object>} - File content and metadata
     */
    async run_impl(params) {
        const { filePath, encoding = 'utf8', maxLines = 0, startLine = 0 } = params;
        
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            // Read file content
            let content = fs.readFileSync(filePath, encoding);
            
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
            const languageMap = {
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
        } catch (error) {
            throw new Error(`Error reading file: ${error.message}`);
        }
    }
}

module.exports = ReadFileTool;