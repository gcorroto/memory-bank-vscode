import * as vscode from 'vscode';
import { CommandRegistration } from '../types';
import { createCommandRegistration } from '../utils';
import { getGlobalAgent } from '../../extension';

export const agentCommands: CommandRegistration[] = [
    createCommandRegistration('grec0ai.createAgent', async () => {
        try {
            const agent = await getGlobalAgent(true);
            vscode.window.showInformationMessage('Agent created successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create agent: ${error}`);
        }
    }),

    createCommandRegistration('grec0ai.getAgent', () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
        }
    }),

    createCommandRegistration('grec0ai.ask', async () => {
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

    createCommandRegistration('grec0ai.agent.showLogs', () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
            return;
        }
        agent.showLogsView();
    }),

    createCommandRegistration('grec0ai.agent.generateTest', async () => {
        const agent = getGlobalAgent();
        if (!agent) {
            vscode.window.showWarningMessage('No agent instance found');
            return;
        }
        
        await vscode.commands.executeCommand('grec0ai.automaticTest');
    }),

    createCommandRegistration('grec0ai.agent.analyzeCode', async () => {
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

    createCommandRegistration('grec0ai.agent.fixError', async () => {
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

    createCommandRegistration('grec0ai.agent.explain', async () => {
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

    createCommandRegistration('grec0ai.agent.testReasoningModel', async () => {
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
                        <p>Modelo utilizado: <strong>o3-mini</strong> (Esfuerzo de razonamiento: medium)</p>
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
    })
]; 