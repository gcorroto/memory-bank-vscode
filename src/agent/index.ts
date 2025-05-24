import * as vscode from 'vscode';

export async function createAgent(name: string, context: vscode.ExtensionContext): Promise<any> {
  // En una implementación real, aquí crearíamos un agente de IA
  console.log(`Creating agent: ${name}`);
  return {
    name,
    executeTask: async (taskName: string, params: any) => {
      vscode.window.showInformationMessage(`Executing task: ${taskName}`);
      return Promise.resolve(`Result of ${taskName}`);
    }
  };
}

export function createCommandWrapper(agent: any, taskName: string): (...args: any[]) => Promise<any> {
  return async (...args: any[]) => {
    try {
      vscode.window.showInformationMessage(`Running task: ${taskName}`);
      return await agent.executeTask(taskName, ...args);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error in task ${taskName}: ${error.message}`);
      throw error;
    }
  };
} 