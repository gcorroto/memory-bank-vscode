/**
 * Flow Viewer
 * Provides a React-based webview for visualizing agent decision-making flow
 */

import * as vscode from 'vscode';
import { Plan, PlanStep } from '../core/interfaces';

export interface ExecutionUpdate {
    stepId: string;
    status: 'running' | 'success' | 'error';
    result?: any;
    error?: string;
}

export class FlowViewer {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private currentPlan: Plan | null = null;
    private executionUpdates: ExecutionUpdate[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Show the flow viewer
     */
    public show(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        // Create the webview panel
        this.panel = vscode.window.createWebviewPanel(
            'grec0aiFlowViewer',
            'Grec0AI: Visualizador de Flujos',
            vscode.ViewColumn.Two,
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

        // Handle panel close
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null, this.context.subscriptions);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'resetView':
                        this.resetView();
                        break;
                    case 'exportFlowImage':
                        this.exportFlowImage();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Update the plan displayed in the viewer
     * @param plan - The plan to display
     */
    public updatePlan(plan: Plan): void {
        this.currentPlan = plan;
        this.executionUpdates = [];
        
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updatePlan',
                plan: plan
            });
        }
    }

    /**
     * Update execution status for a step
     * @param stepIndex - Index of the step (0-based)
     * @param status - Execution status
     * @param data - Optional data (result or error)
     */
    public updateStepStatus(stepIndex: number, status: 'running' | 'success' | 'error', data?: any): void {
        const update: ExecutionUpdate = {
            stepId: `step_${stepIndex}`,
            status: status,
            result: data?.result,
            error: data?.error
        };
        
        this.executionUpdates.push(update);
        
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateExecution',
                update: update
            });
        }
    }

    /**
     * Update execution status for a step (alternative method)
     * @param update - Execution update
     */
    public updateExecution(update: ExecutionUpdate): void {
        this.executionUpdates.push(update);
        
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateExecution',
                update: update
            });
        }
    }

    /**
     * Reset the view to initial state
     */
    private resetView(): void {
        this.currentPlan = null;
        this.executionUpdates = [];
        this.updateContent();
    }

    /**
     * Export flow diagram as image
     */
    private async exportFlowImage(): Promise<void> {
        vscode.window.showInformationMessage('Funcionalidad de exportación disponible próximamente');
    }

    /**
     * Update the webview content
     */
    private updateContent(): void {
        if (!this.panel) {
            return;
        }

        const html = this.getHtmlContent();
        this.panel.webview.html = html;
    }

    /**
     * Generate HTML content for the webview
     * @returns HTML content
     */
    private getHtmlContent(): string {
        if (!this.panel) {
            return '';
        }

        const nonce = this.getNonce();

        // Get URI for React bundle
        const scriptUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'flow-webview.js')
        );

        // Prepare initial state
        const initialState = {
            plan: this.currentPlan,
            executionUpdates: this.executionUpdates,
            theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
        };

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Grec0AI Flow Viewer</title>
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
    <div id="root"><div class="loading">Cargando visualizador de flujos...</div></div>
    <script nonce="${nonce}">
        console.log('Flow View: Inicializando...');
        window.__INITIAL_STATE__ = ${JSON.stringify(initialState)};
        console.log('Flow View: Initial state:', window.__INITIAL_STATE__);
        
        (function() {
            try {
                const vscode = acquireVsCodeApi();
                window.vscode = vscode;
                console.log('Flow View: VSCode API adquirida');
            } catch (error) {
                console.error('Flow View: Error al adquirir VSCode API:', error);
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
