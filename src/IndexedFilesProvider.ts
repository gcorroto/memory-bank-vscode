/**
 * @fileoverview Indexed Files Provider
 * TreeDataProvider for displaying indexed files from Memory Bank in a hierarchical tree
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { 
  getMemoryBankService, 
  formatRelativeTime, 
  abbreviateHash,
  getFileIcon 
} from './services/memoryBankService';
import { FileEntry, IndexMetadata } from './types/memoryBank';

/**
 * Types of tree items
 */
type IndexedTreeItemType = 'root' | 'folder' | 'file' | 'stats' | 'empty';

/**
 * Node structure for hierarchical folder tree
 */
interface FolderNode {
  name: string;
  fullPath: string;
  children: Map<string, FolderNode>;  // subcarpetas
  files: Array<{ path: string; entry: FileEntry }>;  // archivos en esta carpeta
}

/**
 * Tree item for indexed files view
 */
export class IndexedFileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly itemType: IndexedTreeItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly filePath?: string,
    public readonly fileEntry?: FileEntry,
    public readonly folderNode?: FolderNode,
    public readonly fileCount?: number
  ) {
    super(label, collapsibleState);
    
    this.setupItem();
  }

  private setupItem(): void {
    switch (this.itemType) {
      case 'file':
        this.setupFileItem();
        break;
      case 'folder':
        this.setupFolderItem();
        break;
      case 'stats':
        this.setupStatsItem();
        break;
      case 'root':
        this.setupRootItem();
        break;
      case 'empty':
        this.setupEmptyItem();
        break;
    }
  }

  private setupFileItem(): void {
    if (!this.fileEntry || !this.filePath) return;
    
    const hashAbbrev = abbreviateHash(this.fileEntry.hash);
    const timeAgo = formatRelativeTime(this.fileEntry.lastIndexed);
    const chunks = this.fileEntry.chunkCount;
    
    this.description = `${hashAbbrev}... | ${chunks} chunk${chunks !== 1 ? 's' : ''} | ${timeAgo}`;
    
    // Rich tooltip
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${path.basename(this.filePath)}**\n\n`);
    this.tooltip.appendMarkdown(`- Ruta: \`${this.filePath}\`\n`);
    this.tooltip.appendMarkdown(`- Hash: \`${this.fileEntry.hash}\`\n`);
    this.tooltip.appendMarkdown(`- Chunks: ${chunks}\n`);
    this.tooltip.appendMarkdown(`- Indexado: ${timeAgo}\n`);
    
    // Get appropriate icon
    const iconName = getFileIcon(this.filePath);
    this.iconPath = new vscode.ThemeIcon(iconName === 'file' ? 'file-code' : iconName);
    
    this.contextValue = 'memorybank-indexed-file';
    
    // Command to open the file if it exists in workspace
    this.command = {
      command: 'memorybank.openIndexedFile',
      title: 'Open File',
      arguments: [this.filePath]
    };
  }

  private setupFolderItem(): void {
    this.iconPath = new vscode.ThemeIcon('folder');
    
    // Count total files in this folder and all subfolders
    const totalFiles = this.fileCount || 0;
    this.description = `${totalFiles} archivo${totalFiles !== 1 ? 's' : ''}`;
    
    this.contextValue = 'memorybank-indexed-folder';
  }

  private setupRootItem(): void {
    this.iconPath = new vscode.ThemeIcon('database');
    this.contextValue = 'memorybank-root';
  }

  private setupStatsItem(): void {
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'memorybank-stats';
  }

  private setupEmptyItem(): void {
    this.iconPath = new vscode.ThemeIcon('warning');
    this.contextValue = 'memorybank-empty';
  }
}

/**
 * Provider for indexed files tree view
 */
