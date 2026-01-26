/**
 * DashboardViewer
 * VS Code Extension backend for the Agent Dashboard webview
 * Manages webview panel creation, state synchronization, and message routing
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getMemoryBankService } from '../../services/memoryBankService';

// Interface copied/adapted from frontend types to avoid import issues if any
interface ExternalRequest {
  id: string;
  title: string;
  fromProject: string;
  context: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | string;
  receivedAt: string;
}

export class DashboardViewer {
  private static instance: DashboardViewer | undefined;
  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;
  private agent: any | undefined;
  private contextManager: any | undefined;
  private disposables: vscode.Disposable[] = [];
  private pollTimer: NodeJS.Timer | undefined;
  private lastHistoryLength: number = 0;
  private executionItems: Map<string, any> = new Map();
  private currentProjectId: string | undefined;

  private constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /**
   * Singleton instance getter
   */
  public static getInstance(extensionUri: vscode.Uri): DashboardViewer {
    if (!DashboardViewer.instance) {
      DashboardViewer.instance = new DashboardViewer(extensionUri);
    }
    return DashboardViewer.instance;
  }

  /**
   * Show the dashboard
   */
  public async show(
    agent?: any,
    contextManager?: any,
    extensionContext?: vscode.ExtensionContext,
    projectId?: string
  ): Promise<void> {
    this.agent = agent;
    this.contextManager = contextManager;
    this.currentProjectId = projectId;

    if (!this.panel) {
      this.createPanel(extensionContext);
    } else {
      this.panel.reveal(vscode.ViewColumn.Two);
    }
    
    // Force immediate update of data
    this.updateDashboardState();
  }

  /**
   * Create the webview panel
   */
  private createPanel(extensionContext?: vscode.ExtensionContext): void {
    this.panel = vscode.window.createWebviewPanel(
      'autofixerDashboard',
      'Autofixer Agent Dashboard',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'src/agent/ui/react-agent-dashboard'),
          vscode.Uri.joinPath(this.extensionUri, 'dist'),
        ],
      }
    );

    // Set initial HTML
    this.updateWebviewContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      undefined,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = undefined;
        }
      },
      undefined,
      this.disposables
    );

    // Subscribe to agent events
    this.setupAgentEventListeners();
  }

  /**
   * Update webview with bundled React app
   */
  private updateWebviewContent(): void {
    if (!this.panel) return;

    // Path to the bundled dashboard JS
    const dashboardScriptPath = vscode.Uri.joinPath(
      this.extensionUri,
      'dist/dashboard.js'
    );
    const dashboardScriptUri = this.panel.webview.asWebviewUri(dashboardScriptPath);

    // Path to the bundled dashboard CSS
    const dashboardCssPath = vscode.Uri.joinPath(
      this.extensionUri,
      'dist/dashboard.css'
    );
    const dashboardCssUri = this.panel.webview.asWebviewUri(dashboardCssPath);

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Autofixer Agent Dashboard</title>
          <link rel="stylesheet" href="${dashboardCssUri}" />
          <style>
            body {
              font-family: var(--vscode-font-family);
              font-size: var(--vscode-font-size);
              color: var(--vscode-foreground);
              background-color: var(--vscode-editor-background);
            }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script>
            const vscode = acquireVsCodeApi();
            window.vscode = vscode;
          </script>
          <script src="${dashboardScriptUri}"></script>
        </body>
      </html>
    `;

    this.panel.webview.html = html;
  }

  /**
   * Handle messages from the React webview
   */
  private handleWebviewMessage(message: any): void {
    console.log('[DashboardViewer] Received message:', JSON.stringify(message, null, 2));

    switch (message.type) {
      case 'REQUEST_INITIAL_STATE':
        this.sendInitialState();
        break;

      case 'REQUEST_MCPs_STATE':
        this.sendMCPsState();
        break;

      case 'REQUEST_HISTORICO_STATE':
        this.sendHistoricoState();
        break;

      case 'REQUEST_EXECUTION_STATE':
        this.sendExecutionState();
        break;

      case 'REQUEST_VALIDATOR_STATE':
        this.sendValidatorState();
        break;

      case 'REQUEST_PLANNER_STATE':
        this.sendPlannerState();
        break;

      case 'REQUEST_TESTING_STATE':
        this.sendTestingState();
        break;

      case 'REQUEST_DELEGATION_STATE':
        this.sendDelegationState();
        break;

      case 'ACCEPT_TASK':
        if (message.data && this.currentProjectId) {
           vscode.commands.executeCommand('memorybank.agent.acceptTask', {
               id: message.data.requestId,
               projectId: this.currentProjectId
           });
           // Optimistic update or wait for file watcher? 
           // File watcher should trigger reload eventually, but let's refresh quickly
           setTimeout(() => this.sendDelegationState(), 500); 
        }
        break;

      case 'REJECT_TASK':
        if (message.data && this.currentProjectId) {
           vscode.commands.executeCommand('memorybank.agent.rejectTask', {
               id: message.data.requestId,
               projectId: this.currentProjectId
           });
           setTimeout(() => this.sendDelegationState(), 500);
        }
        break;

      case 'CREATE_DELEGATION':
        // Prompt user via chat to delegate
        vscode.commands.executeCommand('memorybank.agent.delegateTask');
        break;

      case 'TRIGGER_AGENT_ACTION':
        this.triggerAgentAction(message.data);
        break;

      case 'UPDATE_AGENT_CONFIG':
        this.updateAgentConfig(message.data);
        break;

      case 'LAUNCH_AGENT':
        const { agentType, task, cliCommand, config } = message.payload;
        
        if (agentType === 'vscode') {
          if (this.agent) {
             // We use the same pattern as 'Launch Agent for Task' command
             // Pass configuration options in the context
             this.agent.handleUserInput(`Task: ${task}`, { 
                 ...config,
                 source: 'dashboard'
             });
             vscode.window.showInformationMessage(`Agent launched for task: ${task}`);
             this.agent.showLogsView();
          } else {
             vscode.window.showErrorMessage('Internal agent not available');
          }
        } else if (agentType === 'cli') {
          if (cliCommand) {
             const terminal = vscode.window.createTerminal(`Agent CLI: ${new Date().toLocaleTimeString()}`);
             terminal.show();
             terminal.sendText(cliCommand);
          } else {
             vscode.window.showErrorMessage('No CLI command provided');
          }
        }
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Send initial dashboard state to webview
   */
  private sendInitialState(): void {
    // Generate mock data for development/testing
    const hasMockData = !this.agent; // Show mock data when no agent is active
    
    const state = {
      mcps: {
        connections: hasMockData ? [
          {
            id: 'mcp-memory-bank',
            name: 'Memory Bank MCP',
            status: 'connected',
            url: 'stdio://memory-bank-mcp',
            version: '1.0.0',
            connectedAt: Date.now() - 300000
          },
          {
            id: 'mcp-mysql',
            name: 'MySQL MCP',
            status: 'connected',
            url: 'stdio://mysql-mcp',
            version: '1.0.0',
            connectedAt: Date.now() - 250000
          }
        ] : [],
        tools: hasMockData ? [
          { name: 'memorybank_search', description: 'Search code semantically', category: 'search' },
          { name: 'memorybank_index_code', description: 'Index code files', category: 'indexing' },
          { name: 'mysql_execute_sql', description: 'Execute SQL query', category: 'database' }
        ] : [],
        latency: hasMockData ? {
          'mcp-memory-bank': 45,
          'mcp-mysql': 32
        } : {},
        initialized: !!this.agent || hasMockData,
      },
      historico: {
        messages: this.contextManager?.getHistory() || (hasMockData ? [
          { role: 'user', content: 'Fix TypeScript errors', timestamp: Date.now() - 120000 },
          { role: 'assistant', content: 'Analyzing errors...', timestamp: Date.now() - 119000 },
          { role: 'tool', content: 'Found 5 errors', timestamp: Date.now() - 118000 }
        ] : []),
        totalTokens: this.contextManager?.getTokenCount() || (hasMockData ? 1234 : 0),
        sessionId: this.contextManager?.getSessionId() || (hasMockData ? 'session-demo-001' : 'N/A'),
        startTime: Date.now() - (hasMockData ? 300000 : 0),
      },
      execution: {
        executing: hasMockData ? [
          { id: '1', tool: 'ReadFileTool', params: { path: 'src/extension.ts' }, startTime: Date.now() - 2000 }
        ] : [],
        completed: hasMockData ? [
          { id: '2', tool: 'AnalyzeCodeTool', params: {}, startTime: Date.now() - 5000, endTime: Date.now() - 3000, result: 'Analysis complete' }
        ] : [],
        failed: [],
        totalExecuted: hasMockData ? 2 : 0,
        currentParallelCount: hasMockData ? 1 : 0,
        currentStep: hasMockData ? 1 : 0,
      },
      validator: {
        checks: hasMockData ? [
          { rule: 'TypeScript compilation', description: 'Check TS errors', passed: true, timestamp: Date.now() - 60000 },
          { rule: 'ESLint validation', description: 'Check linting', passed: true, timestamp: Date.now() - 58000 }
        ] : [],
        passedCount: hasMockData ? 2 : 0,
        failedCount: 0,
        averagePassRate: hasMockData ? 100 : 0,
      },
      planner: {
        steps: hasMockData ? [
          { id: '1', title: 'Analyze errors', description: 'Read TypeScript errors', status: 'completed', progress: 100 },
          { id: '2', title: 'Fix errors', description: 'Apply fixes', status: 'running', progress: 50 },
          { id: '3', title: 'Validate', description: 'Recompile and check', status: 'pending', progress: 0 }
        ] : [],
        replanningHistory: [],
        currentPhase: 'executing',
      },
      testing: {
        testResults: hasMockData ? [
          { id: '1', name: 'Unit tests', status: 'passed', passed: true, duration: 1234, timestamp: Date.now() - 90000 }
        ] : [],
        passedCount: hasMockData ? 1 : 0,
        failedCount: 0,
        coverage: hasMockData ? 85 : 0,
        currentTest: hasMockData ? 'Running integration tests...' : '',
      },
    };

    this.sendToWebview({
      type: 'SET_DASHBOARD_STATE',
      data: state,
    });
  }

  /**
   * Send MCPs state
   */
  private sendMCPsState(): void {
    // TODO: Get MCPs state from agent/tool manager
    this.sendToWebview({
      type: 'UPDATE_MCPS',
      data: {
        connections: [],
        tools: [],
        latency: {},
      },
    });
  }

  /**
   * Send Histórico state
   */
  private sendHistoricoState(): void {
    this.sendToWebview({
      type: 'UPDATE_HISTORICO',
      data: {
        messages: this.contextManager?.getHistory() || [],
        totalTokens: this.contextManager?.getTokenCount() || 0,
      },
    });
  }

  /**
   * Send Execution state
   */
  private sendExecutionState(): void {
    this.sendToWebview({
      type: 'UPDATE_EXECUTION',
      data: {
        executing: [],
        completed: [],
        failed: [],
      },
    });
  }

  /**
   * Send Validator state
   */
  private sendValidatorState(): void {
    this.sendToWebview({
      type: 'UPDATE_VALIDATOR',
      data: {
        checks: [],
        passedCount: 0,
        failedCount: 0,
      },
    });
  }

  /**
   * Send Planner state
   */
  private sendPlannerState(): void {
    this.sendToWebview({
      type: 'UPDATE_PLANNER',
      data: {
        steps: [],
        replanningHistory: [],
        phase: 'planning',
      },
    });
  }

  /**
   * Send Testing state
   */
  private sendTestingState(): void {
    this.sendToWebview({
      type: 'UPDATE_TESTING',
      data: {
        results: [],
        coverage: 0,
      },
    });
  }

  /**
   * Trigger agent action from webview
   */
  private triggerAgentAction(data: any): void {
    console.log('[DashboardViewer] Triggering agent action:', JSON.stringify(data, null, 2));
    // TODO: Implement based on action type
  }

  /**
   * Update agent configuration
   */
  private updateAgentConfig(data: any): void {
    console.log('[DashboardViewer] Updating agent config:', JSON.stringify(data, null, 2));
    // TODO: Implement configuration updates
  }

  /**
   * Setup listeners for agent events
   */
  private setupAgentEventListeners(): void {
    // Prefer Agent event stream if available
    if (this.agent && this.agent.onDidEmitEvent) {
      const subscription = this.agent.onDidEmitEvent((evt: any) => {
        this.handleAgentEvent(evt);
      });
      this.disposables.push(subscription);
      return;
    }

    // Fallback: simple polling based on contextManager history
    if (!this.contextManager || !this.panel) {
      return;
    }

    try {
      const hist = this.contextManager.getHistory?.() || [];
      this.lastHistoryLength = Array.isArray(hist) ? hist.length : 0;
    } catch {
      this.lastHistoryLength = 0;
    }

    this.pollTimer = setInterval(() => {
      try {
        const history = this.contextManager.getHistory?.() || [];
        const totalTokens = this.contextManager.getSummary?.().tokenCount || 0;

        this.sendToWebview({
          type: 'UPDATE_HISTORICO',
          data: {
            messages: history,
            totalTokens,
          },
        });

        if (Array.isArray(history) && history.length > this.lastHistoryLength) {
          const newItems = history.slice(this.lastHistoryLength);
          newItems.forEach((item: any) => {
            if (item.role === 'assistant' && item.tool) {
              this.sendToWebview({
                type: 'UPDATE_EXECUTION',
                data: {
                  completed: [
                    {
                      id: `${Date.now()}`,
                      tool: item.tool,
                      params: {},
                      startTime: Date.now() - 1000,
                      endTime: Date.now(),
                      result: item.result || {},
                    },
                  ],
                },
              });
            }
          });

          this.lastHistoryLength = history.length;
        }
      } catch (e) {
        console.warn('Polling error in DashboardViewer:', e);
      }
    }, 1000);
  }

  /**
   * Handle agent events and forward to webview
   */
  private handleAgentEvent(evt: any): void {
    if (!this.panel) return;

    try {
      switch (evt.type) {
        case 'planUpdate': {
          const plan = evt.data?.plan;
          if (plan?.steps) {
            this.sendToWebview({
              type: 'UPDATE_PLANNER',
              data: { steps: plan.steps, phase: 'planning' },
            });
          }
          break;
        }
        case 'stepStart': {
          const { stepIndex, step } = evt.data || {};
          const item = {
            id: `step-${stepIndex}`,
            name: step?.tool || `Paso ${stepIndex + 1}`,
            params: step?.params || {},
            startTime: Date.now(),
          };
          this.executionItems.set(item.id, item);
          this.sendToWebview({ type: 'UPDATE_EXECUTION', data: { executing: [item] } });
          break;
        }
        case 'stepSuccess': {
          const { stepIndex, step, result } = evt.data || {};
          const id = `step-${stepIndex}`;
          const existing = this.executionItems.get(id) || {
            id,
            name: step?.tool || `Paso ${stepIndex + 1}`,
            params: step?.params || {},
            startTime: Date.now() - 1000,
          };
          this.executionItems.delete(id);
          this.sendToWebview({
            type: 'EXECUTION_TOOL_COMPLETED',
            data: { ...existing, endTime: Date.now(), result },
          });
          break;
        }
        case 'stepError': {
          const { stepIndex, step, error } = evt.data || {};
          const id = `step-${stepIndex}`;
          const existing = this.executionItems.get(id) || {
            id,
            name: step?.tool || `Paso ${stepIndex + 1}`,
            params: step?.params || {},
            startTime: Date.now() - 1000,
          };
          this.executionItems.delete(id);
          this.sendToWebview({
            type: 'EXECUTION_TOOL_FAILED',
            data: { ...existing, endTime: Date.now(), error },
          });
          break;
        }
      }
    } catch (e) {
      console.warn('DashboardViewer: Error handling agent event', e);
    }
  }

  /**
   * Send message to webview
   */
  private sendToWebview(message: any): void {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    if (this.panel) {
      this.panel.dispose();
    }
  }

  /**
   * Force update all dashboard state
   */
  public updateDashboardState(): void {
    this.sendInitialState();
    this.sendMCPsState();
    this.sendHistoricoState();
    this.sendExecutionState();
    this.sendValidatorState();
    this.sendPlannerState();
    this.sendTestingState();
    this.sendDelegationState();
  }

  /**
   * Send Delegation state
   */
  private sendDelegationState(): void {
    if (!this.currentProjectId && this.agent && this.agent.context && this.agent.context.workspaceState) {
         // Try to recover projectId from context/state if possible, or default to current workspace
    }
    const projectId = this.currentProjectId || 'memory_bank_vscode_extension'; // Fallback for dev

    const requests = projectId ? this.parseExternalRequests(projectId) : [];
    
    this.sendToWebview({
      type: 'UPDATE_DELEGATION_REQUESTS',
      data: {
        requests: requests
      }
    });
  }

  private parseExternalRequests(projectId: string): ExternalRequest[] {
      try {
        const service = getMemoryBankService();
        const mbPath = service.getMemoryBankPath();
        if (!mbPath) return [];

        const boardPath = path.join(mbPath, 'projects', projectId, 'docs', 'agentBoard.md');
        if (!fs.existsSync(boardPath)) return [];

        const content = fs.readFileSync(boardPath, 'utf-8');
        const requests = this.parseTable(content, 'External Requests');
        
        return requests.map(row => {
            // | ID | Title | From Project | Context | Status | Received At |
            const [id, title, fromProject, context, status, receivedAt] = row;
            return {
                id: id || 'Unknown',
                title: title || 'Unknown',
                fromProject: fromProject || 'Unknown',
                context: context || '',
                status: status ? status.trim() : 'PENDING',
                receivedAt: receivedAt || ''
            };
        });
      } catch (e) {
          console.error('[DashboardViewer] Error parsing external requests:', e);
          return [];
      }
  }

  private parseTable(content: string, sectionTitle: string): string[][] {
    const rows: string[][] = [];
    const lines = content.split('\n');
    let inSection = false;
    let foundHeaderSep = false;

    for (const line of lines) {
        if (line.trim().startsWith('## ' + sectionTitle)) {
            inSection = true;
            continue;
        }
        if (inSection && line.startsWith('## ')) {
            break; // Next section
        }
        if (inSection) {
            if (line.trim().startsWith('|')) {
                if (line.includes('---')) {
                    foundHeaderSep = true;
                    continue;
                }
                if (!foundHeaderSep && !line.includes('---')) {
                     continue; 
                }
                
                if (foundHeaderSep) {
                    const cells = line.split('|').map(c => c.trim()).filter((c, i) => i > 0 && i < line.split('|').length - 1);
                    if (cells.length > 0) {
                        rows.push(cells);
                    }
                }
            }
        }
    }
    return rows;
  }
}
