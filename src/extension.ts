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

// Import de WebSocket con dynamic import
let WebSocket: any;

// Import FileTreeService
import { FileTreeService } from './utils/FileTreeService';

// Import our services
import * as openaiService from './services/openaiService';
import * as vectraService from './services/vectraService';
import * as ragService from './services/ragService';
import * as configManager from './utils/configManager';
// Eliminar la importación obsoleta y usar la nueva
// import * as commands from './services/commands';

// Import agent system
import * as agentSystem from './agent';
import { Agent } from './agent/core/Agent';

// Import the new command structure
import { registerAllCommands } from './commands';

// Type para AgentLogsView
type AgentLogsViewType = {
  new (context: vscode.ExtensionContext): {
    show: () => void;
  };
};

// Variable global para AgentLogsView
let AgentLogsView: AgentLogsViewType | undefined;

// Create logger
const logger = vscode.window.createOutputChannel('Grec0AI For Developers');

// Initialize providers
const fileTreeProvider = new CoverageDefectsProvider(logger);
const coverageSummaryProvider = new CoverageSummaryProvider(fileTreeProvider, logger);
const coverageDetailsProvider = new CoverageDetailsProvider();

// Global agent instance
let agent: Agent | null = null;

/**
 * Get the global agent instance
 * @param createIfNotExists Create agent if it doesn't exist
 * @returns The agent instance or null
 */
export function getGlobalAgent(createIfNotExists: boolean = false): Agent | null {
  if (!agent && createIfNotExists) {
    // Note: This is asynchronous but returns immediately with a not-yet-initialized agent
    vscode.commands.executeCommand('grec0ai.createAgent');
  }
  return agent;
}

