import * as vscode from 'vscode';
import * as configManager from '../utils/configManager';
import * as vectraService from './vectraService';
import * as ragService from './ragService';
import * as path from 'path';
import * as fs from 'fs';

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
  
  // Register Vectra indexing command - Implementación completa
  disposable = vscode.commands.registerCommand('grec0ai.vectra.indexProject', async () => {
    try {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('No se encontró un workspace para indexar.');
        return;
      }
      
      const projectPath = folders[0].uri.fsPath;
      
      // Mostrar progreso durante la indexación
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Indexando proyecto para RAG...',
        cancellable: true
      }, async (progress, token) => {
        progress.report({ message: 'Inicializando...' });
        
        // Inicializar Vectra y el servicio RAG
        await vectraService.initialize(projectPath);
        
        // Crear/recrear el índice
        progress.report({ message: 'Creando índice vectorial...' });
        await vectraService.createIndex(projectPath);
        
        // Escanear archivos para indexar
        progress.report({ message: 'Escaneando archivos...' });
        const files = await scanFiles(projectPath, ['.ts', '.js', '.tsx', '.jsx', '.md', '.txt', '.json']);
        
        // Indexar cada archivo
        const totalFiles = files.length;
        let indexedFiles = 0;
        
        for (const file of files) {
          if (token.isCancellationRequested) {
            vscode.window.showInformationMessage('Indexación cancelada por el usuario.');
            return;
          }
          
          try {
            const content = fs.readFileSync(file, 'utf8');
            const relativePath = path.relative(projectPath, file);
            
            progress.report({ 
              message: `Indexando ${relativePath}...`, 
              increment: 100 / totalFiles 
            });
            
            // Generar metadata para el archivo
            const metadata = {
              filePath: relativePath,
              fileName: path.basename(file),
              extension: path.extname(file),
              size: content.length,
              indexedAt: new Date().toISOString()
            };
            
            // Indexar el contenido
            await vectraService.indexCode(content, metadata);
            indexedFiles++;
          } catch (error) {
            console.error(`Error al indexar ${file}:`, error);
          }
        }
        
        vscode.window.showInformationMessage(`Indexación completada. ${indexedFiles} archivos indexados.`);
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error al indexar proyecto: ${error.message}`);
    }
  });
  context.subscriptions.push(disposable);
  
  // Registro del comando de búsqueda semántica
  disposable = vscode.commands.registerCommand('grec0ai.vectra.search', async () => {
    const query = await vscode.window.showInputBox({ 
      prompt: 'Consulta semántica para buscar en el código',
      placeHolder: 'Ej: "Cómo se implementa la autenticación"'
    });
    
    if (!query) return;
    
    try {
      // Mostrar progreso durante la búsqueda
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Buscando...',
        cancellable: false
      }, async (progress) => {
        // Realizar búsqueda semántica
        const results = await vectraService.query(query, 10);
        
        if (!results || results.length === 0) {
          vscode.window.showInformationMessage('No se encontraron resultados para la consulta.');
          return;
        }
        
        // Crear un panel para mostrar los resultados
        const panel = vscode.window.createWebviewPanel(
          'vectraResults',
          `Resultados para: ${query}`,
          vscode.ViewColumn.One,
          { enableScripts: true }
        );
        
        // Generar HTML para los resultados
        let html = `
          <html>
          <head>
            <style>
              body { font-family: var(--vscode-font-family); }
              .result { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; }
              .path { color: var(--vscode-textLink-foreground); cursor: pointer; }
              .snippet { background-color: var(--vscode-editor-background); padding: 10px; white-space: pre-wrap; }
              .relevance { font-style: italic; color: var(--vscode-disabledForeground); }
            </style>
          </head>
          <body>
            <h2>Resultados para: ${query}</h2>
        `;
        
        // Añadir cada resultado al HTML
        results.forEach((result, index) => {
          html += `
            <div class="result">
              <div class="path" data-path="${result.metadata?.filePath || ''}">${result.metadata?.filePath || 'Resultado ' + (index + 1)}</div>
              <div class="snippet">${result.metadata?.code || result}</div>
              <div class="relevance">Relevancia: ${result.score ? Math.round(result.score * 100) + '%' : 'N/A'}</div>
            </div>
          `;
        });
        
        // Añadir script para manejar clics en las rutas
        html += `
            <script>
              const vscode = acquireVsCodeApi();
              document.querySelectorAll('.path').forEach(el => {
                el.addEventListener('click', () => {
                  const path = el.getAttribute('data-path');
                  if (path) {
                    vscode.postMessage({ command: 'openFile', path: path });
                  }
                });
              });
            </script>
          </body>
          </html>
        `;
        
        panel.webview.html = html;
        
        // Manejar mensajes del webview
        panel.webview.onDidReceiveMessage(
          message => {
            if (message.command === 'openFile') {
              // Abrir el archivo cuando se hace clic en la ruta
              const filePath = message.path;
              const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
              if (workspaceFolder && filePath) {
                const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, filePath));
                vscode.window.showTextDocument(fileUri);
              }
            }
          },
          undefined,
          context.subscriptions
        );
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error en la búsqueda: ${error.message}`);
    }
  });
  context.subscriptions.push(disposable);
  
  // Register MacGyver command
  disposable = vscode.commands.registerCommand('grec0ai.ask.macgyver', async () => {
    const question = await vscode.window.showInputBox({
      prompt: 'Pregunta para MacGyver (Usa búsqueda semántica + LLM)'
    });
    
    if (question) {
      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Consultando a MacGyver...',
          cancellable: false
        }, async (progress) => {
          // Usar RAG para obtener respuesta
          const answer = await ragService.query(question);
          
          // Mostrar la respuesta en un panel
          const panel = vscode.window.createWebviewPanel(
            'macgyverResponse',
            `Respuesta a: ${question}`,
            vscode.ViewColumn.One,
            {}
          );
          
          panel.webview.html = `
            <html>
              <head>
                <style>
                  body { font-family: var(--vscode-font-family); padding: 20px; }
                  .question { font-weight: bold; margin-bottom: 10px; }
                  .answer { white-space: pre-wrap; }
                </style>
              </head>
              <body>
                <h2>MacGyver</h2>
                <div class="question">${question}</div>
                <div class="answer">${answer}</div>
              </body>
            </html>
          `;
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Error al consultar a MacGyver: ${error.message}`);
      }
    }
  });
  context.subscriptions.push(disposable);
}

/**
 * Escanea recursivamente los archivos en un directorio que coincidan con las extensiones especificadas
 */
async function scanFiles(dir: string, extensions: string[]): Promise<string[]> {
  const files: string[] = [];
  
  // Leer las entradas del directorio
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Ignorar carpetas node_modules, .git y otros directorios ocultos
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...await scanFiles(fullPath, extensions));
      }
    } else if (entry.isFile()) {
      // Verificar si la extensión coincide con alguna de las buscadas
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
} 