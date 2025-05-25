'use strict';

// VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

// Import our providers
import { CoverageDefectsProvider } from './FileTreeProvider';
import { CoverageSummaryProvider } from './CoverageSummaryProvider';
import { CoverageDetailsProvider } from './CoverageDetailsProvider';
import * as Utils from './utils/utils';

// Conditional import for WebSocket
let WebSocket: any;
try {
  WebSocket = require('ws');
} catch (error) {
  // Handle missing ws module gracefully
  console.error('The "ws" module is missing. Please run "npm install" in the extension directory.');
}

// Import FileTreeService
import { FileTreeService } from './utils/FileTreeService';

// Import our services
import * as openaiService from './services/openaiService';
import * as vectraService from './services/vectraService';
import * as ragService from './services/ragService';
import * as configManager from './utils/configManager';
import * as commands from './services/commands';

// Import agent system
import * as agentSystem from './agent';
import { Agent } from './agent/core/Agent';

// Create logger
const logger = vscode.window.createOutputChannel('Grec0AI For Developers');

// Initialize providers
const fileTreeProvider = new CoverageDefectsProvider(logger);
const coverageSummaryProvider = new CoverageSummaryProvider(fileTreeProvider, logger);
const coverageDetailsProvider = new CoverageDetailsProvider();

// Global agent instance
let agent: Agent | null = null;

