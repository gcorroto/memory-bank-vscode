/**
 * FixErrorTool
 * Tool for fixing errors in code using RAG service
 */

const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');
const ragService = require('../../services/ragService');
const openaiService = require('../../services/openaiService');
const configManager = require('../../utils/configManager');

class FixErrorTool extends BaseTool {
    constructor(agent) {
        super(agent);
        this.name = 'FixErrorTool';
        this.description = 'Fixes errors in code';
        this.parameters = {
            sourcePath: {
                description: 'Path to the source file with error',
                type: 'string',
                required: true
            },
            errorMessage: {
                description: 'Error message or description',
                type: 'string',
                required: true
            },
            applyFix: {
                description: 'Whether to apply the fix directly to the file',
                type: 'boolean',
                default: false
            },
            saveBackup: {
                description: 'Whether to save a backup of the original file',
                type: 'boolean',
                default: true
            }
        };
    }

    /**
     * Fix an error in a source file
     * @param {Object} params - Tool parameters
     * @returns {Promise<Object>} - Result of error fixing
     */
    async run_impl(params) {
        const { 
            sourcePath, 
            errorMessage, 
            applyFix = false, 
            saveBackup = true 
        } = params;
        
        try {
            // Check if source file exists
            if (!fs.existsSync(sourcePath)) {
                throw new Error(`Source file not found: ${sourcePath}`);
            }
            
            // Read source file
            const sourceContent = fs.readFileSync(sourcePath, 'utf8');
            
            // Get file extension and determine language
            const extension = path.extname(sourcePath).substring(1);
            const language = this.mapExtensionToLanguage(extension);
            
            // Initialize RAG service
            const ragInitialized = await ragService.initialize();
            
            let solution;
            
            // Use RAG service if available
            if (ragInitialized) {
                try {
                    this.logger.appendLine(`Resolving error with RAG for ${sourcePath}`);
                    solution = await ragService.resolveError(
                        errorMessage, 
                        sourceContent, 
                        language,
                        4,
                        configManager.getOpenAIModel()
                    );
                } catch (ragError) {
                    this.logger.appendLine(`Error resolving with RAG: ${ragError.message}`);
                    
                    // Fallback to a simpler solution with OpenAI
                    const fixedCode = await this.generateSimpleFix(
                        errorMessage, 
                        sourceContent,
                        language
                    );
                    
                    solution = {
                        explanation: `Error: ${errorMessage}`,
                        solution: 'Generated fix based on error message',
                        fixedCode: fixedCode
                    };
                }
            } else {
                // Use simple fix if RAG is not available
                const fixedCode = await this.generateSimpleFix(
                    errorMessage, 
                    sourceContent,
                    language
                );
                
                solution = {
                    explanation: `Error: ${errorMessage}`,
                    solution: 'Generated fix based on error message',
                    fixedCode: fixedCode
                };
            }
            
            // Apply fix if requested
            if (applyFix && solution.fixedCode) {
                // Save backup if requested
                if (saveBackup) {
                    const backupPath = `${sourcePath}.backup.${Date.now()}`;
                    fs.writeFileSync(backupPath, sourceContent);
                }
                
                // Write fixed code to file
                fs.writeFileSync(sourcePath, solution.fixedCode);
            }
            
            return {
                success: true,
                sourcePath,
                errorMessage,
                explanation: solution.explanation,
                solution: solution.solution,
                fixedCode: solution.fixedCode,
                applied: applyFix
            };
        } catch (error) {
            throw new Error(`Error fixing code: ${error.message}`);
        }
    }

    /**
     * Generate a simple fix using OpenAI
     * @param {string} errorMessage - Error message
     * @param {string} sourceCode - Source code
     * @param {string} language - Programming language
     * @returns {Promise<string>} - Fixed code
     */
    async generateSimpleFix(errorMessage, sourceCode, language) {
        try {
            // Create prompt for fixing the error
            const prompt = `
Fix the following ${language} code that has this error: "${errorMessage}"

\`\`\`${language}
${sourceCode}
\`\`\`

Provide ONLY the corrected code without any explanations or markdown formatting. The entire fixed file should be returned.
`;
            
            // Generate fix with OpenAI
            const systemMessage = {
                role: 'system',
                content: 'You are an expert programmer. Fix the provided code to resolve the error. Return only the corrected code without any explanations.'
            };
            
            const userMessage = {
                role: 'user',
                content: prompt
            };
            
            const completion = await openaiService.chatCompletion(
                [systemMessage, userMessage], 
                configManager.getOpenAIModel()
            );
            
            return completion.choices[0].message.content.trim();
        } catch (error) {
            this.logger.appendLine(`Error generating simple fix: ${error.message}`);
            throw error;
        }
    }

    /**
     * Map file extension to programming language
     * @param {string} extension - File extension
     * @returns {string} - Programming language
     */
    mapExtensionToLanguage(extension) {
        const extensionMap = {
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'vue': 'javascript',
            'py': 'python',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'cs': 'csharp',
            'go': 'go',
            'rb': 'ruby',
            'php': 'php',
            'swift': 'swift',
            'kt': 'kotlin',
            'rs': 'rust',
            'scala': 'scala'
        };
        
        return extensionMap[extension.toLowerCase()] || extension;
    }
}

module.exports = FixErrorTool;