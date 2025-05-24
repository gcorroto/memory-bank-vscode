/**
 * Tests for PromptComposer
 */
import { buildPrompt, PromptComposerInput, DocChunk } from './promptComposer';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('vscode');

// Mock gray-matter if it's being used
jest.mock('gray-matter', () => {
    return function(content: string) {
        // Simple mock implementation that extracts frontmatter
        const startPos = content.indexOf('---');
        const endPos = content.indexOf('---', startPos + 3);
        
        // Extract content after frontmatter
        const cleanContent = content.substring(endPos + 3).trim();
        
        // Extract and parse frontmatter
        const frontmatter = content.substring(startPos + 3, endPos).trim();
        const data: any = {};
        
        frontmatter.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                return; // Skip empty lines and comments
            }
            
            const colonIndex = trimmedLine.indexOf(':');
            if (colonIndex !== -1) {
                const key = trimmedLine.substring(0, colonIndex).trim();
                const value = trimmedLine.substring(colonIndex + 1).trim();
                
                if (key === 'globs') {
                    data.globs = value;
                } else if (key === 'alwaysApply') {
                    data.alwaysApply = value.toLowerCase() === 'true';
                } else if (key === 'description') {
                    data.description = value;
                }
            }
        });
        
        return {
            content: cleanContent,
            data: data
        };
    };
}, { virtual: true });