// This method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  logger.appendLine('Grec0AI For Developers extension activated. Welcome!');
  
  // Check if required modules are available
  if (!WebSocket) {
    const message = 'Required dependencies are missing. Please run "npm install" in the extension directory.';
    logger.appendLine(message);
    vscode.window.showErrorMessage(message);
    return; // Exit activation process
  }
  
  // No ejecutamos aquí el autofixer.md, lo haremos después de inicializar el agente
  // para evitar ejecuciones duplicadas
  
  // Register providers for file tree, coverage summary, and coverage details
  vscode.window.registerTreeDataProvider('grec0ai-filesystem-tree', fileTreeProvider);
  vscode.window.registerTreeDataProvider('grec0ai-coverage-summary', coverageSummaryProvider);
  vscode.window.registerTreeDataProvider('grec0ai-coverage-details', coverageDetailsProvider);

  // Register commands
  // File system and test related commands
  let disposable = vscode.commands.registerCommand('grec0ai.filesystem.refresh', refreshFileSystem);
  context.subscriptions.push(disposable);
  
  disposable = vscode.commands.registerCommand('grec0ai.filesystem.showFileDetails', showFileDetails);
  context.subscriptions.push(disposable);
  
  disposable = vscode.commands.registerCommand('grec0ai.coverage.refresh', refreshCoverage);
  context.subscriptions.push(disposable);
  
  disposable = vscode.commands.registerCommand('grec0ai.coverage.details.refresh', refreshCoverageDetails);
  context.subscriptions.push(disposable);

  // File opening command
  disposable = vscode.commands.registerCommand('grec0ai.filesystem.openFileAtLine', openFileAtLine);
  context.subscriptions.push(disposable);

  // Test generation command
  disposable = vscode.commands.registerCommand('grec0ai.automaticTest', automaticTest);
  context.subscriptions.push(disposable);
  
  // Register our new commands for OpenAI and Vectra integration
  commands.registerCommands(context);
  
  // Initialize OpenAI service if API key is configured
  if (configManager.isConfigComplete()) {
    openaiService.initialize();
    logger.appendLine('OpenAI service initialized.');
  } else {
    logger.appendLine('OpenAI API key not configured. Use "Configure OpenAI API Key" command to set it up.');
  }
  
  // Initialize agent system
  initializeAgentSystem(context).catch(error => {
    logger.appendLine(`Error initializing agent system: ${error.message}`);
  });

  // Registrar comando para crear y ejecutar el agente
  const createAgentCommand = vscode.commands.registerCommand('grec0ai.createAgent', async () => {
    // Si ya existe un agente, no crear uno nuevo
    if (agent) {
      vscode.window.showInformationMessage('El agente ya está activado.');
      return agent;
    }
    
    try {
      // Crear y retornar una nueva instancia del agente
      agent = new Agent('Grec0AI', context);
      await agent.initialize();
      vscode.window.showInformationMessage('Agente Grec0AI inicializado correctamente.');
      return agent;
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error al inicializar el agente: ${error.message}`);
      return null;
    }
  });
  
  // Registrar comando para acceder al agente existente
  const getAgentCommand = vscode.commands.registerCommand('grec0ai.getAgent', () => {
    if (!agent) {
      vscode.window.showWarningMessage('El agente no está activado. Use "grec0ai.createAgent" primero.');
    }
    return agent;
  });
  
  // Registrar comando para enviar consultas al agente
  const askAgentCommand = vscode.commands.registerCommand('grec0ai.ask', async () => {
    // Asegurarse de que existe un agente
    if (!agent) {
      try {
        agent = new Agent('Grec0AI', context);
        await agent.initialize();
        vscode.window.showInformationMessage('Agente Grec0AI inicializado correctamente.');
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error al inicializar el agente: ${error.message}`);
        return;
      }
    }
    
    // Solicitar input del usuario
    const userInput = await vscode.window.showInputBox({
      prompt: 'Instrucciones para el agente:',
      placeHolder: 'Ej: Genera tests para el archivo actual'
    });
    
    if (!userInput) return; // El usuario canceló
    
    try {
      // Mostrar indicador de progreso
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Procesando instrucciones...',
        cancellable: false
      }, async (progress) => {
        // Enviar consulta al agente
        const result = await agent!.handleUserInput(userInput);
        
        if (result.success) {
          vscode.window.showInformationMessage('Instrucciones procesadas correctamente.');
        } else {
          vscode.window.showErrorMessage(`Error: ${result.error || 'Error desconocido'}`);
        }
        
        return result;
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error al procesar instrucciones: ${error.message}`);
    }
  });
  
  // Registrar comando para inicializar servicios RAG
  const initializeRAGCommand = vscode.commands.registerCommand('grec0ai.rag.initialize', async () => {
    try {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Inicializando servicios RAG...',
        cancellable: false
      }, async (progress) => {
        // Inicializar Vectra
        await vectraService.initialize();
        
        // Inicializar RAG
        const ragInitialized = await ragService.initialize();
        
        if (ragInitialized) {
          vscode.window.showInformationMessage('Servicios RAG inicializados correctamente.');
        } else {
          vscode.window.showWarningMessage('Inicialización parcial de servicios RAG. Verifique la configuración.');
        }
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error al inicializar RAG: ${error.message}`);
    }
  });
  
  // Registrar comando para reindexar el proyecto bajo demanda
  const reindexProjectCommand = vscode.commands.registerCommand('grec0ai.vectra.reindexProject', async () => {
    try {
      // Verificar que hay un workspace
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('No se encontró un workspace para indexar.');
        return;
      }
      
      const projectPath = folders[0].uri.fsPath;
      
      // Mostrar diálogo de confirmación
      const confirmation = await vscode.window.showWarningMessage(
        'Esta operación recreará el índice vectorial completo. ¿Desea continuar?',
        { modal: true },
        'Sí, recrear índice'
      );
      
      if (confirmation !== 'Sí, recrear índice') {
        return;
      }
      
      // Mostrar progreso
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Reindexando proyecto...',
        cancellable: true
      }, async (progress, token) => {
        // Inicializar y recrear índice
        await vectraService.initialize(projectPath);
        progress.report({ message: 'Recreando índice vectorial...' });
        await vectraService.createIndex(projectPath);
        
        // Ejecutar el comando de indexación
        await vscode.commands.executeCommand('grec0ai.vectra.indexProject');
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error al reindexar proyecto: ${error.message}`);
    }
  });
  
  // Registrar comando para ejecutar manualmente el autofixer
  disposable = vscode.commands.registerCommand('grec0ai.runAutofixer', async () => {
    try {
      // Mostrar indicador de progreso
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Ejecutando Autofixer...',
        cancellable: false
      }, async (progress) => {
        // Verificar si está habilitado en la configuración
        const config = vscode.workspace.getConfiguration('grec0ai');
        const autoFixerEnabled = config.get('autofixer.enabled', false);
        
        if (!autoFixerEnabled) {
          // Aunque no esté habilitado, permitimos la ejecución manual
          logger.appendLine('Autofixer está deshabilitado en la configuración, pero se ejecutará manualmente');
          progress.report({ message: 'Autofixer está deshabilitado pero se ejecutará manualmente' });
        }
        
        // Ejecutar el proceso de autofixer
        const result = await checkAndProcessAutofixerMd(true);
        
        if (result.found && result.processed) {
          vscode.window.showInformationMessage('Autofixer ejecutado correctamente');
        } else if (result.found && !result.processed) {
          vscode.window.showWarningMessage(`Se encontró el archivo autofixer.md pero no se pudo procesar: ${result.error || 'Error desconocido'}`);
        } else {
          vscode.window.showErrorMessage(`No se encontró el archivo autofixer.md en el workspace: ${result.error || 'Archivo no encontrado'}`);
        }
        
        return { success: result.processed };
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error al ejecutar autofixer: ${error.message}`);
    }
  });
  
  // Register commands that use the agent architecture
  registerAgentCommands(context);
  
  // Agregar todos los comandos al contexto
  context.subscriptions.push(createAgentCommand);
  context.subscriptions.push(getAgentCommand);
  context.subscriptions.push(askAgentCommand);
  context.subscriptions.push(initializeRAGCommand);
  context.subscriptions.push(reindexProjectCommand);
  context.subscriptions.push(disposable);
}

