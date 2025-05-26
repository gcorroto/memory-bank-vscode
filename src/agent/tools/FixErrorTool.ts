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
import * as vscode from 'vscode';
import type { ChatMessage } from '../../types/openai';
import { toStandardChatMessage } from '../../types/compatibility';

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
            },
            additionalContext: {
                description: 'Additional context from RAG or other sources',
                type: 'string',
                required: false
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
            saveBackup = true,
            additionalContext = ''
        } = params;
        
        try {
            // Normalizar ruta del archivo
            const normalizedSourcePath = this.normalizePath(sourcePath);
            this.logger.appendLine(`Attempting to fix error in file: ${normalizedSourcePath}`);
            
            // Check if source file exists
            if (!this.fileExists(normalizedSourcePath)) {
                throw new Error(`Source file not found: ${normalizedSourcePath}`);
            }
            
            // Read source file
            const sourceContent = fs.readFileSync(normalizedSourcePath, 'utf8');
            
            // Get file extension and determine language
            const extension = path.extname(normalizedSourcePath).substring(1);
            const language = this.mapExtensionToLanguage(extension);
            
            // Initialize RAG service
            const ragInitialized = await ragService.initialize();
            
            let solution: ErrorSolution;
            
            // Use RAG service if available
            if (ragInitialized) {
                try {
                    this.logger.appendLine(`Resolving error with RAG for ${normalizedSourcePath}`);
                    
                    // Usar el servicio RAG especializado para corrección de errores
                    const fixedCode = await ragService.fixError(
                        sourceContent,
                        errorMessage,
                        normalizedSourcePath,
                        language
                    );
                    
                    if (fixedCode && fixedCode.length > 0) {
                        this.logger.appendLine(`RAG service provided a fix for the error`);
                        
                        solution = {
                            explanation: `Error fixed: ${errorMessage}`,
                            solution: 'Generated fix based on project context and error patterns',
                            fixedCode: fixedCode
                        };
                    } else {
                        throw new Error('RAG service did not provide a valid fix');
                    }
                } catch (ragError: any) {
                    this.logger.appendLine(`Error resolving with RAG: ${ragError.message}`);
                    
                    // Fallback to a simpler solution with OpenAI and additional context
                    const combinedContext = additionalContext 
                        ? `${additionalContext}\n\nError to fix: ${errorMessage}`
                        : `Error to fix: ${errorMessage}`;
                    
                    const fixedCode = await this.generateFixWithContext(
                        errorMessage, 
                        sourceContent,
                        language,
                        combinedContext
                    );
                    
                    solution = {
                        explanation: `Error: ${errorMessage}`,
                        solution: 'Generated fix based on error message and available context',
                        fixedCode: fixedCode
                    };
                }
            } else {
                // Use simple fix if RAG is not available
                const fixedCode = await this.generateFixWithContext(
                    errorMessage, 
                    sourceContent,
                    language,
                    additionalContext
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
                    const backupPath = `${normalizedSourcePath}.backup.${Date.now()}`;
                    fs.writeFileSync(backupPath, sourceContent);
                    this.logger.appendLine(`Backup saved to: ${backupPath}`);
                }
                
                // Write fixed code to file
                fs.writeFileSync(normalizedSourcePath, solution.fixedCode);
                this.logger.appendLine(`Fixed code written to: ${normalizedSourcePath}`);
                
                // Indexar el archivo corregido en Vectra para futuras consultas
                try {
                    await ragService.initialize();
                    const metadata = {
                        filePath: normalizedSourcePath,
                        fileName: path.basename(normalizedSourcePath),
                        extension: extension,
                        errorFixed: errorMessage,
                        fixedAt: new Date().toISOString()
                    };
                    
                    // Intentar indexar el código corregido
                    const vectraService = require('../../services/vectraService');
                    await vectraService.indexCode(solution.fixedCode, metadata);
                    this.logger.appendLine(`Indexed fixed code in vector store for future reference`);
                } catch (indexError) {
                    this.logger.appendLine(`Warning: Could not index fixed code: ${indexError}`);
                    // No interrumpir el flujo principal por un error de indexación
                }
            }
            
            return {
                success: true,
                sourcePath: normalizedSourcePath,
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
     * Generate a fix using OpenAI with additional context
     * @param errorMessage - Error message
     * @param sourceCode - Source code
     * @param language - Programming language
     * @param additionalContext - Additional context for the fix
     * @returns - Fixed code
     */
    async generateFixWithContext(
        errorMessage: string, 
        sourceCode: string, 
        language: string,
        additionalContext: string = ''
    ): Promise<string> {
        try {
            // Create base prompt for fixing the error
            let prompt = `
Fix the following ${language} code that has this error: "${errorMessage}"

\`\`\`${language}
${sourceCode}
\`\`\`
`;

            // Add additional context if available
            if (additionalContext) {
                prompt = `
${additionalContext}

${prompt}
`;
            }

            prompt += `
Provide ONLY the corrected code without any explanations or markdown formatting. The entire fixed file should be returned.
`;
            
            // Generate fix with OpenAI
            const systemMessage: ChatMessage = {
                role: 'system',
                content: 'You are an expert programmer. Fix the provided code to resolve the error. Return only the corrected code without any explanations.'
            };
            
            const userMessage: ChatMessage = {
                role: 'user',
                content: prompt
            };
            
            // Obtener el modelo configurado o usar uno predeterminado
            const configuredModel = configManager.getOpenAIModel();
            const modelToUse = configuredModel || "gpt-4.1-mini";
            
            // Usamos el método chatCompletion del servicio de OpenAI
            const completion = await openaiService.chatCompletion(
                [systemMessage, userMessage], 
                modelToUse
            );
            
            return completion.choices[0].message.content.trim();
        } catch (error: any) {
            this.logger.appendLine(`Error generating fix: ${error.message}`);
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