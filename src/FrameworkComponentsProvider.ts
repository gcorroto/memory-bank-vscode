/**
 * @fileoverview Framework Components Provider
 * TreeDataProvider for displaying framework components in the sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  FrameworkType,
  FrameworkComponentType,
  FrameworkComponent,
  FrameworkAnalysis,
  EndpointInfo,
  FrameworkAnalysisStatus,
  FRAMEWORK_INFO,
  COMPONENT_TYPE_INFO,
} from './types/framework';
import * as frameworkDetectorService from './services/frameworkDetectorService';
import { getMemoryBankService, formatRelativeTime } from './services/memoryBankService';
import { ProjectInfo } from './types/memoryBank';

/**
 * Types of items in the tree
 */
type FrameworkItemType = 
  | 'status'           // Status/info item
  | 'framework'        // Framework header
  | 'group'            // Component type group (Controllers, Services, etc.)
  | 'component'        // Individual component
  | 'endpoint-group'   // Endpoint mappings group
  | 'endpoint'         // Individual endpoint
  | 'action'           // Action button
  | 'empty';           // Empty state

/**
 * Tree item for framework components view
 */
export class FrameworkTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly itemType: FrameworkItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly framework?: FrameworkType,
    public readonly componentType?: FrameworkComponentType,
    public readonly component?: FrameworkComponent,
    public readonly endpoint?: EndpointInfo,
    public readonly childComponents?: FrameworkComponent[],
    public readonly childEndpoints?: EndpointInfo[]
  ) {
    super(label, collapsibleState);
    this.setupItem();
  }

  private setupItem(): void {
    switch (this.itemType) {
      case 'status':
        this.setupStatusItem();
        break;
      case 'framework':
        this.setupFrameworkItem();
        break;
      case 'group':
        this.setupGroupItem();
        break;
      case 'component':
        this.setupComponentItem();
        break;
      case 'endpoint-group':
        this.setupEndpointGroupItem();
        break;
      case 'endpoint':
        this.setupEndpointItem();
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
    this.contextValue = 'framework-status';
  }

  private setupFrameworkItem(): void {
    if (this.framework) {
      const info = FRAMEWORK_INFO[this.framework];
      // Use theme icon, framework-specific icons will be added later
      this.iconPath = new vscode.ThemeIcon('package');
      this.description = info.name;
    }
    this.contextValue = 'framework-header';
  }

  private setupGroupItem(): void {
    if (this.componentType) {
      const info = COMPONENT_TYPE_INFO[this.componentType];
      this.iconPath = new vscode.ThemeIcon(info.icon);
      const count = this.childComponents?.length || 0;
      this.description = `${count}`;
      this.tooltip = new vscode.MarkdownString(`**${info.labelPlural}**\n\n${info.description}\n\n${count} elemento${count !== 1 ? 's' : ''}`);
    }
    this.contextValue = 'framework-group';
  }

  private setupComponentItem(): void {
    if (!this.component) return;

    const typeInfo = COMPONENT_TYPE_INFO[this.component.type];
    this.iconPath = new vscode.ThemeIcon(typeInfo.icon);
    
    // Description shows the file
    this.description = path.basename(this.component.filePath);

    // Rich tooltip
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${this.component.name}**\n\n`);
    this.tooltip.appendMarkdown(`- Tipo: ${typeInfo.label}\n`);
    this.tooltip.appendMarkdown(`- Framework: ${FRAMEWORK_INFO[this.component.framework].name}\n`);
    this.tooltip.appendMarkdown(`- Archivo: \`${this.component.filePath}\`\n`);
    this.tooltip.appendMarkdown(`- Línea: ${this.component.startLine}\n`);
    
    if (this.component.metadata?.decorators) {
      this.tooltip.appendMarkdown(`- Decoradores: ${this.component.metadata.decorators.join(', ')}\n`);
    }
    if (this.component.metadata?.basePath) {
      this.tooltip.appendMarkdown(`- Base Path: \`${this.component.metadata.basePath}\`\n`);
    }

    this.contextValue = 'framework-component';

    // Command to open the file
    this.command = {
      command: 'memorybank.frameworks.openFile',
      title: 'Open File',
      arguments: [this.component.filePath, this.component.startLine]
    };
  }

  private setupEndpointGroupItem(): void {
    this.iconPath = new vscode.ThemeIcon('link');
    const count = this.childEndpoints?.length || 0;
    this.description = `${count}`;
    this.tooltip = `${count} endpoint${count !== 1 ? 's' : ''} detectados`;
    this.contextValue = 'framework-endpoint-group';
  }

  private setupEndpointItem(): void {
    if (!this.endpoint) return;

    // Color-coded icon based on HTTP method
    const methodIcons: Record<string, string> = {
      'GET': 'arrow-down',
      'POST': 'arrow-up',
      'PUT': 'arrow-swap',
      'DELETE': 'trash',
      'PATCH': 'edit',
    };

    this.iconPath = new vscode.ThemeIcon(methodIcons[this.endpoint.method] || 'link');
    this.description = this.endpoint.handlerName;

    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${this.endpoint.method}** \`${this.endpoint.path}\`\n\n`);
    this.tooltip.appendMarkdown(`- Handler: \`${this.endpoint.handlerName}\`\n`);
    this.tooltip.appendMarkdown(`- Archivo: \`${this.endpoint.filePath}\`\n`);
    this.tooltip.appendMarkdown(`- Línea: ${this.endpoint.line}\n`);

    this.contextValue = 'framework-endpoint';

    // Command to open the file
    this.command = {
      command: 'memorybank.frameworks.openFile',
      title: 'Open File',
      arguments: [this.endpoint.filePath, this.endpoint.line]
    };
  }

  private setupActionItem(): void {
    this.contextValue = 'framework-action';
  }

  private setupEmptyItem(): void {
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'framework-empty';
  }
}

