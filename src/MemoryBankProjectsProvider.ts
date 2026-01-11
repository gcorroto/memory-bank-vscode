/**
 * @fileoverview Memory Bank Projects Provider
 * TreeDataProvider for displaying indexed projects in the Memory Bank
 */

import * as vscode from 'vscode';
import { getMemoryBankService, formatRelativeTime } from './services/memoryBankService';
import { ProjectInfo } from './types/memoryBank';

/**
 * Tree item representing a project in the Memory Bank
 */
export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly projectInfo: ProjectInfo,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(projectInfo.id, collapsibleState);
    
    // Set description with doc count and last updated time
    const timeAgo = formatRelativeTime(projectInfo.lastUpdated);
    this.description = `${projectInfo.docCount} docs, ${timeAgo}`;
    
    // Set tooltip with more details
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${projectInfo.id}**\n\n`);
    this.tooltip.appendMarkdown(`- Documentos: ${projectInfo.docCount}\n`);
    this.tooltip.appendMarkdown(`- Última actualización: ${timeAgo}\n`);
    this.tooltip.appendMarkdown(`- Ruta: ${projectInfo.docsPath}\n`);
    
    // Add token info if metadata available
    if (projectInfo.metadata) {
      let totalTokens = 0;
      for (const doc of Object.values(projectInfo.metadata)) {
        totalTokens += doc.outputTokens + doc.reasoningTokens;
      }
      this.tooltip.appendMarkdown(`- Tokens totales: ${totalTokens.toLocaleString()}\n`);
    }
    
    // Set icon
    this.iconPath = new vscode.ThemeIcon('project');
    
    // Set context value for menu contributions
    this.contextValue = 'memorybank-project';
    
    // Command to select this project
    this.command = {
      command: 'memorybank.selectProject',
      title: 'Select Project',
      arguments: [projectInfo]
    };
  }
}

/**
 * Tree item for when Memory Bank is not configured
 */
class NotConfiguredTreeItem extends vscode.TreeItem {
  constructor() {
    super('Memory Bank no configurado', vscode.TreeItemCollapsibleState.None);
    this.description = 'Haz clic para configurar';
    this.tooltip = 'El Memory Bank no está configurado o la ruta no existe. Haz clic para configurar la ruta.';
    this.iconPath = new vscode.ThemeIcon('warning');
    this.command = {
      command: 'memorybank.configure',
      title: 'Configure Memory Bank Path'
    };
  }
}

/**
 * Tree item for when no projects are found
 */
class NoProjectsTreeItem extends vscode.TreeItem {
  constructor() {
    super('No hay proyectos indexados', vscode.TreeItemCollapsibleState.None);
    this.description = 'Indexa un proyecto primero';
    this.tooltip = 'No se encontraron proyectos en el Memory Bank. Usa el MCP para indexar un proyecto.';
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

/**
 * Provider for Memory Bank projects tree view
 */
export class MemoryBankProjectsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = 
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;
  
  private selectedProject: ProjectInfo | null = null;
  private logger: vscode.OutputChannel;

  constructor(logger: vscode.OutputChannel) {
    this.logger = logger;
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    getMemoryBankService().clearCache();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get the currently selected project
   */
  getSelectedProject(): ProjectInfo | null {
    return this.selectedProject;
  }

  /**
   * Set the selected project
   */
  setSelectedProject(project: ProjectInfo | null): void {
    this.selectedProject = project;
    this.logger.appendLine(`Selected project: ${project?.id || 'none'}`);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // Top level - list all projects
    if (!element) {
      const service = getMemoryBankService();
      
      // Check if Memory Bank exists
      if (!service.memoryBankExists()) {
        return [new NotConfiguredTreeItem()];
      }

      try {
        const projects = await service.getProjects();
        
        if (projects.length === 0) {
          return [new NoProjectsTreeItem()];
        }

        // Create tree items for each project
        return projects.map(project => 
          new ProjectTreeItem(project, vscode.TreeItemCollapsibleState.None)
        );
      } catch (error) {
        this.logger.appendLine(`Error loading projects: ${error}`);
        return [new vscode.TreeItem('Error al cargar proyectos')];
      }
    }

    return [];
  }
}
