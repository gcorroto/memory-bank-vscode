import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class FileTreeService {
  private workspaceRoot: string | undefined;
  
  constructor() {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      this.workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
  }
  
  public createTreeView(): any {
    // Implementación simulada
    return {};
  }
  
  public getFiles(dirPath: string): string[] {
    if (!this.workspaceRoot) {
      return [];
    }
    
    const fullPath = path.join(this.workspaceRoot, dirPath);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    
    try {
      return fs.readdirSync(fullPath)
        .map(file => path.join(dirPath, file))
        .filter(file => !fs.statSync(path.join(this.workspaceRoot!, file)).isDirectory());
    } catch (error) {
      console.error('Error reading directory:', error);
      return [];
    }
  }
} 