import * as vscode from 'vscode';
import { CoverageDefectsProvider } from './FileTreeProvider';

export class CoverageSummaryProvider implements vscode.TreeDataProvider<any> {
  private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
  readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
  private fileTreeProvider: CoverageDefectsProvider;
  private logger: vscode.OutputChannel;

  constructor(fileTreeProvider: CoverageDefectsProvider, logger: vscode.OutputChannel) {
    this.fileTreeProvider = fileTreeProvider;
    this.logger = logger;
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
} 