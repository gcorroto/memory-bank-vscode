/**
 * FixErrorTool
 * Tool for fixing errors in code using RAG service
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import * as ragService from '../../services/ragService';
import * as openaiService from '../../services/openaiService';
import * as configManager from '../../utils/configManager';

// Agregar la definición de la interfaz para solucionar el problema del linter
interface ErrorSolution {
    explanation: string;
    solution: string;
    fixedCode: string;
}

export class FixErrorTool extends BaseTool {
    constructor(agent: any) {
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
                required: false,
                default: false
            },
            saveBackup: {
                description: 'Whether to save a backup of the original file',
                type: 'boolean',
                required: false,
                default: true
            }
        };
    }

    /**
     * Fix an error in a source file
     * @param params - Tool parameters
     * @returns - Result of error fixing
     */
    async run_impl(params: Record<string, any>): Promise<any> {
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
            
            let solution: ErrorSolution;
            
            // Use RAG service if available
            if (ragInitialized) {
                try {
                    this.logger.appendLine(`Resolving error with RAG for ${sourcePath}`);
                    // Usamos el método directamente con OpenAI ya que no existe en ragService
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
                } catch (ragError: any) {
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
        } catch (error: any) {
            throw new Error(`Error fixing code: ${error.message}`);
        }
    }

    /**
     * Generate a simple fix using OpenAI
     * @param errorMessage - Error message
     * @param sourceCode - Source code
     * @param language - Programming language
     * @returns - Fixed code
     */
    async generateSimpleFix(errorMessage: string, sourceCode: string, language: string): Promise<string> {
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
            
            // Usamos el método chatCompletion del servicio de OpenAI
            const completion = await openaiService.chatCompletion(
                [systemMessage, userMessage], 
                "gpt-4.1-mini" // Usamos un valor directo en lugar de configManager.getOpenAIModel()
            );
            
            return completion.choices[0].message.content.trim();
        } catch (error: any) {
            this.logger.appendLine(`Error generating simple fix: ${error.message}`);
            throw error;
        }
    }

    /**
     * Map file extension to programming language
     * @param extension - File extension
     * @returns - Programming language
     */
    mapExtensionToLanguage(extension: string): string {
        const extensionMap: Record<string, string> = {
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