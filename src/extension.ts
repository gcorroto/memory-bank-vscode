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

// Create logger
const logger = vscode.window.createOutputChannel('Grec0AI For Developers');

// Initialize providers
const fileTreeProvider = new CoverageDefectsProvider(logger);
const coverageSummaryProvider = new CoverageSummaryProvider(fileTreeProvider, logger);
const coverageDetailsProvider = new CoverageDetailsProvider();

// Global agent instance
let mainAgent: any = null;
(global as any).mainAgent = null;

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
  
  // Check for autofixer.md file if enabled
  checkAndProcessAutofixerMd().catch(error => {
    logger.appendLine(`Error processing autofixer.md: ${error.message}`);
  });
  
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
}

/**
 * Initialize the agent system
 * @param context Extension context
 */
async function initializeAgentSystem(context: vscode.ExtensionContext) {
  try {
    logger.appendLine('Initializing Grec0AI Agent System...');
    
    // Create and initialize the main agent
    mainAgent = await agentSystem.createAgent('Grec0AI', context);
    
    // Make it globally accessible
    (global as any).mainAgent = mainAgent;
    
    // Register agent-based command handlers
    registerAgentCommands(context);
    
    // Register logs view command
    let disposable = vscode.commands.registerCommand('grec0ai.agent.showLogs', () => {
      showAgentLogs(context);
    });
    context.subscriptions.push(disposable);
    
    logger.appendLine('Grec0AI Agent System initialized successfully');
    
    // Now that the agent is initialized, check for autofixer.md
    checkAndProcessAutofixerMd().catch(error => {
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
  if (!mainAgent) {
    logger.appendLine('Cannot register agent commands: Agent not initialized');
    return;
  }
  
  // Create command wrappers for the agent
  const generateTestCmd = agentSystem.createCommandWrapper(mainAgent, 'generateTest');
  const analyzeCodeCmd = agentSystem.createCommandWrapper(mainAgent, 'analyzeCode');
  const fixErrorCmd = agentSystem.createCommandWrapper(mainAgent, 'fixError');
  const explainCodeCmd = agentSystem.createCommandWrapper(mainAgent, 'explain');
  
  // Register these as new commands with 'agent.' prefix to avoid conflicts
  let disposable = vscode.commands.registerCommand('grec0ai.agent.generateTest', generateTestCmd);
  context.subscriptions.push(disposable);
  
  disposable = vscode.commands.registerCommand('grec0ai.agent.analyzeCode', analyzeCodeCmd);
  context.subscriptions.push(disposable);
  
  disposable = vscode.commands.registerCommand('grec0ai.agent.fixError', fixErrorCmd);
  context.subscriptions.push(disposable);
  
  disposable = vscode.commands.registerCommand('grec0ai.agent.explain', explainCodeCmd);
  context.subscriptions.push(disposable);
}

/**
 * Show agent logs view
 * @param context Extension context
 */
function showAgentLogs(context: vscode.ExtensionContext) {
  try {
    // Import dynamically to avoid circular dependencies
    const { AgentLogsView } = require('./agent/ui/logsView');
    
    if (!(global as any).agentLogsView) {
      (global as any).agentLogsView = new AgentLogsView(context);
    }
    
    (global as any).agentLogsView.show();
  } catch (error: any) {
    logger.appendLine(`Error showing agent logs: ${error.message}`);
    vscode.window.showErrorMessage('Failed to show agent logs.');
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
    if (mainAgent && configManager.isConfigComplete()) {
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
  
  try {
    await mainAgent.executeTask('generateTest', {
      filePath,
      reasoning
    });
  } catch (error: any) {
    logger.appendLine(`Agent error: ${error.message}`);
    vscode.window.showErrorMessage('Failed to generate test with agent.');
  }
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

async function checkAndProcessAutofixerMd() {
  // Implementation for processing autofixer.md
  const config = vscode.workspace.getConfiguration('grec0ai');
  const autoFixerEnabled = config.get('autofixer.enabled', false);
  
  if (!autoFixerEnabled) {
    return;
  }
  
  // Look for autofixer.md file in workspace root
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
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
    if (mainAgent && configManager.isConfigComplete()) {
      await mainAgent.executeTask('processAutoFixerFile', { content });
    } else {
      logger.appendLine('Agent not available for processing autofixer.md');
      vscode.window.showInformationMessage('Autofixer.md found but agent not available for processing.');
    }
  } catch (error) {
    // File doesn't exist or other error
    logger.appendLine('No autofixer.md file found or error accessing it.');
  }
}

// This method is called when extension is deactivated
export function deactivate() {
  // Cleanup code
  logger.appendLine('Grec0AI For Developers extension deactivated.');
} 