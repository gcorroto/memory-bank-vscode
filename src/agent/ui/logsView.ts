import * as vscode from 'vscode';

export class AgentLogsView {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private logs: string[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public show() {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'grec0aiAgentLogs',
      'Grec0AI Agent Logs',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.webview.html = this.getWebviewContent();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    }, null, this.context.subscriptions);
  }

  public addLog(log: string) {
    this.logs.push(log);
    if (this.panel) {
      this.panel.webview.html = this.getWebviewContent();
    }
  }

  private getWebviewContent() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Grec0AI Agent Logs</title>
      <style>
        body {
          font-family: var(--vscode-editor-font-family);
          padding: 10px;
        }
        .log-entry {
          margin-bottom: 8px;
          padding: 5px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
      </style>
    </head>
    <body>
      <h1>Grec0AI Agent Logs</h1>
      <div id="logs">
        ${this.logs.map(log => `<div class="log-entry">${log}</div>`).join('')}
      </div>
    </body>
    </html>`;
  }
} 