import * as vscode from 'vscode';

export function isConfigComplete(): boolean {
  const config = vscode.workspace.getConfiguration('grec0ai');
  const apiKey = config.get('openai.apiKey', '');
  return apiKey !== '';
}

export function getConfig(key: string, defaultValue: any = undefined): any {
  const config = vscode.workspace.getConfiguration('grec0ai');
  return config.get(key, defaultValue);
}

export function setConfig(key: string, value: any): Thenable<void> {
  const config = vscode.workspace.getConfiguration('grec0ai');
  return config.update(key, value, vscode.ConfigurationTarget.Global);
} 