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
                'Grec0AI Agent Logs',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
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
     */
    private updateContent(): void {
        if (this.panel) {
            this.panel.webview.html = this.getHtmlContent();
        }
    }

    /**
     * Generate HTML content for the webview
     * @returns HTML content
     */
    private getHtmlContent(): string {
        // Get color theme type (light or dark)
        const isDarkTheme = vscode.window.activeColorTheme && vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Grec0AI Agent Logs</title>
                <style>
                    :root {
                        ${isDarkTheme ? `
                            --bg-color: #1e1e1e;
                            --text-color: #e0e0e0;
                            --accent-color: #0e639c;
                            --border-color: #3e3e3e;
                            --code-bg: #2d2d2d;
                            --step-bg: #1a2535;
                            --step-border: #0e639c;
                            --plan-bg: #25231a;
                            --plan-border: #bb8c00;
                            --reflection-bg: #1a2c1a;
                            --reflection-border: #089404;
                            --reflection-success-bg: #0f2f0f;
                            --reflection-success-border: #22cc44;
                            --reflection-partial-bg: #2f2f0f;
                            --reflection-partial-border: #cccc22;
                            --reflection-failed-bg: #2f0f0f;
                            --reflection-failed-border: #cc2222;
                            --success-color: #22cc44;
                            --failure-color: #f14c4c;
                            --warning-color: #f1d14c;
                            --timestamp-color: #7d7d7d;
                            --collapsible-bg: #2a2a2a;
                            --collapsible-hover: #3a3a3a;
                            --tab-bg: #252525;
                            --tab-active-bg: #1e1e1e;
                            --tab-hover: #333333;
                            --model-info-bg: #17212b;
                            --rules-bg: #312118;
                            --token-info-bg: #1d2a1c;
                            --build-rules-bg: #1a1a35;
                            --build-rules-border: #7b68ee;
                            --cost-info-bg: #182838;
                            --cost-info-border: #3b8bd8;
                            --cost-info-color: #5dadff;
                            --token-label-color: #8bc34a;
                            --cost-label-color: #5a9bd5;
                        ` : `
                            --bg-color: #ffffff;
                            --text-color: #333333;
                            --accent-color: #007acc;
                            --border-color: #eaeaea;
                            --code-bg: #f5f5f5;
                            --step-bg: #f0f7ff;
                            --step-border: #007acc;
                            --plan-bg: #fff8f0;
                            --plan-border: #ff8c00;
                            --reflection-bg: #f0fff0;
                            --reflection-border: #00cc44;
                            --reflection-success-bg: #e6ffe6;
                            --reflection-success-border: #00cc44;
                            --reflection-partial-bg: #fffde6;
                            --reflection-partial-border: #cccc00;
                            --reflection-failed-bg: #ffe6e6;
                            --reflection-failed-border: #cc0000;
                            --success-color: #00cc44;
                            --failure-color: #cc0000;
                            --warning-color: #cccc00;
                            --timestamp-color: #888888;
                            --collapsible-bg: #f1f1f1;
                            --collapsible-hover: #dddddd;
                            --tab-bg: #ececec;
                            --tab-active-bg: #ffffff;
                            --tab-hover: #f5f5f5;
                            --model-info-bg: #e6f0fa;
                            --rules-bg: #faf0e6;
                            --token-info-bg: #e6fae8;
                            --build-rules-bg: #f0f0ff;
                            --build-rules-border: #7b68ee;
                            --cost-info-bg: #e8f4ff;
                            --cost-info-border: #5a9bd5;
                            --cost-info-color: #2c5898;
                        `}
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                        line-height: 1.6;
                        padding: 20px;
                        max-width: 100%;
                        background-color: var(--bg-color);
                        color: var(--text-color);
                        margin: 0;
                    }
                    h1 {
                        color: var(--accent-color);
                        border-bottom: 1px solid var(--border-color);
                        padding-bottom: 10px;
                    }
                    pre {
                        background-color: var(--code-bg);
                        padding: 10px;
                        border-radius: 5px;
                        overflow: auto;
                        max-width: 100%;
                    }
                    code {
                        font-family: 'Courier New', Courier, monospace;
                    }
                    .log-entry {
                        margin-bottom: 20px;
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    .log-header {
                        display: flex;
                        align-items: center;
                        padding: 8px 12px;
                        background-color: rgba(0,0,0,0.1);
                        font-weight: bold;
                        cursor: pointer;
                    }
                    .log-header:hover {
                        background-color: rgba(0,0,0,0.2);
                    }
                    .log-timestamp {
                        color: var(--timestamp-color);
                        margin-right: 8px;
                    }
                    .log-icon {
                        margin-right: 8px;
                        font-size: 1.2em;
                    }
                    .log-title {
                        flex: 1;
                    }
                    .log-tool, .log-model {
                        background-color: rgba(0,0,0,0.1);
                        padding: 2px 6px;
                        border-radius: 4px;
                        margin-left: 8px;
                        font-size: 0.9em;
                    }
                    .log-content {
                        padding: 15px;
                        display: none;
                    }
                    .log-section {
                        margin-bottom: 15px;
                    }
                    .log-section h4 {
                        margin-top: 0;
                        margin-bottom: 8px;
                        color: var(--accent-color);
                    }
                    .code-block {
                        background-color: var(--code-bg);
                        border-radius: 4px;
                        overflow: auto;
                        max-height: 400px;
                    }
                    .step-log {
                        background-color: var(--step-bg);
                        border-left: 4px solid var(--step-border);
                    }
                    .step-log.success .log-header {
                        border-bottom: 2px solid var(--success-color);
                    }
                    .step-log.error .log-header {
                        border-bottom: 2px solid var(--failure-color);
                    }
                    .plan-log {
                        background-color: var(--plan-bg);
                        border-left: 4px solid var(--plan-border);
                    }
                    .reflection-log {
                        background-color: var(--reflection-bg);
                        border-left: 4px solid var(--reflection-border);
                    }
                    .reflection-success {
                        background-color: var(--reflection-success-bg);
                        border-left: 4px solid var(--reflection-success-border);
                    }
                    .reflection-partial {
                        background-color: var(--reflection-partial-bg);
                        border-left: 4px solid var(--reflection-partial-border);
                    }
                    .reflection-failed {
                        background-color: var(--reflection-failed-bg);
                        border-left: 4px solid var(--reflection-failed-border);
                    }
                    .reflection-stats {
                        background-color: rgba(0,0,0,0.05);
                        padding: 10px;
                        border-radius: 4px;
                        margin-top: 10px;
                    }
                    .success-count {
                        color: var(--success-color);
                        font-weight: bold;
                    }
                    .failed-count {
                        color: var(--failure-color);
                        font-weight: bold;
                    }
                    .stopped-step, .stop-reason {
                        font-weight: bold;
                        color: var(--warning-color);
                    }
                    .reflection-recommendations {
                        background-color: rgba(0,0,0,0.05);
                        padding: 10px;
                        border-radius: 4px;
                        margin-top: 10px;
                    }
                    .recommendations-list {
                        margin: 0;
                        padding-left: 20px;
                    }
                    .recommendation-item {
                        margin-bottom: 5px;
                    }
                    .model-usage-container {
                        margin-top: 10px;
                    }
                    .model-usage-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.9em;
                        margin-top: 8px;
                    }
                    .model-usage-table th, .model-usage-table td {
                        border: 1px solid var(--border-color);
                        padding: 8px;
                        text-align: left;
                    }
                    .model-usage-table th {
                        background-color: rgba(0,0,0,0.1);
                    }
                    .model-usage-table .total-row {
                        font-weight: bold;
                        background-color: rgba(0,0,0,0.05);
                    }
                    .log-section {
                        margin-bottom: 16px;
                    }
                    .build-rules-log {
                        background-color: var(--build-rules-bg);
                        border-left: 4px solid var(--build-rules-border);
                    }
                    .steps-list {
                        margin: 0;
                        padding: 0 0 0 20px;
                    }
                    .steps-list li {
                        margin-bottom: 10px;
                    }
                    .step-info {
                        display: flex;
                        align-items: center;
                        margin-bottom: 5px;
                    }
                    .step-description {
                        flex: 1;
                    }
                    .step-tool {
                        background-color: rgba(0,0,0,0.1);
                        padding: 2px 6px;
                        border-radius: 4px;
                        margin-left: 8px;
                        font-size: 0.9em;
                    }
                    .step-params {
                        font-size: 0.9em;
                        margin-left: 20px;
                        padding: 8px;
                        background-color: var(--code-bg);
                        border-radius: 4px;
                        max-height: 200px;
                        overflow: auto;
                    }
                    .rules-list {
                        list-style-type: disc;
                        padding-left: 20px;
                        margin: 0;
                    }
                    .reflection-text p {
                        margin: 0 0 8px 0;
                    }
                    .reflection-text p:last-child {
                        margin-bottom: 0;
                    }
                    .success {
                        color: var(--success-color);
                    }
                    .error {
                        color: var(--failure-color);
                    }
                    .clear-button {
                        background-color: var(--failure-color);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-bottom: 20px;
                    }
                    .reload-button {
                        background-color: var(--accent-color);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-bottom: 20px;
                    }
                    /* Tabs styles */
                    .tabs {
                        display: flex;
                        border-bottom: 1px solid var(--border-color);
                        margin-bottom: 20px;
                        overflow-x: auto;
                    }
                    .tab {
                        padding: 10px 15px;
                        cursor: pointer;
                        background-color: var(--tab-bg);
                        border: none;
                        outline: none;
                        margin-right: 2px;
                        color: var(--text-color);
                        border-top-left-radius: 4px;
                        border-top-right-radius: 4px;
                    }
                    .tab:hover {
                        background-color: var(--tab-hover);
                    }
                    .tab.active {
                        background-color: var(--tab-active-bg);
                        border-bottom: 2px solid var(--accent-color);
                    }
                    .new-tab-button {
                        padding: 10px 15px;
                        background-color: var(--accent-color);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-right: 10px;
                    }
                    .tab-controls {
                        display: flex;
                        margin-bottom: 20px;
                    }
                    /* Estilo para información de modelo y tokens */
                    .model-info {
                        background-color: var(--model-info-bg);
                        border-radius: 4px;
                        padding: 12px;
                        margin-top: 15px;
                        border: 1px solid rgba(255,255,255,0.1);
                    }
                    .model-section-header {
                        display: flex;
                        align-items: center;
                        padding: 8px;
                        background-color: rgba(0,0,0,0.2);
                        margin: -12px -12px 10px -12px;
                        border-top-left-radius: 4px;
                        border-top-right-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                        color: #4e9bf8;
                    }
                    .model-section-header:hover {
                        background-color: rgba(0,0,0,0.3);
                    }
                    .model-content {
                        display: none;
                    }
                    .model-info.expanded .model-content {
                        display: block;
                    }
                    .model-details {
                        margin-bottom: 10px;
                    }
                    .model-details p {
                        margin: 0 0 5px 0;
                    }
                    .token-usage, .cost-info {
                        margin-top: 10px;
                        padding: 10px;
                        border-radius: 4px;
                        border-left: 3px solid var(--border-color);
                    }
                    .token-usage {
                        background-color: var(--token-info-bg);
                        border-left-color: var(--reflection-border);
                    }
                    .cost-info {
                        background-color: var(--cost-info-bg);
                        border-left-color: var(--cost-info-border);
                    }
                    .cost-info h5, .token-usage h5 {
                        margin-top: 0;
                        margin-bottom: 8px;
                        color: #4e9bf8;
                    }
                    .cost-info p, .token-usage p {
                        margin: 4px 0;
                    }
                    .cost-info strong {
                        color: var(--cost-info-color);
                    }
                    .uso-tokens-header {
                        color: #4caf50;
                        font-weight: bold;
                    }
                    .coste-modelo-header {
                        color: #4e9bf8;
                        font-weight: bold;
                    }
                    .token-label {
                        color: var(--token-label-color);
                    }
                    .cost-label {
                        color: var(--cost-label-color);
                    }
                    .desglose-label {
                        color: #a1887f;
                        font-size: 0.9em;
                    }
                    /* Estilo para diagramas Mermaid */
                    .mermaid-container {
                        margin-top: 15px;
                        padding: 10px;
                        background-color: var(--code-bg);
                        border-radius: 5px;
                    }
                    .mermaid {
                        font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif;
                        font-size: 14px;
                    }
                    .no-rules {
                        font-style: italic;
                        color: var(--timestamp-color);
                        padding: 5px;
                    }
                    .log-entry.expanded .log-content {
                        display: block;
                    }
                </style>
            </head>
            <body>
                <h1>Grec0AI Agent Logs</h1>
                
                <div class="tab-controls">
                    <button class="new-tab-button" id="newSessionButton">Nueva Sesión</button>
                    <button class="reload-button" id="reloadButton">Cargar Logs Históricos</button>
                    <button class="clear-button" id="clearButton">Limpiar Logs</button>
                </div>
                
                <div class="tabs">
                    ${this.renderTabs()}
                </div>
                
                <div id="logs">
                    ${this.renderLogs()}
                </div>
                
                <script>
                    document.getElementById('clearButton').addEventListener('click', () => {
                        const vscode = acquireVsCodeApi();
                        vscode.postMessage({
                            command: 'clearLogs'
                        });
                    });
                    
                    document.getElementById('reloadButton').addEventListener('click', () => {
                        const vscode = acquireVsCodeApi();
                        vscode.postMessage({
                            command: 'reloadHistoricalLogs'
                        });
                    });
                    
                    document.getElementById('newSessionButton').addEventListener('click', () => {
                        const sessionName = prompt('Nombre de la nueva sesión:', 'Nueva Sesión');
                        if (sessionName) {
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                command: 'createSession',
                                name: sessionName
                            });
                        }
                    });
                    
                    // Set up tab switching
                    const tabs = document.querySelectorAll('.tab');
                    tabs.forEach(tab => {
                        tab.addEventListener('click', function() {
                            const sessionId = this.getAttribute('data-session-id');
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                command: 'switchSession',
                                sessionId: sessionId
                            });
                        });
                    });
                    
                    // Configurar la expansión/colapso de entradas de log
                    const logHeaders = document.querySelectorAll('.log-header');
                    logHeaders.forEach(header => {
                        header.addEventListener('click', function() {
                            const logEntry = this.closest('.log-entry');
                            if (logEntry) {
                                logEntry.classList.toggle('expanded');
                            }
                        });
                    });

                    // Configurar la expansión/colapso de secciones de modelo LLM (segundo nivel)
                    const modelHeaders = document.querySelectorAll('.model-section-header');
                    modelHeaders.forEach(header => {
                        header.addEventListener('click', function(event) {
                            event.stopPropagation(); // Evitar que se propague al log-header padre
                            const modelSection = this.closest('.model-info');
                            if (modelSection) {
                                modelSection.classList.toggle('expanded');
                            }
                        });
                    });

                    // Inicializar el estado con el plan expandido por defecto (para mejor experiencia de usuario)
                    document.querySelectorAll('.plan-log').forEach(entry => {
                        entry.classList.add('expanded');
                    });

                    // Expandir todas las secciones de costes para mostrarlas (pueden colapsarse manualmente)
                    document.querySelectorAll('.model-info').forEach(section => {
                        section.classList.add('expanded');
                    });
                </script>
            </body>
            </html>
        `;
    }

    /**
     * Render the session tabs
     * @returns HTML for tabs
     */
    private renderTabs(): string {
        return this.sessions.map(session => {
            const isActive = session.id === this.activeSessionId;
            const activeClass = isActive ? 'active' : '';
            return `
                <button class="tab ${activeClass}" data-session-id="${session.id}">
                    ${this.sanitizeForHtml(session.name)}
                </button>
            `;
        }).join('');
    }

    /**
     * Render all logs as HTML
     * @returns HTML content for logs
     */
    private renderLogs(): string {
        const session = this.getActiveSession();
        
        if (!session || session.entries.length === 0) {
            return '<p>No logs yet... Click "Cargar Logs Históricos" to load past events.</p>';
        }

        return session.entries.map(entry => this.renderLogEntry(entry)).join('');
    }

    /**
     * Render a log entry based on its type
     * @param entry - Log entry to render
     * @returns HTML for the log entry
     */
    private renderLogEntry(entry: LogEntry): string {
        const timestamp = `<div class="timestamp">${entry.timestamp.toLocaleString()}</div>`;

        switch (entry.type) {
            case 'step':
                return this.renderStepLog(entry);
            case 'plan':
                return this.renderPlanLog(entry);
            case 'reflection':
                return this.renderReflectionLog(entry);
            case 'build_rules':
                return this.renderBuildRulesLog(entry);
            default:
                return `
                    <div class="log-entry">
                        <div>${this.sanitizeForHtml(JSON.stringify(entry))}</div>
                        ${timestamp}
                    </div>
                `;
        }
    }

    /**
     * Render a step execution log
     * @param entry - Step log entry
     * @returns HTML for the step log
     */
    private renderStepLog(entry: LogEntry): string {
        let html = `
            <div class="log-entry step-log ${entry.success ? 'success' : 'error'}">
                <div class="log-header">
                    <span class="log-timestamp">${entry.timestamp.toLocaleTimeString()}</span>
                    <span class="log-icon">${entry.success ? '✓' : '✗'}</span>
                    <span class="log-title">${this.sanitizeForHtml(entry.description || 'Step execution')}</span>
                    <span class="log-tool">${entry.tool || ''}</span>
                </div>
                
                <div class="log-content">
                    <div class="log-section">
                        <h4>Parameters:</h4>
                        <pre class="code-block">${JSON.stringify(entry.params || {}, null, 2)}</pre>
                    </div>
                    
                    <div class="log-section">
                        <h4>Result:</h4>
                        <pre class="code-block">${JSON.stringify(entry.result || {}, null, 2)}</pre>
                    </div>
                    
                    ${this.renderModelInfo(entry)}
                </div>
            </div>
        `;
        
        return html;
    }

    /**
     * Render model info including tokens and cost
     * @param entry - Log entry with model info
     * @returns HTML string with model info
     */
    private renderModelInfo(entry: LogEntry): string {
        if (!entry.modelInfo) {
            return '';
        }

        let html = `
            <div class="log-section model-info">
                <div class="model-section-header">
                    <span>Modelo LLM:</span>
                </div>
                <div class="model-content">
                    <div class="model-details">
                        <p><strong>Nombre:</strong> ${entry.modelInfo.name || 'Desconocido'}</p>
                        <p><strong>Tipo de tarea:</strong> ${entry.modelInfo.taskType || 'Sin especificar'}</p>
                    </div>
        `;

        if (entry.tokenCount) {
            html += `
                <div class="token-usage">
                    <h5 class="uso-tokens-header">Uso de tokens:</h5>
                    <p><span class="token-label">Prompt:</span> ${entry.tokenCount.prompt || 0}</p>
                    <p><span class="token-label">Completion:</span> ${entry.tokenCount.completion || 0}</p>
                    <p><span class="token-label">Total:</span> ${entry.tokenCount.total || entry.tokenCount.prompt + entry.tokenCount.completion || 0}</p>
                </div>
            `;
        }

        if (entry.modelCost) {
            html += `
                <div class="cost-info">
                    <h5 class="coste-modelo-header">Coste de modelo:</h5>
                    <p><span class="cost-label">Coste USD:</span> $${entry.modelCost.totalUSD.toFixed(6)}</p>
                    <p><span class="cost-label">Coste EUR:</span> €${entry.modelCost.totalEUR.toFixed(6)}</p>
                    <p class="desglose-label">Desglose: Input: $${entry.modelCost.inputUSD.toFixed(6)}, Output: $${entry.modelCost.outputUSD.toFixed(6)}</p>
                </div>
            `;
        }

        html += `</div></div>`;
        return html;
    }

    /**
     * Render a plan log
     * @param entry - Plan log entry
     * @returns HTML for the plan log
     */
    private renderPlanLog(entry: LogEntry): string {
        let html = `
            <div class="log-entry plan-log">
                <div class="log-header">
                    <span class="log-timestamp">${entry.timestamp.toLocaleTimeString()}</span>
                    <span class="log-icon">📋</span>
                    <span class="log-title">Plan generado</span>
                    ${entry.modelInfo ? `<span class="log-model">${entry.modelInfo.name || ''}</span>` : ''}
                </div>
                
                <div class="log-content">
                    <div class="log-section">
                        <h4>Pasos planeados:</h4>
                        <ol class="steps-list">
                            ${(entry.steps || []).map(step => `
                                <li>
                                    <div class="step-info">
                                        <span class="step-description">${this.sanitizeForHtml(step.description || '')}</span>
                                        <span class="step-tool">[${step.tool || ''}]</span>
                                    </div>
                                    <pre class="step-params">${JSON.stringify(step.params || {}, null, 2)}</pre>
                                </li>
                            `).join('')}
                        </ol>
                    </div>
                    
                    ${entry.appliedRules && entry.appliedRules.length > 0 ? `
                        <div class="log-section">
                            <h4>Reglas aplicadas (${entry.appliedRules.length}):</h4>
                            <ul class="rules-list">
                                ${entry.appliedRules.slice(0, 5).map(rule => `
                                    <li>${this.sanitizeForHtml(rule)}</li>
                                `).join('')}
                                ${entry.appliedRules.length > 5 ? `<li>... y ${entry.appliedRules.length - 5} reglas más</li>` : ''}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${this.renderModelInfo(entry)}
                </div>
            </div>
        `;
        
        return html;
    }

    /**
     * Render a reflection log
     * @param entry - Reflection log entry
     * @returns HTML for the reflection log
     */
    private renderReflectionLog(entry: LogEntry): string {
        // Determinar el estilo de la reflexión según el estado
        let statusClass = '';
        let statusIcon = '🔍';
        
        if (entry.status) {
            switch (entry.status) {
                case 'success':
                    statusClass = 'reflection-success';
                    statusIcon = '✅';
                    break;
                case 'partial':
                    statusClass = 'reflection-partial';
                    statusIcon = '⚠️';
                    break;
                case 'failed':
                    statusClass = 'reflection-failed';
                    statusIcon = '❌';
                    break;
            }
        }
        
        let html = `
            <div class="log-entry reflection-log ${statusClass}">
                <div class="log-header">
                    <span class="log-timestamp">${entry.timestamp.toLocaleTimeString()}</span>
                    <span class="log-icon">${statusIcon}</span>
                    <span class="log-title">Reflexión del agente</span>
                    ${entry.modelInfo ? `<span class="log-model">${entry.modelInfo.name || ''}</span>` : ''}
                </div>
                
                <div class="log-content">
                    <div class="log-section">
                        <h4>Reflexión:</h4>
                        <div class="reflection-text">
                            ${(entry.reflection || '').split('\n').map(line => `<p>${this.sanitizeForHtml(line)}</p>`).join('')}
                        </div>
                    </div>
                    
                    ${entry.successfulSteps !== undefined ? `
                        <div class="reflection-stats">
                            <h4>Estadísticas:</h4>
                            <p>Pasos completados con éxito: <span class="success-count">${entry.successfulSteps}</span></p>
                            <p>Pasos fallidos: <span class="failed-count">${entry.failedSteps}</span></p>
                            ${entry.stoppedAtStep ? `
                                <p>Ejecución detenida en: <span class="stopped-step">${this.sanitizeForHtml(entry.stoppedAtStep)}</span></p>
                                <p>Motivo: <span class="stop-reason">${this.sanitizeForHtml(entry.stopReason || '')}</span></p>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${entry.recommendations && entry.recommendations.length > 0 ? `
                        <div class="reflection-recommendations">
                            <h4>Recomendaciones:</h4>
                            <ul class="recommendations-list">
                                ${entry.recommendations.map(rec => `
                                    <li class="recommendation-item">${this.sanitizeForHtml(rec)}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${entry.modelUsage && entry.modelUsage.length > 0 ? `
                        <div class="model-usage-container">
                            <h4>Uso de modelos LLM:</h4>
                            <div class="collapsible-content">
                                <table class="model-usage-table">
                                    <thead>
                                        <tr>
                                            <th>Modelo</th>
                                            <th>Llamadas</th>
                                            <th>Tokens de entrada</th>
                                            <th>Tokens de salida</th>
                                            <th>Coste USD</th>
                                            <th>Coste EUR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${entry.modelUsage.map(model => `
                                            <tr>
                                                <td>${this.sanitizeForHtml(model.model)}</td>
                                                <td>${model.calls}</td>
                                                <td>${model.inputTokens}</td>
                                                <td>${model.outputTokens}</td>
                                                <td>$${model.costUSD.toFixed(6)}</td>
                                                <td>€${model.costEUR.toFixed(6)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                    <tfoot>
                                        <tr class="total-row">
                                            <td colspan="4">Total:</td>
                                            <td>$${entry.totalCostUSD ? entry.totalCostUSD.toFixed(6) : '0.000000'}</td>
                                            <td>€${entry.totalCostEUR ? entry.totalCostEUR.toFixed(6) : '0.000000'}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${entry.appliedRules && entry.appliedRules.length > 0 ? `
                        <div class="log-section">
                            <h4>Reglas aplicadas (${entry.appliedRules.length}):</h4>
                            <ul class="rules-list">
                                ${entry.appliedRules.slice(0, 5).map(rule => `
                                    <li>${this.sanitizeForHtml(rule)}</li>
                                `).join('')}
                                ${entry.appliedRules.length > 5 ? `<li>... y ${entry.appliedRules.length - 5} reglas más</li>` : ''}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${this.renderModelInfo(entry)}
                </div>
            </div>
        `;
        
        return html;
    }

    /**
     * Render a build rules log
     * @param entry - Build rules log entry
     * @returns HTML for the build rules log
     */
    private renderBuildRulesLog(entry: LogEntry): string {
        const rulesHtml = this.renderMermaidDiagram(entry.rules || []);
        
        return `
            <div class="log-entry build-rules-log">
                <div class="log-header">
                    <span class="log-timestamp">${entry.timestamp.toLocaleTimeString()}</span>
                    <span class="log-icon">📝</span>
                    <span class="log-title">${this.sanitizeForHtml(entry.description || 'Reglas aplicables')}</span>
                </div>
                
                <div class="log-content">
                    <div class="log-section">
                        <h4>Reglas (${(entry.rules || []).length}):</h4>
                        <div class="rules-container">
                            ${entry.rules && entry.rules.length > 0 ? `
                                <ul class="rules-list">
                                    ${entry.rules.map(rule => `<li>${this.sanitizeForHtml(rule)}</li>`).join('')}
                                </ul>
                                ${rulesHtml}
                            ` : '<div class="no-rules">No hay reglas definidas</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar un diagrama Mermaid basado en las reglas aplicadas
     * @param rules - Lista de reglas aplicadas
     * @returns - HTML con el diagrama Mermaid
     */
    private renderMermaidDiagram(rules: string[]): string {
        if (!rules || rules.length === 0) {
            return '';
        }
        
        // Crear un diagrama de flujo simple que muestre las reglas aplicadas
        const mermaidCode = `
            flowchart TD
                Start([Inicio]) --> Rules
                Rules[Reglas Aplicadas]
                
                ${rules.map((rule, index) => `Rules --> Rule${index}["${this.sanitizeForHtml(rule)}"]`).join('\n                ')}
                
                ${rules.map((_, index) => `Rule${index} --> End`).join('\n                ')}
                End([Fin])
        `;
        
        return `
            <div class="mermaid-container">
                <h4>Diagrama de flujo de reglas:</h4>
                <div class="mermaid">
                    ${mermaidCode}
                </div>
                <script>
                    // Cargar Mermaid dinámicamente si no está cargado
                    if (typeof mermaid === 'undefined') {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js';
                        script.onload = () => {
                            mermaid.initialize({ startOnLoad: true });
                        };
                        document.head.appendChild(script);
                    } else {
                        // Si ya está cargado, solo inicializar
                        mermaid.initialize({ startOnLoad: true });
                    }
                </script>
            </div>
        `;
    }

    /**
     * Sanitize a string for use in HTML
     * @param str - String to sanitize
     * @returns Sanitized string
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