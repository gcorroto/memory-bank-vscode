/**
 * Comandos para las funcionalidades relacionadas con OpenAI y Vectra
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const configManager = require('../utils/configManager');
const openaiService = require('./openaiService');
const vectraService = require('./vectraService');
const ragService = require('./ragService');

/**
 * Comando para configurar la clave API de OpenAI
 * @returns {Promise<void>}
 */
async function configureOpenAIApiKey() {
    try {
        const success = await configManager.promptForApiKey();
        
        if (success) {
            vscode.window.showInformationMessage('Clave API de OpenAI configurada correctamente.');
            
            // Inicializar servicios
            const openaiInitialized = openaiService.initialize();
            
            if (openaiInitialized) {
                vscode.window.showInformationMessage('Servicio OpenAI inicializado correctamente.');
            }
        } else {
            vscode.window.showWarningMessage('Operación de configuración de la clave API cancelada.');
        }
    } catch (error) {
        console.error('Error al configurar la clave API de OpenAI:', error);
        vscode.window.showErrorMessage(`Error al configurar la clave API: ${error.message}`);
    }
}

/**
 * Obtiene la extensión de un archivo a partir de su ruta
 * @param {string} filePath - Ruta del archivo
 * @returns {string} - Extensión del archivo
 */
function getFileExtension(filePath) {
    return path.extname(filePath).substring(1);
}

/**
 * Mapea una extensión de archivo a un lenguaje de programación
 * @param {string} extension - Extensión del archivo
 * @returns {string} - Lenguaje de programación
 */
function mapExtensionToLanguage(extension) {
    const extensionMap = {
        'js': 'javascript',
        'ts': 'typescript',
        'jsx': 'javascript',
        'tsx': 'typescript',
        'vue': 'javascript',
        'py': 'python',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'go': 'go',
        'rb': 'ruby',
        'php': 'php',
        'swift': 'swift',
        'kt': 'kotlin',
        'rs': 'rust',
        'scala': 'scala'
    };
    
    return extensionMap[extension.toLowerCase()] || extension;
}

/**
 * Comando para indexar el proyecto para RAG
 * @returns {Promise<void>}
 */
async function indexProjectForRAG() {
    try {
        // Asegurar que Vectra esté inicializado
        const vectraInitialized = await vectraService.initialize();
        
        if (!vectraInitialized) {
            throw new Error('No se pudo inicializar el servicio Vectra');
        }
        
        // Obtener la ruta del workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No hay carpetas de workspace abiertas');
        }
        
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        
        // Obtener patrones de exclusión
        const config = vscode.workspace.getConfiguration('grec0ai');
        const excludePatterns = config.get('filesystem.excludePatterns') || ['node_modules', 'dist', '.git', 'coverage'];
        
        // Mostrar progreso de indexación
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Indexando proyecto para RAG',
            cancellable: true
        }, async (progress, token) => {
            // Función recursiva para indexar archivos
            async function indexDirectory(dirPath, relativePathForProgress = '') {
                if (token.isCancellationRequested) {
                    return;
                }
                
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    // Verificar si se debe saltar este directorio o archivo
                    if (excludePatterns.some(pattern => 
                        entry.name.includes(pattern) || 
                        path.join(dirPath, entry.name).includes(pattern)
                    )) {
                        continue;
                    }
                    
                    const fullPath = path.join(dirPath, entry.name);
                    const relativePath = path.relative(workspaceRoot, fullPath);
                    
                    if (token.isCancellationRequested) {
                        return;
                    }
                    
                    if (entry.isDirectory()) {
                        // Indexar subdirectorio
                        await indexDirectory(fullPath, relativePath);
                    } else {
                        // Indexar archivo si es de texto
                        const extension = getFileExtension(entry.name);
                        const language = mapExtensionToLanguage(extension);
                        
                        // Filtrar archivos binarios y tipos no soportados
                        const textFileExtensions = ['js', 'ts', 'jsx', 'tsx', 'java', 'py', 'c', 'cpp', 'cs', 'go', 
                                                   'rb', 'php', 'swift', 'kt', 'rs', 'scala', 'html', 'css', 'json', 
                                                   'md', 'txt', 'xml', 'yml', 'yaml'];
                        
                        if (textFileExtensions.includes(extension.toLowerCase())) {
                            progress.report({ 
                                message: `Indexando: ${relativePath}`,
                                increment: 0.1
                            });
                            
                            try {
                                await vectraService.indexFile(fullPath, language);
                            } catch (error) {
                                console.error(`Error al indexar archivo ${fullPath}:`, error);
                            }
                        }
                    }
                }
            }
            
            // Iniciar indexación desde la raíz
            await indexDirectory(workspaceRoot);
            
            return true;
        });
        
        vscode.window.showInformationMessage('Proyecto indexado correctamente para RAG.');
    } catch (error) {
        console.error('Error al indexar proyecto:', error);
        vscode.window.showErrorMessage(`Error al indexar proyecto: ${error.message}`);
    }
}

