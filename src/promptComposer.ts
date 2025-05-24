/**
 * PromptComposer Module
 * 
 * Responsible for dynamically building prompts by combining:
 * 1. User query
 * 2. System prompt (from resources/system_prompt.md)
 * 3. Tools prompt (from resources/tools_prompt.md)
 * 4. Rules (from workspace .cursor/rules if it exists)
 * 5. Dynamic documentation chunks from RAG
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * A chunk of documentation from the RAG engine
 */
export interface DocChunk {
    text: string;
    source: string;
}

/**
 * Rule metadata from frontmatter in .mdc files
 */
export interface RuleMetadata {
    description?: string;
    globs?: string[];
    alwaysApply?: boolean;
}

/**
 * Parsed rule with metadata and content
 */
export interface ParsedRule {
    metadata: RuleMetadata;
    content: string;
}

/**
 * Input parameters for the buildPrompt function
 */
export interface PromptComposerInput {
    userQuery: string;          // mensaje del usuario
    workspacePath: string;      // raíz del proyecto abierto
    attachedDocs: DocChunk[];   // output del motor RAG (puede ir vacío)
    currentFilePath?: string;   // ruta del archivo actual (opcional, para matching de globs)
}

// Static prompt content (cached)
let SYSTEM_PROMPT: string | null = null;
let TOOLS_PROMPT: string | null = null;

/**
 * Parses frontmatter from a markdown-like file content
 * Uses gray-matter library if available, otherwise falls back to custom parsing
 * @param content File content string
 * @returns Parsed rule with metadata and content
 */
function parseFrontmatter(content: string): ParsedRule {
    const defaultResult: ParsedRule = {
        metadata: {},
        content: content
    };

    // Check if content starts with frontmatter delimiter
    if (!content.trimStart().startsWith('---')) {
        return defaultResult;
    }

    try {
        // Try to use gray-matter if available
        // Using require instead of import for dynamic loading
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const matter = require('gray-matter');
        const parsed = matter(content);
        
        // Extract relevant metadata fields
        const metadata: RuleMetadata = {};
        
        if (parsed.data.description) {
            metadata.description = parsed.data.description;
        }
        
        if (parsed.data.alwaysApply !== undefined) {
            metadata.alwaysApply = !!parsed.data.alwaysApply;
        }
        
        if (parsed.data.globs) {
            // Handle both string and array formats
            if (typeof parsed.data.globs === 'string') {
                metadata.globs = parsed.data.globs.split(',').map((item: string) => item.trim());
            } else if (Array.isArray(parsed.data.globs)) {
                metadata.globs = parsed.data.globs;
            }
        }
        
        return {
            metadata,
            content: parsed.content
        };
    } catch (error) {
        console.log('gray-matter not available, using fallback parser');
        
        // Fallback to manual parsing if gray-matter is not available
        // Find the second delimiter
        const startPos = content.indexOf('---');
        const endPos = content.indexOf('---', startPos + 3);
        if (endPos === -1) {
            return defaultResult;
        }

        // Extract frontmatter and content
        const frontmatter = content.substring(startPos + 3, endPos).trim();
        const cleanContent = content.substring(endPos + 3).trim();

        // Parse frontmatter into key-value pairs
        const metadata: RuleMetadata = {};
        const lines = frontmatter.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue; // Skip empty lines and comments
            }

            const colonIndex = trimmedLine.indexOf(':');
            if (colonIndex !== -1) {
                const key = trimmedLine.substring(0, colonIndex).trim();
                const value = trimmedLine.substring(colonIndex + 1).trim();

                // Parse specific types
                if (key === 'globs') {
                    // Parse array value
                    if (value) {
                        metadata.globs = value.split(',').map(item => item.trim());
                    }
                } else if (key === 'alwaysApply') {
                    // Parse boolean value
                    metadata.alwaysApply = value.toLowerCase() === 'true';
                } else if (key === 'description') {
                    metadata.description = value;
                }
            }
        }

        return {
            metadata,
            content: cleanContent
        };
    }
}

/**
 * Checks if a file path matches a glob pattern
 * @param filePath Path to check
 * @param pattern Glob pattern
 * @returns true if the path matches the pattern
 */
function matchGlobPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    let regexPattern = pattern
        .replace(/\./g, '\\.')    // Escape dots
        .replace(/\*\*/g, '.*')   // ** matches any character (including /)
        .replace(/\*/g, '[^/]*'); // * matches any character except /

    // Make sure it's a full match
    regexPattern = `^${regexPattern}$`;
    
    // Create regex and test
    const regex = new RegExp(regexPattern);
    return regex.test(filePath);
}

/**
 * Checks if a rule applies to a specific file based on its metadata
 * @param rule Parsed rule with metadata
 * @param filePath Current file path (optional)
 * @returns true if the rule applies
 */
