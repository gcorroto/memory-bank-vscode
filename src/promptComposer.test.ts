/**
 * Tests for PromptComposer
 */
import { buildPrompt, PromptComposerInput, DocChunk } from './promptComposer';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('vscode');

describe('PromptComposer', () => {
    const mockSystemPrompt = "Eres un asistente de código avanzao llamao MacGyver";
    const mockToolsPrompt = "## Herramientas pa' código";
    const mockRules = "REGLA: No generar código malicioso";

    beforeEach(() => {
        // Mock file system
        (fs.existsSync as jest.Mock).mockImplementation((path) => {
            if (path.includes('rules')) {
                return true;
            }
            return false;
        });
        
        (fs.readFileSync as jest.Mock).mockImplementation((path, encoding) => {
            if (path.includes('system_prompt.md')) {
                return mockSystemPrompt;
            } else if (path.includes('tools_prompt.md')) {
                return mockToolsPrompt;
            } else if (path.includes('rules')) {
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
});