export class IndexedFilesProvider implements vscode.TreeDataProvider<IndexedFileTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<IndexedFileTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<IndexedFileTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IndexedFileTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private logger: vscode.OutputChannel;
  private indexMetadata: IndexMetadata | null = null;
  private rootNode: FolderNode | null = null;

  constructor(logger: vscode.OutputChannel) {
    this.logger = logger;
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    getMemoryBankService().clearCache();
    this.indexMetadata = null;
    this.rootNode = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IndexedFileTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: IndexedFileTreeItem): Promise<IndexedFileTreeItem[]> {
    const service = getMemoryBankService();

    // Top level - show stats and root projects
    if (!element) {
      if (!service.memoryBankExists()) {
        return [new IndexedFileTreeItem(
          'Memory Bank no encontrado',
          'empty',
          vscode.TreeItemCollapsibleState.None
        )];
      }

      try {
        // Load index metadata
        this.indexMetadata = await service.loadIndexMetadata(true);
        
        if (!this.indexMetadata || Object.keys(this.indexMetadata.files).length === 0) {
          return [new IndexedFileTreeItem(
            'No hay archivos indexados',
            'empty',
            vscode.TreeItemCollapsibleState.None
          )];
        }

        // Build hierarchical folder tree
        this.buildHierarchicalTree();

        // Create root items
        const items: IndexedFileTreeItem[] = [];

        // Add stats item
        const stats = await service.getIndexStats();
        const statsItem = new IndexedFileTreeItem(
          `${stats.totalFiles} archivos, ${stats.totalChunks} chunks`,
          'stats',
          vscode.TreeItemCollapsibleState.None
        );
        statsItem.description = `Última indexación: ${formatRelativeTime(stats.lastIndexed)}`;
        items.push(statsItem);

        // Add root folder children (top-level project folders)
        if (this.rootNode) {
          const sortedChildren = Array.from(this.rootNode.children.entries())
            .sort((a, b) => a[0].localeCompare(b[0]));
          
          for (const [name, node] of sortedChildren) {
            const fileCount = this.countFilesInNode(node);
            const item = new IndexedFileTreeItem(
              name,
              'folder',
              vscode.TreeItemCollapsibleState.Collapsed,
              node.fullPath,
              undefined,
              node,
              fileCount
            );
            items.push(item);
          }

          // Add root-level files if any
          if (this.rootNode.files.length > 0) {
            const sortedFiles = [...this.rootNode.files].sort((a, b) => 
              path.basename(a.path).localeCompare(path.basename(b.path))
            );
            
            for (const file of sortedFiles) {
              const item = new IndexedFileTreeItem(
                path.basename(file.path),
                'file',
                vscode.TreeItemCollapsibleState.None,
                file.path,
                file.entry
              );
              items.push(item);
            }
          }
        }

        return items;
      } catch (error) {
        this.logger.appendLine(`Error loading indexed files: ${error}`);
        return [new IndexedFileTreeItem(
          'Error al cargar archivos',
          'empty',
          vscode.TreeItemCollapsibleState.None
        )];
      }
    }

    // Folder level - show subfolders and files
    if (element.itemType === 'folder' && element.folderNode) {
      const items: IndexedFileTreeItem[] = [];
      const node = element.folderNode;
      
      // Add subfolders first, sorted alphabetically
      const sortedChildren = Array.from(node.children.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      
      for (const [name, childNode] of sortedChildren) {
        const fileCount = this.countFilesInNode(childNode);
        const item = new IndexedFileTreeItem(
          name,
          'folder',
          vscode.TreeItemCollapsibleState.Collapsed,
          childNode.fullPath,
          undefined,
          childNode,
          fileCount
        );
        items.push(item);
      }

      // Add files in this folder, sorted alphabetically
      const sortedFiles = [...node.files].sort((a, b) => 
        path.basename(a.path).localeCompare(path.basename(b.path))
      );
      
      for (const file of sortedFiles) {
        const item = new IndexedFileTreeItem(
          path.basename(file.path),
          'file',
          vscode.TreeItemCollapsibleState.None,
          file.path,
          file.entry
        );
        items.push(item);
      }

      return items;
    }

    return [];
  }

  /**
   * Build hierarchical folder tree from index metadata
   */
  private buildHierarchicalTree(): void {
    this.rootNode = {
      name: '',
      fullPath: '',
      children: new Map(),
      files: []
    };
    
    if (!this.indexMetadata) return;

    for (const [filePath, entry] of Object.entries(this.indexMetadata.files)) {
      // Normalize and clean path
      const normalizedPath = filePath.replace(/\\/g, '/');
      
      // Remove leading ../.. and get clean path parts
      const cleanPath = normalizedPath.replace(/^(\.\.\/)+/, '');
      const parts = cleanPath.split('/').filter(p => p && p !== '.' && p !== '..');
      
      if (parts.length === 0) continue;

      // Navigate/create tree structure
      let currentNode = this.rootNode;
      
      // Process all parts except the last one (which is the filename)
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        
        if (!currentNode.children.has(folderName)) {
          const newNode: FolderNode = {
            name: folderName,
            fullPath: parts.slice(0, i + 1).join('/'),
            children: new Map(),
            files: []
          };
          currentNode.children.set(folderName, newNode);
        }
        
        currentNode = currentNode.children.get(folderName)!;
      }

      // Add the file to the current folder
      currentNode.files.push({
        path: filePath,  // Keep original path for opening
        entry: entry
      });
    }

    // Simplify tree by collapsing single-child folders
    this.simplifyTree(this.rootNode);
  }

  /**
   * Simplify tree by merging single-child folders
   */
  private simplifyTree(node: FolderNode): void {
    // First, recursively simplify children
    for (const child of node.children.values()) {
      this.simplifyTree(child);
    }

    // Then, merge single-child folders (only if no files in parent)
    if (node.children.size === 1 && node.files.length === 0 && node.name !== '') {
      const [childName, childNode] = node.children.entries().next().value;
      
      // Merge: update name to include child name
      node.name = `${node.name}/${childName}`;
      node.fullPath = childNode.fullPath;
      node.children = childNode.children;
      node.files = childNode.files;
      
      // Recursively simplify again in case of chain
      this.simplifyTree(node);
    }
  }

  /**
   * Count total files in a node and all its descendants
   */
  private countFilesInNode(node: FolderNode): number {
    let count = node.files.length;
    
    for (const child of node.children.values()) {
      count += this.countFilesInNode(child);
    }
    
    return count;
  }
}
