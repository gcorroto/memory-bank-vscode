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

export class AgentLogsView {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private logEntries: LogEntry[] = [];

    /**
     * Create a new logs view
     * @param context - Extension context
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
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
                    }
                },
                undefined,
                this.context.subscriptions
            );
        }
    }

    /**
     * Add a log entry
     * @param entry - Log entry
     */
    public addLogEntry(entry: LogEntry): void {
        // Add timestamp if not provided
        if (!entry.timestamp) {
            entry.timestamp = new Date();
        }

        // Add entry to log
        this.logEntries.push(entry);

        // Update content if panel is visible
        if (this.panel) {
            this.updateContent();
        }
    }

    /**
     * Add a step execution log
     * @param description - Step description
     * @param tool - Tool name
     * @param params - Parameters used
     * @param result - Execution result
     * @param success - Whether execution was successful
     */
    public addStepLog(description: string, tool: string, params: any, result: any, success: boolean): void {
        this.addLogEntry({
            type: 'step',
            description,
            tool,
            params,
            result,
            success,
            timestamp: new Date()
        });
    }

    /**
     * Add a plan log
     * @param steps - Planned steps
     */
    public addPlanLog(steps: any[]): void {
        this.addLogEntry({
            type: 'plan',
            steps,
            timestamp: new Date()
        });
    }

    /**
     * Add a reflection log
     * @param reflection - Reflection data
     */
    public addReflectionLog(reflection: string): void {
        this.addLogEntry({
            type: 'reflection',
            reflection,
            timestamp: new Date()
        });
    }

    /**
     * Clear all logs
     */
    public clearLogs(): void {
        this.logEntries = [];
        if (this.panel) {
            this.updateContent();
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
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Grec0AI Agent Logs</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                        line-height: 1.6;
                        padding: 20px;
                        max-width: 100%;
                    }
                    h1 {
                        color: #007acc;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 10px;
                    }
                    pre {
                        background-color: #f5f5f5;
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
                        border-bottom: 1px solid #eee;
                        padding-bottom: 10px;
                    }
                    .timestamp {
                        color: #888;
                        font-size: 0.8em;
                    }
                    .step {
                        background-color: #f0f7ff;
                        border-left: 4px solid #007acc;
                        padding: 10px;
                    }
                    .plan {
                        background-color: #fff8f0;
                        border-left: 4px solid #ff8c00;
                        padding: 10px;
                    }
                    .reflection {
                        background-color: #f0fff0;
                        border-left: 4px solid #00cc44;
                        padding: 10px;
                    }
                    .success {
                        color: #00cc44;
                    }
                    .failure {
                        color: #cc0000;
                    }
                    .collapsible {
                        background-color: #f1f1f1;
                        cursor: pointer;
                        padding: 10px;
                        width: 100%;
                        border: none;
                        text-align: left;
                        outline: none;
                    }
                    .active, .collapsible:hover {
                        background-color: #ddd;
                    }
                    .content {
                        padding: 0 10px;
                        max-height: 0;
                        overflow: hidden;
                        transition: max-height 0.2s ease-out;
                    }
                    .clear-button {
                        background-color: #cc0000;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-bottom: 20px;
                    }
                </style>
            </head>
            <body>
                <h1>Grec0AI Agent Logs</h1>
                <button class="clear-button" id="clearButton">Clear Logs</button>
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
     * Render all logs as HTML
     * @returns HTML content for logs
     */
    private renderLogs(): string {
        if (this.logEntries.length === 0) {
            return '<p>No logs yet...</p>';
        }

        return this.logEntries.map(entry => this.renderLogEntry(entry)).join('');
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