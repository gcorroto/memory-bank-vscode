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

export class AnalyzeCodeTool extends BaseTool {
    constructor(agent: any) {
        super(agent);
        this.name = 'AnalyzeCodeTool';
        this.description = 'Analyzes code for problems and suggests improvements';
        this.parameters = {
            sourcePath: {
                description: 'Path to the source file to analyze',
                type: 'string',
                required: true
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
            }
        };
    }

    /**
     * Analyze code in a source file
     * @param params - Tool parameters
     * @returns - Analysis results
     */
    async run_impl(params: Record<string, any>): Promise<any> {
        let { 
            sourcePath, 
            code,
            focus = 'all', 
            detailLevel = 'medium',
            outputFormat = 'json'
        } = params;
        
        try {
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
            let language: string;
            
            // Get content from either code parameter or file
            if (code && code !== '$CONTENT_OF_SELECTED_FILE' && code !== 'content_of_the_file' && code !== 'content from previous step') {
                // Use provided code
                sourceContent = code;
                
                // Try to determine language from sourcePath or default to 'text'
                if (sourcePath) {
                    const extension = path.extname(sourcePath).substring(1);
                    language = this.mapExtensionToLanguage(extension);
                } else {
                    language = 'text';
                }
            } else {
                // Code parameter is a variable or not provided, read from file
                if (!sourcePath) {
                    throw new Error('Either sourcePath or valid code parameter must be provided');
                }
                
                // Check if source file exists
                if (!fs.existsSync(sourcePath)) {
                    throw new Error(`Source file not found: ${sourcePath}`);
                }
                
                // Read source file
                sourceContent = fs.readFileSync(sourcePath, 'utf8');
                
                // Get file extension and determine language
                const extension = path.extname(sourcePath).substring(1);
                language = this.mapExtensionToLanguage(extension);
                
                // If code was a variable, update it for logs and context
                if (code === '$CONTENT_OF_SELECTED_FILE' || code === 'content_of_the_file' || code === 'content from previous step') {
                    this.logger.appendLine(`Resolved code variable to file content from: ${sourcePath}`);
                }
            }
            
            // Fallback de análisis básico en caso de errores
            let analysis: AnalysisResult = {
                issues: [],
                summary: "Code analysis completed."
            };
            
            try {
                // Intentar usar OpenAI para el análisis
                this.logger.appendLine(`Analyzing code with OpenAI for ${sourcePath || 'provided code'}`);
                
                // Generate analysis with OpenAI
                const systemMessage = {
                    role: 'system',
                    content: 'You are an expert code reviewer specializing in identifying problems and suggesting improvements. Provide detailed, actionable feedback in JSON format.'
                };
                
                const userMessage = {
                    role: 'user',
                    content: `
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
`
                };
                
                // Simplificamos las opciones para evitar el error
                const apiConfig = configManager.getConfig();
                const modelToUse = apiConfig.model || "gpt-4.1-mini";
                
                const completion = await openaiService.chatCompletion(
                    [systemMessage, userMessage], 
                    modelToUse,
                    { temperature: 0.3 }
                );
                
                let resultContent = completion.choices[0].message.content;
                
                try {
                    // Intentamos parsear el resultado como JSON
                    analysis = JSON.parse(resultContent);
                } catch (parseError) {
                    // Si falla, usar resultado genérico
                    this.logger.appendLine("Failed to parse OpenAI response as JSON, using fallback analysis");
                    analysis = {
                        issues: [{
                            description: "Could not parse analysis results",
                            severity: "Medium" as 'Medium',
                            solution: "The code analyzer encountered an error parsing the results",
                            code: ""
                        }],
                        summary: "Analysis failed to produce properly formatted results."
                    };
                }
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
                    sourcePath: sourcePath || 'code-snippet',
                    analysis: this.formatAnalysisAsMarkdown(analysis, sourcePath || 'code-snippet', language)
                };
            } else if (outputFormat === 'text') {
                return {
                    sourcePath: sourcePath || 'code-snippet',
                    analysis: this.formatAnalysisAsText(analysis, sourcePath || 'code-snippet', language)
                };
            } else {
                // Default to JSON
                return {
                    sourcePath: sourcePath || 'code-snippet',
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
} 