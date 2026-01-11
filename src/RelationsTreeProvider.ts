/**
 * @fileoverview Relations Tree Provider
 * TreeDataProvider for displaying code relations in the sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  ProjectRelations,
  RelationNode,
  RelationNodeType,
  RelationsStatus,
  NODE_TYPE_ICONS,
  NODE_TYPE_LABELS,
} from './types/relations';
import * as relationsAnalyzerService from './services/relationsAnalyzerService';
import { getMemoryBankService, formatRelativeTime } from './services/memoryBankService';
import { ProjectInfo } from './types/memoryBank';

/**
 * Types of items in the tree
 */
type RelationsItemType = 'status' | 'group' | 'node' | 'action' | 'empty';

/**
 * Tree item for relations view
 */
export class RelationsTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly itemType: RelationsItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly relationNode?: RelationNode,
    public readonly nodeType?: RelationNodeType,
    public readonly projectId?: string,
    public readonly childNodes?: RelationNode[]
  ) {
    super(label, collapsibleState);
    this.setupItem();
  }

  private setupItem(): void {
    switch (this.itemType) {
      case 'status':
        this.setupStatusItem();
        break;
      case 'group':
        this.setupGroupItem();
        break;
      case 'node':
        this.setupNodeItem();
        break;
      case 'action':
        this.setupActionItem();
        break;
      case 'empty':
        this.setupEmptyItem();
        break;
    }
  }

  private setupStatusItem(): void {
    this.contextValue = 'relations-status';
  }

  private setupGroupItem(): void {
    if (this.nodeType) {
      this.iconPath = new vscode.ThemeIcon(NODE_TYPE_ICONS[this.nodeType] || 'symbol-folder');
      const count = this.childNodes?.length || 0;
      this.description = `${count} elemento${count !== 1 ? 's' : ''}`;
    }
    this.contextValue = 'relations-group';
  }

  private setupNodeItem(): void {
    if (!this.relationNode) return;

    this.iconPath = new vscode.ThemeIcon(NODE_TYPE_ICONS[this.relationNode.type] || 'symbol-file');
    
    // Description with function count
    const funcCount = this.relationNode.functions.length;
    this.description = `${funcCount} función${funcCount !== 1 ? 'es' : ''}`;

    // Rich tooltip
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${this.relationNode.name}**\n\n`);
    this.tooltip.appendMarkdown(`${this.relationNode.description}\n\n`);
    this.tooltip.appendMarkdown(`- Tipo: ${NODE_TYPE_LABELS[this.relationNode.type]}\n`);
    this.tooltip.appendMarkdown(`- Archivo: \`${path.basename(this.relationNode.filePath)}\`\n`);
    if (this.relationNode.functions.length > 0) {
      this.tooltip.appendMarkdown(`- Funciones: ${this.relationNode.functions.slice(0, 5).join(', ')}${this.relationNode.functions.length > 5 ? '...' : ''}\n`);
    }

    this.contextValue = 'relations-node';

    // Command to open the file
    this.command = {
      command: 'memorybank.relations.openFile',
      title: 'Open File',
      arguments: [this.relationNode.filePath]
    };
  }

  private setupActionItem(): void {
    this.contextValue = 'relations-action';
  }

  private setupEmptyItem(): void {
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'relations-empty';
  }
}

/**
 * Provider for relations tree view
 */
