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

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

// Static prompt content (cached)
let SYSTEM_PROMPT = null;
let TOOLS_PROMPT = null;

/**
 * Loads the static prompt files from resources directory
 */
function loadStaticPrompts() {
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
 * @param {Array<{text: string, source: string}>} docs Array of document chunks
 * @returns {string} Formatted documentation text
 */
function formatDocChunks(docs) {
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
 * @param {Object} input Input object containing user query, workspace path and docs
 * @param {string} input.userQuery User's query
 * @param {string} input.workspacePath Workspace root path
 * @param {Array<{text: string, source: string}>} input.attachedDocs RAG document chunks
 * @returns {string} Assembled prompt string
 */
function buildPrompt(input) {
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

module.exports = {
    buildPrompt
};