/**
 * AnalyzeCodeTool
 * Tool for analyzing code for errors, vulnerabilities, and best practices
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import * as ragService from '../../services/ragService';
import * as openaiService from '../../services/openaiService';
import * as configManager from '../../utils/configManager';
import * as vscode from 'vscode';

interface AnalysisIssue {
    description: string;
    severity: 'High' | 'Medium' | 'Low';
    solution: string;
    code: string;
}

interface AnalysisResult {
    issues: AnalysisIssue[];
    summary: string;
}

export class AnalyzeCodeTool extends BaseTool {    constructor(agent: any) {
        super(agent);
        this.name = 'AnalyzeCodeTool';
        this.description = 'Analyzes code for problems and suggests improvements';
        this.parameters = {
            sourcePath: {
                description: 'Path to the source file to analyze',
                type: 'string',
                required: false
            },
            path: {
                description: 'Alternative parameter name for sourcePath',
                type: 'string',
                required: false
            },
            code: {
                description: 'Code content to analyze directly (alternative to file path)',
                type: 'string',
                required: false
            },
            focus: {
                description: 'Focus areas for analysis (security, performance, structure, all)',
                type: 'string',
                required: false,
                default: 'all'
            },
            detailLevel: {
                description: 'Level of detail for results (low, medium, high)',
                type: 'string',
                required: false,
                default: 'medium'
            },
            outputFormat: {
                description: 'Format for the analysis output',
                type: 'string',
                required: false,
                default: 'json'
            },
            additionalContext: {
                description: 'Additional context from RAG or other sources',
                type: 'string',
                required: false
            },
            focusLines: {
                description: 'Array of two numbers [startLine, endLine] to focus analysis on specific lines',
                type: 'array',
                required: false
            }
        };
    }

    /**
     * Analyze code in a source file
     * @param params - Tool parameters
     * @returns - Analysis results
     */    async run_impl(params: Record<string, any>): Promise<any> {
        let { 
            sourcePath, 
            path,
            code,
            focus = 'all', 
            detailLevel = 'medium',
            outputFormat = 'json',
            additionalContext = '',
            focusLines
        } = params;
        
        try {
            // Handle path parameter as alias for sourcePath
            if (!sourcePath && path) {
                sourcePath = path;
                this.logger.appendLine(`Using 'path' parameter as sourcePath: ${sourcePath}`);
            }
            
            // Handle missing sourcePath by using active editor if possible
            if (!sourcePath) {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        sourcePath = editor.document.uri.fsPath;
                        this.logger.appendLine(`No sourcePath provided, using active editor file: ${sourcePath}`);
                    } else if (!code) {
                        throw new Error('Required parameter sourcePath is missing and no active editor available');
                    }
                } catch (e) {
                    if (!code) {
                        throw new Error('Required parameter sourcePath is missing and could not determine active file');
                    }
                }
            }
            
            // Handle variables in sourcePath
            if (sourcePath === '$SELECTED_FILE' || sourcePath === 'path_to_selected_file') {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        sourcePath = editor.document.uri.fsPath;
                        this.logger.appendLine(`Resolved $SELECTED_FILE to: ${sourcePath}`);
                    } else {
                        throw new Error('No active editor available to resolve $SELECTED_FILE');
                    }
                } catch (e) {
                    throw new Error('Could not resolve $SELECTED_FILE variable: No active editor');
                }
            }
            
            let sourceContent: string;
            let language: string = 'text'; // Establecer un valor predeterminado
            let normalizedSourcePath: string = '';
            
            // Get content from either code parameter or file
            if (code && code !== '$CONTENT_OF_SELECTED_FILE' && code !== 'content_of_the_file' && code !== 'content from previous step') {
                // Use provided code
                sourceContent = code;
                this.logger.appendLine('Using provided code parameter instead of file');
                
                // Try to determine language from sourcePath or default to 'text'
                if (sourcePath) {
                    normalizedSourcePath = this.normalizePath(sourcePath);
                    
                    // Validación para evitar undefined en path.extname
                    if (normalizedSourcePath) {
                        const extension = path.extname(normalizedSourcePath).substring(1);
                        language = this.mapExtensionToLanguage(extension);
                    } else {
                        this.logger.appendLine('Warning: Could not normalize sourcePath, using default language "text"');
                    }
                }
            } else {
                // Code parameter is a variable or not provided, read from file
                if (!sourcePath) {
                    throw new Error('Either sourcePath or valid code parameter must be provided');
                }
                
                normalizedSourcePath = this.normalizePath(sourcePath);
                
                // Validación explícita para evitar undefined en path.extname
                if (!normalizedSourcePath) {
                    throw new Error(`Could not normalize sourcePath: ${sourcePath}`);
                }
                
                this.logger.appendLine(`Analyzing file: ${normalizedSourcePath}`);
                
                // Check if source file exists
                if (!this.fileExists(normalizedSourcePath)) {
                    throw new Error(`Source file not found: ${normalizedSourcePath}`);
                }
                // Read source file
                sourceContent = fs.readFileSync(normalizedSourcePath, 'utf8');
                
                // Handle focusLines if provided
                if (focusLines && Array.isArray(focusLines) && focusLines.length === 2) {
                    const lines = sourceContent.split('\n');
                    const startLine = Math.max(0, focusLines[0] - 1); // Convert to 0-based index
                    const endLine = Math.min(lines.length, focusLines[1]);
                    sourceContent = lines.slice(startLine, endLine).join('\n');
                    this.logger.appendLine(`Focusing on lines ${focusLines[0]}-${focusLines[1]}`);
                }
                
                // Get file extension and determine language
                // Asegurarse de que normalizedSourcePath existe antes de usar path.extname
                if (normalizedSourcePath) {
                    const extension = path.extname(normalizedSourcePath).substring(1);
                    language = this.mapExtensionToLanguage(extension);
                }
                
                // If code was a variable, update it for logs and context
                if (code === '$CONTENT_OF_SELECTED_FILE' || code === 'content_of_the_file' || code === 'content from previous step') {
                    this.logger.appendLine(`Resolved code variable to file content from: ${normalizedSourcePath}`);
                }
            }
            
            // Fallback de análisis básico en caso de errores
            let analysis: AnalysisResult = {
                issues: [],
                summary: "Code analysis completed."
            };
            
            try {
                // Intentamos usar el servicio RAG para un análisis más contextualizado
                this.logger.appendLine(`Analyzing code with RAG for ${normalizedSourcePath || 'provided code'}`);
                
                // Si no tenemos contexto adicional pero tenemos una ruta de archivo, intentamos obtener contexto del RAG
                if (!additionalContext && normalizedSourcePath) {
                    try {
                        // Usar RAG para analizar el código con contexto del proyecto
                        const ragAnalysis = await ragService.analyzeCode(
                            sourceContent,
                            normalizedSourcePath,
                            language
                        );
                        
                        if (ragAnalysis && typeof ragAnalysis === 'object') {
                            this.logger.appendLine('Successfully used RAG for code analysis');
                            return {
                                sourcePath: normalizedSourcePath || 'code-snippet',
                                language,
                                analysis: ragAnalysis
                            };
                        }
                    } catch (ragError) {
                        this.logger.appendLine(`RAG analysis failed, falling back to OpenAI: ${ragError}`);
                        // Continuar con el análisis básico de OpenAI
                    }
                }
                
                // Generar el análisis con OpenAI si RAG no funcionó
                this.logger.appendLine(`Analyzing code with OpenAI for ${normalizedSourcePath || 'provided code'}`);
                
                // Generate analysis with OpenAI
                const systemMessage = {
                    role: 'system',
                    content: 'You are an expert code reviewer specializing in identifying problems and suggesting improvements. Provide detailed, actionable feedback in JSON format.'
                };
                
                // Construir el prompt con o sin contexto adicional
                let userPrompt = `
Analyze this ${language} code:

\`\`\`${language}
${sourceContent}
\`\`\`

Look for:
1. Errors and bugs
2. Security vulnerabilities
3. Performance issues
4. Code structure and maintainability problems
5. Violations of best practices
`;

                // Añadir contexto adicional si está disponible
                if (additionalContext) {
                    userPrompt = `
${additionalContext}

${userPrompt}
`;
                }

                userPrompt += `
For each issue, provide:
- Description of the problem
- Severity level (High/Medium/Low)
- Recommended solution with code example

Response format should be valid JSON with the following structure:
{
  "issues": [
    {
      "description": "Issue description",
      "severity": "High|Medium|Low",
      "solution": "Suggested solution",
      "code": "Example fixed code"
    }
  ],
  "summary": "Overall assessment"
}
`;
                
                const userMessage = {
                    role: 'user',
                    content: userPrompt
                };
                
                // Usar generateCompletion con taskType: 'analysis'
                const result = await openaiService.generateCompletion(
                    userPrompt,
                    {
                        temperature: 0.3,
                        format: 'json',
                        taskType: 'analysis',
                        systemPrompt: 'You are an expert code reviewer specializing in identifying problems and suggesting improvements. Provide detailed, actionable feedback in JSON format.'
                    }
                );
                
                // Extraer la información del modelo y el conteo de tokens
                const modelInfo = result.modelInfo;
                const tokenCount = result.tokenCount;
                
                // Si el resultado ya es un objeto (parseado como JSON), usarlo directamente
                if (result.content && typeof result.content === 'object') {
                    analysis = result.content;
                    this.logger.appendLine(`Successfully received object response from OpenAI`);
                } else {
                    // Si es string, intentar parsearlo con manejo mejorado de errores
                    try {
                        const contentString = typeof result.content === 'string' ? result.content : String(result.content);
                        this.logger.appendLine(`Attempting to parse OpenAI response: ${contentString.substring(0, 200)}...`);
                        
                        // Intentar extraer JSON válido si está dentro de comillas, markdown o tiene caracteres extra
                        let jsonContent = contentString;
                        
                        // Buscar patrones de bloques de código JSON en markdown
                        const jsonBlockMatch = contentString.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                        if (jsonBlockMatch && jsonBlockMatch[1]) {
                            jsonContent = jsonBlockMatch[1];
                            this.logger.appendLine(`Extracted JSON from markdown code block`);
                        }
                        
                        // Buscar patrón de objeto JSON directo
                        const jsonObjectMatch = contentString.match(/(\{[\s\S]*\})/);
                        if (!jsonBlockMatch && jsonObjectMatch && jsonObjectMatch[1]) {
                            jsonContent = jsonObjectMatch[1];
                            this.logger.appendLine(`Extracted JSON object from response`);
                        }
                        
                        try {
                            // Intentar parsear el JSON extraído
                            analysis = JSON.parse(jsonContent);
                            this.logger.appendLine(`Successfully parsed JSON response`);
                            
                            // Verificar que tenga la estructura esperada
                            if (!analysis.issues) {
                                analysis.issues = [];
                            }
                            if (!analysis.summary) {
                                analysis.summary = "Analysis completed";
                            }
                        } catch (jsonError) {
                            // Si falla el parsing directo, intentar normalizar el JSON
                            this.logger.appendLine(`Initial JSON parse failed: ${jsonError}. Attempting to normalize JSON...`);
                            
                            // Intento de normalización de JSON malformado (comillas incorrectas, comillas faltantes, etc.)
                            const normalizedJson = this.normalizeJsonString(jsonContent);
                            try {
                                analysis = JSON.parse(normalizedJson);
                                this.logger.appendLine(`Successfully parsed normalized JSON`);
                            } catch (normalizedError) {
                                // Si todo falla, intentar extraer un objeto básico mediante RegExp
                                this.logger.appendLine(`Normalized JSON parsing failed: ${normalizedError}`);
                                throw normalizedError; // Propagar el error para usar el fallback
                            }
                        }
                    } catch (parseError) {
                        // Si falla, usar resultado genérico
                        this.logger.appendLine(`Failed to parse OpenAI response as JSON: ${parseError}. Response was: ${String(result.content).substring(0, 500)}`);
                        
                        // Intentar crear un análisis básico basado en el texto de la respuesta
                        const responseText = String(result.content);
                        
                        // Buscar posibles problemas mencionados en el texto
                        const potentialIssues = this.extractIssuesFromText(responseText);
                        
                        if (potentialIssues.length > 0) {
                            analysis = {
                                issues: potentialIssues,
                                summary: "Analysis extracted from unstructured response."
                            };
                            this.logger.appendLine(`Created basic analysis from unstructured response with ${potentialIssues.length} issues`);
                        } else {
                            analysis = {
                                issues: [{
                                    description: "Could not parse analysis results",
                                    severity: "Medium" as 'Medium',
                                    solution: "The code analyzer encountered an error parsing the results. Raw response: " + 
                                              responseText.substring(0, 200) + (responseText.length > 200 ? "..." : ""),
                                    code: ""
                                }],
                                summary: "Analysis failed to produce properly formatted results."
                            };
                        }
                    }
                }
                
                // Guardar la información del modelo en el resultado del análisis para el LogsView
                this.agent.logsView?.addStepLog(
                    `Análisis de código para ${normalizedSourcePath || 'fragmento de código'}`,
                    "AnalyzeCodeTool",
                    { sourcePath, focus, detailLevel, outputFormat },
                    { analysis },
                    true,
                    undefined,
                    modelInfo,
                    [], // No hay reglas aplicadas en este ejemplo
                    tokenCount
                );
            } catch (aiError: any) {
                // Log error but continue
                this.logger.appendLine(`Error using OpenAI: ${aiError.message}`);
                analysis = {
                    issues: [{
                        description: "Error during analysis",
                        severity: "Medium" as 'Medium',
                        solution: "The code analyzer encountered an error: " + aiError.message,
                        code: ""
                    }],
                    summary: "Analysis failed due to an error with the AI service."
                };
            }
            
            // Format output if needed
            if (outputFormat === 'markdown') {
                return {
                    sourcePath: normalizedSourcePath || 'code-snippet',
                    analysis: this.formatAnalysisAsMarkdown(analysis, normalizedSourcePath || 'code-snippet', language)
                };
            } else if (outputFormat === 'text') {
                return {
                    sourcePath: normalizedSourcePath || 'code-snippet',
                    analysis: this.formatAnalysisAsText(analysis, normalizedSourcePath || 'code-snippet', language)
                };
            } else {
                // Default to JSON
                return {
                    sourcePath: normalizedSourcePath || 'code-snippet',
                    language,
                    analysis
                };
            }
        } catch (error: any) {
            throw new Error(`Error analyzing code: ${error.message}`);
        }
    }

    /**
     * Format analysis results as markdown
     * @param analysis - Analysis results
     * @param sourcePath - Path to source file
     * @param language - Programming language
     * @returns - Markdown formatted analysis
     */
    formatAnalysisAsMarkdown(analysis: AnalysisResult, sourcePath: string, language: string): string {
        let markdown = `# Code Analysis: ${path.basename(sourcePath)}\n\n`;
        markdown += `**Language:** ${language}\n\n`;
        markdown += `## Summary\n\n${analysis.summary}\n\n`;
        
        if (analysis.issues && analysis.issues.length > 0) {
            markdown += `## Found Issues (${analysis.issues.length})\n\n`;
            
            analysis.issues.forEach((issue, index) => {
                markdown += `### Issue ${index + 1}: ${issue.severity} Severity\n\n`;
                markdown += `**Description:** ${issue.description}\n\n`;
                markdown += `**Solution:** ${issue.solution}\n\n`;
                
                if (issue.code) {
                    markdown += "```" + language + "\n";
                    markdown += issue.code + "\n";
                    markdown += "```\n\n";
                }
            });
        } else {
            markdown += "## No issues found\n\n";
        }
        
        return markdown;
    }

    /**
     * Format analysis results as plain text
     * @param analysis - Analysis results
     * @param sourcePath - Path to source file
     * @param language - Programming language
     * @returns - Plain text formatted analysis
     */
    formatAnalysisAsText(analysis: AnalysisResult, sourcePath: string, language: string): string {
        let text = `Code Analysis: ${path.basename(sourcePath)}\n`;
        text += `Language: ${language}\n\n`;
        text += `Summary: ${analysis.summary}\n\n`;
        
        if (analysis.issues && analysis.issues.length > 0) {
            text += `Found Issues (${analysis.issues.length}):\n\n`;
            
            analysis.issues.forEach((issue, index) => {
                text += `Issue ${index + 1} (${issue.severity} Severity):\n`;
                text += `- Description: ${issue.description}\n`;
                text += `- Solution: ${issue.solution}\n`;
                
                if (issue.code) {
                    text += `- Suggested Code:\n${issue.code}\n\n`;
                }
            });
        } else {
            text += "No issues found\n";
        }
        
        return text;
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

    /**
     * Intenta normalizar una cadena JSON malformada
     * @param jsonString - Cadena JSON potencialmente malformada
     * @returns - Cadena JSON normalizada
     */
    private normalizeJsonString(jsonString: string): string {
        let normalized = jsonString;
        
        // Reemplazar comillas simples por comillas dobles
        normalized = normalized.replace(/'/g, '"');
        
        // Asegurar que las claves tengan comillas dobles
        normalized = normalized.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        
        // Eliminar comas finales en objetos y arrays
        normalized = normalized.replace(/,(\s*[}\]])/g, '$1');
        
        // Reemplazar valores de texto sin comillas con comillas
        // Este es un caso difícil porque puede interferir con otros valores
        // solo aplicar en casos obvios
        normalized = normalized.replace(/:(\s*)(\w+)(\s*[,}])/g, (match, space1, word, space2) => {
            // No modificar números o valores booleanos
            if (/^(true|false|null|\d+)$/.test(word)) {
                return match;
            }
            return `:${space1}"${word}"${space2}`;
        });
        
        return normalized;
    }
    
    /**
     * Extrae problemas potenciales de una respuesta de texto no estructurado
     * @param text - Respuesta de texto
     * @returns - Array de problemas encontrados
     */
    private extractIssuesFromText(text: string): AnalysisIssue[] {
        const issues: AnalysisIssue[] = [];
        const lines = text.split('\n');
        
        let currentIssue: Partial<AnalysisIssue> = {};
        let collectingCode = false;
        let codeBuffer = '';
        
        // Patrones para detectar secciones relevantes
        const issuePattern = /issue|problem|error|warning|vulnerability/i;
        const severityPattern = /severity:?\s*(high|medium|low)/i;
        const solutionPattern = /solution|fix|resolution|recommendation/i;
        const codeBlockStartPattern = /```|suggested code|corrected code|example code/i;
        const codeBlockEndPattern = /```/;
        
        for (const line of lines) {
            // Detectar inicio de nuevo problema
            if (issuePattern.test(line) && !collectingCode) {
                // Guardar el problema actual si existe
                if (currentIssue.description) {
                    issues.push({
                        description: currentIssue.description || 'Undefined issue',
                        severity: currentIssue.severity || 'Medium',
                        solution: currentIssue.solution || 'No solution provided',
                        code: currentIssue.code || ''
                    });
                }
                
                // Iniciar nuevo problema
                currentIssue = {
                    description: line.trim()
                };
                continue;
            }
            
            // Detectar severidad
            const severityMatch = line.match(severityPattern);
            if (severityMatch && !collectingCode) {
                const severity = severityMatch[1].toLowerCase();
                currentIssue.severity = severity.charAt(0).toUpperCase() + severity.slice(1) as 'High' | 'Medium' | 'Low';
                continue;
            }
            
            // Detectar solución
            if (solutionPattern.test(line) && !collectingCode && !currentIssue.solution) {
                currentIssue.solution = line.trim();
                continue;
            }
            
            // Detectar inicio de bloque de código
            if (codeBlockStartPattern.test(line) && !collectingCode) {
                collectingCode = true;
                codeBuffer = '';
                continue;
            }
            
            // Detectar fin de bloque de código
            if (codeBlockEndPattern.test(line) && collectingCode) {
                collectingCode = false;
                currentIssue.code = codeBuffer.trim();
                continue;
            }
            
            // Recolectar líneas de código
            if (collectingCode) {
                codeBuffer += line + '\n';
            }
            
            // Agregar línea a la descripción o solución
            if (!collectingCode && currentIssue.description && !currentIssue.solution) {
                currentIssue.description += ' ' + line.trim();
            } else if (!collectingCode && currentIssue.solution) {
                currentIssue.solution += ' ' + line.trim();
            }
        }
        
        // Añadir el último problema si existe
        if (currentIssue.description) {
            issues.push({
                description: currentIssue.description || 'Undefined issue',
                severity: currentIssue.severity || 'Medium',
                solution: currentIssue.solution || 'No solution provided',
                code: currentIssue.code || ''
            });
        }
        
        return issues;
    }
} 