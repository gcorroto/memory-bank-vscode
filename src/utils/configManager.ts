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

/**
 * Obtiene el modelo de OpenAI configurado o devuelve el modelo por defecto
 * @returns Nombre del modelo de OpenAI a utilizar
 */
export function getOpenAIModel(): string {
  const config = vscode.workspace.getConfiguration('grec0ai');
  return config.get('openai.model', 'gpt-4') as string;
} 