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
        const { 
            sourcePath, 
            focus = 'all', 
            detailLevel = 'medium',
            outputFormat = 'json'
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
            
            let analysis: AnalysisResult;
            
            // Use RAG service if available
            if (ragInitialized) {
                try {
                    this.logger.appendLine(`Analyzing code with RAG for ${sourcePath}`);
                    
                    // Adjust context count based on detail level
                    let contextCount = 3;
                    if (detailLevel === 'high') {
                        contextCount = 5;
                    } else if (detailLevel === 'low') {
                        contextCount = 2;
                    }
                    
                    // En lugar de usar ragService.analyzeCode, utilizamos nuestro método interno
                    analysis = await this.analyzeWithOpenAI(
                        sourceContent,
                        language,
                        focus,
                        detailLevel
                    );
                } catch (ragError: any) {
                    this.logger.appendLine(`Error analyzing with RAG: ${ragError.message}`);
                    
                    // Fallback to analyzing with OpenAI directly
                    analysis = await this.analyzeWithOpenAI(
                        sourceContent,
                        language,
                        focus,
                        detailLevel
                    );
                }
            } else {
                // Use OpenAI directly if RAG is not available
                analysis = await this.analyzeWithOpenAI(
                    sourceContent,
                    language,
                    focus,
                    detailLevel
                );
            }
            
            // Format output if needed
            if (outputFormat === 'markdown') {
                return {
                    sourcePath,
                    analysis: this.formatAnalysisAsMarkdown(analysis, sourcePath, language)
                };
            } else if (outputFormat === 'text') {
                return {
                    sourcePath,
                    analysis: this.formatAnalysisAsText(analysis, sourcePath, language)
                };
            } else {
                // Default to JSON
                return {
                    sourcePath,
                    language,
                    analysis
                };
            }
        } catch (error: any) {
            throw new Error(`Error analyzing code: ${error.message}`);
        }
    }

    /**
     * Analyze code using OpenAI directly
     * @param sourceCode - Source code to analyze
     * @param language - Programming language
     * @param focus - Focus area for analysis
     * @param detailLevel - Level of detail
     * @returns - Analysis results
     */
    async analyzeWithOpenAI(
        sourceCode: string, 
        language: string, 
        focus: string, 
        detailLevel: string
    ): Promise<AnalysisResult> {
        try {
            // Create prompt for analysis
            let focusInstructions = '';
            if (focus === 'security') {
                focusInstructions = 'Focus primarily on security vulnerabilities and issues.';
            } else if (focus === 'performance') {
                focusInstructions = 'Focus primarily on performance issues and optimizations.';
            } else if (focus === 'structure') {
                focusInstructions = 'Focus primarily on code structure, maintainability, and best practices.';
            }
            
            let detailInstructions = '';
            if (detailLevel === 'high') {
                detailInstructions = 'Provide very detailed analysis with concrete examples and fixes.';
            } else if (detailLevel === 'low') {
                detailInstructions = 'Provide a concise summary of the most important issues.';
            }
            
            const prompt = `
Analyze this ${language} code:

\`\`\`${language}
${sourceCode}
\`\`\`

${focusInstructions}
${detailInstructions}

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
`;
            
            // Generate analysis with OpenAI
            const systemMessage = {
                role: 'system',
                content: 'You are an expert code reviewer specializing in identifying problems and suggesting improvements. Provide detailed, actionable feedback.'
            };
            
            const userMessage = {
                role: 'user',
                content: prompt
            };
            
            const responseFormat = {
                type: 'json_object',
                schema: {
                    type: 'object',
                    properties: {
                        issues: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    description: { type: 'string' },
                                    severity: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                                    solution: { type: 'string' },
                                    code: { type: 'string' }
                                }
                            }
                        },
                        summary: { type: 'string' }
                    }
                }
            };
            
            const completion = await openaiService.chatCompletion(
                [systemMessage, userMessage], 
                "gpt-4.1-mini",
                { response_format: responseFormat }
            );
            
            return JSON.parse(completion.choices[0].message.content);
        } catch (error: any) {
            this.logger.appendLine(`Error analyzing with OpenAI: ${error.message}`);
            throw error;
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