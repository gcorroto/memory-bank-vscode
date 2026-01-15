/**
 * @fileoverview Project Docs Provider
 * TreeDataProvider for displaying project documentation from Memory Bank
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { 
  getMemoryBankService, 
  formatRelativeTime,
  formatTokenCount 
} from './services/memoryBankService';
import { 
  ProjectInfo, 
  DocMetadata, 
  DOC_TYPE_LABELS, 
  KnownDocType,
  KNOWN_DOC_TYPES
} from './types/memoryBank';

/**
 * Tree item for a project document
 */
export class DocTreeItem extends vscode.TreeItem {
  constructor(
    public readonly docType: string,
    public readonly docPath: string,
    public readonly projectId: string,
    public readonly metadata?: DocMetadata
  ) {
    super(docType, vscode.TreeItemCollapsibleState.None);
    
    this.setupItem();
  }

  private setupItem(): void {
    // Get friendly label
    const friendlyLabel = DOC_TYPE_LABELS[this.docType as KnownDocType] || this.docType;
    this.label = friendlyLabel;
    
    // Set description with token count and time
    if (this.metadata) {
      const totalTokens = this.metadata.outputTokens + this.metadata.reasoningTokens;
      const timeAgo = formatRelativeTime(this.metadata.lastGenerated);
      this.description = `${formatTokenCount(totalTokens)} | ${timeAgo}`;
    } else {
      this.description = 'Sin metadata';
    }
    
    // Rich tooltip
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${friendlyLabel}**\n\n`);
    this.tooltip.appendMarkdown(`- Archivo: \`${this.docType}.md\`\n`);
    this.tooltip.appendMarkdown(`- Proyecto: ${this.projectId}\n`);
    
    if (this.metadata) {
      this.tooltip.appendMarkdown(`\n**Generación:**\n`);
      this.tooltip.appendMarkdown(`- Tokens de razonamiento: ${this.metadata.reasoningTokens.toLocaleString()}\n`);
      this.tooltip.appendMarkdown(`- Tokens de salida: ${this.metadata.outputTokens.toLocaleString()}\n`);
      this.tooltip.appendMarkdown(`- Última generación: ${formatRelativeTime(this.metadata.lastGenerated)}\n`);
      this.tooltip.appendMarkdown(`- Hash de entrada: \`${this.metadata.lastInputHash.substring(0, 16)}...\`\n`);
    }
    
    // Icon based on doc type
    this.iconPath = this.getDocIcon();
    
    this.contextValue = 'memorybank-doc';
    
    // Command to open the document
    this.command = {
      command: 'memorybank.openDoc',
      title: 'Open Document',
      arguments: [this.docPath]
    };
  }

  private getDocIcon(): vscode.ThemeIcon {
    // Different icons for different doc types
    const iconMap: Record<string, string> = {
      projectBrief: 'book',
      productContext: 'account',
      systemPatterns: 'symbol-structure',
      techContext: 'tools',
      activeContext: 'pulse',
      progress: 'tasklist',
      decisionLog: 'history',
      agentBoard: 'circuit-board'
    };
    
    const iconName = iconMap[this.docType] || 'markdown';
    return new vscode.ThemeIcon(iconName);
  }
}

/**
 * Info item showing project selection status
 */
class ProjectInfoItem extends vscode.TreeItem {
  constructor(projectInfo: ProjectInfo) {
    super(`Proyecto: ${projectInfo.id}`, vscode.TreeItemCollapsibleState.None);
    
    const timeAgo = formatRelativeTime(projectInfo.lastUpdated);
    this.description = `${projectInfo.docCount} docs | ${timeAgo}`;
    this.iconPath = new vscode.ThemeIcon('project');
    this.contextValue = 'memorybank-project-info';
  }
}

/**
 * Item shown when no project is selected
 */
class NoProjectSelectedItem extends vscode.TreeItem {
  constructor() {
    super('Selecciona un proyecto', vscode.TreeItemCollapsibleState.None);
    this.description = 'desde la vista de proyectos';
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'memorybank-no-selection';
  }
}

/**
 * Provider for project documentation tree view
 */
export class ProjectDocsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = 
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private logger: vscode.OutputChannel;
  private selectedProject: ProjectInfo | null = null;

  constructor(logger: vscode.OutputChannel) {
    this.logger = logger;
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Set the selected project and refresh
   */
  setSelectedProject(project: ProjectInfo | null): void {
    this.selectedProject = project;
    this.logger.appendLine(`ProjectDocsProvider: Selected project ${project?.id || 'none'}`);
    this.refresh();
  }

  /**
   * Get the currently selected project
   */
  getSelectedProject(): ProjectInfo | null {
    return this.selectedProject;
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // No element = top level
    if (!element) {
      // Check if a project is selected
      if (!this.selectedProject) {
        return [new NoProjectSelectedItem()];
      }

      const service = getMemoryBankService();
      const items: vscode.TreeItem[] = [];

      try {
        // Add project info header
        items.push(new ProjectInfoItem(this.selectedProject));

        // Get docs and metadata
        const docs = await service.getProjectDocs(this.selectedProject.id);
        const metadata = await service.getProjectDocsMetadata(this.selectedProject.id);

        if (docs.size === 0) {
          const emptyItem = new vscode.TreeItem('No hay documentos', vscode.TreeItemCollapsibleState.None);
          emptyItem.iconPath = new vscode.ThemeIcon('warning');
          items.push(emptyItem);
          return items;
        }

        // Add separator
        const separatorItem = new vscode.TreeItem('─────────────', vscode.TreeItemCollapsibleState.None);
        separatorItem.contextValue = 'separator';
        items.push(separatorItem);

        // Sort docs by known order, then alphabetically
        const sortedDocs = Array.from(docs.entries()).sort((a, b) => {
          const aIndex = KNOWN_DOC_TYPES.indexOf(a[0] as KnownDocType);
          const bIndex = KNOWN_DOC_TYPES.indexOf(b[0] as KnownDocType);
          
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a[0].localeCompare(b[0]);
        });

        // Create tree items for each doc
        for (const [docType, docPath] of sortedDocs) {
          const docMetadata = metadata?.[docType];
          const item = new DocTreeItem(
            docType,
            docPath,
            this.selectedProject.id,
            docMetadata
          );
          items.push(item);
        }

        return items;
      } catch (error) {
        this.logger.appendLine(`Error loading project docs: ${error}`);
        const errorItem = new vscode.TreeItem('Error al cargar documentos', vscode.TreeItemCollapsibleState.None);
        errorItem.iconPath = new vscode.ThemeIcon('error');
        return [errorItem];
      }
    }

    return [];
  }
}
