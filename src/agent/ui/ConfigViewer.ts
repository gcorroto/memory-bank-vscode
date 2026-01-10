/**
 * Config Viewer
 * Provides a React-based webview for configuring agent plans, rules, and prompts
 */

import * as vscode from 'vscode';

export interface ToolInfo {
    name: string;
    description: string;
    parameters: any;
}

export interface SavedPlan {
    id: string;
    name: string;
    steps: any[];
    createdAt: Date;
}

export interface Rule {
    id: string;
    name: string;
    condition: string;
    action: string;
    enabled: boolean;
}

export interface PromptTemplate {
    id: string;
    name: string;
    template: string;
    variables: string[];
}

export class ConfigViewer {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private availableTools: ToolInfo[] = [];
    private savedPlans: SavedPlan[] = [];
    private rules: Rule[] = [];
    private promptTemplates: PromptTemplate[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Show the config viewer
     */
    public show(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        // Create the webview panel
        this.panel = vscode.window.createWebviewPanel(
            'grec0aiConfigViewer',
            'Grec0AI: Configurador Visual',
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
                    case 'savePlan':
                        this.savePlan(message.plan);
                        break;
                    case 'saveRule':
                        this.saveRule(message.rule);
                        break;
                    case 'savePromptTemplate':
                        this.savePromptTemplate(message.template);
                        break;
                    case 'loadPlans':
                        this.loadSavedPlans();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Set available tools for the plan editor
     * @param tools - List of available tools
     */
    public setAvailableTools(tools: ToolInfo[]): void {
        this.availableTools = tools;
        
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateTools',
                tools: tools
            });
        }
    }

    /**
     * Save a plan configuration
     * @param plan - Plan to save
     */
    private async savePlan(plan: any): Promise<void> {
        try {
            const savedPlan: SavedPlan = {
                id: `plan_${Date.now()}`,
                name: plan.name || 'Unnamed Plan',
                steps: plan.steps || [],
                createdAt: new Date()
            };
            
            this.savedPlans.push(savedPlan);
            
            // Save to workspace state
            await this.context.workspaceState.update('grec0ai.savedPlans', this.savedPlans);
            
            vscode.window.showInformationMessage(`Plan "${savedPlan.name}" guardado exitosamente`);
            
            // Update webview
            if (this.panel) {
                this.panel.webview.postMessage({
                    command: 'planSaved',
                    plan: savedPlan
                });
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error guardando plan: ${error.message}`);
        }
    }

    /**
     * Save a rule configuration
     * @param rule - Rule to save
     */
    private async saveRule(rule: Rule): Promise<void> {
        try {
            const existingIndex = this.rules.findIndex(r => r.id === rule.id);
            
            if (existingIndex >= 0) {
                this.rules[existingIndex] = rule;
            } else {
                this.rules.push(rule);
            }
            
            // Save to workspace state
            await this.context.workspaceState.update('grec0ai.rules', this.rules);
            
            vscode.window.showInformationMessage(`Regla "${rule.name}" guardada exitosamente`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error guardando regla: ${error.message}`);
        }
    }

    /**
     * Save a prompt template
     * @param template - Prompt template to save
     */
    private async savePromptTemplate(template: PromptTemplate): Promise<void> {
        try {
            const existingIndex = this.promptTemplates.findIndex(t => t.id === template.id);
            
            if (existingIndex >= 0) {
                this.promptTemplates[existingIndex] = template;
            } else {
                this.promptTemplates.push(template);
            }
            
            // Save to workspace state
            await this.context.workspaceState.update('grec0ai.promptTemplates', this.promptTemplates);
            
            vscode.window.showInformationMessage(`Template "${template.name}" guardado exitosamente`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error guardando template: ${error.message}`);
        }
    }

    /**
     * Load saved plans from workspace state
     */
    private async loadSavedPlans(): Promise<void> {
        try {
            const plans = this.context.workspaceState.get<SavedPlan[]>('grec0ai.savedPlans', []);
            this.savedPlans = plans;
            
            if (this.panel) {
                this.panel.webview.postMessage({
                    command: 'plansLoaded',
                    plans: plans
                });
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error cargando planes: ${error.message}`);
        }
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
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'config-webview.js')
        );

        // Prepare initial state
        const initialState = {
            availableTools: this.availableTools,
            savedPlans: this.savedPlans,
            rules: this.rules,
            promptTemplates: this.promptTemplates,
            theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
        };

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Grec0AI Config Viewer</title>
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
    <div id="root"><div class="loading">Cargando configurador...</div></div>
    <script nonce="${nonce}">
        console.log('Config View: Inicializando...');
        window.__INITIAL_STATE__ = ${JSON.stringify(initialState)};
        console.log('Config View: Initial state:', window.__INITIAL_STATE__);
        
        (function() {
            try {
                const vscode = acquireVsCodeApi();
                window.vscode = vscode;
                console.log('Config View: VSCode API adquirida');
            } catch (error) {
                console.error('Config View: Error al adquirir VSCode API:', error);
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
