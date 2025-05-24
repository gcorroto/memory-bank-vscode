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
 * Input parameters for the buildPrompt function
 */
export interface PromptComposerInput {
    userQuery: string;          // mensaje del usuario
    workspacePath: string;      // raíz del proyecto abierto
    attachedDocs: DocChunk[];   // output del motor RAG (puede ir vacío)
}

// Static prompt content (cached)
let SYSTEM_PROMPT: string | null = null;
let TOOLS_PROMPT: string | null = null;

/**
 * Loads the static prompt files from resources directory
 */
function loadStaticPrompts(): void {
    if (SYSTEM_PROMPT !== null && TOOLS_PROMPT !== null) {
        // Already loaded
        return;
    }

    try {
        const extensionPath = vscode.extensions.getExtension('grec0ai.grec0ai-vscode')?.extensionPath;
        
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

    // 2. Check for rules file
    let rules = '';
    const rulesPath = path.join(input.workspacePath, '.cursor', 'rules');
    // Alternative path
    const altRulesPath = path.join(input.workspacePath, '@rules.mdc');
    
    if (fs.existsSync(rulesPath)) {
        rules = fs.readFileSync(rulesPath, 'utf8');
    } else if (fs.existsSync(altRulesPath)) {
        rules = fs.readFileSync(altRulesPath, 'utf8');
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
        rules ? '---\n' + rules : '',
        input.attachedDocs.length ? '---\n' + attachedDocsText : ''
    ].filter(Boolean).join('\n\n');
}