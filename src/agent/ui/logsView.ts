/**
 * Agent Logs View
 * Provides a web view for displaying agent logs and reasoning
 */

import * as vscode from 'vscode';

interface LogEntry {
    type: string;
    description?: string;
    tool?: string;
    params?: any;
    result?: any;
    success?: boolean;
    steps?: any[];
    reflection?: string;
    timestamp: Date;
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

    /**
     * Create a new logs view
     * @param context - Extension context
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        // Create default session
        this.createNewSession('Default');
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
     * Add a step execution log
     * @param description - Step description
     * @param tool - Tool name
     * @param params - Parameters used
     * @param result - Execution result
     * @param success - Whether execution was successful
     * @param sessionId - Optional session ID
     */
    public addStepLog(description: string, tool: string, params: any, result: any, success: boolean, sessionId?: string): void {
        this.addLogEntry({
            type: 'step',
            description,
            tool,
            params,
            result,
            success,
            timestamp: new Date()
        }, sessionId);
    }

    /**
     * Add a plan log
     * @param steps - Planned steps
     * @param sessionId - Optional session ID
     */
    public addPlanLog(steps: any[], sessionId?: string): void {
        this.addLogEntry({
            type: 'plan',
            steps,
            timestamp: new Date()
        }, sessionId);
    }

    /**
     * Add a reflection log
     * @param reflection - Reflection data
     * @param sessionId - Optional session ID
     */
    public addReflectionLog(reflection: string, sessionId?: string): void {
        this.addLogEntry({
            type: 'reflection',
            reflection,
            timestamp: new Date()
        }, sessionId);
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
                            --success-color: #22cc44;
                            --failure-color: #f14c4c;
                            --timestamp-color: #7d7d7d;
                            --collapsible-bg: #2a2a2a;
                            --collapsible-hover: #3a3a3a;
                            --tab-bg: #252525;
                            --tab-active-bg: #1e1e1e;
                            --tab-hover: #333333;
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
                            --success-color: #00cc44;
                            --failure-color: #cc0000;
                            --timestamp-color: #888888;
                            --collapsible-bg: #f1f1f1;
                            --collapsible-hover: #dddddd;
                            --tab-bg: #ececec;
                            --tab-active-bg: #ffffff;
                            --tab-hover: #f5f5f5;
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
                        border-bottom: 1px solid var(--border-color);
                        padding-bottom: 10px;
                    }
                    .timestamp {
                        color: var(--timestamp-color);
                        font-size: 0.8em;
                    }
                    .step {
                        background-color: var(--step-bg);
                        border-left: 4px solid var(--step-border);
                        padding: 10px;
                    }
                    .plan {
                        background-color: var(--plan-bg);
                        border-left: 4px solid var(--plan-border);
                        padding: 10px;
                    }
                    .reflection {
                        background-color: var(--reflection-bg);
                        border-left: 4px solid var(--reflection-border);
                        padding: 10px;
                    }
                    .success {
                        color: var(--success-color);
                    }
                    .failure {
                        color: var(--failure-color);
                    }
                    .collapsible {
                        background-color: var(--collapsible-bg);
                        cursor: pointer;
                        padding: 10px;
                        width: 100%;
                        border: none;
                        text-align: left;
                        outline: none;
                        color: var(--text-color);
                    }
                    .active, .collapsible:hover {
                        background-color: var(--collapsible-hover);
                    }
                    .content {
                        padding: 0 10px;
                        max-height: 0;
                        overflow: hidden;
                        transition: max-height 0.2s ease-out;
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
                </style>
            </head>
            <body>
                <h1>Grec0AI Agent Logs</h1>
                
                <div class="tab-controls">
                    <button class="new-tab-button" id="newSessionButton">Nueva Sesión</button>
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
                    
                    // Set up collapsible sections
                    var coll = document.getElementsByClassName("collapsible");
                    for (var i = 0; i < coll.length; i++) {
                        coll[i].addEventListener("click", function() {
                            this.classList.toggle("active");
                            var content = this.nextElementSibling;
                            if (content.style.maxHeight) {
                                content.style.maxHeight = null;
                            } else {
                                content.style.maxHeight = content.scrollHeight + "px";
                            }
                        });
                    }
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
            return '<p>No logs yet...</p>';
        }

        return session.entries.map(entry => this.renderLogEntry(entry)).join('');
    }

    /**
     * Render a single log entry based on its type
     * @param entry - Log entry to render
     * @returns HTML for the log entry
     */
    private renderLogEntry(entry: LogEntry): string {
        const timestamp = entry.timestamp 
            ? `<div class="timestamp">${entry.timestamp.toLocaleString()}</div>` 
            : '';

        switch (entry.type) {
            case 'step':
                return this.renderStepLog(entry);
            case 'plan':
                return this.renderPlanLog(entry);
            case 'reflection':
                return this.renderReflectionLog(entry);
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
        const status = entry.success 
            ? '<span class="success">✓ Success</span>' 
            : '<span class="failure">✗ Failed</span>';
        
        return `
            <div class="log-entry step">
                <div><strong>${this.sanitizeForHtml(entry.description || '')}</strong> - ${status}</div>
                <div class="timestamp">${entry.timestamp.toLocaleString()}</div>
                
                <button class="collapsible">Tool: ${this.sanitizeForHtml(entry.tool || '')}</button>
                <div class="content">
                    <h4>Parameters:</h4>
                    <pre><code>${this.sanitizeForHtml(JSON.stringify(entry.params, null, 2))}</code></pre>
                    
                    <h4>Result:</h4>
                    <pre><code>${this.sanitizeForHtml(JSON.stringify(entry.result, null, 2))}</code></pre>
                </div>
            </div>
        `;
    }

    /**
     * Render a plan log
     * @param entry - Plan log entry
     * @returns HTML for the plan log
     */
    private renderPlanLog(entry: LogEntry): string {
        const steps = entry.steps || [];
        const stepsHtml = steps.map((step, index) => `
            <li>
                <strong>${this.sanitizeForHtml(step.description || '')}</strong>
                <div>Tool: ${this.sanitizeForHtml(step.tool || '')}</div>
                <button class="collapsible">Parameters</button>
                <div class="content">
                    <pre><code>${this.sanitizeForHtml(JSON.stringify(step.params, null, 2))}</code></pre>
                </div>
            </li>
        `).join('');
        
        return `
            <div class="log-entry plan">
                <div><strong>Plan with ${steps.length} steps</strong></div>
                <div class="timestamp">${entry.timestamp.toLocaleString()}</div>
                
                <ol>
                    ${stepsHtml}
                </ol>
            </div>
        `;
    }

    /**
     * Render a reflection log
     * @param entry - Reflection log entry
     * @returns HTML for the reflection log
     */
    private renderReflectionLog(entry: LogEntry): string {
        return `
            <div class="log-entry reflection">
                <div><strong>Reflection</strong></div>
                <div class="timestamp">${entry.timestamp.toLocaleString()}</div>
                
                <div>${this.sanitizeForHtml(entry.reflection || '')}</div>
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