/**
 * Comando para explicar código seleccionado
 * @returns {Promise<void>}
 */
async function explainCode() {
    try {
        // Obtener editor activo
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No hay editor activo');
        }
        
        // Obtener texto seleccionado
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText) {
            throw new Error('No hay texto seleccionado');
        }
        
        // Obtener lenguaje
        const filePath = editor.document.uri.fsPath;
        const extension = getFileExtension(filePath);
        const language = mapExtensionToLanguage(extension);
        
        // Mostrar progreso
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Explicando código',
            cancellable: false
        }, async (progress) => {
            // Inicializar servicio RAG
            if (!await ragService.initialize()) {
                throw new Error('No se pudo inicializar el servicio RAG');
            }
            
            progress.report({ message: 'Generando explicación...' });
            
            // Generar explicación
            const query = `Explica detalladamente cómo funciona este código ${language}`;
            const explanation = await ragService.generateResponse(query, 3, configManager.getOpenAIModel(), {
                sourceCode: selectedText,
                language: language
            });
            
            // Mostrar explicación
            const panel = vscode.window.createWebviewPanel(
                'grec0aiExplanation',
                'Explicación de Código - Grec0AI',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            
            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Explicación de Código - Grec0AI</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                            line-height: 1.6;
                            padding: 20px;
                        }
                        h1 {
                            color: #007acc;
                            border-bottom: 1px solid #eee;
                            padding-bottom: 10px;
                        }
                        pre {
                            background-color: #f5f5f5;
                            padding: 10px;
                            border-radius: 5px;
                            overflow: auto;
                        }
                        code {
                            font-family: 'Courier New', Courier, monospace;
                        }
                    </style>
                </head>
                <body>
                    <h1>Explicación de Código</h1>
                    <pre><code>${selectedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                    <div>${explanation.replace(/\n/g, '<br>').replace(/`{3}(\w*)\n([\s\S]*?)\n`{3}/g, '<pre><code>$2</code></pre>')}</div>
                </body>
                </html>
            `;
            
            return true;
        });
    } catch (error) {
        console.error('Error al explicar código:', error);
        vscode.window.showErrorMessage(`Error al explicar código: ${error.message}`);
    }
}

/**
 * Comando para corregir código seleccionado
 * @returns {Promise<void>}
 */
async function fixCode() {
    try {
        // Obtener editor activo
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No hay editor activo');
        }
        
        // Obtener texto seleccionado
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText) {
            throw new Error('No hay texto seleccionado');
        }
        
        // Obtener lenguaje
        const filePath = editor.document.uri.fsPath;
        const extension = getFileExtension(filePath);
        const language = mapExtensionToLanguage(extension);
        
        // Pedir al usuario que describa el problema
        const problemDescription = await vscode.window.showInputBox({
            prompt: 'Describe el problema que deseas corregir',
            placeHolder: 'Ej: Hay un error en la función de ordenamiento...',
            ignoreFocusOut: true
        });
        
        if (!problemDescription) {
            return; // Usuario canceló
        }
        
        // Mostrar progreso
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analizando y corrigiendo código',
            cancellable: false
        }, async (progress) => {
            // Inicializar servicio RAG
            if (!await ragService.initialize()) {
                throw new Error('No se pudo inicializar el servicio RAG');
            }
            
            progress.report({ message: 'Analizando código...' });
            
            // Analizar código con RAG
            const analysisResult = await ragService.analyzeCode(selectedText, language);
            
            progress.report({ message: 'Generando solución...' });
            
            // Generar solución
            const errorMessage = problemDescription;
            const solution = await ragService.resolveError(errorMessage, selectedText, language);
            
            // Verificar si hay una solución
            if (!solution.fixedCode) {
                throw new Error('No se pudo generar una solución');
            }
            
            // Preguntar al usuario si desea aplicar la solución
            const action = await vscode.window.showInformationMessage(
                `Grec0AI ha encontrado una solución:\n${solution.explanation}`,
                'Aplicar Solución',
                'Ver Detalles',
                'Cancelar'
            );
            
            if (action === 'Aplicar Solución') {
                // Aplicar la solución
                editor.edit(editBuilder => {
                    editBuilder.replace(selection, solution.fixedCode);
                });
                
                vscode.window.showInformationMessage('Solución aplicada correctamente.');
            } else if (action === 'Ver Detalles') {
                // Mostrar detalles en un panel
                const panel = vscode.window.createWebviewPanel(
                    'grec0aiSolution',
                    'Solución de Código - Grec0AI',
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );
                
                panel.webview.html = `
                    <!DOCTYPE html>
                    <html lang="es">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Solución de Código - Grec0AI</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                                line-height: 1.6;
                                padding: 20px;
                            }
                            h1, h2 {
                                color: #007acc;
                                border-bottom: 1px solid #eee;
                                padding-bottom: 10px;
                            }
                            pre {
                                background-color: #f5f5f5;
                                padding: 10px;
                                border-radius: 5px;
                                overflow: auto;
                            }
                            code {
                                font-family: 'Courier New', Courier, monospace;
                            }
                            .apply-button {
                                background-color: #007acc;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                margin-top: 20px;
                            }
                            .explanation {
                                margin-bottom: 20px;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>Solución de Código</h1>
                        
                        <h2>Explicación</h2>
                        <div class="explanation">${solution.explanation.replace(/\n/g, '<br>')}</div>
                        
                        <h2>Solución</h2>
                        <div>${solution.solution.replace(/\n/g, '<br>')}</div>
                        
                        <h2>Código Original</h2>
                        <pre><code>${selectedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                        
                        <h2>Código Corregido</h2>
                        <pre><code>${solution.fixedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                        
                        <button class="apply-button" id="applyButton">Aplicar Solución</button>
                        
                        <script>
                            const vscode = acquireVsCodeApi();
                            document.getElementById('applyButton').addEventListener('click', () => {
                                vscode.postMessage({
                                    command: 'applyFix',
                                    text: ${JSON.stringify(solution.fixedCode)}
                                });
                            });
                        </script>
                    </body>
                    </html>
                `;
                
                // Manejar mensajes del webview
                panel.webview.onDidReceiveMessage(
                    message => {
                        switch (message.command) {
                            case 'applyFix':
                                editor.edit(editBuilder => {
                                    editBuilder.replace(selection, message.text);
                                });
                                vscode.window.showInformationMessage('Solución aplicada correctamente.');
                                break;
                        }
                    },
                    undefined,
                    []
                );
            }
            
            return true;
        });
    } catch (error) {
        console.error('Error al corregir código:', error);
        vscode.window.showErrorMessage(`Error al corregir código: ${error.message}`);
    }
}

/**
 * Comando para preguntar a MacGyver asistente
 * @returns {Promise<void>}
 */
async function askMacGyver() {
    try {
        // Obtener editor activo y selección
        const editor = vscode.window.activeTextEditor;
        let contextText = '';
        
        if (editor) {
            const selection = editor.selection;
            contextText = editor.document.getText(selection);
        }
        
        // Pedir al usuario que formule su pregunta
        const query = await vscode.window.showInputBox({
            prompt: 'Pregunta a MacGyver',
            placeHolder: 'Ej: ¿Cómo puedo mejorar este código?',
            ignoreFocusOut: true
        });
        
        if (!query) {
            return; // Usuario canceló
        }
        
        // Obtener la ruta del workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No hay carpetas de workspace abiertas');
        }
        
        const workspacePath = workspaceFolders[0].uri.fsPath;
        
        // Mostrar progreso
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'MacGyver está pensando...',
            cancellable: false
        }, async (progress) => {
            // Inicializar el servicio RAG si es necesario
            if (!await ragService.initialize()) {
                throw new Error('No se pudo inicializar el servicio RAG');
            }
            
            progress.report({ message: 'Buscando contexto relevante...' });
            
            // Crear query combinado con el contexto de código
            const fullQuery = contextText 
                ? `${query}\n\nContexto de código:\n\`\`\`\n${contextText}\n\`\`\``
                : query;
            
            // Obtener chunks relevantes del RAG
            const config = vscode.workspace.getConfiguration('grec0ai');
            const contextCount = config.get('rag.contextCount') || 3;
            const contextResults = await vectraService.query(fullQuery, contextCount);
            
            // Usar el PromptComposer para construir el prompt
            const promptComposer = require('../promptComposer');
            
            const input = {
                userQuery: query,
                workspacePath: workspacePath,
                attachedDocs: contextResults.map(result => ({
                    text: result.code,
                    source: result.metadata.filePath || 'Desconocido'
                })),
                currentFilePath: editor ? editor.document.uri.fsPath : undefined
            };
            
            progress.report({ message: 'Generando respuesta...' });
            
            // Construir el prompt completo
            const fullPrompt = promptComposer.buildPrompt(input);
            
            // Configurar los mensajes para OpenAI
            const messages = [
                {
                    role: 'user',
                    content: fullPrompt
                }
            ];
            
            // Generar la respuesta con OpenAI
            const completion = await openaiService.chatCompletion(messages, configManager.getOpenAIModel());
            
            // Mostrar la respuesta en un panel
            const panel = vscode.window.createWebviewPanel(
                'macGyverResponse',
                'Respuesta de MacGyver',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            
            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>MacGyver - Tu asistente de código</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                            line-height: 1.6;
                            padding: 20px;
                        }
                        h1 {
                            color: #007acc;
                            border-bottom: 1px solid #eee;
                            padding-bottom: 10px;
                        }
                        pre {
                            background-color: #f5f5f5;
                            padding: 10px;
                            border-radius: 5px;
                            overflow: auto;
                        }
                        code {
                            font-family: 'Courier New', Courier, monospace;
                        }
                        .query {
                            color: #555;
                            font-style: italic;
                            margin-bottom: 20px;
                            padding: 10px;
                            background-color: #f9f9f9;
                            border-left: 3px solid #007acc;
                        }
                    </style>
                </head>
                <body>
                    <h1>Respuesta de MacGyver</h1>
                    <div class="query">${query}</div>
                    <div>${completion.choices[0].message.content.replace(/\n/g, '<br>').replace(/`{3}(\w*)\n([\s\S]*?)\n`{3}/g, '<pre><code>$2</code></pre>')}</div>
                </body>
                </html>
            `;
            
            return true;
        });
    } catch (error) {
        console.error('Error al consultar a MacGyver:', error);
        vscode.window.showErrorMessage(`Error al consultar a MacGyver: ${error.message}`);
    }
}

/**
 * Registra los comandos en el contexto de extensión
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function registerCommands(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('grec0ai.openai.configure', configureOpenAIApiKey),
        vscode.commands.registerCommand('grec0ai.vectra.indexProject', indexProjectForRAG),
        vscode.commands.registerCommand('grec0ai.explain', explainCode),
        vscode.commands.registerCommand('grec0ai.fix', fixCode),
        vscode.commands.registerCommand('grec0ai.ask.macgyver', askMacGyver)
    );
}

module.exports = {
    registerCommands,
    configureOpenAIApiKey,
    indexProjectForRAG,
    explainCode,
    fixCode,
    askMacGyver
}; 