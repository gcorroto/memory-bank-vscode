import * as vscode from 'vscode';
import * as configManager from '../utils/configManager';

export function registerCommands(context: vscode.ExtensionContext): void {
  // Register configuration command
  let disposable = vscode.commands.registerCommand('grec0ai.openai.configure', async () => {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Ingrese su clave de API de OpenAI',
      password: true
    });
    
    if (apiKey) {
      await configManager.setConfig('openai.apiKey', apiKey);
      vscode.window.showInformationMessage('Clave de API de OpenAI configurada correctamente');
    }
  });
  context.subscriptions.push(disposable);
  
  // Register Vectra indexing command
  disposable = vscode.commands.registerCommand('grec0ai.vectra.indexProject', async () => {
    vscode.window.showInformationMessage('Indexing project for RAG...');
    // Implementación simulada
  });
  context.subscriptions.push(disposable);
  
  // Register MacGyver command
  disposable = vscode.commands.registerCommand('grec0ai.ask.macgyver', async () => {
    const question = await vscode.window.showInputBox({
      prompt: 'Pregunta para MacGyver'
    });
    
    if (question) {
      vscode.window.showInformationMessage(`Pregunta recibida: ${question}`);
    }
  });
  context.subscriptions.push(disposable);
} 