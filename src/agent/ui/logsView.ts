/**
 * Agent Logs View
 * Provides a web view for displaying agent logs and reasoning
 */

import * as vscode from 'vscode';

interface LogEntry {
    type: string;  // 'step', 'plan', 'reflection', 'build_rules'
    description?: string;
    tool?: string;
    params?: any;
    result?: any;
    success?: boolean;
    steps?: any[];
    reflection?: string;
    rules?: string[];
    timestamp: Date;
    modelInfo?: {
        name: string;
        taskType?: string;
    };
    appliedRules?: string[];
    tokenCount?: {
        prompt: number;
        completion: number;
        total: number;
    };
    modelCost?: {
        inputUSD: number;
        outputUSD: number;
        totalUSD: number;
        totalEUR: number;
        model?: string;
        inputTokens?: number;
        outputTokens?: number;
    };
    status?: string;
    successfulSteps?: number;
    failedSteps?: number;
    stoppedAtStep?: string;
    stopReason?: string;
    modelUsage?: {
        model: string;
        calls: number;
        inputTokens: number;
        outputTokens: number;
        costUSD: number;
        costEUR: number;
    }[];
    totalCostUSD?: number;
    totalCostEUR?: number;
    recommendations?: string[];
}

interface LogSession {
    id: string;
    name: string;
    entries: LogEntry[];
    createdAt: Date;
}

export class AgentLogsView {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private sessions: LogSession[] = [];
    private activeSessionId: string = '';
    private databaseManager: any; // Referencia al DatabaseManager para cargar eventos históricos

    /**
     * Create a new logs view
     * @param context - Extension context
     * @param databaseManager - Database manager to load historical events
     */
    constructor(context: vscode.ExtensionContext, databaseManager?: any) {
        this.context = context;
        this.databaseManager = databaseManager;
        // Create default session
        this.createNewSession('Default');
    }

    /**
     * Set the database manager reference
     * @param dbManager - Database manager instance
     */
    public setDatabaseManager(dbManager: any): void {
        this.databaseManager = dbManager;
        // Cargar eventos históricos cuando se configura el DatabaseManager
        this.loadHistoricalEvents();
    }

    /**
     * Load historical events from the database
     */
    private async loadHistoricalEvents(): Promise<void> {
        if (!this.databaseManager) {
            return;
        }
        
        try {
            // Obtener eventos recientes (último día)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const events = this.databaseManager.getEvents({ 
                from: yesterday,
                type: 'tool_success'
            }, 50);
            