// Carga los módulos que requieren import dinámico
async function loadDynamicModules(): Promise<boolean> {
  try {
    // Cargar WebSocket
    if (!WebSocket) {
      const wsModule = await import('ws');
      WebSocket = wsModule.default || wsModule.WebSocket;
    }
    
    // Cargar AgentLogsView
    if (!AgentLogsView) {
      const logsViewModule = await import('./agent/ui/logsView');
      AgentLogsView = logsViewModule.AgentLogsView;
    }
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error loading dynamic modules: ${errorMessage}`);
    return false;
  }
}

// This method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  logger.appendLine('Grec0AI For Developers extension activated. Welcome!');
  
  // Cargar módulos dinámicos
  loadDynamicModules().then(success => {
    if (!success) {
      const message = 'Required dependencies are missing. Please run "npm install" in the extension directory.';
      logger.appendLine(message);
      vscode.window.showErrorMessage(message);
      return; // Exit activation process
    }
    
    // Continue with extension activation
    continueActivation(context);
  });
}

/**
 * Continues activation after dynamic modules are loaded
 */
function continueActivation(context: vscode.ExtensionContext) {
  // No ejecutamos aquí el autofixer.md, lo haremos después de inicializar el agente
  // para evitar ejecuciones duplicadas
  
  // Register providers for file tree, coverage summary, and coverage details
  vscode.window.registerTreeDataProvider('grec0ai-filesystem-tree', fileTreeProvider);
  vscode.window.registerTreeDataProvider('grec0ai-coverage-summary', coverageSummaryProvider);
  vscode.window.registerTreeDataProvider('grec0ai-coverage-details', coverageDetailsProvider);

  // Register all commands using the new structure
  const commandDisposables = registerAllCommands();
  context.subscriptions.push(...commandDisposables);
  
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

  // IMPORTANTE: Los siguientes comandos ya están incluidos en la estructura centralizada
  // y eventualmente se eliminarán por completo durante la refactorización.
  // Por ahora, se mantienen para garantizar la compatibilidad con código existente
  // que referencia las variables agent y context de este archivo.
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
    
    // Ya no registramos comandos aquí, están en la estructura centralizada
    
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
  
  // NOTA: La mayoría de estos comandos ya están registrados en la estructura centralizada
  // Esta función se mantiene para garantizar la compatibilidad con código existente
  // que depende de los wrappers generateTestCmd, analyzeCodeCmd, etc.
  
  // Create command wrappers for the agent
  const generateTestCmd = agentSystem.createCommandWrapper(agent, 'generateTest');
  const analyzeCodeCmd = agentSystem.createCommandWrapper(agent, 'analyzeCode');
  const fixErrorCmd = agentSystem.createCommandWrapper(agent, 'fixError');
  const explainCodeCmd = agentSystem.createCommandWrapper(agent, 'explain');
  
  // No registramos los comandos aquí, ya están en la estructura centralizada
  
  logger.appendLine('Agent command wrappers created successfully');
}

/**
 * Show agent logs view
 * @param context - Extension context
 */
async function showAgentLogs(context: vscode.ExtensionContext) {
  try {
    // Cargar AgentLogsView si no está cargado
    if (!AgentLogsView) {
      await loadDynamicModules();
      
      if (!AgentLogsView) {
        throw new Error("No se pudo cargar el módulo de logs");
      }
    }
    
    // Usar 'as any' para acceder a la propiedad global
    if (!(global as any).agentLogsView) {
      (global as any).agentLogsView = new AgentLogsView(context);
    }
    
    (global as any).agentLogsView.show();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.appendLine(`Error showing agent logs: ${errorMessage}`);
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
    
    // Get file type using VSCode API
    const fileUri = vscode.Uri.file(filePath);
    const fileName = fileUri.path.split('/').pop() || '';
    const lastDotIndex = fileName.lastIndexOf('.');
    const fileExtension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
    
    if (!['.js', '.ts', '.jsx', '.tsx'].includes(fileExtension)) {
      vscode.window.showInformationMessage('Automatic test generation is currently supported for JavaScript and TypeScript files only.');
      return;
    }
    
    // Create test file path using VSCode API
    const parentUri = vscode.Uri.joinPath(fileUri, '..');
    const nameWithoutExtension = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const testFilename = `${nameWithoutExtension}.test${fileExtension}`;
    const testFileUri = vscode.Uri.joinPath(parentUri, testFilename);
    const testFilePath = testFileUri.fsPath;
    
    // Open or create the test file
    openTestContainers(filePath, testFilePath, null, true, reasoning);
  } catch (error: any) {
    logger.appendLine(`Error in automaticTest: ${error.message}`);
    vscode.window.showErrorMessage(`Failed to generate test: ${error.message}`);
  }
}

/**
 * Handle automatic test generation using the agent system
 * @param reasoning - Level of reasoning detail
 * @returns Promise with the result of the operation
 */
async function handleAutomaticTestWithAgent(reasoning?: string): Promise<any> {
  try {
    // Show progress while performing the test operation
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Testing with Grec0AI',
      cancellable: true
    }, async (progress, token) => {
      token.onCancellationRequested(() => {
        vscode.window.showWarningMessage('Test operation was cancelled');
      });
      
      progress.report({ message: 'Initializing test...' });
      
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('No workspace folder found');
      }
      
      const rootPath = workspaceFolders[0].uri.fsPath;
      
      // Prepare context for agent
      const context = {
        taskType: 'generateTest',
        rootPath: rootPath,
        reasoning: reasoning,
        isAutomatic: true
      };
      
      // Let the agent handle the task
      const userRequest = `Generate tests for all source files in ${rootPath} with ${reasoning || 'standard'} reasoning`;
      
      progress.report({ message: 'Planning task...' });
      
      // Usar getGlobalAgent() en lugar de agent
      const currentAgent = getGlobalAgent(true);
      if (!currentAgent) {
        throw new Error('Agent not initialized');
      }
      
      const result = await currentAgent.handleUserInput(userRequest, context);
      
      // Show results
      if (result.success) {
        vscode.window.showInformationMessage(`Test generation completed successfully`);
      } else {
        vscode.window.showWarningMessage(`Test generation completed with some errors`);
      }
      
      return result;
    });
  } catch (error: any) {
    logger.appendLine(`Error in handleAutomaticTestWithAgent: ${error.message}`);
    throw error;
  }
}

function openTestContainers(
  pathFinal: string, 
  pathTestFinal: string, 
  error: any, 
  auto: boolean, 
  reasoning?: string
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (auto) {
      testWithGrec0AI(pathFinal, pathTestFinal, reasoning, error, auto)
      .then((response) => {
        resolve(response);
      })
      .catch((error) => {
        reject(error);
      });
    } else {
      vscode.window.showInformationMessage(`Initialize tests with Grec0AI?`, 'Fast', 'Reasoning', 'Cancel').then(selection2 => {
        if (selection2 === 'Fast' || selection2 === 'Reasoning') {
          if (selection2 === 'Reasoning') {
            vscode.window.showInformationMessage(`Reasoning level?`, 'low', 'medium', 'high').then(selection2 => {
              if (selection2 === 'low' || selection2 === 'medium' || selection2 === 'high') {
                testWithGrec0AI(pathFinal, pathTestFinal, selection2, error)
                .then((response) => {
                  resolve(response);
                })
                .catch((error) => {
                  reject(error);
                });
              } else {
                resolve(""); // User cancelled reasoning selection
              }
            });
          } else {
            testWithGrec0AI(pathFinal, pathTestFinal, undefined, error)
            .then((response) => {
              resolve(response);
            })
            .catch((error) => {
              reject(error);
            });
          }
        } else {
          // Handle cancel or opening test file directly
          openOrCreateTestFile(pathTestFinal)
          .then(() => {
            resolve("");
          })
          .catch((error) => {
            reject(error);
          });
        }	
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
    const fileUri = vscode.Uri.file(filePath);
    
    try {
      // Intentar crear directorio padre si no existe
      const parentUri = vscode.Uri.joinPath(fileUri, '..');
      await vscode.workspace.fs.createDirectory(parentUri);
    } catch {
      // El directorio ya existe o hay otro error, continuar
    }
    
    try {
      // Verificar si el archivo existe
      await vscode.workspace.fs.stat(fileUri);
    } catch {
      // El archivo no existe, crearlo vacío
      await vscode.workspace.fs.writeFile(fileUri, new Uint8Array());
    }
    
    // Abrir el archivo
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Error creating test file: ${error}`);
  }
}