function ruleAppliesToFile(rule: ParsedRule, filePath?: string): boolean {
    // If alwaysApply is true, the rule always applies
    if (rule.metadata.alwaysApply) {
        return true;
    }

    // If no globs or no file path, don't apply pattern matching
    if (!rule.metadata.globs || !filePath) {
        return true; // Default behavior: include if no constraints
    }

    // Get relative path for matching
    const fileName = path.basename(filePath);
    
    // Check if any glob pattern matches
    for (const pattern of rule.metadata.globs) {
        if (pattern && (matchGlobPattern(filePath, pattern) || matchGlobPattern(fileName, pattern))) {
            return true;
        }
    }
    
    return false;
}

/**
 * Loads the static prompt files from resources directory
 */
function loadStaticPrompts(): void {
    if (SYSTEM_PROMPT !== null && TOOLS_PROMPT !== null) {
        // Already loaded
        return;
    }

    try {
        const extension = vscode.extensions.getExtension('grec0ai.grec0ai-vscode');
        const extensionPath = extension ? extension.extensionPath : undefined;
        
        if (!extensionPath) {
            throw new Error('Extension path not found');
        }

        const systemPromptPath = path.join(extensionPath, 'resources', 'system_prompt.md');
        const toolsPromptPath = path.join(extensionPath, 'resources', 'tools_prompt.md');

        SYSTEM_PROMPT = fs.readFileSync(systemPromptPath, 'utf8');
        TOOLS_PROMPT = fs.readFileSync(toolsPromptPath, 'utf8');
    } catch (error) {
        console.error('Error loading static prompts:', error);
        // Fallback to default values
        SYSTEM_PROMPT = "Eres un asistente de código avanzao llamao MacGyver, que ayuda a los dev con su código. Hablas con acentillo andalú.";
        TOOLS_PROMPT = "## Herramientas pa' código\n\nAquí tienes algunas herramientas que podemos usa' pa' ayudarte con tu código.";
    }
}

/**
 * Formats document chunks into a string
 * @param docs Array of document chunks
 * @returns Formatted documentation text
 */
function formatDocChunks(docs: DocChunk[]): string {
    if (!docs || docs.length === 0) {
        return '';
    }

    let result = '';

    for (const doc of docs) {
        result += `### Fuente: ${doc.source}\n${doc.text}\n\n`;
    }

    return result.trim();
}

/**
 * Main function to build the complete prompt
 * @param input PromptComposerInput object containing user query, workspace path and docs
 * @returns Assembled prompt string
 */
export function buildPrompt(input: PromptComposerInput): string {
    // 1. Load static prompts if not loaded
    loadStaticPrompts();

    // 2. Process rules files
    let rulesContent = '';
    
    // Check for traditional rules file first (backward compatibility)
    const rulesPath = path.join(input.workspacePath, '.cursor', 'rules');
    if (fs.existsSync(rulesPath)) {
        rulesContent = fs.readFileSync(rulesPath, 'utf8');
    } else {
        // Check for .mdc rule files
        const altRulesPath = path.join(input.workspacePath, '@rules.mdc');
        const rulesDir = path.join(input.workspacePath, '.cursor', 'rules.d');
        
        // Rules content from all applicable files
        const applicableRules: string[] = [];
        
        // Process individual @rules.mdc file if it exists
        if (fs.existsSync(altRulesPath)) {
            const content = fs.readFileSync(altRulesPath, 'utf8');
            const parsedRule = parseFrontmatter(content);
            
            if (ruleAppliesToFile(parsedRule, input.currentFilePath)) {
                applicableRules.push(parsedRule.content);
            }
        }
        
        // Process rules directory if it exists
        if (fs.existsSync(rulesDir) && fs.statSync(rulesDir).isDirectory()) {
            try {
                const files = fs.readdirSync(rulesDir);
                
                for (const file of files) {
                    if (file.endsWith('.mdc')) {
                        const filePath = path.join(rulesDir, file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        const parsedRule = parseFrontmatter(content);
                        
                        if (ruleAppliesToFile(parsedRule, input.currentFilePath)) {
                            applicableRules.push(parsedRule.content);
                        }
                    }
                }
            } catch (error) {
                console.error('Error reading rules directory:', error);
            }
        }
        
        // Combine applicable rules
        rulesContent = applicableRules.join('\n\n');
    }

    // 3. Format attached docs
    const attachedDocsText = formatDocChunks(input.attachedDocs);

    // 4. Assemble the prompt
    return [
        `USER:\n${input.userQuery.trim()}`,
        '---',
        SYSTEM_PROMPT,
        '---',
        TOOLS_PROMPT,
        rulesContent ? '---\n' + rulesContent : '',
        input.attachedDocs.length ? '---\n' + attachedDocsText : ''
    ].filter(Boolean).join('\n\n');
}