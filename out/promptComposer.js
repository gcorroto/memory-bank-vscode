"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrompt = buildPrompt;
var fs = require("fs");
var path = require("path");
var vscode = require("vscode");
// Static prompt content (cached)
var SYSTEM_PROMPT = null;
var TOOLS_PROMPT = null;
/**
 * Parses frontmatter from a markdown-like file content
 * @param content File content string
 * @returns Parsed rule with metadata and content
 */
function parseFrontmatter(content) {
    var defaultResult = {
        metadata: {},
        content: content
    };
    // Check if content starts with frontmatter delimiter
    if (!content.trimStart().startsWith('---')) {
        return defaultResult;
    }
    // Find the second delimiter
    var startPos = content.indexOf('---');
    var endPos = content.indexOf('---', startPos + 3);
    if (endPos === -1) {
        return defaultResult;
    }
    // Extract frontmatter and content
    var frontmatter = content.substring(startPos + 3, endPos).trim();
    var cleanContent = content.substring(endPos + 3).trim();
    // Parse frontmatter into key-value pairs
    var metadata = {};
    var lines = frontmatter.split('\n');
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        var trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue; // Skip empty lines and comments
        }
        var colonIndex = trimmedLine.indexOf(':');
        if (colonIndex !== -1) {
            var key = trimmedLine.substring(0, colonIndex).trim();
            var value = trimmedLine.substring(colonIndex + 1).trim();
            // Parse specific types
            if (key === 'globs') {
                // Parse array value
                if (value) {
                    metadata.globs = value.split(',').map(function (item) { return item.trim(); });
                }
            }
            else if (key === 'alwaysApply') {
                // Parse boolean value
                metadata.alwaysApply = value.toLowerCase() === 'true';
            }
            else if (key === 'description') {
                metadata.description = value;
            }
        }
    }
    return {
        metadata: metadata,
        content: cleanContent
    };
}
/**
 * Checks if a file path matches a glob pattern
 * @param filePath Path to check
 * @param pattern Glob pattern
 * @returns true if the path matches the pattern
 */
function matchGlobPattern(filePath, pattern) {
    // Convert glob pattern to regex
    var regexPattern = pattern
        .replace(/\./g, '\\.') // Escape dots
        .replace(/\*\*/g, '.*') // ** matches any character (including /)
        .replace(/\*/g, '[^/]*'); // * matches any character except /
    // Make sure it's a full match
    regexPattern = "^".concat(regexPattern, "$");
    // Create regex and test
    var regex = new RegExp(regexPattern);
    return regex.test(filePath);
}
/**
 * Checks if a rule applies to a specific file based on its metadata
 * @param rule Parsed rule with metadata
 * @param filePath Current file path (optional)
 * @returns true if the rule applies
 */
function ruleAppliesToFile(rule, filePath) {
    // If alwaysApply is true, the rule always applies
    if (rule.metadata.alwaysApply) {
        return true;
    }
    // If no globs or no file path, don't apply pattern matching
    if (!rule.metadata.globs || !filePath) {
        return true; // Default behavior: include if no constraints
    }
    // Get relative path for matching
    var fileName = path.basename(filePath);
    // Check if any glob pattern matches
    for (var _i = 0, _a = rule.metadata.globs; _i < _a.length; _i++) {
        var pattern = _a[_i];
        if (pattern && (matchGlobPattern(filePath, pattern) || matchGlobPattern(fileName, pattern))) {
            return true;
        }
    }
    return false;
}
/**
 * Loads the static prompt files from resources directory
 */
function loadStaticPrompts() {
    var _a;
    if (SYSTEM_PROMPT !== null && TOOLS_PROMPT !== null) {
        // Already loaded
        return;
    }
    try {
        var extensionPath = (_a = vscode.extensions.getExtension('grec0ai.grec0ai-vscode')) === null || _a === void 0 ? void 0 : _a.extensionPath;
        if (!extensionPath) {
            throw new Error('Extension path not found');
        }
        var systemPromptPath = path.join(extensionPath, 'resources', 'system_prompt.md');
        var toolsPromptPath = path.join(extensionPath, 'resources', 'tools_prompt.md');
        SYSTEM_PROMPT = fs.readFileSync(systemPromptPath, 'utf8');
        TOOLS_PROMPT = fs.readFileSync(toolsPromptPath, 'utf8');
    }
    catch (error) {
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
function formatDocChunks(docs) {
    if (!docs || docs.length === 0) {
        return '';
    }
    var result = '';
    for (var _i = 0, docs_1 = docs; _i < docs_1.length; _i++) {
        var doc = docs_1[_i];
        result += "### Fuente: ".concat(doc.source, "\n").concat(doc.text, "\n\n");
    }
    return result.trim();
}
/**
 * Main function to build the complete prompt
 * @param input PromptComposerInput object containing user query, workspace path and docs
 * @returns Assembled prompt string
 */
function buildPrompt(input) {
    // 1. Load static prompts if not loaded
    loadStaticPrompts();
    // 2. Process rules files
    var rulesContent = '';
    // Check for traditional rules file first (backward compatibility)
    var rulesPath = path.join(input.workspacePath, '.cursor', 'rules');
    if (fs.existsSync(rulesPath)) {
        rulesContent = fs.readFileSync(rulesPath, 'utf8');
    }
    else {
        // Check for .mdc rule files
        var altRulesPath = path.join(input.workspacePath, '@rules.mdc');
        var rulesDir = path.join(input.workspacePath, '.cursor', 'rules.d');
        // Rules content from all applicable files
        var applicableRules = [];
        // Process individual @rules.mdc file if it exists
        if (fs.existsSync(altRulesPath)) {
            var content = fs.readFileSync(altRulesPath, 'utf8');
            var parsedRule = parseFrontmatter(content);
            if (ruleAppliesToFile(parsedRule, input.currentFilePath)) {
                applicableRules.push(parsedRule.content);
            }
        }
        // Process rules directory if it exists
        if (fs.existsSync(rulesDir) && fs.statSync(rulesDir).isDirectory()) {
            try {
                var files = fs.readdirSync(rulesDir);
                for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
                    var file = files_1[_i];
                    if (file.endsWith('.mdc')) {
                        var filePath = path.join(rulesDir, file);
                        var content = fs.readFileSync(filePath, 'utf8');
                        var parsedRule = parseFrontmatter(content);
                        if (ruleAppliesToFile(parsedRule, input.currentFilePath)) {
                            applicableRules.push(parsedRule.content);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error reading rules directory:', error);
            }
        }
        // Combine applicable rules
        rulesContent = applicableRules.join('\n\n');
    }
    // 3. Format attached docs
    var attachedDocsText = formatDocChunks(input.attachedDocs);
    // 4. Assemble the prompt
    return [
        "USER:\n".concat(input.userQuery.trim()),
        '---',
        SYSTEM_PROMPT,
        '---',
        TOOLS_PROMPT,
        rulesContent ? '---\n' + rulesContent : '',
        input.attachedDocs.length ? '---\n' + attachedDocsText : ''
    ].filter(Boolean).join('\n\n');
}

// CommonJS module export
module.exports = {
    buildPrompt: buildPrompt
};