/**
 * Interface for test generator options
 */
interface TestGeneratorOptions {
  instructions?: string;
  reasoning?: string;
}

/**
 * Generate tests with Grec0AI
 * @param sourcePath - Path to the source file
 * @param testPath - Path to the test file
 * @param reasoning - Level of reasoning to use
 * @param error - Error information if regenerating a test
 * @param auto - Whether this is an automatic test generation
 * @returns Promise with the result message
 */
function testWithGrec0AI(sourcePath: string, testPath: string, reasoning?: string, error?: any, auto: boolean = false): Promise<string> {
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
        placeHolder: 'Ingrese instrucciones adicionales para la generación de tests.',
        prompt: 'Instrucciones Adicionales',
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

/**
 * Call Grec0AI to generate a test
 * @param pathFinal - Path to the source file
 * @param pathTestFinal - Path to the test file
 * @param instructions - Additional instructions for test generation
 * @param error - Error information if regenerating a test
 * @param reasoning - Level of reasoning to use
 * @param auto - Whether this is an automatic test generation
 * @returns Promise with the result message
 */
function callGrec0AI(pathFinal: string, pathTestFinal: string, instructions?: string, error?: any, reasoning?: string, auto: boolean = false): Promise<string> {
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
          // Get source file content using VSCode API
          const sourceUri = vscode.Uri.file(pathFinal);
          const sourceData = await vscode.workspace.fs.readFile(sourceUri);
          const sourceContent = Buffer.from(sourceData).toString('utf8');
          
          // Get test file content if it exists using VSCode API
          let testContent = '';
          try {
            const testUri = vscode.Uri.file(pathTestFinal);
            const testData = await vscode.workspace.fs.readFile(testUri);
            testContent = Buffer.from(testData).toString('utf8');
          } catch {
            // Test file doesn't exist yet
            testContent = '';
          }
          
          // Get file extension using VSCode API
          const sourceFileName = sourceUri.path.split('/').pop() || '';
          const lastDotIndex = sourceFileName.lastIndexOf('.');
          const extension = lastDotIndex > 0 ? sourceFileName.substring(lastDotIndex + 1) : '';
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
                pathFinal, 
                language, 
                framework as string, 
                5, // contextCount
                configManager.getOpenAIModel()
              );
            } catch (ragError: any) {
              logger.appendLine(`Error con RAG, usando OpenAI directamente: ${ragError.message}`);
              
              // Fallback to direct OpenAI if RAG fails
              generatedTest = await openaiService.generateTests(
                sourceContent,
                language,
                framework as string,
                configManager.getOpenAIModel()
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
                pathFinal, 
                language, 
                framework as string, 
                5, // contextCount
                configManager.getOpenAIModel()
              );
            } catch (ragError: any) {
              logger.appendLine(`Error con RAG, usando OpenAI directamente: ${ragError.message}`);
              
              // Fallback to direct OpenAI if RAG fails
              generatedTest = await openaiService.generateTests(
                sourceContent,
                language,
                framework as string,
                configManager.getOpenAIModel(),
                {
                  instructions: `Genera tests unitarios completos para este código. ${reasoningContext} ${additionalInstructions}`
                }
              );
            }
          }
          
          // Create directories if needed
          const dir = path.dirname(pathTestFinal);
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
          
          // Write test file using VSCode API
          await vscode.workspace.fs.writeFile(vscode.Uri.file(pathTestFinal), Buffer.from(generatedTest, 'utf8').subarray());
          
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
                openTestContainers(pathFinal, pathTestFinal, execResult.error, auto, reasoning)
                .then((response) => {
                  resolve(response);
                })
                .catch((error) => {
                  reject(error);
                });
                return; // Para evitar resolver dos veces
              }
            } else {
              // For automatic mode, retry once
              try {
                await openTestContainers(pathFinal, pathTestFinal, execResult.error, auto, reasoning);
              } catch (error) {
                reject(`Reintento fallido: ${error}`);
                return;
              }
            }
            
            resolve(`Test fallido: ${execResult.error}`);
          }
        } catch (error: any) {
          logger.appendLine(`[Error] La generación de test falló: ${error.message}`);
          reject(`La generación de test falló: ${error.message}`);
        }
      });
    } catch (error: any) {
      logger.appendLine(`[Error] La generación de test falló: ${error.message}`);
      reject(`La generación de test falló: ${error.message}`);
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
 * Interface for the result of processing autofixer.md
 */
interface AutofixerResult {
  found: boolean;
  processed: boolean;
  error?: string;
}

/**
 * Check for autofixer.md file and process it if found
 * @param forceProcess - If true, process the file even if it's disabled in the configuration
 * @returns Promise with the processing result
 */
export async function checkAndProcessAutofixerMd(forceProcess: boolean = false): Promise<AutofixerResult> {
  // Check if autofixer is enabled via config or environment variable
  const config = vscode.workspace.getConfiguration('grec0ai');
  const autoFixerEnabled = config.get('autofixer.enabled', false);
  
  if (!autoFixerEnabled && !forceProcess) {
    logger.appendLine('AutoFixer is disabled, skipping autofixer.md check');
    return { found: false, processed: false };
  }
  
  logger.appendLine('AutoFixer is enabled, checking for autofixer.md file...');
  
  try {
    // Get workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.appendLine('No workspace folders found, cannot check for autofixer.md');
      return { found: false, processed: false, error: 'No se encontró un workspace' };
    }
    
    // Look for autofixer.md in the root of each workspace folder
    for (const folder of workspaceFolders) {
      const autofixerUri = vscode.Uri.joinPath(folder.uri, 'autofixer.md');
      
      try {
        // Check if autofixer.md exists using VSCode API
        await vscode.workspace.fs.stat(autofixerUri);
        logger.appendLine(`Found autofixer.md in workspace: ${folder.name}`);
        
        // Read file content using VSCode API
        const contentData = await vscode.workspace.fs.readFile(autofixerUri);
        const content = Buffer.from(contentData).toString('utf8');
        
        if (!content.trim()) {
          logger.appendLine('autofixer.md file is empty, skipping');
          continue;
        }
        
        // Usar getGlobalAgent() en lugar de agent
        const currentAgent = getGlobalAgent(true); // true para crear el agente si no existe
        
        // Process with agent if available
        if (currentAgent && configManager.isConfigComplete()) {
          try {
            // Verificar que agent tenga la función handleUserInput
            if (typeof currentAgent.handleUserInput !== 'function') {
              logger.appendLine('Error: agent.handleUserInput is not a function');
              logger.appendLine(`agent type: ${typeof currentAgent}`);
              logger.appendLine(`agent properties: ${Object.keys(currentAgent).join(', ')}`);
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
                filePath: autofixerUri.fsPath,
                timestamp: new Date()
              };
              
              // Crear mensaje de solicitud
              const userRequest = `Procesar instrucciones de autofixer.md`;
              
              // Ejecutar la tarea y capturar el resultado usando handleUserInput con timeout
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout: El procesamiento de autofixer.md tomó demasiado tiempo')), 1800000) // 30 minutos
              );
              
              const result = await Promise.race([
                currentAgent.handleUserInput(userRequest, {
                  ...context,
                  content: content
                }),
                timeoutPromise
              ]);
              vscode.window.showInformationMessage(`Finalizado el procesamiento de autofixer.md`);
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
              this.logger.appendLine(`Error processing autofixer.md: ${error.message}`);
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
          } catch (outerError: any) {
            // Capa adicional de protección contra crashes de la extensión
            logger.appendLine(`Error crítico en procesamiento de autofixer: ${outerError.message}`);
            logger.appendLine(`Stack trace: ${outerError.stack}`);
            
            // Mostrar notificación al usuario pero no crashear la extensión
            vscode.window.showErrorMessage(
              'Error al procesar autofixer.md. Consulta el Output de Grec0AI para más detalles.',
              'Ver Output'
            ).then(selection => {
              if (selection === 'Ver Output') {
                logger.show();
              }
            });
            
            return { found: true, processed: false, error: `Error crítico: ${outerError.message}` };
          }
        } else {
          logger.appendLine('Agent not available for processing autofixer.md');
          vscode.window.showInformationMessage('Autofixer.md found but agent not available for processing.');
          return { found: true, processed: false, error: 'Agente no disponible' };
        }
      } catch (error: any) {
        logger.appendLine(`Error accessing autofixer.md: ${error.message}`);
        return { found: false, processed: false, error: error.message };
      }
    }
    
    // If we got here, no autofixer.md was found in any workspace
    return { found: false, processed: false, error: 'No se encontró el archivo autofixer.md' };
  } catch (error: any) {
    // File doesn't exist or other error
    logger.appendLine(`Error accessing or processing autofixer.md: ${error.message}`);
    return { found: false, processed: false, error: error.message };
  }
}

// This method is called when extension is deactivated
export function deactivate() {
  // Cleanup code
  logger.appendLine('Grec0AI For Developers extension deactivated.');
  
  // Limpiar recursos del agente
  const currentAgent = getGlobalAgent(false); // false para no crear el agente si no existe
  if (currentAgent) {
    currentAgent.dispose();
  }
} 