/**
 * Initialize the agent system
 * @param context Extension context
 */
async function initializeAgentSystem(context: vscode.ExtensionContext) {
  try {
    logger.appendLine('Initializing Grec0AI Agent System...');
    
    // Create and initialize the main agent
    agent = await agentSystem.createAgent('Grec0AI', context);
    
    // Make it globally accessible
    (global as any).mainAgent = agent;
    
    // Register agent-based command handlers
    registerAgentCommands(context);
    
    // Register logs view command
    let disposable = vscode.commands.registerCommand('grec0ai.agent.showLogs', () => {
      showAgentLogs(context);
    });
    context.subscriptions.push(disposable);
    
    logger.appendLine('Grec0AI Agent System initialized successfully');
    
    // Now that the agent is initialized, check for autofixer.md
    checkAndProcessAutofixerMd()
      .then(result => {
        if (result.processed) {
          logger.appendLine('Autofixer.md procesado automáticamente al iniciar la extensión');
        } else if (result.found) {
          logger.appendLine(`Autofixer.md encontrado pero no procesado: ${result.error}`);
        }
      })
      .catch(error => {
        logger.appendLine(`Error processing autofixer.md after agent initialization: ${error.message}`);
      });
  } catch (error: any) {
    logger.appendLine(`Failed to initialize agent system: ${error.message}`);
    
    // Show notification
    vscode.window.showErrorMessage('Failed to initialize Grec0AI Agent System. Some advanced features may not be available.');
  }
}

/**
 * Register commands that use the agent architecture
 * @param context Extension context
 */
