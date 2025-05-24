/**
 * Agent Logs View
 * Provides a web view for displaying agent logs and reasoning
 */

const vscode = require('vscode');

class AgentLogsView {
    /**
     * Create a new logs view
     * @param {vscode.ExtensionContext} context - Extension context
     */
    constructor(context) {
        this.context = context;
        this.panel = null;
        this.logEntries = [];
    }

    /**
     * Show the logs view
     */
    show() {
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
                this.panel = null;
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
     * @param {Object} entry - Log entry
     */
    addLogEntry(entry) {
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
     * @param {string} description - Step description
     * @param {string} tool - Tool name
     * @param {Object} params - Parameters used
     * @param {Object} result - Execution result
     * @param {boolean} success - Whether execution was successful
     */
    addStepLog(description, tool, params, result, success) {
        this.addLogEntry({
            type: 'step',
            description,
            tool,
            params,
            result,
            success
        });
    }

    /**
     * Add a plan log
     * @param {Array} steps - Planned steps
     */
    addPlanLog(steps) {
        this.addLogEntry({
            type: 'plan',
            steps
        });
    }

    /**
     * Add a reflection log
     * @param {Object} reflection - Reflection data
     */
    addReflectionLog(reflection) {
        this.addLogEntry({
            type: 'reflection',
            reflection
        });
    }

    /**
     * Clear all logs
     */
    clearLogs() {
        this.logEntries = [];
        if (this.panel) {
            this.updateContent();
        }
    }

    /**
     * Update the webview content
     */
    updateContent() {
        if (this.panel) {
            this.panel.webview.html = this.getHtmlContent();
        }
    }

    /**
     * Generate HTML content for the webview
     * @returns {string} - HTML content
     */
    getHtmlContent() {
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
                            if (content.style.maxHeight){
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
     * Render log entries as HTML
     * @returns {string} - HTML content for logs
     */
    renderLogs() {
        if (this.logEntries.length === 0) {
            return '<p>No logs yet. Agent activity will be displayed here.</p>';
        }

        // Render logs in reverse order (newest first)
        return this.logEntries
            .slice()
            .reverse()
            .map(entry => this.renderLogEntry(entry))
            .join('');
    }

    /**
     * Render a single log entry as HTML
     * @param {Object} entry - Log entry
     * @returns {string} - HTML content for the log entry
     */
    renderLogEntry(entry) {
        const timestamp = entry.timestamp instanceof Date
            ? entry.timestamp.toLocaleTimeString()
            : new Date().toLocaleTimeString();

        let content = '';

        switch (entry.type) {
            case 'step':
                content = this.renderStepLog(entry);
                break;
            case 'plan':
                content = this.renderPlanLog(entry);
                break;
            case 'reflection':
                content = this.renderReflectionLog(entry);
                break;
            default:
                content = `<pre>${JSON.stringify(entry, null, 2)}</pre>`;
        }

        return `
            <div class="log-entry ${entry.type}">
                <div class="timestamp">${timestamp}</div>
                ${content}
            </div>
        `;
    }

    /**
     * Render a step execution log
     * @param {Object} entry - Step log entry
     * @returns {string} - HTML content
     */
    renderStepLog(entry) {
        const statusClass = entry.success ? 'success' : 'failure';
        const statusText = entry.success ? 'Successful' : 'Failed';

        // Sanitize JSON for display
        const safeParams = this.sanitizeForHtml(JSON.stringify(entry.params, null, 2));
        const safeResult = this.sanitizeForHtml(JSON.stringify(entry.result, null, 2));

        return `
            <div class="step">
                <h3>Step Execution: ${this.sanitizeForHtml(entry.description)}</h3>
                <p>Tool: <strong>${this.sanitizeForHtml(entry.tool)}</strong> | Status: <span class="${statusClass}">${statusText}</span></p>
                
                <button class="collapsible">Parameters</button>
                <div class="content">
                    <pre><code>${safeParams}</code></pre>
                </div>
                
                <button class="collapsible">Result</button>
                <div class="content">
                    <pre><code>${safeResult}</code></pre>
                </div>
            </div>
        `;
    }

    /**
     * Render a plan log
     * @param {Object} entry - Plan log entry
     * @returns {string} - HTML content
     */
    renderPlanLog(entry) {
        const stepsHtml = entry.steps
            .map((step, index) => `
                <div>
                    <strong>${index + 1}.</strong> ${this.sanitizeForHtml(step.description)}
                    <br>
                    Tool: ${this.sanitizeForHtml(step.tool)}
                    <button class="collapsible">Parameters</button>
                    <div class="content">
                        <pre><code>${this.sanitizeForHtml(JSON.stringify(step.params, null, 2))}</code></pre>
                    </div>
                </div>
            `)
            .join('');

        return `
            <div class="plan">
                <h3>Execution Plan</h3>
                <p>The agent has created a plan with ${entry.steps.length} steps:</p>
                ${stepsHtml}
            </div>
        `;
    }

    /**
     * Render a reflection log
     * @param {Object} entry - Reflection log entry
     * @returns {string} - HTML content
     */
    renderReflectionLog(entry) {
        const statusClass = entry.reflection.success ? 'success' : 'failure';
        const suggestions = entry.reflection.suggestions
            ? entry.reflection.suggestions.map(s => `<li>${this.sanitizeForHtml(s)}</li>`).join('')
            : '';

        return `
            <div class="reflection">
                <h3>Execution Reflection</h3>
                <p>Status: <span class="${statusClass}">${entry.reflection.success ? 'Success' : 'Partial Success/Failure'}</span></p>
                <p>${this.sanitizeForHtml(entry.reflection.message)}</p>
                ${suggestions ? `<p>Suggestions:</p><ul>${suggestions}</ul>` : ''}
            </div>
        `;
    }

    /**
     * Sanitize a string for HTML display
     * @param {string} str - String to sanitize
     * @returns {string} - Sanitized string
     */
    sanitizeForHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

module.exports = AgentLogsView;