/**
 * FindFileTool
 * Tool for locating the real path of a file in the workspace
 */

import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { Agent } from '../core/Agent';

interface FindFileResult {
    matches: string[];
    pattern: string;
    found: boolean;
}

export class FindFileTool extends BaseTool {
    constructor(agent: Agent) {
        super(agent);
        this.name = 'FindFileTool';
        this.description = 'Finds the real path(s) of a file in the workspace using a filename or glob pattern.';
        this.parameters = {
            pattern: {
                description: 'Filename or glob pattern to search for (e.g. boletas.component.ts or **/boletas.component.ts)',
                type: 'string',
                required: true
            },
            maxResults: {
                description: 'Maximum number of results to return (default: 5)',
                type: 'number',
                required: false,
                default: 5
            }
        };
    }

    /**
     * Find file(s) in the workspace
     * @param params - Tool parameters
     * @returns List of matching file paths
     */
    async run_impl(params: Record<string, any>): Promise<FindFileResult> {
        const { pattern, maxResults = 5 } = params;
        try {
            // Obtener el workspace del usuario
            const userWorkspacePath = this.agent.workspaceManager.getUserWorkspacePath();
            
            if (userWorkspacePath) {
                this.logger.appendLine(`FindFileTool: Searching in user workspace: ${userWorkspacePath}`);
                
                // Buscar archivos usando la API de VS Code pero especificando el workspace
                const userWorkspaceUri = vscode.Uri.file(userWorkspacePath);
                const workspaceFolder: vscode.WorkspaceFolder = {
                    uri: userWorkspaceUri,
                    name: 'UserWorkspace',
                    index: 0
                };
                
                // Usar relativeTo para limitar la búsqueda al workspace específico
                const relativePattern = new vscode.RelativePattern(workspaceFolder, pattern);
                const files = await vscode.workspace.findFiles(
                    relativePattern, 
                    '**/node_modules/**', 
                    maxResults
                );
                
                const matches = files.map(f => f.fsPath);
                
                this.logger.appendLine(`FindFileTool: Found ${matches.length} matches in user workspace`);
                
                return {
                    matches,
                    pattern,
                    found: matches.length > 0
                };
            } else {
                // Fallback: usar el workspace actual de VS Code
                this.logger.appendLine(`FindFileTool: No user workspace found, using current VS Code workspace`);
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', maxResults);
                const matches = files.map(f => f.fsPath);
                
                return {
                    matches,
                    pattern,
                    found: matches.length > 0
                };
            }
        } catch (error: any) {
            throw new Error(`Error finding file(s): ${error.message}`);
        }
    }
}