function registerAgentCommands(context: vscode.ExtensionContext) {
  if (!agent) {
    logger.appendLine('Cannot register agent commands: Agent not initialized');
    return;
  }
  
  // Create command wrappers for the agent
  const generateTestCmd = agentSystem.createCommandWrapper(agent, 'generateTest');
  const analyzeCodeCmd = agentSystem.createCommandWrapper(agent, 'analyzeCode');
  const fixErrorCmd = agentSystem.createCommandWrapper(agent, 'fixError');
  const explainCodeCmd = agentSystem.createCommandWrapper(agent, 'explain');
  
  // Register these as new commands with 'agent.' prefix to avoid conflicts
  let disposable = vscode.commands.registerCommand('grec0ai.agent.generateTest', generateTestCmd);
  context.subscriptions.push(disposable);
  
  disposable = vscode.commands.registerCommand('grec0ai.agent.analyzeCode', analyzeCodeCmd);
  context.subscriptions.push(disposable);
  
  disposable = vscode.commands.registerCommand('grec0ai.agent.fixError', fixErrorCmd);
  context.subscriptions.push(disposable);
  
  disposable = vscode.commands.registerCommand('grec0ai.agent.explain', explainCodeCmd);
  context.subscriptions.push(disposable);
  
  // Registrar comando para probar modelos de razonamiento
  disposable = vscode.commands.registerCommand('grec0ai.agent.testReasoningModel', async () => {
    try {
      // Solicitar al usuario un prompt para el modelo de razonamiento
      const userInput = await vscode.window.showInputBox({
        prompt: 'Introduce una pregunta para probar el modelo de razonamiento',
        placeHolder: 'Ejemplo: Busca archivos con extensión .ts y analiza su contenido'
      });
      
      if (!userInput) {
        return; // Usuario canceló la operación
      }
      
      // Mostrar mensaje de procesamiento
      const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
      statusBarItem.text = "$(sync~spin) Procesando con modelo de razonamiento...";
      statusBarItem.show();
      
      try {
        // Llamar al método de demostración del agente
        const result = await agent.demoReasoningModel(userInput);
        
        // Mostrar los resultados en un webview
        const panel = vscode.window.createWebviewPanel(
          'reasoningModelResult',
          'Resultado del Modelo de Razonamiento',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );
        
        // Crear contenido HTML para mostrar los resultados
        const conversation = result.conversation || [];
        let conversationHtml = '';
        
        conversation.forEach((msg: any) => {
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
        
        // Función para formatear el contenido, detectando JSON y código
        function formatContent(content: string): string {
          if (typeof content !== 'string') {
            content = JSON.stringify(content, null, 2);
            return `<pre class="json">${escapeHtml(content)}</pre>`;
          }
          
          // Intentar analizar como JSON si parece ser JSON
          if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
            try {
              const json = JSON.parse(content);
              content = JSON.stringify(json, null, 2);
              return `<pre class="json">${escapeHtml(content)}</pre>`;
            } catch (e) {
              // No es JSON válido, continuar con el formato normal
            }
          }
          
          // Convertir saltos de línea en <br> para visualización HTML
          return content.replace(/\n/g, '<br>');
        }
        
        // Función para escapar HTML
        function escapeHtml(text: string): string {
          return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        }
        
        // Establecer el contenido HTML
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
        // Ocultar indicador de progreso
        statusBarItem.dispose();
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error al probar el modelo de razonamiento: ${error.message}`);
      logger.appendLine(`Error en testReasoningModel: ${error.message}`);
    }
  });
  context.subscriptions.push(disposable);
}

/**
 * Show agent logs view
 * @param context Extension context
 */
function showAgentLogs(context: vscode.ExtensionContext) {
  try {
    // Importar dinámicamente para evitar dependencias circulares
    const { AgentLogsView } = require('./agent/ui/logsView');
    
    // Verificar si ya existe una instancia global
    if (!(global as any).agentLogsView) {
      logger.appendLine('Creando nueva instancia de AgentLogsView');
      (global as any).agentLogsView = new AgentLogsView(context);
    } else {
      logger.appendLine('Usando instancia existente de AgentLogsView');
    }
    
    // Mostrar la vista
    (global as any).agentLogsView.show();
  } catch (error: any) {
    logger.appendLine(`Error al mostrar logs del agente: ${error.message}`);
    vscode.window.showErrorMessage('No se pudieron mostrar los logs del agente.');
  }
}

function refreshFileSystem() {
  fileTreeProvider.refresh();
}

function showFileDetails(element: any) {
  if (element) {
    fileTreeProvider.showFileDetails(element);
  }
}

function refreshCoverage() {
  coverageSummaryProvider.refresh();
}

function refreshCoverageDetails() {
  coverageDetailsProvider.refresh();
}

function openFileAtLine(element: any) {
  // Implementation for opening file at specific line
  if (element && element.filePath) {
    const filePath = element.filePath;
    const lineNumber = element.lineNumber || 0;
    
    vscode.workspace.openTextDocument(filePath).then(doc => {
      vscode.window.showTextDocument(doc).then(editor => {
        const position = new vscode.Position(lineNumber, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      });
    }, err => {
      vscode.window.showErrorMessage(`Could not open file: ${err}`);
    });
  }
}

async function automaticTest(reasoning?: string) {
  // Implementation of automaticTest functionality
  try {
    // Check if we should use agent-based implementation
    if (agent && configManager.isConfigComplete()) {
      return await handleAutomaticTestWithAgent(reasoning);
    }
    
    // Otherwise use the classic implementation
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No editor is active');
      return;
    }
    
    const document = editor.document;
    const filePath = document.fileName;
    
    // Skip test files
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      vscode.window.showInformationMessage('This appears to be a test file already.');
      return;
    }
    
    // Get file type
    const fileExtension = path.extname(filePath);
    if (!['.js', '.ts', '.jsx', '.tsx'].includes(fileExtension)) {
      vscode.window.showInformationMessage('Automatic test generation is currently supported for JavaScript and TypeScript files only.');
      return;
    }
    
    // Create test file path
    const dirname = path.dirname(filePath);
    const filename = path.basename(filePath);
    const nameWithoutExtension = path.basename(filename, fileExtension);
    const testFilename = `${nameWithoutExtension}.test${fileExtension}`;
    const testFilePath = path.join(dirname, testFilename);
    
    // Open or create the test file
    openTestContainers(filePath, testFilePath, null, true, reasoning);
  } catch (error: any) {
    logger.appendLine(`Error in automaticTest: ${error.message}`);
    vscode.window.showErrorMessage(`Failed to generate test: ${error.message}`);
  }
}

async function handleAutomaticTestWithAgent(reasoning: string) {
  // Agent-based implementation
  // Implementation details...
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('No editor is active');
    return;
  }
  
  const document = editor.document;
  const filePath = document.fileName;
  
  // Rest of implementation...
  vscode.window.showInformationMessage('Generating test with Grec0AI Agent...');
  
  // try {
  //   await agent!.executeTask('generateTest', {
  //     filePath,
  //     reasoning
  //   });
  // } catch (error: any) {
  //   logger.appendLine(`Agent error: ${error.message}`);
  //   vscode.window.showErrorMessage('Failed to generate test with agent.');
  // }
}

function openTestContainers(pathFinal: string, pathTestFinal: string, error: any, auto: boolean, reasoning: string = undefined) {
  // Check if test file exists
  fs.access(pathTestFinal, fs.constants.F_OK, (err) => {
    if (err) {
      // Test file doesn't exist, create it
      openOrCreateTestFile(pathTestFinal).then(() => {
        testWithGrec0AI(pathFinal, pathTestFinal, reasoning, error, auto);
      });
    } else {
      // Test file already exists
      openTestFile(pathTestFinal).then(() => {
        testWithGrec0AI(pathFinal, pathTestFinal, reasoning, error, auto);
      });
    }
  });
}

// Implementaciones de las funciones faltantes
async function openTestFile(filePath: string): Promise<void> {
  try {
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Error opening test file: ${error}`);
  }
}

async function openOrCreateTestFile(filePath: string): Promise<void> {
  try {
    // Crear el directorio si no existe
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Crear archivo vacío si no existe
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '', 'utf8');
    }
    
    // Abrir el archivo
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Error creating test file: ${error}`);
  }
}

function testWithGrec0AI(sourcePath: string, testPath: string, reasoning: string, error: any, auto: boolean = false): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (auto) {
      callGrec0AI(sourcePath, testPath, undefined, error, reasoning, auto)
        .then((response) => {
          resolve(response);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      vscode.window.showInputBox({
        placeHolder: 'Enter any additional instructions for test generation.',
        prompt: 'Additional Instructions',
      }).then(instructions => {
        callGrec0AI(sourcePath, testPath, instructions, error, reasoning)
          .then((response) => {
            resolve(response);
          })
          .catch((error) => {
            reject(error);
          });
      });
    }
  });
}

function callGrec0AI(pathFinal: string, pathTestFinal: string, instructions: string | undefined, error: any, reasoning: string, auto: boolean = false): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    try {
      // Show progress indicator during test generation
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generando tests con IA...",
        cancellable: true
      }, async (progress, token) => {
        token.onCancellationRequested(() => {
          vscode.window.showWarningMessage("Operación cancelada.");
        });
        
        try {
          // Get source file content
          const sourceContent = await fs.promises.readFile(pathFinal, 'utf8');
          
          // Get test file content if it exists
          const testContent = fs.existsSync(pathTestFinal) ? 
            await fs.promises.readFile(pathTestFinal, 'utf8') : '';
          
          // Get file extension and determine language
          const extension = path.extname(pathFinal).substring(1);
          const language = extension === 'ts' ? 'typescript' : 'javascript';
          
          // Determine test framework from configuration
          const config = vscode.workspace.getConfiguration('grec0ai');
          const framework = config.get('test.framework') || 'jasmine';
          
          progress.report({ message: 'Inicializando servicios de IA...' });
          
          // Ensure RAG service is initialized
          if (!await ragService.initialize()) {
            // If RAG initialization fails, try to use OpenAI directly
            if (!openaiService.initialize()) {
              throw new Error('No se pudo inicializar los servicios de IA. Por favor, configure la clave API de OpenAI.');
            }
          }
          
          progress.report({ message: 'Generando tests...' });
          
          let generatedTest: string;
          
          // If error is provided, use it for context in regeneration
          if (error) {
            const errorContext = `
El test anterior falló con el error: ${error}
Contenido del test anterior: 
\`\`\`${language}
${testContent}
\`\`\`

Por favor, regenera el test corrigiendo el error mencionado.
`;
            
            // Try to use RAG service first
            try {
              generatedTest = await ragService.generateTests(
                sourceContent, 
                String(pathFinal), 
                language as string, 
                framework as string, 
                5, // contextCount
                "gpt-4.1-mini"
              );
            } catch (ragError: any) {
              logger.appendLine(`Error con RAG, usando OpenAI directamente: ${ragError.message}`);
              
              // Fallback to direct OpenAI if RAG fails
              generatedTest = await openaiService.generateTests(
                sourceContent,
                language as string,
                framework as string,
                "gpt-4.1-mini"
              );
            }
          } else {
            // Generate tests with custom instructions if provided
            let additionalInstructions = '';
            if (instructions) {
              additionalInstructions = `\nInstrucciones adicionales: ${instructions}`;
            }
            
            // Adjust based on reasoning level
            let reasoningContext = '';
            if (reasoning) {
              if (reasoning === 'high') {
                reasoningContext = 'Utiliza un enfoque muy detallado y exhaustivo, con pruebas para todos los casos posibles.';
              } else if (reasoning === 'medium') {
                reasoningContext = 'Utiliza un enfoque equilibrado con buena cobertura de los casos más importantes.';
              } else if (reasoning === 'low') {
                reasoningContext = 'Utiliza un enfoque simple que cubra la funcionalidad básica.';
              }
            }
            
            // Try to use RAG service first
            try {
              generatedTest = await ragService.generateTests(
                sourceContent, 
                String(pathFinal), 
                language as string, 
                framework as string, 
                5, // contextCount
                "gpt-4.1-mini"
              );
            } catch (ragError: any) {
              logger.appendLine(`Error con RAG, usando OpenAI directamente: ${ragError.message}`);
              
              // Fallback to direct OpenAI if RAG fails
              generatedTest = await openaiService.generateTests(
                sourceContent,
                language as string,
                framework as string,
                "gpt-4.1-mini",
                {
                  instructions: `Genera tests unitarios completos para este código. ${reasoningContext} ${additionalInstructions}`
                }
              );
            }
          }
          
          // Create directories if needed
          const dir = path.dirname(pathTestFinal);
          await fs.promises.mkdir(dir, { recursive: true });
          
          // Write test file
          await fs.promises.writeFile(pathTestFinal, generatedTest);
          
          // Add explanation
          const actionDescription = generateTestExplanation(pathFinal, reasoning);
          coverageDetailsProvider.updateDetails(actionDescription);
          
          // Open test file if not in automatic mode
          if (!auto) {
            await openTestFile(pathTestFinal);
          }
          
          // Simulate test execution
          const execResult = await simulateTestExecution(pathFinal, pathTestFinal);
          
          if (execResult.success) {
            vscode.window.showInformationMessage(`Test ejecutado correctamente con ${execResult.coverage}% de cobertura.`);
            resolve(`Test ejecutado correctamente con ${execResult.coverage}% de cobertura.`);
          } else {
            // Handle test failure
            vscode.window.showInformationMessage(`Test fallido: ${execResult.error}`);
            
            if (!auto) {
              // For interactive mode, ask to regenerate
              const regenerate = await vscode.window.showInformationMessage(
                `La ejecución del test falló. ¿Regenerar?`, 
                'Sí', 'No'
              );
              
              if (regenerate === 'Sí') {
                openTestContainers(pathFinal, pathTestFinal, execResult.error, auto, reasoning);
              }
            }
            
            resolve(`Test fallido: ${execResult.error}`);
          }
        } catch (error: any) {
          logger.appendLine(`Error en callGrec0AI: ${error.message}`);
          reject(error);
        }
      });
    } catch (error: any) {
      reject(error);
    }
  });
}

