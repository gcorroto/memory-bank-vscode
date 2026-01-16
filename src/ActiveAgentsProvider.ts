import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getMemoryBankService } from './services/memoryBankService';
import { ProjectInfo } from './types/memoryBank';
import { SqliteService } from './services/SqliteService';

export class ActiveAgentsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = 
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private selectedProject: ProjectInfo | null = null;
  private logger: vscode.OutputChannel;

  constructor(logger: vscode.OutputChannel) {
    this.logger = logger;
  }

  public getSelectedProject(): ProjectInfo | null {
    return this.selectedProject;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setSelectedProject(project: ProjectInfo | null): void {
    this.selectedProject = project;
    this.refresh();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      if (!this.selectedProject) {
        return [new vscode.TreeItem('Ningún proyecto seleccionado', vscode.TreeItemCollapsibleState.None)];
      }

      const service = getMemoryBankService();
      
      // Try SQLite (New implementation)
      const sqlite = service.getSqliteService();
      if (sqlite) {
        try {
            return this.getChildrenFromSqlite(this.selectedProject.id);
        } catch (error) {
            this.logger.appendLine(`SQLite retrieval failed: ${error}, falling back to markdown`);
        }
      }

      const mbPath = service.getMemoryBankPath();
      if (!mbPath) {
        return [new vscode.TreeItem('Memory Bank no configurado', vscode.TreeItemCollapsibleState.None)];
      }

      const boardPath = path.join(mbPath, 'projects', this.selectedProject.id, 'docs', 'agentBoard.md');

      if (!fs.existsSync(boardPath)) {
        const item = new vscode.TreeItem('No hay actividad de agentes', vscode.TreeItemCollapsibleState.None);
        item.description = '(agentBoard.md no encontrado)';
        return [item];
      }

      try {
        const content = fs.readFileSync(boardPath, 'utf-8');
        return this.parseBoardContent(content);
      } catch (error) {
        this.logger.appendLine(`Error reading agent board: ${error}`);
        return [new vscode.TreeItem('Error al leer el tablero de agentes', vscode.TreeItemCollapsibleState.None)];
      }
    }

    // Handle children of sections (Agents, Locks, Messages)
    if (element instanceof SectionTreeItem) {
        return element.children;
    }

    // Handle session history navigation
    if (element instanceof AgentTreeItem && element.sessionId && element.projectId) {
        return this.getSessionHistory(element.projectId, element.sessionId);
    }

    return [];
  }

  private async getSessionHistory(projectId: string, sessionId: string): Promise<vscode.TreeItem[]> {
      const service = getMemoryBankService();
      const mbPath = service.getMemoryBankPath();
      if (!mbPath) return [];

      const sessionPath = path.join(mbPath, 'projects', projectId, 'sessions', `${sessionId}.jsonl`);
      
      if (!fs.existsSync(sessionPath)) {
          return [new vscode.TreeItem('No session history available', vscode.TreeItemCollapsibleState.None)];
      }

      try {
          const content = fs.readFileSync(sessionPath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim().length > 0);
          
          if (lines.length === 0) {
               return [new vscode.TreeItem('Session log is empty', vscode.TreeItemCollapsibleState.None)];
          }

          // Limit to last 20 events reversed
          const recentLines = lines.slice(-20).reverse();

          return recentLines.map(line => {
              try {
                  const event = JSON.parse(line);
                  const type = event.type || 'UNKNOWN';
                  const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '';
                  
                  // Friendly label based on type
                  let label = `[${type}]`;
                  let description = timestamp;
                  let icon = 'record';

                  if (type === 'read_doc') {
                      label = `Read ${path.basename(event.data?.path || 'doc')}`;
                      icon = 'book';
                  } else if (type === 'tool_use') {
                      label = `Used ${event.data?.tool || 'tool'}`;
                      icon = 'tools';
                  } else if (type === 'memory_search') {
                      label = `Searched memory`;
                      description = `${timestamp} - "${event.data?.query?.substring(0, 20)}..."`;
                      icon = 'search';
                  }

                  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                  item.description = description;
                  item.iconPath = new vscode.ThemeIcon(icon);
                  
                  // Tooltip with full JSON data
                  item.tooltip = new vscode.MarkdownString();
                  item.tooltip.appendCodeblock(JSON.stringify(event, null, 2), 'json');
                  
                  return item;
              } catch (e) {
                  return new vscode.TreeItem('Invalid log entry', vscode.TreeItemCollapsibleState.None);
              }
          });

      } catch (error) {
          this.logger.appendLine(`Error reading session log: ${error}`);
          return [new vscode.TreeItem('Error reading session log', vscode.TreeItemCollapsibleState.None)];
      }
  }

  private getChildrenFromSqlite(projectId: string): vscode.TreeItem[] {
    const service = getMemoryBankService();
    const sqlite = service.getSqliteService();
    if (!sqlite) return [];

    const sections: vscode.TreeItem[] = [];

    // Active Agents
    const agents = sqlite.getActiveAgents(projectId);
    const agentsSection = new SectionTreeItem('Agentes Activos (SQLite)', vscode.TreeItemCollapsibleState.Expanded);
    agentsSection.iconPath = new vscode.ThemeIcon('organization');
    if (agents.length > 0) {
        agentsSection.children = agents.map(agent => {
            const item = new AgentTreeItem(agent.id, agent.sessionId, projectId);
            item.description = agent.status;
            item.tooltip = `Status: ${agent.status}\nFocus: ${agent.focus}\nSession: ${agent.sessionId}\nHeartbeat: ${agent.lastHeartbeat}`;
            if (agent.status.trim().toUpperCase() === 'ACTIVE') {
                 item.iconPath = new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('testing.iconPassed'));
            } else {
                 item.iconPath = new vscode.ThemeIcon('person');
            }
            return item;
        });
    } else {
        agentsSection.children = [new vscode.TreeItem('No hay agentes activos', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(agentsSection);

    // Pending Tasks
    const tasks = sqlite.getPendingTasks(projectId);
    const tasksSection = new SectionTreeItem('Tareas Pendientes', vscode.TreeItemCollapsibleState.Collapsed);
    tasksSection.iconPath = new vscode.ThemeIcon('checklist');
    if (tasks.length > 0) {
        tasksSection.children = tasks.map(task => {
            const item = new vscode.TreeItem(task.title, vscode.TreeItemCollapsibleState.None);
            item.description = task.status;
            item.tooltip = `ID: ${task.id}\nAssigned To: ${task.assignedTo}\nFrom: ${task.from}\nStatus: ${task.status}\nCreated: ${task.createdAt}`;
            item.iconPath = new vscode.ThemeIcon('tasklist');
            return item;
        });
    } else {
        tasksSection.children = [new vscode.TreeItem('No hay tareas pendientes', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(tasksSection);

    // External Requests
    const requests = sqlite.getExternalRequests(projectId);
    const requestsSection = new SectionTreeItem('Peticiones Externas', vscode.TreeItemCollapsibleState.Collapsed);
    requestsSection.iconPath = new vscode.ThemeIcon('broadcast');
    if (requests.length > 0) {
        requestsSection.children = requests.map(req => {
            return new ExternalRequestTreeItem(
                req.id,
                req.title,
                req.fromProject,
                req.context,
                req.status,
                req.receivedAt,
                projectId
            );
        });
    } else {
        requestsSection.children = [new vscode.TreeItem('No hay peticiones externas', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(requestsSection);

    // File Locks
    const locks = sqlite.getFileLocks(projectId);
    const locksSection = new SectionTreeItem('Bloqueos de Archivos', vscode.TreeItemCollapsibleState.Collapsed);
    locksSection.iconPath = new vscode.ThemeIcon('lock');
    if (locks.length > 0) {
        locksSection.children = locks.map(lock => {
             const item = new vscode.TreeItem(lock.pattern, vscode.TreeItemCollapsibleState.None);
             item.description = `by ${lock.claimedBy}`;
             item.tooltip = `Claimed by: ${lock.claimedBy}\nSince: ${lock.since}`;
             item.iconPath = new vscode.ThemeIcon('file');
             return item;
        });
    } else {
        locksSection.children = [new vscode.TreeItem('No hay bloqueos activos', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(locksSection);

    // Agent Messages
    const messages = sqlite.getMessages(projectId, 10);
    const msgsSection = new SectionTreeItem('Mensajes del Sistema', vscode.TreeItemCollapsibleState.Collapsed);
    msgsSection.iconPath = new vscode.ThemeIcon('comment-discussion');
    if (messages.length > 0) {
        msgsSection.children = messages.map(msg => {
             const item = new vscode.TreeItem(`${msg.timestamp ? `[${msg.timestamp.split('T')[1].split('.')[0]}] ` : ''}${msg.message}`, vscode.TreeItemCollapsibleState.None);
             item.iconPath = new vscode.ThemeIcon('comment');
             return item;
        });
    } else {
        msgsSection.children = [new vscode.TreeItem('No hay mensajes', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(msgsSection);

    return sections;
  }

  private parseBoardContent(content: string): vscode.TreeItem[] {
    const sections: vscode.TreeItem[] = [];

    // Parse Active Agents
    const agentsSection = new SectionTreeItem('Agentes Activos', vscode.TreeItemCollapsibleState.Expanded);
    agentsSection.iconPath = new vscode.ThemeIcon('organization');
    const agents = this.parseTable(content, 'Active Agents');
    
    if (agents.length > 0) {
        agentsSection.children = agents.map(row => {
            // New Format: | Agent ID | Status | Current Focus | Session ID | Last Heartbeat |
            // Old Format: | Agent ID | Status | Current Focus | Last Heartbeat |
            
            let id, status, focus, sessionId, heartbeat;
            
            if (row.length >= 5) {
                [id, status, focus, sessionId, heartbeat] = row;
            } else {
                [id, status, focus, heartbeat] = row;
                sessionId = undefined;
            }

            const item = new AgentTreeItem(
                id || 'Unknown', 
                sessionId === '-' ? undefined : sessionId, 
                this.selectedProject?.id || ''
            );
            
            item.description = status;
            item.tooltip = `Status: ${status}\nFocus: ${focus}\nSession: ${sessionId}\nHeartbeat: ${heartbeat}`;
            
            if (status?.trim().toUpperCase() === 'ACTIVE') {
                // Use a spinning icon for real-time activity feedback
                item.iconPath = new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('testing.iconPassed'));
            } else {
                item.iconPath = new vscode.ThemeIcon('person');
            }
            return item;
        });
    } else {
        agentsSection.children = [new vscode.TreeItem('No hay agentes activos', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(agentsSection);

    // Parse Pending Tasks
    const tasksSection = new SectionTreeItem('Tareas Pendientes', vscode.TreeItemCollapsibleState.Collapsed);
    tasksSection.iconPath = new vscode.ThemeIcon('checklist');
    const tasks = this.parseTable(content, 'Pending Tasks');
    if (tasks.length > 0) {
        tasksSection.children = tasks.map(row => {
            // | ID | Title | Assigned To | From | Status | Created At |
            const [id, title, assignedTo, from, status, createdAt] = row;
            const item = new vscode.TreeItem(title || 'Unknown Task', vscode.TreeItemCollapsibleState.None);
            item.description = status;
            item.tooltip = `ID: ${id}\nAssigned To: ${assignedTo}\nFrom: ${from}\nStatus: ${status}\nCreated: ${createdAt}`;
            item.iconPath = new vscode.ThemeIcon('tasklist');
            return item;
        });
    } else {
        tasksSection.children = [new vscode.TreeItem('No hay tareas pendientes', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(tasksSection);

    // Parse External Requests
    const requestsSection = new SectionTreeItem('Peticiones Externas', vscode.TreeItemCollapsibleState.Collapsed);
    requestsSection.iconPath = new vscode.ThemeIcon('broadcast');
    const requests = this.parseTable(content, 'External Requests');
    if (requests.length > 0) {
        requestsSection.children = requests.map(row => {
            // | ID | Title | From Project | Context | Status | Received At |
            const [id, title, fromProject, context, status, receivedAt] = row;
            return new ExternalRequestTreeItem(
                id || 'Unknown',
                title || 'Unknown Request',
                fromProject || 'Unknown',
                context || '',
                status || 'PENDING',
                receivedAt || '',
                this.selectedProject?.id || ''
            );
        });
    } else {
        requestsSection.children = [new vscode.TreeItem('No hay peticiones externas', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(requestsSection);

    // Parse File Locks
    const locksSection = new SectionTreeItem('Bloqueos de Archivos', vscode.TreeItemCollapsibleState.Collapsed);
    locksSection.iconPath = new vscode.ThemeIcon('lock');
    const locks = this.parseTable(content, 'File Locks');
    if (locks.length > 0) {
        locksSection.children = locks.map(row => {
            // | File Pattern | Claimed By | Since |
            const [pattern, claimedBy, since] = row;
            const item = new vscode.TreeItem(pattern || 'Unknown', vscode.TreeItemCollapsibleState.None);
            item.description = `by ${claimedBy}`;
            item.tooltip = `Claimed by: ${claimedBy}\nSince: ${since}`;
            item.iconPath = new vscode.ThemeIcon('file');
            return item;
        });
    } else {
        locksSection.children = [new vscode.TreeItem('No hay bloqueos activos', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(locksSection);

    // Parse Messages
    const msgsSection = new SectionTreeItem('Mensajes del Sistema', vscode.TreeItemCollapsibleState.Collapsed);
    msgsSection.iconPath = new vscode.ThemeIcon('comment-discussion');
    const messages = this.parseBulletPoints(content, 'Agent Messages');
    if (messages.length > 0) {
        let displayMessages = messages;
        if (messages.length > 10) {
            displayMessages = messages.slice(-10); // Show last 10
        }
        
        msgsSection.children = displayMessages.reverse().map(msg => {
            const item = new vscode.TreeItem(msg, vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon('comment');
            // Try to extract timestamp if present like [HH:MM:SS]
            return item;
        });
    } else {
        msgsSection.children = [new vscode.TreeItem('No hay mensajes', vscode.TreeItemCollapsibleState.None)];
    }
    sections.push(msgsSection);

    return sections;
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
                // Check if it's separator line |---|---|
                if (line.includes('---')) {
                    foundHeaderSep = true;
                    continue;
                }
                // Skip header row if we haven't seen separator yet
                if (!foundHeaderSep && !line.includes('---')) {
                     // We assume first row is header, so if we haven't seen separator, wait for it?
                     // Actually markdown tables usually have header then separator.
                     // Simple heuristic: if we haven't seen separator, this might be header.
                     // But simpler: just ignore the header row by looking for ---
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

  private parseBulletPoints(content: string, sectionTitle: string): string[] {
    const items: string[] = [];
    const lines = content.split('\n');
    let inSection = false;

    for (const line of lines) {
        if (line.trim().startsWith('## ' + sectionTitle)) {
            inSection = true;
            continue;
        }
        if (inSection && line.startsWith('## ')) {
            break;
        }
        if (inSection && (line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
            items.push(line.trim().substring(2));
        }
    }
    return items;
  }
}

class SectionTreeItem extends vscode.TreeItem {
    public children: vscode.TreeItem[] = [];
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}

class AgentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly agentId: string,
        public readonly sessionId: string | undefined,
        public readonly projectId: string
    ) {
        super(agentId, sessionId ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'active-agent';
    }
}

export class ExternalRequestTreeItem extends vscode.TreeItem {
    constructor(
        public readonly id: string,
        public readonly title: string,
        public readonly fromProject: string,
        public readonly context: string,
        public readonly status: string,
        public readonly receivedAt: string,
        public readonly projectId: string
    ) {
        super(title, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'external-request';
        this.description = `${status} (from ${fromProject})`;
        this.tooltip = `ID: ${id}\nFrom: ${fromProject}\nContext: ${context}\nStatus: ${status}\nReceived: ${receivedAt}`;
        this.iconPath = new vscode.ThemeIcon('remote-explorer');
    }
}
