import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CommandRegistration } from '../types';
import { createCommandRegistration } from '../utils';
import { getGlobalAgent } from '../../extension';
import { getMemoryBankService } from '../../services/memoryBankService';
import { ExternalRequestTreeItem } from '../../ActiveAgentsProvider';

export const agentCommands: CommandRegistration[] = [
    createCommandRegistration('memorybank.createAgent', async () => {
        try {
            const agent = await getGlobalAgent(true);
            vscode.window.showInformationMessage('Agent created successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create agent: ${error}`);
        }
    }),

    createCommandRegistration('memorybank.getAgent', () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
        }
    }),

    createCommandRegistration('memorybank.ask', async () => {
        const agent = getGlobalAgent(true);
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
            return;
        }

        const question = await vscode.window.showInputBox({
            prompt: 'What would you like to ask the agent?',
            placeHolder: 'Enter your question here'
        });

        if (question) {
            try {
                const result = await agent.handleUserInput(question);
                if (result.success) {
                    vscode.window.showInformationMessage('Instructions processed successfully.');
                } else {
                    vscode.window.showErrorMessage(`Error: ${result.error || 'Unknown error'}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to get response: ${error}`);
            }
        }
    }),

    createCommandRegistration('memorybank.agent.showLogs', () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
            return;
        }
        agent.showLogsView();
    }),

    createCommandRegistration('memorybank.agent.generateTest', async () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
            return;
        }
        
        await vscode.commands.executeCommand('memorybank.automaticTest');
    }),

    createCommandRegistration('memorybank.agent.analyzeCode', async () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
            return;
        }
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        
        const document = editor.document;
        const selection = editor.selection;
        const selectedText = selection.isEmpty ? 
            document.getText() : document.getText(selection);
        
        await agent.handleUserInput(`Analyze this code: ${selectedText}`);
    }),

    createCommandRegistration('memorybank.agent.fixError', async () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
            return;
        }
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        
        const document = editor.document;
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        
        if (diagnostics.length === 0) {
            vscode.window.showInformationMessage('No errors found in the current file');
            return;
        }
        
        const firstError = diagnostics[0];
        const errorMessage = firstError.message;
        const range = firstError.range;
        const lineText = document.lineAt(range.start.line).text;
        
        await agent.handleUserInput(`Fix this error: "${errorMessage}" in code: "${lineText}"`);
    }),

    createCommandRegistration('memorybank.agent.explain', async () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
            return;
        }
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        
        const document = editor.document;
        const selection = editor.selection;
        const selectedText = selection.isEmpty ? 
            document.getText() : document.getText(selection);
        
        await agent.handleUserInput(`Explain this code: ${selectedText}`);
    }),

    createCommandRegistration('memorybank.agent.testReasoningModel', async () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
            return;
        }
        
        const userInput = await vscode.window.showInputBox({
            prompt: 'Enter a question to test the reasoning model',
            placeHolder: 'Example: Find files with .ts extension and analyze their content'
        });
        
        if (!userInput) {
            return;
        }
        
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.text = "$(sync~spin) Processing with reasoning model...";
        statusBarItem.show();
        
        try {
            const result = await agent.demoReasoningModel(userInput);
            
            const panel = vscode.window.createWebviewPanel(
                'reasoningModelResult',
                'Resultado del Modelo de Razonamiento',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );
            
            const conversation = result.conversation || [];
            let conversationHtml = '';
            
            conversation.forEach((msg) => {
                const role = msg.role;
                const content = msg.content || 'Sin contenido';
                
                let roleClass = '';
                let roleLabel = '';
                
                switch (role) {
                    case 'developer':
                        roleClass = 'developer-message';
                        roleLabel = 'Sistema';
                        break;
                    case 'user':
                        roleClass = 'user-message';
                        roleLabel = 'Usuario';
                        break;
                    case 'assistant':
                        roleClass = 'assistant-message';
                        roleLabel = 'Asistente';
                        break;
                    case 'tool':
                        roleClass = 'tool-message';
                        roleLabel = 'Herramienta';
                        break;
                    default:
                        roleClass = 'other-message';
                        roleLabel = role;
                }
                
                conversationHtml += `
                    <div class="message ${roleClass}">
                        <div class="role-label">${roleLabel}</div>
                        <div class="content">${formatContent(content)}</div>
                    </div>
                `;
            });
            
            function formatContent(content) {
                if (typeof content !== 'string') {
                    content = JSON.stringify(content, null, 2);
                    return `<pre class="json">${escapeHtml(content)}</pre>`;
                }
                
                if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                    try {
                        const json = JSON.parse(content);
                        content = JSON.stringify(json, null, 2);
                        return `<pre class="json">${escapeHtml(content)}</pre>`;
                    } catch (e) {
                        // No es JSON válido, continuar con el formato normal
                    }
                }
                
                return content.replace(/\n/g, '<br>');
            }
            
            function escapeHtml(text) {
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }
            
            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Resultado del Modelo de Razonamiento</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 20px;
                            line-height: 1.5;
                        }
                        .message {
                            margin-bottom: 15px;
                            padding: 10px;
                            border-radius: 5px;
                        }
                        .role-label {
                            font-weight: bold;
                            margin-bottom: 5px;
                        }
                        .developer-message {
                            background-color: #f0f0f0;
                            border-left: 4px solid #007acc;
                        }
                        .user-message {
                            background-color: #e6f7ff;
                            border-left: 4px solid #0078d4;
                        }
                        .assistant-message {
                            background-color: #f3f9ef;
                            border-left: 4px solid #107c10;
                        }
                        .tool-message {
                            background-color: #fff8e6;
                            border-left: 4px solid #f8a100;
                        }
                        .other-message {
                            background-color: #f0f0f0;
                            border-left: 4px solid #6e6e6e;
                        }
                        pre {
                            background-color: #f8f8f8;
                            padding: 10px;
                            border-radius: 3px;
                            overflow-x: auto;
                        }
                        .json {
                            font-family: 'Courier New', monospace;
                        }
                        .summary {
                            margin-top: 20px;
                            padding: 15px;
                            background-color: #f5f5f5;
                            border-radius: 5px;
                            border-left: 4px solid #007acc;
                        }
                        h2 {
                            color: #007acc;
                        }
                    </style>
                </head>
                <body>
                    <h2>Conversación con Modelo de Razonamiento</h2>
                    ${conversationHtml}
                    
                    <div class="summary">
                        <h3>Resumen de la Interacción</h3>
                        <p>Modelo utilizado: <strong>gpt-5-mini</strong> (Esfuerzo de razonamiento: medium)</p>
                        ${result.tool_calls && result.tool_calls.length > 0 
                            ? `<p>Se realizaron <strong>${result.tool_calls.length}</strong> llamadas a herramientas.</p>` 
                            : '<p>No se utilizaron herramientas durante la conversación.</p>'}
                    </div>
                </body>
                </html>
            `;
        } finally {
            statusBarItem.dispose();
        }
    }),

    createCommandRegistration('memorybank.agent.acceptTask', async (item: ExternalRequestTreeItem) => {
        if (!item || !item.id) { 
             vscode.window.showErrorMessage('Invalid task item');
             return;
        }
        await updateExternalRequestStatus(item, 'ACCEPTED');
    }),

    createCommandRegistration('memorybank.agent.rejectTask', async (item: ExternalRequestTreeItem) => {
        if (!item || !item.id) { 
             vscode.window.showErrorMessage('Invalid task item');
             return;
        }
        await updateExternalRequestStatus(item, 'REJECTED');
    }),

    createCommandRegistration('memorybank.agent.delegateTask', async () => {
        const option = await vscode.window.showInformationMessage(
            'Para delegar una tarea, usa el chat con el comando @agent delegate ...',
            'Abrir Chat'
        );
        
        if (option === 'Abrir Chat') {
            vscode.commands.executeCommand('memorybank.ask');
        }
    })
]; 

async function updateExternalRequestStatus(item: ExternalRequestTreeItem, newStatus: string) {
    const service = getMemoryBankService();
    
    // Update SQLite
    try {
        const sqlite = service.getSqliteService();
        if (sqlite) {
            sqlite.updateExternalRequestStatus(item.id, newStatus);
        }
    } catch (e) {
        console.error('Failed to update SQLite external request status:', e);
    }

    const mbPath = service.getMemoryBankPath();
    if (!mbPath || !item.projectId) {
        vscode.window.showErrorMessage('Memory Bank path or Project ID missing');
        return;
    }

    const boardPath = path.join(mbPath, 'projects', item.projectId, 'docs', 'agentBoard.md');
    if (!fs.existsSync(boardPath)) {
        vscode.window.showErrorMessage(`Agent board not found at ${boardPath}`);
        return;
    }

    try {
        let content = fs.readFileSync(boardPath, 'utf-8');
        // Simple regex strategy: find the line with the ID and replace the status column
        // Format: | ID | Title | From Project | Context | Status | Received At |
        // We look for a line starting with | {id} | ...
        
        // Escape special chars in ID just in case
        const escapedId = item.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // We look for the line manually to be safer with spaces
        const lines = content.split('\n');
        let updated = false;
        
        const newLines = lines.map(line => {
            const trimmed = line.trim();
            // Check if it's a table row and has the ID in the first column
            if (trimmed.startsWith('|') && (trimmed.includes(`| ${item.id} |`) || trimmed.includes(`|${item.id}|`))) {
                 const parts = line.split('|');
                 // parts[0] is typically empty string if line starts with |
                 // Columns: [0] "", [1] ID, [2] Title, [3] From, [4] Context, [5] Status, [6] Received, [7] ""
                 
                 // We need to identify column index 5 (Status)
                 // This assumes the standard layout defined in parseBoardContent
                 if (parts.length >= 7) {
                     parts[5] = ` ${newStatus} `;
                     updated = true;
                     return parts.join('|');
                 }
            }
            return line;
        });

        if (updated) {
            const newContent = newLines.join('\n');
            fs.writeFileSync(boardPath, newContent, 'utf-8');
            vscode.window.showInformationMessage(`Task ${item.id} marked as ${newStatus}`);
            vscode.commands.executeCommand('memorybank.agents.refresh');
        } else {
             vscode.window.showWarningMessage(`Could not find task ${item.id} in agentBoard.md`);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Error updating task status: ${error}`);
    }
} 