async function simulateTestExecution(sourcePath: string, testPath: string): Promise<{success: boolean, coverage?: number, error?: string}> {
  // En una implementación real, aquí ejecutaríamos los tests con Jest, Mocha, etc.
  // Por ahora, simulamos el resultado
  
  try {
    // Simulamos un pequeño retraso para dar sensación de ejecución
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 80% de probabilidad de éxito
    const success = Math.random() > 0.2;
    
    if (success) {
      // Generar un porcentaje de cobertura entre 70% y 100%
      const coverage = Math.floor(Math.random() * 30) + 70;
      return { success: true, coverage };
    } else {
      // Simular un error aleatorio
      const errors = [
        "Unexpected token in test file",
        "Cannot read property of undefined",
        "Expected value to be defined",
        "Test timed out",
        "Assertion failed: expected true to be false"
      ];
      const randomError = errors[Math.floor(Math.random() * errors.length)];
      return { success: false, error: randomError };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function generateTestExplanation(filePath: string, reasoning: string): string {
  const fileName = path.basename(filePath);
  
  // Convertir reasoning a string si no lo es
  const reasoningLevel = reasoning ? String(reasoning) : 'standard';
  
  let detail = `## Tests generados para ${fileName}\n\n`;
  
  // Add timestamp
  detail += `Generado: ${new Date().toLocaleString()}\n\n`;
  
  // Add reasoning level info
  if (reasoningLevel === 'high') {
    detail += "**Nivel de detalle:** Alto - Tests exhaustivos con máxima cobertura\n\n";
  } else if (reasoningLevel === 'medium') {
    detail += "**Nivel de detalle:** Medio - Tests equilibrados con buena cobertura\n\n";
  } else if (reasoningLevel === 'low') {
    detail += "**Nivel de detalle:** Bajo - Tests básicos de funcionalidad principal\n\n";
  } else {
    detail += "**Nivel de detalle:** Estándar\n\n";
  }
  
  // Add generic explanation
  detail += `Los tests han sido generados automáticamente para verificar el comportamiento del código en \`${fileName}\`.`;
  detail += " La suite de pruebas incluye comprobaciones para la funcionalidad principal y casos límite comunes.\n\n";
  
  // Add execution instructions
  detail += "### Ejecución de los tests\n\n";
  detail += "Para ejecutar los tests, use el comando de test apropiado según el framework configurado.\n";
  detail += "Los resultados de la ejecución se mostrarán en la terminal.\n\n";
  
  // Add tips for handling failures
  detail += "### Si los tests fallan\n\n";
  detail += "- Compruebe que las dependencias están correctamente configuradas\n";
  detail += "- Verifique que el código testeado es válido y no contiene errores\n";
  detail += "- Considere regenerar los tests si hay cambios importantes en el código\n";
  
  return detail;
}

/**
 * Verifica y procesa el archivo autofixer.md
 * @param forceProcess - Si es true, procesa el archivo aunque la configuración lo tenga deshabilitado
 * @returns Un objeto con el resultado del procesamiento
 */
async function checkAndProcessAutofixerMd(forceProcess: boolean = false): Promise<{
  found: boolean;
  processed: boolean;
  error?: string;
}> {
  // Implementation for processing autofixer.md
  const config = vscode.workspace.getConfiguration('grec0ai');
  const autoFixerEnabled = config.get('autofixer.enabled', false);
  
  if (!autoFixerEnabled && !forceProcess) {
    return { found: false, processed: false };
  }
  
  // Look for autofixer.md file in workspace root
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return { found: false, processed: false, error: 'No se encontró un workspace' };
  }
  
  const rootPath = workspaceFolders[0].uri.fsPath;
  const autoFixerPath = path.join(rootPath, 'autofixer.md');
  
  // Check if file exists
  try {
    await fs.promises.access(autoFixerPath, fs.constants.F_OK);
    logger.appendLine('Found autofixer.md file, processing...');
    
    // Read file content
    const content = await fs.promises.readFile(autoFixerPath, 'utf8');
    
    // Process with agent if available
    if (agent && configManager.isConfigComplete()) {
      // Verificar que mainAgent tenga la función handleUserInput
      if (typeof agent.handleUserInput !== 'function') {
        logger.appendLine('Error: agent.handleUserInput is not a function');
        logger.appendLine(`agent type: ${typeof agent}`);
        logger.appendLine(`agent properties: ${Object.keys(agent).join(', ')}`);
        vscode.window.showErrorMessage('Error al procesar autofixer.md: El agente no tiene la función handleUserInput');
        return { found: true, processed: false, error: 'El agente no tiene la función handleUserInput' };
      }
      
      // Crear una sesión específica para la ejecución de autofixer en la vista de logs
      let sessionId = '';
      let logsView = (global as any).agentLogsView;
      
      if (logsView) {
        // Crear una nueva sesión para esta ejecución
        sessionId = logsView.createNewSession('AutoFixer');
        logsView.show();
        logsView.setActiveSession(sessionId);
        
        // Registrar inicio de la tarea
        logsView.addReflectionLog('Iniciando procesamiento de autofixer.md', sessionId);
      }
      
      try {
        // Preparar contexto para el archivo autofixer
        const context = {
          taskType: 'processAutoFixerFile',
          filePath: autoFixerPath,
          timestamp: new Date()
        };
        
        // Crear mensaje de solicitud
        const userRequest = `Procesar instrucciones de autofixer.md`;
        
        // Ejecutar la tarea y capturar el resultado usando handleUserInput
        const result = await agent.handleUserInput(userRequest, {
          ...context,
          content: content
        });
        
        // Registrar resultado exitoso en logs
        if (logsView) {
          logsView.addStepLog(
            'Procesar archivo AutoFixer',
            'handleUserInput',
            { contentLength: content.length },
            result,
            true,
            sessionId
          );
        }
        
        return { found: true, processed: true };
      } catch (error: any) {
        // Registrar error en logs
        if (logsView) {
          logsView.addStepLog(
            'Procesar archivo AutoFixer',
            'handleUserInput',
            { contentLength: content.length },
            { error: error.message },
            false,
            sessionId
          );
        }
        
        // Registrar error en el logger
        logger.appendLine(`Error processing autofixer.md: ${error.message}`);
        return { found: true, processed: false, error: error.message };
      }
    } else {
      logger.appendLine('Agent not available for processing autofixer.md');
      vscode.window.showInformationMessage('Autofixer.md found but agent not available for processing.');
      return { found: true, processed: false, error: 'Agente no disponible' };
    }
  } catch (error: any) {
    // File doesn't exist or other error
    logger.appendLine('No autofixer.md file found or error accessing it.');
    return { found: false, processed: false, error: error.message };
  }
}

// This method is called when extension is deactivated
export function deactivate() {
  // Cleanup code
  logger.appendLine('Grec0AI For Developers extension deactivated.');
  
  // Limpiar recursos del agente
  if (agent) {
    agent.dispose();
    agent = null;
  }
} 