import * as vscode from 'vscode';

export class CoverageDetailsProvider implements vscode.TreeDataProvider<any> {
  private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
  readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
  private details: string = '';

  constructor() {
    // Initialize
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: any): vscode.TreeItem {
    return element;
  }

  getChildren(element?: any): Thenable<any[]> {
    return Promise.resolve([]);
  }

  /**
   * Actualiza los detalles de cobertura y refresca la vista
   * @param details - Detalles de cobertura en formato string (puede contener markdown)
   */
  updateDetails(details: string): void {
    this.details = details;
    this.refresh();
  }

  /**
   * Obtiene los detalles de cobertura actuales
   * @returns Detalles de cobertura
   */
  getDetails(): string {
    return this.details;
  }
} 