describe('PromptComposer', () => {
    const mockSystemPrompt = "Eres un asistente de código avanzao llamao MacGyver";
    const mockToolsPrompt = "## Herramientas pa' código";
    const mockRules = "REGLA: No generar código malicioso";
    const mockRulesWithFrontmatter = `---
description: Instrucciones que siempre deben seguirse.
alwaysApply: true
---
Estas deben respetarse SIEMPRE:
REGLA 1: No generar código malicioso
REGLA 2: Seguir buenas prácticas de programación`;

    const mockRulesWithGlobs = `---
description: Este archivo de reglas proporciona prácticas recomendadas para desarrollar con Python.
globs: **/*.py
---
REGLA: Usar PEP8 para el código Python`;

    beforeEach(() => {
        // Reset all mocks
        jest.resetAllMocks();
        
        // Mock file system for basic files
        (fs.existsSync as jest.Mock).mockImplementation((path) => {
            if (path.includes('rules') && !path.includes('rules.d')) {
                return true;
            }
            return false;
        });
        
        (fs.readFileSync as jest.Mock).mockImplementation((path, encoding) => {
            if (path.includes('system_prompt.md')) {
                return mockSystemPrompt;
            } else if (path.includes('tools_prompt.md')) {
                return mockToolsPrompt;
            } else if (path.includes('rules') && !path.includes('rules.d')) {
                return mockRules;
            }
            return '';
        });
    });

    test('buildPrompt should combine all components', () => {
        const input: PromptComposerInput = {
            userQuery: 'How do I create a React component?',
            workspacePath: '/fake/path',
            attachedDocs: [
                { text: 'Example React component', source: 'components.md' }
            ]
        };

        const result = buildPrompt(input);
        
        // Check that all parts are included
        expect(result).toContain(input.userQuery);
        expect(result).toContain(mockSystemPrompt);
        expect(result).toContain(mockToolsPrompt);
        expect(result).toContain(mockRules);
        expect(result).toContain('Example React component');
    });

    test('buildPrompt should handle missing rules', () => {
        // Mock rules file doesn't exist
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        
        const input: PromptComposerInput = {
            userQuery: 'How do I create a React component?',
            workspacePath: '/fake/path',
            attachedDocs: []
        };

        const result = buildPrompt(input);
        
        // Rules should not be included
        expect(result).not.toContain(mockRules);
    });

    test('buildPrompt should handle empty attached docs', () => {
        const input: PromptComposerInput = {
            userQuery: 'How do I create a React component?',
            workspacePath: '/fake/path',
            attachedDocs: []
        };

        const result = buildPrompt(input);
        
        // Attached docs should not be included
        expect(result).not.toContain('Fuente:');
    });

    test('buildPrompt should process MDC files with frontmatter', () => {
        // Setup mocks for MDC file with frontmatter
        (fs.existsSync as jest.Mock).mockImplementation((path) => {
            if (path.includes('@rules.mdc')) {
                return true;
            }
            return false;
        });

        (fs.readFileSync as jest.Mock).mockImplementation((path, encoding) => {
            if (path.includes('system_prompt.md')) {
                return mockSystemPrompt;
            } else if (path.includes('tools_prompt.md')) {
                return mockToolsPrompt;
            } else if (path.includes('@rules.mdc')) {
                return mockRulesWithFrontmatter;
            }
            return '';
        });
        
        const input: PromptComposerInput = {
            userQuery: 'How do I create a React component?',
            workspacePath: '/fake/path',
            attachedDocs: [],
            currentFilePath: '/fake/path/src/component.js'
        };

        const result = buildPrompt(input);
        
        // Frontmatter shouldn't be included, but content should be
        expect(result).not.toContain('description:');
        expect(result).not.toContain('alwaysApply:');
        expect(result).toContain('REGLA 1: No generar código malicioso');
        expect(result).toContain('REGLA 2: Seguir buenas prácticas de programación');
    });

    test('buildPrompt should apply glob pattern matching', () => {
        // Setup mocks for MDC file with glob patterns
        (fs.existsSync as jest.Mock).mockImplementation((path) => {
            if (path.includes('@rules.mdc')) {
                return true;
            }
            return false;
        });

        (fs.readFileSync as jest.Mock).mockImplementation((path, encoding) => {
            if (path.includes('system_prompt.md')) {
                return mockSystemPrompt;
            } else if (path.includes('tools_prompt.md')) {
                return mockToolsPrompt;
            } else if (path.includes('@rules.mdc')) {
                return mockRulesWithGlobs;
            }
            return '';
        });
        
        // Test with Python file (should apply)
        const pythonInput: PromptComposerInput = {
            userQuery: 'How do I optimize this code?',
            workspacePath: '/fake/path',
            attachedDocs: [],
            currentFilePath: '/fake/path/src/script.py'
        };

        const pythonResult = buildPrompt(pythonInput);
        expect(pythonResult).toContain('REGLA: Usar PEP8 para el código Python');
        
        // Test with JavaScript file (should NOT apply)
        const jsInput: PromptComposerInput = {
            userQuery: 'How do I optimize this code?',
            workspacePath: '/fake/path',
            attachedDocs: [],
            currentFilePath: '/fake/path/src/script.js'
        };

        const jsResult = buildPrompt(jsInput);
        expect(jsResult).not.toContain('REGLA: Usar PEP8 para el código Python');
    });

    test('buildPrompt should handle multiple rule files from directory', () => {
        // Setup mocks for rules directory
        (fs.existsSync as jest.Mock).mockImplementation((path) => {
            if (path.includes('rules.d')) {
                return true;
            }
            return false;
        });

        (fs.statSync as jest.Mock).mockImplementation(() => {
            return { isDirectory: () => true };
        });

        (fs.readdirSync as jest.Mock).mockReturnValue(['python.mdc', 'javascript.mdc']);

        (fs.readFileSync as jest.Mock).mockImplementation((path, encoding) => {
            if (path.includes('system_prompt.md')) {
                return mockSystemPrompt;
            } else if (path.includes('tools_prompt.md')) {
                return mockToolsPrompt;
            } else if (path.includes('python.mdc')) {
                return mockRulesWithGlobs; // Python rules
            } else if (path.includes('javascript.mdc')) {
                return `---
description: JavaScript rules
globs: **/*.js
---
REGLA JS: Usar ES6+`;
            }
            return '';
        });
        
        // Test with Python file (should apply Python rules only)
        const pythonInput: PromptComposerInput = {
            userQuery: 'How do I optimize this code?',
            workspacePath: '/fake/path',
            attachedDocs: [],
            currentFilePath: '/fake/path/src/script.py'
        };

        const pythonResult = buildPrompt(pythonInput);
        expect(pythonResult).toContain('REGLA: Usar PEP8 para el código Python');
        expect(pythonResult).not.toContain('REGLA JS: Usar ES6+');
        
        // Test with JavaScript file (should apply JS rules only)
        const jsInput: PromptComposerInput = {
            userQuery: 'How do I optimize this code?',
            workspacePath: '/fake/path',
            attachedDocs: [],
            currentFilePath: '/fake/path/src/script.js'
        };

        const jsResult = buildPrompt(jsInput);
        expect(jsResult).not.toContain('REGLA: Usar PEP8 para el código Python');
        expect(jsResult).toContain('REGLA JS: Usar ES6+');
    });
});