export class RelationsTreeProvider implements vscode.TreeDataProvider<RelationsTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<RelationsTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<RelationsTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<RelationsTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private logger: vscode.OutputChannel;
  private selectedProject: ProjectInfo | null = null;
  private relations: ProjectRelations | null = null;
  private status: RelationsStatus = 'none';
  private isAnalyzing: boolean = false;

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
   * Set the selected project and load its relations
   */
  async setSelectedProject(project: ProjectInfo | null): Promise<void> {
    this.selectedProject = project;
    
    if (project) {
      await this.loadProjectRelations(project.id);
    } else {
      this.relations = null;
      this.status = 'none';
    }
    
    this.refresh();
  }

  /**
   * Get the currently selected project
   */
  getSelectedProject(): ProjectInfo | null {
    return this.selectedProject;
  }

  /**
   * Load relations for a project
   */
  private async loadProjectRelations(projectId: string): Promise<void> {
    try {
      const result = await relationsAnalyzerService.getRelationsStatus(projectId);
      this.relations = result.relations;
      this.status = result.status;
      this.logger.appendLine(`Relations status for ${projectId}: ${this.status}`);
    } catch (error) {
      this.logger.appendLine(`Error loading relations: ${error}`);
      this.relations = null;
      this.status = 'none';
    }
  }

  /**
   * Start analysis for current project
   */
  async analyzeProject(useAI: boolean = true): Promise<void> {
    if (!this.selectedProject || this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.status = 'analyzing' as any; // Temporary status during analysis
    this.refresh();

    let lastPercent = 0;
    let lastPhase = '';

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Analizando relaciones de ${this.selectedProject.id}`,
        cancellable: false
      }, async (progress) => {
        this.relations = await relationsAnalyzerService.analyzeProject(
          this.selectedProject!.id,
          { useAI },
          (p) => {
            let message = '';
            let percent = 0;
            
            // Calculate percentage based on phase
            if (p.phase === 'parsing') {
              percent = Math.round((p.processedFiles / p.totalFiles) * 50); // 0-50%
              message = `Parseando: ${p.processedFiles}/${p.totalFiles} archivos`;
            } else if (p.phase === 'detecting') {
              percent = 50;
              message = `Detectando relaciones: ${p.processedNodes} nodos`;
            } else if (p.phase === 'enriching') {
              const totalNodes = p.totalNodes || p.processedNodes || 1;
              const enrichPercent = Math.round((p.processedNodes / totalNodes) * 100);
              percent = 50 + Math.round(enrichPercent * 0.45); // 50-95%
              message = `Enriqueciendo con IA: ${p.processedNodes}/${totalNodes} nodos`;
            } else if (p.phase === 'saving') {
              percent = 95;
              message = 'Guardando...';
            }
            
            // Log progress to output channel
            if (p.phase !== lastPhase || percent !== lastPercent) {
              this.logger.appendLine(`[Relations] ${message} (${percent}%)`);
              
              // Calculate increment from last update
              const increment = percent > lastPercent ? percent - lastPercent : 0;
              
              progress.report({
                message: message,
                increment: increment
              });
              
              lastPhase = p.phase;
              lastPercent = percent;
            }
          }
        );
        
        this.status = 'ready';
        this.logger.appendLine(`[Relations] Analysis complete: ${this.relations.nodes.length} nodes, ${this.relations.edges.length} edges`);
      });

      vscode.window.showInformationMessage(
        `Análisis completado: ${this.relations?.nodes.length || 0} nodos, ${this.relations?.edges.length || 0} relaciones`
      );
    } catch (error: any) {
      this.logger.appendLine(`Analysis error: ${error.message}`);
      this.status = 'error' as any;
      vscode.window.showErrorMessage(`Error en análisis: ${error.message}`);
    } finally {
      this.isAnalyzing = false;
      this.refresh();
    }
  }

  getTreeItem(element: RelationsTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: RelationsTreeItem): Promise<RelationsTreeItem[]> {
    // Top level
    if (!element) {
      return this.getRootItems();
    }

    // Group level - show nodes of that type
    if (element.itemType === 'group' && element.childNodes) {
      return element.childNodes
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(node => new RelationsTreeItem(
          node.name,
          'node',
          vscode.TreeItemCollapsibleState.None,
          node,
          undefined,
          this.selectedProject?.id
        ));
    }

    return [];
  }

  private getRootItems(): RelationsTreeItem[] {
    const items: RelationsTreeItem[] = [];

    // No project selected
    if (!this.selectedProject) {
      items.push(new RelationsTreeItem(
        'Selecciona un proyecto',
        'empty',
        vscode.TreeItemCollapsibleState.None
      ));
      items[0].description = 'desde Memory Bank';
      return items;
    }

    // Status item
    const statusItem = this.createStatusItem();
    items.push(statusItem);

    // If analyzing, show progress
    if (this.isAnalyzing) {
      const analyzingItem = new RelationsTreeItem(
        'Analizando...',
        'status',
        vscode.TreeItemCollapsibleState.None
      );
      analyzingItem.iconPath = new vscode.ThemeIcon('sync~spin');
      items.push(analyzingItem);
      return items;
    }

    // If no relations, show analyze button
    if (!this.relations || this.status === 'none') {
      const analyzeItem = new RelationsTreeItem(
        'Analizar Relaciones',
        'action',
        vscode.TreeItemCollapsibleState.None
      );
      analyzeItem.iconPath = new vscode.ThemeIcon('play');
      analyzeItem.command = {
        command: 'memorybank.relations.analyze',
        title: 'Analizar'
      };
      items.push(analyzeItem);
      return items;
    }

    // Show action to view flow
    const flowItem = new RelationsTreeItem(
      'Ver Dataflow Completo',
      'action',
      vscode.TreeItemCollapsibleState.None
    );
    flowItem.iconPath = new vscode.ThemeIcon('type-hierarchy');
    flowItem.command = {
      command: 'memorybank.relations.showFlow',
      title: 'Ver Dataflow'
    };
    items.push(flowItem);

    // Group nodes by type
    const nodesByType = new Map<RelationNodeType, RelationNode[]>();
    
    for (const node of this.relations.nodes) {
      if (!nodesByType.has(node.type)) {
        nodesByType.set(node.type, []);
      }
      nodesByType.get(node.type)!.push(node);
    }

    // Sort by count (most common first)
    const sortedTypes = Array.from(nodesByType.entries())
      .sort((a, b) => b[1].length - a[1].length);

    // Create group items
    for (const [type, nodes] of sortedTypes) {
      const groupItem = new RelationsTreeItem(
        NODE_TYPE_LABELS[type],
        'group',
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        type,
        this.selectedProject.id,
        nodes
      );
      items.push(groupItem);
    }

    return items;
  }

  private createStatusItem(): RelationsTreeItem {
    let label: string;
    let icon: string;
    let description: string;

    if (this.status === 'ready' && this.relations) {
      label = `${this.relations.nodes.length} nodos, ${this.relations.edges.length} relaciones`;
      icon = 'check';
      description = `Actualizado ${formatRelativeTime(this.relations.lastAnalyzed)}`;
    } else if (this.status === 'outdated') {
      label = 'Análisis desactualizado';
      icon = 'warning';
      description = 'El código ha cambiado';
    } else {
      label = 'Sin análisis';
      icon = 'circle-outline';
      description = '';
    }

    const item = new RelationsTreeItem(
      label,
      'status',
      vscode.TreeItemCollapsibleState.None
    );
    item.iconPath = new vscode.ThemeIcon(icon);
    item.description = description;

    // Add refresh command for outdated status
    if (this.status === 'outdated') {
      item.command = {
        command: 'memorybank.relations.analyze',
        title: 'Regenerar'
      };
    }

    return item;
  }
}
