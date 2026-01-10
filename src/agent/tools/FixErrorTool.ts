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
                required: false  // Made optional to handle $STEP[n] references
            },
            content: {
                description: 'File content to analyze and fix (alternative to reading from sourcePath)',
                type: 'string',
                required: false
            },
            errorMessage: {
                description: 'Error message or description',
                type: 'string',
                required: false  // Made optional - can be inferred
            },
            focus: {
                description: 'Focus area for the fix (e.g., specific class, function, or issue)',
                type: 'string',
                required: false
            },
            description: {
                description: 'Alternative description of the issue to fix',
                type: 'string',
                required: false
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
        let { 
            sourcePath, 
            content,
            errorMessage, 
            focus,
            description,
            applyFix = false, 
            saveBackup = true,
            additionalContext = ''
        } = params;
        
        try {
            let sourceContent: string;
            let normalizedSourcePath: string = '';
            let language: string = 'text';
            
            // Determine error message from various sources
            if (!errorMessage) {
                errorMessage = this.inferErrorMessage(params);
            }
            
            // Handle content vs file path scenarios
            if (content && typeof content === 'string' && content.trim() !== '') {
                // Use provided content
                sourceContent = content;
                this.logger.appendLine('FixErrorTool: Using provided content instead of reading from file');
                
                // Try to get language from sourcePath if available
                if (sourcePath && typeof sourcePath === 'string' && sourcePath.trim() !== '') {
                    try {
                        normalizedSourcePath = this.normalizePath(sourcePath);
                        const extension = this.safeGetExtension(normalizedSourcePath);
                        language = this.mapExtensionToLanguage(extension);
                    } catch (error: any) {
                        this.logger.appendLine(`Warning: Could not normalize sourcePath for language detection: ${error.message}`);
                    }
                }
            } else {
                // Read from file
                if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.trim() === '') {
                    throw new Error('Either sourcePath or content parameter must be provided');
                }
                
                // Normalizar ruta del archivo
                normalizedSourcePath = this.normalizePath(sourcePath);
                this.logger.appendLine(`Attempting to fix error in file: ${normalizedSourcePath}`);
                
                // Check if source file exists
                if (!this.fileExists(normalizedSourcePath)) {
                    throw new Error(`Source file not found: ${normalizedSourcePath}`);
                }
                
                // Read source file
                sourceContent = fs.readFileSync(normalizedSourcePath, 'utf8');
                
                // Get file extension and determine language
                const extension = this.safeGetExtension(normalizedSourcePath);
                language = this.mapExtensionToLanguage(extension);
            }
            
            this.logger.appendLine(`FixErrorTool: Processing error - ${errorMessage}`);
            this.logger.appendLine(`FixErrorTool: Language detected - ${language}`);
            
            // Initialize RAG service
            const ragInitialized = await ragService.initialize();
            
            let solution: ErrorSolution;
            
            // Use RAG service if available
            if (ragInitialized) {
                try {
                    this.logger.appendLine(`Resolving error with RAG for ${normalizedSourcePath || 'inline content'}`);
                    
                    // Usar el servicio RAG especializado para corrección de errores
                    const fixedCode = await ragService.fixError(
                        sourceContent,
                        errorMessage,
                        normalizedSourcePath || 'inline-content',
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
                    this.logger.appendLine(`Falling back to OpenAI-only solution`);
                    
                    // Fallback to a simpler solution with OpenAI only
                    try {
                        const fixedCode = await this.generateSimpleFix(
                            errorMessage, 
                            sourceContent,
                            language,
                            additionalContext
                        );
                        
                        solution = {
                            explanation: `Error: ${errorMessage}`,
                            solution: 'Generated fix using OpenAI (RAG unavailable)',
                            fixedCode: fixedCode
                        };
                    } catch (fallbackError: any) {
                        this.logger.appendLine(`Fallback also failed: ${fallbackError.message}`);
                        
                        // Último recurso: devolver el código original con comentario
                        solution = {
                            explanation: `Error: ${errorMessage}`,
                            solution: 'Could not generate automatic fix. Manual review required.',
                            fixedCode: `// ERROR: ${errorMessage}\n// RAG and fallback services unavailable\n// TODO: Manual fix required\n\n${sourceContent}`
                        };
                    }
                }
            } else {
                // Use simple fix if RAG is not available
                this.logger.appendLine(`RAG not available, using OpenAI directly`);
                
                try {
                    const fixedCode = await this.generateSimpleFix(
                        errorMessage, 
                        sourceContent,
                        language,
                        additionalContext
                    );
                    
                    solution = {
                        explanation: `Error: ${errorMessage}`,
                        solution: 'Generated fix using OpenAI (RAG not available)',
                        fixedCode: fixedCode
                    };
                } catch (fixError: any) {
                    this.logger.appendLine(`Failed to generate fix: ${fixError.message}`);
                    
                    // Último recurso
                    solution = {
                        explanation: `Error: ${errorMessage}`,
                        solution: 'Could not generate automatic fix. Manual review required.',
                        fixedCode: `// ERROR: ${errorMessage}\n// Automatic fix unavailable\n// TODO: Manual fix required\n\n${sourceContent}`
                    };
                }
            }
            
            // Apply fix if requested and we have a valid source path
            if (applyFix && solution.fixedCode && normalizedSourcePath) {
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
                        extension: this.safeGetExtension(normalizedSourcePath),
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
                sourcePath: normalizedSourcePath || 'inline-content',
                errorMessage,
                explanation: solution.explanation,
                solution: solution.solution,
                fixedCode: solution.fixedCode,
                applied: applyFix && !!normalizedSourcePath,
                language: language
            };
        } catch (error: any) {
            // NO crashear - devolver un resultado válido con el error
            this.logger.appendLine(`Critical error in FixErrorTool: ${error.message}`);
            this.logger.appendLine(`Stack trace: ${error.stack}`);
            
            return {
                success: false,
                sourcePath: params.sourcePath || 'unknown',
                errorMessage: params.errorMessage || params.description || 'Unknown error',
                explanation: `Failed to fix error: ${error.message}`,
                solution: 'Manual review required',
                fixedCode: params.content || '// Error during fix generation',
                applied: false,
                language: 'text',
                error: error.message
            };
        }
    }

    /**
     * Infer error message from various parameter sources
     * @param params - Tool parameters
     * @returns - Inferred error message
     */
    private inferErrorMessage(params: Record<string, any>): string {
        // Try different sources for error message
        if (params.errorMessage && typeof params.errorMessage === 'string') {
            return params.errorMessage;
        }
        
        if (params.description && typeof params.description === 'string') {
            return params.description;
        }
        
        if (params.focus && typeof params.focus === 'string') {
            // Convert focus to error message
            const focus = params.focus;
            if (focus.includes('Service') || focus.includes('Component') || focus.includes('Module')) {
                return `Issue with ${focus} - missing import, declaration, or dependency`;
            } else {
                return `Fix issue related to: ${focus}`;
            }
        }
        
        // Check if there's additional context that might contain error info
        if (params.additionalContext && typeof params.additionalContext === 'string') {
            const context = params.additionalContext;
            if (context.includes('error') || context.includes('Error')) {
                return `Fix based on context: ${context.substring(0, 100)}${context.length > 100 ? '...' : ''}`;
            }
        }
        
        // Default generic error message
        return 'Fix code issues and improve structure';
    }

    /**
     * Safe get file extension without throwing errors
     * @param filePath - File path
     * @returns - File extension (without the dot) or 'text' as fallback
     */
    private safeGetExtension(filePath: string): string {
        try {
            if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
                return 'text';
            }
            const extension = path.extname(filePath).substring(1);
            return extension.trim() === '' ? 'text' : extension;
        } catch (error: any) {
            this.logger.appendLine(`Warning: Could not extract extension from "${filePath}": ${error.message}`);
            return 'text';
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
     * Generate a simple fix using only OpenAI (no RAG)
     * @param errorMessage - Error message
     * @param sourceContent - Source code content
     * @param language - Programming language
     * @param additionalContext - Additional context
     * @returns - Fixed code
     */
    private async generateSimpleFix(
        errorMessage: string,
        sourceContent: string,
        language: string,
        additionalContext?: string
    ): Promise<string> {
        try {
            this.logger.appendLine(`Generating simple fix with OpenAI for error: ${errorMessage}`);
            
            let prompt = `Fix the following ${language} code to resolve this error:\n\n`;
            prompt += `Error: ${errorMessage}\n\n`;
            
            if (additionalContext) {
                prompt += `Additional Context:\n${additionalContext}\n\n`;
            }
            
            prompt += `Code:\n\`\`\`${language}\n${sourceContent}\n\`\`\`\n\n`;
            prompt += `Provide ONLY the corrected code without explanations or markdown formatting.`;
            
            const systemMessage: ChatMessage = {
                role: 'system',
                content: 'You are an expert programmer. Fix code errors precisely and return only the corrected code.'
            };
            
            const userMessage: ChatMessage = {
                role: 'user',
                content: prompt
            };
            
            const modelToUse = configManager.getOpenAIModel() || "gpt-4.1-mini";
            
            const completion = await openaiService.chatCompletion(
                [systemMessage, userMessage], 
                modelToUse
            );
            
            const fixedCode = completion.choices[0].message.content.trim();
            this.logger.appendLine(`Simple fix generated successfully`);
            
            return fixedCode;
        } catch (error: any) {
            this.logger.appendLine(`Error in generateSimpleFix: ${error.message}`);
            throw new Error(`Failed to generate simple fix: ${error.message}`);
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