            if (events && events.length > 0) {
                const activeSession = this.getActiveSession();
                if (activeSession) {
                    // Convertir eventos a formato LogEntry
                    const logEntries = events.map(event => this.convertEventToLogEntry(event));
                    
                    // Añadir a la sesión activa
                    activeSession.entries.push(...logEntries);
                    
                    // Actualizar UI si está visible
                    if (this.panel) {
                        this.updateContent();
                    }
                }
            }
        } catch (error: any) {
            console.error('Error loading historical events:', error);
        }
    }

    /**
     * Convert a database event to a log entry
     * @param event - Database event
     * @returns Log entry
     */
    private convertEventToLogEntry(event: any): LogEntry {
        const logEntry: LogEntry = {
            type: event.type.startsWith('tool_') ? 'step' : event.type,
            timestamp: new Date(event.timestamp)
        };
        
        if (event.type === 'tool_success' || event.type === 'tool_error') {
            logEntry.tool = event.tool || 'Unknown';
            logEntry.description = event.description || `Executing ${event.tool || 'tool'}`;
            logEntry.params = event.params || {};
            logEntry.result = event.result || (event.type === 'tool_error' ? { error: event.error } : {});
            logEntry.success = event.type === 'tool_success';
        } else if (event.type === 'plan') {
            logEntry.steps = event.steps || [];
        } else if (event.type === 'reflection') {
            logEntry.reflection = event.reflection || '';
        }
        
        return logEntry;
    }

    /**
     * Create a new log session
     * @param name - Session name
     * @returns Session ID
     */
    public createNewSession(name: string): string {
        const id = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const session: LogSession = {
            id,
            name,
            entries: [],
            createdAt: new Date()
        };
        
        this.sessions.push(session);
        this.activeSessionId = id;
        
        if (this.panel) {
            this.updateContent();
        }
        
        // Cargar eventos históricos para la nueva sesión
        this.loadHistoricalEvents();
        
        return id;
    }

    /**
     * Set the active session
     * @param sessionId - Session ID to activate
     */
    public setActiveSession(sessionId: string): void {
        if (this.sessions.find(s => s.id === sessionId)) {
            this.activeSessionId = sessionId;
            
            if (this.panel) {
                this.updateContent();
            }
        }
    }

    /**
     * Show the logs view
     */
    public show(): void {
        if (this.panel) {
            // If panel exists, reveal it
            this.panel.reveal();
        } else {
            // Create a new panel
            this.panel = vscode.window.createWebviewPanel(
                'agentLogsView',
                'Memory Bank: Agent Logs',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.context.extensionUri, 'dist')
                    ],
                    retainContextWhenHidden: true
                }
            );

            // Set initial HTML content (React version)
            this.panel.webview.html = this.getHtmlContent();

            // Handle panel close
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.context.subscriptions);

            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'clearLogs':
                            this.clearLogs();
                            break;
                        case 'switchSession':
                            this.setActiveSession(message.sessionId);
                            break;
                        case 'createSession':
                            this.createNewSession(message.name || `Session ${this.sessions.length + 1}`);
                            break;
                        case 'reloadHistoricalLogs':
                            this.loadHistoricalEvents();
                            break;
                    }
                },
                undefined,
                this.context.subscriptions
            );
        }
    }

    /**
     * Get the active session
     * @returns Active session or undefined
     */
    private getActiveSession(): LogSession | undefined {
        return this.sessions.find(s => s.id === this.activeSessionId) || 
               (this.sessions.length > 0 ? this.sessions[0] : undefined);
    }

    /**
     * Add a log entry to the active session
     * @param entry - Log entry
     * @param sessionId - Optional session ID (uses active session if not provided)
     */
    public addLogEntry(entry: LogEntry, sessionId?: string): void {
        // Add timestamp if not provided
        if (!entry.timestamp) {
            entry.timestamp = new Date();
        }

        const targetSessionId = sessionId || this.activeSessionId;
        const session = this.sessions.find(s => s.id === targetSessionId);
        
        if (session) {
            // Add entry to session logs
            session.entries.push(entry);
            
            // Update content if panel is visible
            if (this.panel) {
                this.updateContent();
            }
        } else if (this.sessions.length > 0) {
            // Fallback to first session if target not found
            this.sessions[0].entries.push(entry);
            
            if (this.panel) {
                this.updateContent();
            }
        }
    }

    /**
     * Add a step log entry
     * @param description - Step description
     * @param tool - Tool used
     * @param params - Tool parameters
     * @param result - Tool result
     * @param success - Whether the step was successful
     * @param sessionId - Optional session ID
     * @param modelInfo - Optional model information
     * @param appliedRules - Optional applied rules
     * @param tokenCount - Optional token count
     * @param modelCost - Optional model cost information
     */
    public addStepLog(
        description: string, 
        tool: string, 
        params: any, 
        result: any, 
        success: boolean, 
        sessionId?: string,
        modelInfo?: { name: string; taskType?: string },
        appliedRules?: string[],
        tokenCount?: { prompt: number; completion: number; total: number },
        modelCost?: { inputUSD: number; outputUSD: number; totalUSD: number; totalEUR: number; model?: string; inputTokens?: number; outputTokens?: number }
    ): void {
        // Process variable placeholders in params
        const processedParams = this.processVariables(params);
        
        const entry: LogEntry = {
            type: 'step',
            description,
            tool,
            params: processedParams,
            result,
            success,
            timestamp: new Date(),
            modelInfo,
            appliedRules,
            tokenCount,
            modelCost
        };
        
        this.addLogEntry(entry, sessionId);
    }

    /**
     * Process variables in parameters or results
     * @param obj - Object containing variables to process
     * @returns Processed object with variables resolved where possible
     */
    private processVariables(obj: any): any {
        if (!obj) {
            return obj;
        }

        // Helper function to get current active editor info
        const getActiveEditorInfo = (): { filePath?: string, content?: string } => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    return {
                        filePath: editor.document.uri.fsPath,
                        content: editor.document.getText()
                    };
                }
            } catch (e) {
                // Ignore errors
            }
            return {};
        };

        // Handle primitive types
        if (typeof obj !== 'object') {
            if (typeof obj === 'string') {
                // Process string variable references
                const activeInfo = getActiveEditorInfo();
                
                // Replace common variables
                if (obj === '$SELECTED_FILE' && activeInfo.filePath) {
                    return activeInfo.filePath;
                }
                if (obj === '$CONTENT_OF_SELECTED_FILE' && activeInfo.content) {
                    return activeInfo.content;
                }
            }
            return obj;
        }

        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map(item => this.processVariables(item));
        }

        // Handle objects
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            // Special case for common parameter names
            if (key === 'file_path' && value === '$SELECTED_FILE') {
                const activeInfo = getActiveEditorInfo();
                result[key] = activeInfo.filePath || value;
            } else if (key === 'filePath' && value === '$SELECTED_FILE') {
                const activeInfo = getActiveEditorInfo();
                result[key] = activeInfo.filePath || value;
            } else if (key === 'code' && value === '$CONTENT_OF_SELECTED_FILE') {
                const activeInfo = getActiveEditorInfo();
                result[key] = activeInfo.content || value;
            } else if (key === 'content' && value === '$CONTENT_OF_SELECTED_FILE') {
                const activeInfo = getActiveEditorInfo();
                result[key] = activeInfo.content || value;
            } else if (key === 'sourcePath' && value === '$SELECTED_FILE') {
                const activeInfo = getActiveEditorInfo();
                result[key] = activeInfo.filePath || value;
            } else {
                // Recursively process nested objects
                result[key] = this.processVariables(value);
            }
        }
        
        return result;
    }

    /**
     * Add a plan log entry
     * @param steps - Plan steps
     * @param sessionId - Optional session ID
     * @param modelInfo - Optional model information
     * @param appliedRules - Optional applied rules
     * @param tokenCount - Optional token count
     * @param modelCost - Optional model cost information
     */
    public addPlanLog(
        steps: any[], 
        sessionId?: string,
        modelInfo?: { name: string; taskType?: string },
        appliedRules?: string[],
        tokenCount?: { prompt: number; completion: number; total: number },
        modelCost?: { inputUSD: number; outputUSD: number; totalUSD: number; totalEUR: number; model?: string; inputTokens?: number; outputTokens?: number }
    ): void {
        this.addLogEntry({
            type: 'plan',
            steps,
            timestamp: new Date(),
            modelInfo,
            appliedRules,
            tokenCount,
            modelCost
        }, sessionId);
    }

    /**
     * Add a reflection log entry
     * @param reflection - Reflection text or object with detailed reflection data
     * @param sessionId - Optional session ID
     * @param modelInfo - Optional model information
     * @param tokenCount - Optional token count
     * @param modelCost - Optional model cost information
     */
    public addReflectionLog(
        reflection: string | any, 
        sessionId?: string,
        modelInfo?: { name: string; taskType?: string },
        tokenCount?: { prompt: number; completion: number; total: number },
        modelCost?: { inputUSD: number; outputUSD: number; totalUSD: number; totalEUR: number; model?: string; inputTokens?: number; outputTokens?: number }
    ): void {
        // Si reflection es un string, usamos el formato antiguo
        if (typeof reflection === 'string') {
            this.addLogEntry({
                type: 'reflection',
                reflection,
                timestamp: new Date(),
                modelInfo,
                tokenCount,
                modelCost
            }, sessionId);
        } else {
            // Si es un objeto, lo tratamos como una reflexión detallada
            this.addLogEntry({
                type: 'reflection',
                reflection: reflection.text || '',
                status: reflection.status,
                successfulSteps: reflection.successfulSteps,
                failedSteps: reflection.failedSteps,
                stoppedAtStep: reflection.stoppedAtStep,
                stopReason: reflection.stopReason,
                modelUsage: reflection.modelUsage,
                totalCostUSD: reflection.totalCostUSD,
                totalCostEUR: reflection.totalCostEUR,
                recommendations: reflection.recommendations,
                appliedRules: reflection.appliedRules,
                timestamp: reflection.timestamp || new Date(),
                modelInfo,
                tokenCount,
                modelCost
            }, sessionId);
        }
    }

    /**
     * Add a build rules log entry
     * @param rules - Array of rules being applied
     * @param description - Optional description of the rules context
     * @param sessionId - Optional session ID
     */
    public addBuildRulesLog(
        rules: string[],
        description?: string,
        sessionId?: string
    ): void {
        const entry: LogEntry = {
            type: 'build_rules',
            rules,
            description: description || 'Reglas que serán aplicadas en la próxima invocación del LLM',
            timestamp: new Date()
        };
        
        this.addLogEntry(entry, sessionId);
    }

    /**
     * Clear logs for the active session
     */
    public clearLogs(): void {
        const session = this.getActiveSession();
        if (session) {
            session.entries = [];
            if (this.panel) {
                this.updateContent();
            }
        }
    }

    /**
     * Update the webview content
     * With React, we just send updated state instead of regenerating HTML
     */
    private updateContent(): void {
        if (this.panel) {
            // Send updated sessions to React instead of regenerating HTML
            this.panel.webview.postMessage({
                command: 'updateSessions',
                sessions: this.sessions.map(s => ({
                    ...s,
                    entries: s.entries.map(e => ({
                        ...e,
                        timestamp: e.timestamp.toISOString()
                    })),
                    createdAt: s.createdAt.toISOString()
                }))
            });
        }
    }

    /**
     * Generate HTML content for the webview
     * @returns HTML content
     */
    private getHtmlContent(): string {
        if (!this.panel) {
            return '';
        }

        // Generate a nonce for script security
        const nonce = this.getNonce();

        // Get URI for React bundle
        const scriptUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'logs-webview.js')
        );

        // Prepare initial state
        const initialState = {
            sessions: this.sessions.map(s => ({
                ...s,
                entries: s.entries.map((e: any) => ({
                    ...e,
                    timestamp: e.timestamp.toISOString ? e.timestamp.toISOString() : e.timestamp
                })),
                createdAt: s.createdAt.toISOString ? s.createdAt.toISOString() : s.createdAt
            })),
            activeSessionId: this.activeSessionId,
            theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
        };

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${this.panel.webview.cspSource}; connect-src ${this.panel.webview.cspSource};">
    <title>Memory Bank: Agent Logs</title>
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
    <div id="root"><div class="loading">Cargando vista de logs...</div></div>
    <script nonce="${nonce}">
        console.log('Logs View: Inicializando...');
        console.log('Logs View: Script URI:', '${scriptUri}');
        
        window.__INITIAL_STATE__ = ${JSON.stringify(initialState)};
        console.log('Logs View: Initial state:', window.__INITIAL_STATE__);
        
        (function() {
            try {
                const vscode = acquireVsCodeApi();
                window.vscode = vscode;
                console.log('Logs View: VSCode API adquirida');
            } catch (error) {
                console.error('Logs View: Error al adquirir VSCode API:', error);
            }
        })();
        
        window.addEventListener('error', function(e) {
            console.error('Logs View: Error global:', e.error);
        });
        
        window.addEventListener('load', function() {
            console.log('Logs View: Ventana cargada');
        });
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
     * @deprecated This method is no longer used with React implementation
     */
    private renderTabs(): string {
        // No longer needed with React
        return '';
    }

    /**
     * @deprecated This method is no longer used with React implementation
     */
    private renderLogs(): string {
        // No longer needed with React
        return '';
    }

    /**
     * @deprecated This method is no longer used with React implementation
     */
    private renderLogEntry(entry: any): string {
        // No longer needed with React
        return '';
    }

    /**
     * @deprecated This method is no longer used with React implementation
     */
    private renderStepLog(entry: any): string {
        // No longer needed with React
        return '';
    }

    /**
     * @deprecated This method is no longer used with React implementation
     */
    private renderPlanLog(entry: any): string {
        // No longer needed with React
        return '';
    }

    /**
     * @deprecated This method is no longer used with React implementation
     */
    private renderReflectionLog(entry: any): string {
        // No longer needed with React
        return '';
    }

    /**
     * @deprecated This method is no longer used with React implementation
     */
    private renderBuildRulesLog(entry: any): string {
        // No longer needed with React
        return '';
    }

    /**
     * @deprecated This method is no longer used with React implementation
     */
    private renderModelInfo(modelInfo: any, tokenCount?: any, modelCost?: any): string {
        // No longer needed with React
        return '';
    }

    /**
     * Sanitize a string for use in HTML
     * @param str - String to sanitize
     * @returns Sanitized string
     * @deprecated This method is no longer used with React implementation
     */
    private sanitizeForHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
