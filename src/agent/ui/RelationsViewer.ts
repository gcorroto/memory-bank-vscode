/**
 * Relations Viewer
 * Provides a React-based webview for visualizing code relationships
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectRelations } from '../../types/relations';
import * as relationsAnalyzerService from '../../services/relationsAnalyzerService';
import { getMemoryBankService } from '../../services/memoryBankService';

export class RelationsViewer {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private currentRelations: ProjectRelations | null = null;
    private currentProjectId: string | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Show the relations viewer
     */
    public async show(projectId?: string): Promise<void> {
        // Load relations for project
        if (projectId) {
            this.currentProjectId = projectId;
            this.currentRelations = await relationsAnalyzerService.loadRelations(projectId);
        }

        if (this.panel) {
            this.panel.reveal();
            this.syncStateToWebview();
            return;
        }

        // Create the webview panel
        this.panel = vscode.window.createWebviewPanel(
            'memorybankRelationsViewer',
            'Memory Bank: Code Relations',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'dist')
                ],
                retainContextWhenHidden: true
            }
        );

        // Set initial HTML content
        this.updateContent();

        // Send initial state after a small delay to ensure React has mounted
        setTimeout(() => {
            this.syncStateToWebview();
        }, 500);

        // Handle panel close
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null, this.context.subscriptions);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'refresh':
                        await this.refresh();
                        break;
                    case 'regenerate':
                        await this.regenerate();
                        break;
                    case 'openFile':
                        await this.openFile(message.filePath);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Sync current state to webview
     */
    private syncStateToWebview(): void {
        if (!this.panel) return;

        this.panel.webview.postMessage({
            command: 'updateRelations',
            relations: this.currentRelations,
        });
    }

    /**
     * Update relations data
     */
    public updateRelations(relations: ProjectRelations): void {
        this.currentRelations = relations;
        this.currentProjectId = relations.projectId;
        
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateRelations',
                relations: relations
            });
        }
    }

    /**
     * Refresh relations data
     */
    private async refresh(): Promise<void> {
        if (!this.currentProjectId) return;

        this.currentRelations = await relationsAnalyzerService.loadRelations(this.currentProjectId);
        this.syncStateToWebview();
    }

    /**
     * Regenerate relations analysis
     */
    private async regenerate(): Promise<void> {
        if (!this.currentProjectId) return;

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Regenerando análisis de ${this.currentProjectId}`,
                cancellable: false
            }, async (progress) => {
                this.currentRelations = await relationsAnalyzerService.analyzeProject(
                    this.currentProjectId!,
                    { useAI: true },
                    (p) => {
                        progress.report({
                            message: `${p.phase}: ${p.processedNodes} nodos`
                        });
                    }
                );
            });

            this.syncStateToWebview();
            vscode.window.showInformationMessage('Análisis regenerado correctamente');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error regenerando análisis: ${error.message}`);
        }
    }

    /**
     * Open a file in the editor
     */
    private async openFile(filePath: string): Promise<void> {
        try {
            const mbPath = getMemoryBankService().getMemoryBankPath();
            if (!mbPath) return;

            // Resolve path
            const baseDir = path.dirname(mbPath);
            const resolvedPath = path.resolve(baseDir, filePath);

            const doc = await vscode.workspace.openTextDocument(resolvedPath);
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: true
            });
        } catch (error: any) {
            vscode.window.showWarningMessage(`No se pudo abrir el archivo: ${filePath}`);
        }
    }

    /**
     * Update the webview content
     */
    private updateContent(): void {
        if (!this.panel) return;

        const html = this.getHtmlContent();
        this.panel.webview.html = html;
    }

    /**
     * Generate HTML content for the webview
     */
    private getHtmlContent(): string {
        if (!this.panel) return '';

        const nonce = this.getNonce();

        // Get URI for React bundle
        const scriptUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'relations-webview.js')
        );

        // Prepare initial state
        const initialState = {
            relations: this.currentRelations,
            theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
        };

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${this.panel.webview.cspSource}; connect-src ${this.panel.webview.cspSource};">
    <title>Memory Bank: Code Relations</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
        }
        #root {
            width: 100%;
            height: 100vh;
        }
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-size: 16px;
        }
    </style>
</head>
<body class="${initialState.theme === 'dark' ? 'vscode-dark' : 'vscode-light'}">
    <div id="root"><div class="loading">Cargando visualizador de relaciones...</div></div>
    <script nonce="${nonce}">
        console.log('Relations Viewer: Initializing...');
        window.__INITIAL_STATE__ = ${JSON.stringify(initialState)};
        
        (function() {
            try {
                const vscode = acquireVsCodeApi();
                window.vscode = vscode;
                console.log('Relations Viewer: VSCode API acquired');
            } catch (error) {
                console.error('Relations Viewer: Error acquiring VSCode API:', error);
            }
        })();
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Generate a random nonce for CSP
     */
    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}