/**
 * Provider for framework components tree view
 */
export class FrameworkComponentsProvider implements vscode.TreeDataProvider<FrameworkTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FrameworkTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<FrameworkTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<FrameworkTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private logger: vscode.OutputChannel;
  private selectedProject: ProjectInfo | null = null;
  private analysis: FrameworkAnalysis | null = null;
  private status: FrameworkAnalysisStatus = 'none';
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
   * Set the selected project and analyze its frameworks
   */
  async setSelectedProject(project: ProjectInfo | null): Promise<void> {
    this.selectedProject = project;
    
    if (project) {
      await this.loadFrameworkAnalysis(project.id);
    } else {
      this.analysis = null;
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
   * Get the current analysis
   */
  getAnalysis(): FrameworkAnalysis | null {
    return this.analysis;
  }

  /**
   * Load framework analysis for a project
   */
  private async loadFrameworkAnalysis(projectId: string): Promise<void> {
    this.isAnalyzing = true;
    this.status = 'analyzing';
    this.refresh();

    try {
      this.analysis = await frameworkDetectorService.getFrameworkAnalysis(projectId);
      
      if (this.analysis && this.analysis.frameworks.length > 0) {
        this.status = 'ready';
        this.logger.appendLine(`[Frameworks] Loaded analysis for ${projectId}: ${this.analysis.frameworks.join(', ')}`);
      } else {
        this.status = 'no-framework';
        this.logger.appendLine(`[Frameworks] No frameworks detected for ${projectId}`);
      }
    } catch (error) {
      this.logger.appendLine(`[Frameworks] Error loading analysis: ${error}`);
      this.analysis = null;
      this.status = 'error';
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Re-analyze the current project
   */
  async reanalyze(): Promise<void> {
    if (!this.selectedProject) return;

    frameworkDetectorService.clearAnalysisCache(this.selectedProject.id);
    await this.loadFrameworkAnalysis(this.selectedProject.id);
    this.refresh();
  }

  getTreeItem(element: FrameworkTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FrameworkTreeItem): Promise<FrameworkTreeItem[]> {
    // Top level
    if (!element) {
      return this.getRootItems();
    }

    // Framework level - show component type groups
    if (element.itemType === 'framework' && element.framework) {
      return this.getFrameworkChildren(element.framework);
    }

    // Group level - show components of that type
    if (element.itemType === 'group' && element.childComponents) {
      return element.childComponents
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(comp => new FrameworkTreeItem(
          comp.name,
          'component',
          vscode.TreeItemCollapsibleState.None,
          comp.framework,
          comp.type,
          comp
        ));
    }

    // Endpoint group level - show endpoints
    if (element.itemType === 'endpoint-group' && element.childEndpoints) {
      return element.childEndpoints
        .sort((a, b) => {
          // Sort by path, then by method
          const pathCompare = a.path.localeCompare(b.path);
          if (pathCompare !== 0) return pathCompare;
          return a.method.localeCompare(b.method);
        })
        .map(endpoint => new FrameworkTreeItem(
          `${endpoint.method} ${endpoint.path}`,
          'endpoint',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          undefined,
          undefined,
          endpoint
        ));
    }

    return [];
  }

  private getRootItems(): FrameworkTreeItem[] {
    const items: FrameworkTreeItem[] = [];

    // No project selected
    if (!this.selectedProject) {
      items.push(new FrameworkTreeItem(
        'Selecciona un proyecto',
        'empty',
        vscode.TreeItemCollapsibleState.None
      ));
      items[0].description = 'desde Memory Bank';
      return items;
    }

    // Analyzing
    if (this.isAnalyzing) {
      const analyzingItem = new FrameworkTreeItem(
        'Analizando frameworks...',
        'status',
        vscode.TreeItemCollapsibleState.None
      );
      analyzingItem.iconPath = new vscode.ThemeIcon('sync~spin');
      items.push(analyzingItem);
      return items;
    }

    // Error state
    if (this.status === 'error') {
      const errorItem = new FrameworkTreeItem(
        'Error al analizar',
        'status',
        vscode.TreeItemCollapsibleState.None
      );
      errorItem.iconPath = new vscode.ThemeIcon('error');
      items.push(errorItem);
      
      const retryItem = new FrameworkTreeItem(
        'Reintentar análisis',
        'action',
        vscode.TreeItemCollapsibleState.None
      );
      retryItem.iconPath = new vscode.ThemeIcon('refresh');
      retryItem.command = {
        command: 'memorybank.frameworks.refresh',
        title: 'Refresh'
      };
      items.push(retryItem);
      return items;
    }

    // No frameworks detected
    if (this.status === 'no-framework' || !this.analysis || this.analysis.frameworks.length === 0) {
      const noFrameworkItem = new FrameworkTreeItem(
        'No se detectaron frameworks',
        'empty',
        vscode.TreeItemCollapsibleState.None
      );
      noFrameworkItem.description = 'en este proyecto';
      items.push(noFrameworkItem);
      return items;
    }

    // Show status with component count
    const totalComponents = this.analysis.components.length;
    const totalEndpoints = this.analysis.endpoints.length;
    
    const statusItem = new FrameworkTreeItem(
      `${totalComponents} componentes, ${totalEndpoints} endpoints`,
      'status',
      vscode.TreeItemCollapsibleState.None
    );
    statusItem.iconPath = new vscode.ThemeIcon('check');
    statusItem.description = formatRelativeTime(this.analysis.analyzedAt);
    items.push(statusItem);

    // Add search action
    const searchItem = new FrameworkTreeItem(
      'Buscar componente...',
      'action',
      vscode.TreeItemCollapsibleState.None
    );
    searchItem.iconPath = new vscode.ThemeIcon('search');
    searchItem.command = {
      command: 'memorybank.frameworks.search',
      title: 'Search'
    };
    items.push(searchItem);

    // Add framework headers
    for (const framework of this.analysis.frameworks) {
      const frameworkInfo = FRAMEWORK_INFO[framework];
      const frameworkComponents = this.analysis.components.filter(c => c.framework === framework);
      
      const frameworkItem = new FrameworkTreeItem(
        frameworkInfo.name,
        'framework',
        vscode.TreeItemCollapsibleState.Expanded,
        framework
      );
      frameworkItem.description = `${frameworkComponents.length} componentes`;
      items.push(frameworkItem);
    }

    return items;
  }

  private getFrameworkChildren(framework: FrameworkType): FrameworkTreeItem[] {
    if (!this.analysis) return [];

    const items: FrameworkTreeItem[] = [];
    const frameworkComponents = this.analysis.components.filter(c => c.framework === framework);
    const frameworkEndpoints = this.analysis.endpoints.filter(e => {
      // Find endpoints that belong to controllers of this framework
      const controller = frameworkComponents.find(c => 
        c.filePath === e.filePath && 
        (c.type === 'controller' || c.type === 'view')
      );
      return controller !== undefined;
    });

    // Group by component type
    const byType = new Map<FrameworkComponentType, FrameworkComponent[]>();
    for (const comp of frameworkComponents) {
      if (!byType.has(comp.type)) {
        byType.set(comp.type, []);
      }
      byType.get(comp.type)!.push(comp);
    }

    // Sort groups by count (most first)
    const sortedTypes = Array.from(byType.entries())
      .sort((a, b) => b[1].length - a[1].length);

    // Create group items
    for (const [type, components] of sortedTypes) {
      const typeInfo = COMPONENT_TYPE_INFO[type];
      const groupItem = new FrameworkTreeItem(
        typeInfo.labelPlural,
        'group',
        vscode.TreeItemCollapsibleState.Collapsed,
        framework,
        type,
        undefined,
        undefined,
        components
      );
      items.push(groupItem);
    }

    // Add endpoints group if any
    if (frameworkEndpoints.length > 0) {
      const endpointGroup = new FrameworkTreeItem(
        'Endpoint Mappings',
        'endpoint-group',
        vscode.TreeItemCollapsibleState.Collapsed,
        framework,
        undefined,
        undefined,
        undefined,
        undefined,
        frameworkEndpoints
      );
      items.push(endpointGroup);
    }

    return items;
  }

  /**
   * Show quick pick search for all components
   */
  async showSearchQuickPick(): Promise<void> {
    if (!this.analysis || this.analysis.components.length === 0) {
      vscode.window.showInformationMessage('No hay componentes para buscar');
      return;
    }

    const items: vscode.QuickPickItem[] = [];

    // Add components
    for (const comp of this.analysis.components) {
      const typeInfo = COMPONENT_TYPE_INFO[comp.type];
      const frameworkInfo = FRAMEWORK_INFO[comp.framework];
      
      items.push({
        label: `$(${typeInfo.icon}) ${comp.name}`,
        description: `${typeInfo.label} · ${frameworkInfo.name}`,
        detail: comp.filePath,
        // Store data for selection
        // @ts-ignore - custom property
        component: comp,
      });
    }

    // Add endpoints
    for (const endpoint of this.analysis.endpoints) {
      const methodIcons: Record<string, string> = {
        'GET': 'arrow-down',
        'POST': 'arrow-up',
        'PUT': 'arrow-swap',
        'DELETE': 'trash',
        'PATCH': 'edit',
      };
      
      items.push({
        label: `$(${methodIcons[endpoint.method] || 'link'}) ${endpoint.method} ${endpoint.path}`,
        description: `Endpoint · ${endpoint.handlerName}`,
        detail: endpoint.filePath,
        // @ts-ignore - custom property
        endpoint: endpoint,
      });
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Buscar componente o endpoint...',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      // @ts-ignore
      if (selected.component) {
        // @ts-ignore
        const comp = selected.component as FrameworkComponent;
        await this.openFile(comp.filePath, comp.startLine);
      // @ts-ignore
      } else if (selected.endpoint) {
        // @ts-ignore
        const endpoint = selected.endpoint as EndpointInfo;
        await this.openFile(endpoint.filePath, endpoint.line);
      }
    }
  }

  /**
   * Open a file at a specific line
   */
  async openFile(filePath: string, line: number = 1): Promise<void> {
    try {
      // Resolve the file path
      const mbService = getMemoryBankService();
      const mbPath = mbService.getMemoryBankPath();
      
      let absolutePath = filePath;
      
      // If relative path, try to resolve it
      if (!path.isAbsolute(filePath) && mbPath) {
        // Try relative to memory bank path
        const fromMB = path.resolve(mbPath, filePath);
        if (require('fs').existsSync(fromMB)) {
          absolutePath = fromMB;
        }
      }

      const uri = vscode.Uri.file(absolutePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      
      // Go to line
      const position = new vscode.Position(Math.max(0, line - 1), 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    } catch (error) {
      this.logger.appendLine(`[Frameworks] Error opening file ${filePath}: ${error}`);
      vscode.window.showErrorMessage(`No se pudo abrir el archivo: ${filePath}`);
    }
  }
}
