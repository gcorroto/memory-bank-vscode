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
import { extractContent } from '../../types/compatibility';

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

export class AnalyzeCodeTool extends BaseTool {
    constructor(agent: any) {
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
     * Analiza un archivo de código
     * @param params Parámetros de análisis
     * @returns Resultado del análisis
     */
    async run_impl(params: Record<string, any>): Promise<any> {
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
                if (sourcePath && typeof sourcePath === 'string' && sourcePath.trim() !== '') {
                    try {
                        normalizedSourcePath = this.normalizePath(sourcePath);
                        
                        // Validación robusta para evitar undefined en path.extname
                        if (normalizedSourcePath && typeof normalizedSourcePath === 'string' && normalizedSourcePath.trim() !== '') {
                            const extension = this.safeGetExtension(normalizedSourcePath);
                            language = this.mapExtensionToLanguage(extension);
                        } else {
                            this.logger.appendLine('Warning: Could not normalize sourcePath, using default language "text"');
                        }
                    } catch (error: any) {
                        this.logger.appendLine(`Warning: Error normalizing sourcePath: ${error.message}, using default language "text"`);
                    }
                }
            } else {
                // Code parameter is a variable or not provided, read from file
                if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.trim() === '') {
                    throw new Error('Either sourcePath or valid code parameter must be provided');
                }
                
                try {
                    normalizedSourcePath = this.normalizePath(sourcePath);
                    
                    // Validación explícita para evitar undefined en path.extname
                    if (!normalizedSourcePath || typeof normalizedSourcePath !== 'string' || normalizedSourcePath.trim() === '') {
                        throw new Error(`Could not normalize sourcePath: ${sourcePath}`);
                    }
                } catch (error: any) {
                    throw new Error(`Error normalizing sourcePath "${sourcePath}": ${error.message}`);
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
                if (normalizedSourcePath && typeof normalizedSourcePath === 'string' && normalizedSourcePath.trim() !== '') {
                    const extension = this.safeGetExtension(normalizedSourcePath);
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
                summary: `Análisis del archivo ${normalizedSourcePath || 'código proporcionado'}`
            };
            
            try {
                // Try to use RAG service for enhanced context
                // Verificar si tenemos acceso al workspace usando el agent directamente
                const workspacePath = this.agent.workspaceManager?.getWorkspacePath();
                if (workspacePath) {
                    this.logger.appendLine(`Using RAG with workspace path: ${workspacePath}`);
                    try {
                        // Attempt to analyze with RAG
                        const ragResult = await ragService.analyzeCode(sourceContent, normalizedSourcePath || 'inline-code', language);
                        // Verificar que ragResult sea un objeto con propiedad content
                        if (ragResult && typeof ragResult === 'object' && 'content' in ragResult) {
                            this.logger.appendLine('Successfully used RAG for analysis');
                            analysis = this.parseAnalysisResult(ragResult.content, outputFormat);
                            return this.formatAnalysisOutput(analysis, normalizedSourcePath, language, outputFormat);
                        } else if (typeof ragResult === 'string') {
                            // Si es un string, parsearlo directamente
                            this.logger.appendLine('RAG returned string result, parsing directly');
                            analysis = this.parseAnalysisResult(ragResult, outputFormat);
                            return this.formatAnalysisOutput(analysis, normalizedSourcePath, language, outputFormat);
                        }
                    } catch (ragError) {
                        this.logger.appendLine(`RAG analysis failed: ${ragError.message}, falling back to direct analysis`);
                        // Fall through to direct analysis
                    }
                }
                
                // Fallback to direct OpenAI analysis
                this.logger.appendLine('Using direct OpenAI analysis');
                
                // Prepare analysis prompt
                const analysisPrompt = this.prepareAnalysisPrompt(
                    sourceContent, 
                    language, 
                    focus, 
                    detailLevel, 
                    additionalContext,
                    normalizedSourcePath
                );
                
                // Get model for analysis
                const analysisModel = this.determineAppropriateModel(sourceContent.length, detailLevel);
                
                // Call OpenAI for analysis
                const openaiResult = await openaiService.generateCompletion(
                    analysisPrompt,
                    {
                        taskType: 'analysis',
                        temperature: 0.1,
                        model: analysisModel
                    }
                );
                
                // Extract the content from the result
                const analysisText = extractContent(openaiResult);
                
                // Parse analysis
                analysis = this.parseAnalysisResult(analysisText, outputFormat);
                
                // Format output
                return this.formatAnalysisOutput(analysis, normalizedSourcePath, language, outputFormat);
            } catch (analysisError) {
                this.logger.appendLine(`Error during analysis: ${analysisError.message}`);
                
                // Return basic error analysis
                analysis.issues.push({
                    description: `Error al analizar el código: ${analysisError.message}`,
                    severity: 'Medium',
                    solution: 'Intente de nuevo con un fragmento de código más pequeño o una solicitud más específica',
                    code: sourceContent.substring(0, 100) + '...'
                });
                
                analysis.summary = `Error durante el análisis: ${analysisError.message}`;
                
                return this.formatAnalysisOutput(analysis, normalizedSourcePath, language, outputFormat);
            }
        } catch (error) {
            this.logger.appendLine(`Error in AnalyzeCodeTool: ${error.message}`);
            throw error;
        }
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
     * Safe get file name without throwing errors
     * @param filePath - File path
     * @returns - File name or 'codigo-inline' as fallback
     */
    private safeGetFileName(filePath: string): string {
        try {
            if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
                return 'codigo-inline';
            }
            return path.basename(filePath);
        } catch (error: any) {
            this.logger.appendLine(`Warning: Could not extract filename from "${filePath}": ${error.message}`);
            return 'codigo-inline';
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
        // Manejar casos donde sourcePath puede estar vacío o undefined
        const safeSourcePath = sourcePath || 'codigo-inline';
        const fileName = this.safeGetFileName(safeSourcePath);
        
        let markdown = `# Code Analysis: ${fileName}\n\n`;
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
        // Manejar casos donde sourcePath puede estar vacío o undefined
        const safeSourcePath = sourcePath || 'codigo-inline';
        const fileName = this.safeGetFileName(safeSourcePath);
        
        let text = `Code Analysis: ${fileName}\n`;
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
     * Formatea la salida del análisis según el formato requerido
     * @param analysis Resultado del análisis
     * @param sourcePath Ruta del archivo
     * @param language Lenguaje de programación
     * @param outputFormat Formato de salida
     * @returns Análisis formateado
     */
    formatAnalysisOutput(analysis: AnalysisResult, sourcePath: string, language: string, outputFormat: string): any {
        switch (outputFormat.toLowerCase()) {
            case 'markdown':
                return {
                    analysis: analysis,
                    formatted: this.formatAnalysisAsMarkdown(analysis, sourcePath, language),
                    sourcePath: sourcePath,
                    language: language,
                    format: 'markdown'
                };
            case 'text':
                return {
                    analysis: analysis,
                    formatted: this.formatAnalysisAsText(analysis, sourcePath, language),
                    sourcePath: sourcePath,
                    language: language,
                    format: 'text'
                };
            case 'json':
            default:
                return {
                    analysis: analysis,
                    sourcePath: sourcePath,
                    language: language,
                    format: 'json'
                };
        }
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

    /**
     * Prepara un prompt para análisis de código
     * @param sourceCode Código fuente a analizar
     * @param language Lenguaje de programación
     * @param focus Área de enfoque
     * @param detailLevel Nivel de detalle
     * @param additionalContext Contexto adicional
     * @param sourcePath Ruta del archivo
     * @returns Prompt formateado
     */
    prepareAnalysisPrompt(
        sourceCode: string,
        language: string,
        focus: string,
        detailLevel: string,
        additionalContext: string,
        sourcePath: string
    ): string {
        // Manejar casos donde sourcePath puede estar vacío o undefined
        const safeSourcePath = sourcePath || 'codigo-inline';
        const fileName = this.safeGetFileName(safeSourcePath);
        
        // Construir un prompt específico para el análisis de código
        let prompt = `
### CÓDIGO A ANALIZAR:
\`\`\`${language}
${sourceCode}
\`\`\`

### INSTRUCCIONES:
Analiza este código (${fileName}) y proporciona:
`;

        // Ajustar el enfoque del análisis
        switch (focus.toLowerCase()) {
            case 'security':
                prompt += `
1. Vulnerabilidades de seguridad
2. Inyecciones potenciales
3. Exposición de datos sensibles
4. Problemas de autenticación o autorización
5. Recomendaciones de seguridad
`;
                break;
            case 'performance':
                prompt += `
1. Problemas de rendimiento
2. Uso ineficiente de recursos
3. Fugas de memoria potenciales
4. Operaciones redundantes
5. Recomendaciones de optimización
`;
                break;
            case 'structure':
                prompt += `
1. Problemas de estructura y organización
2. Patrones de diseño faltantes o incorrectos
3. Deuda técnica
4. Problemas de mantenibilidad
5. Recomendaciones de estructura
`;
                break;
            default:
                prompt += `
1. Errores o bugs potenciales
2. Vulnerabilidades de seguridad
3. Problemas de rendimiento
4. Mejoras de legibilidad y mantenibilidad
5. Recomendaciones generales
`;
        }

        // Ajustar el nivel de detalle
        switch (detailLevel.toLowerCase()) {
            case 'high':
                prompt += `\nProporciona un análisis exhaustivo con ejemplos de código específicos y soluciones detalladas.`;
                break;
            case 'low':
                prompt += `\nProporciona un análisis conciso centrándote solo en los problemas más importantes.`;
                break;
            default:
                prompt += `\nProporciona un análisis equilibrado con soluciones claras para los problemas detectados.`;
        }

        // Formato de respuesta
        prompt += `
        
Responde en formato JSON con la siguiente estructura:
{
  "issues": [
    {
      "description": "Descripción del problema",
      "severity": "High|Medium|Low",
      "solution": "Solución propuesta",
      "code": "Ejemplo de código corregido"
    }
  ],
  "summary": "Resumen general del análisis"
}
`;

        // Añadir contexto adicional si existe
        if (additionalContext && additionalContext.trim()) {
            prompt += `\n\n### CONTEXTO ADICIONAL:\n${additionalContext}\n`;
        }

        return prompt;
    }

    /**
     * Determina el modelo más apropiado según el tamaño del código y nivel de detalle
     * @param codeLength Longitud del código
     * @param detailLevel Nivel de detalle
     * @returns Nombre del modelo
     */
    determineAppropriateModel(codeLength: number, detailLevel: string): string {
        // Obtener modelo de configuración o usar uno por defecto
        const configuredModel = configManager.getOpenAIModel();
        if (configuredModel) {
            return configuredModel;
        }
        
        // Lógica para determinar el modelo según tamaño y complejidad
        if (codeLength > 5000 || detailLevel === 'high') {
            return "gpt-4"; // Para código grande o análisis detallado
        }
        
        // Modelo por defecto para la mayoría de casos
        return "gpt-4.1-mini";
    }

    /**
     * Parsea el resultado de análisis a partir de un texto
     * @param text Texto a parsear
     * @param outputFormat Formato esperado
     * @returns Resultado de análisis estructurado
     */
    parseAnalysisResult(text: string, outputFormat: string): AnalysisResult {
        try {
            // Intentar parsear como JSON primero
            if (outputFormat.toLowerCase() === 'json') {
                try {
                    // Intentar parsear directamente
                    const jsonResult = JSON.parse(text);
                    if (jsonResult.issues && jsonResult.summary) {
                        // Validar y reparar si es necesario
                        const issues = Array.isArray(jsonResult.issues) ? jsonResult.issues : [];
                        return {
                            issues: issues.map((issue: any) => ({
                                description: issue.description || 'No description',
                                severity: issue.severity || 'Medium',
                                solution: issue.solution || 'No solution provided',
                                code: issue.code || ''
                            })),
                            summary: jsonResult.summary || 'No summary provided'
                        };
                    }
                } catch (e) {
                    // Si falla, intentar normalizar y parsear de nuevo
                    try {
                        const normalized = this.normalizeJsonString(text);
                        const jsonResult = JSON.parse(normalized);
                        if (jsonResult.issues && jsonResult.summary) {
                            return jsonResult;
                        }
                    } catch (e2) {
                        // Si sigue fallando, extraer usando heurísticas
                        this.logger.appendLine('Failed to parse JSON, using text extraction');
                    }
                }
            }
            
            // Extracción basada en texto
            const issues = this.extractIssuesFromText(text);
            
            // Extraer un resumen
            let summary = 'Análisis de código';
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.includes('summary') || line.includes('Summary') || line.includes('SUMMARY')) {
                    summary = line.replace(/.*[sS]ummary:?\s*/, '').trim();
                    break;
                }
            }
            
            return {
                issues,
                summary
            };
        } catch (error) {
            this.logger.appendLine(`Error parsing analysis result: ${error}`);
            return {
                issues: [{
                    description: `Error parsing analysis result: ${error}`,
                    severity: 'Medium',
                    solution: 'Try again with a different format',
                    code: ''
                }],
                summary: 'Error parsing analysis result'
            };
        }
    }
} 