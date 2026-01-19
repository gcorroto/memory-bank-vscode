'use strict';

// VS Code extensibility API
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Import Memory Bank providers
import { ActiveAgentsProvider, ExternalRequestTreeItem } from './ActiveAgentsProvider';
import { RelationsViewer } from './agent/ui/RelationsViewer';
import { FrameworkComponentsProvider } from './FrameworkComponentsProvider';
import { IndexedFilesProvider } from './IndexedFilesProvider';
import { MemoryBankProjectsProvider } from './MemoryBankProjectsProvider';
import { ProjectDocsProvider } from './ProjectDocsProvider';
import { RelationsTreeProvider } from './RelationsTreeProvider';
import { getMemoryBankService } from './services/memoryBankService';
import { ProjectInfo } from './types/memoryBank';

// Import de WebSocket con dynamic import
let WebSocket: any;

// Import our services
import * as openaiService from './services/openaiService';
import * as configManager from './utils/configManager';

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
const logger = vscode.window.createOutputChannel('Memory Bank Inspector');

// Initialize Memory Bank providers
const memoryBankProjectsProvider = new MemoryBankProjectsProvider(logger);
const indexedFilesProvider = new IndexedFilesProvider(logger);
const projectDocsProvider = new ProjectDocsProvider(logger);
const relationsTreeProvider = new RelationsTreeProvider(logger);
const frameworkComponentsProvider = new FrameworkComponentsProvider(logger);
const activeAgentsProvider = new ActiveAgentsProvider(logger);

// Relations viewer instance
let relationsViewer: RelationsViewer | null = null;

// Global agent instance
let agent: Agent | null = null;

// FileSystemWatcher for Memory Bank
let memoryBankWatcher: vscode.FileSystemWatcher | null = null;

/**
 * Get the global agent instance
 * @param createIfNotExists Create agent if it doesn't exist
 * @returns The agent instance or null
 */
export function getGlobalAgent(createIfNotExists: boolean = false): Agent | null {
  if (!agent && createIfNotExists) {
    // Note: This is asynchronous but returns immediately with a not-yet-initialized agent
    vscode.commands.executeCommand('memorybank.createAgent');
  }
  return agent;
}

// Carga los módulos que requieren import dinámico
async function loadDynamicModules(): Promise<boolean> {
  try {
    // Cargar WebSocket
    // if (!WebSocket) {
    //   const wsModule = await import('ws');
    //   WebSocket = wsModule.default || wsModule.WebSocket;
    // }
    
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
  logger.appendLine('Memory Bank Inspector extension activated. Welcome!');
  
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
  // Store context globally for commands access
  (global as any).extensionContext = context;
  
  // Register Memory Bank providers
  vscode.window.registerTreeDataProvider('memorybank-projects', memoryBankProjectsProvider);
  vscode.window.registerTreeDataProvider('memorybank-files', indexedFilesProvider);
  vscode.window.registerTreeDataProvider('memorybank-docs', projectDocsProvider);
  vscode.window.registerTreeDataProvider('memorybank-relations', relationsTreeProvider);
  vscode.window.registerTreeDataProvider('memorybank-frameworks', frameworkComponentsProvider);
  vscode.window.registerTreeDataProvider('memorybank-agents', activeAgentsProvider);

  // Initialize Relations Viewer
  relationsViewer = new RelationsViewer(context);

  // Register Memory Bank commands
  registerMemoryBankCommands(context);

  // Register Relations commands
  registerRelationsCommands(context);

  // Setup Memory Bank file watcher
  setupMemoryBankWatcher(context);

  // Initialize UI viewers
  initializeUIViewers(context);

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

  // Log Memory Bank status and set up logging
  const mbService = getMemoryBankService();
  mbService.setOutputChannel(logger); // Enable logging to the OutputChannel
  if (mbService.memoryBankExists()) {
    logger.appendLine('Memory Bank found at: ' + mbService.getMemoryBankPath());
  } else {
    logger.appendLine('Memory Bank not configured or not found.');
  }
}

/**
 * Register Memory Bank related commands
 */
function registerMemoryBankCommands(context: vscode.ExtensionContext) {
  // Refresh all Memory Bank views
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.refresh', () => {
      logger.appendLine('Refreshing Memory Bank views...');
      memoryBankProjectsProvider.refresh();
      indexedFilesProvider.refresh();
      projectDocsProvider.refresh();
      activeAgentsProvider.refresh();
    })
  );

  // Select a project
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.selectProject', (projectInfo: ProjectInfo) => {
      logger.appendLine(`Selecting project: ${projectInfo.id}`);
      memoryBankProjectsProvider.setSelectedProject(projectInfo);
      projectDocsProvider.setSelectedProject(projectInfo);
      activeAgentsProvider.setSelectedProject(projectInfo);
      
      // Show notification
      vscode.window.showInformationMessage(`Proyecto seleccionado: ${projectInfo.id}`);
    })
  );

  // Refresh Agents view
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.agents.refresh', () => {
      logger.appendLine('Refreshing Agents view...');
      activeAgentsProvider.refresh();
    })
  );

  // Helper function to update request status in agentBoard.md
  async function updateExternalRequestStatus(item: ExternalRequestTreeItem, newStatus: string) {
    const project = activeAgentsProvider.getSelectedProject();
    if (!project) {
        vscode.window.showErrorMessage('No project selected');
        return;
    }
    
    const service = getMemoryBankService();
    const mbPath = service.getMemoryBankPath();
    if (!mbPath) {
        vscode.window.showErrorMessage('Memory Bank not configured');
        return;
    }

    const boardPath = path.join(mbPath, 'projects', project.id, 'docs', 'agentBoard.md');
    if (!fs.existsSync(boardPath)) {
        vscode.window.showErrorMessage('Agent Board not found');
        return;
    }

    try {
        let content = fs.readFileSync(boardPath, 'utf-8');
        const lines = content.split('\n');
        const newLines = lines.map(line => {
            if (line.includes(`| ${item.id} |`)) {
                const parts = line.split('|');
                if (parts.length >= 7) {
                    // Update Status column (Index 5)
                    parts[5] = ` ${newStatus} `;
                    return parts.join('|');
                }
            }
            return line;
        });

        fs.writeFileSync(boardPath, newLines.join('\n'));
        vscode.window.showInformationMessage(`Request ${item.id} marked as ${newStatus}`);
        activeAgentsProvider.refresh();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update board: ${error}`);
    }
  }

  // Delete a project (including embeddings and project directory)
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.deleteProject', async (item: any) => {
      // Get project info from the tree item
      const projectInfo: ProjectInfo | undefined = item?.projectInfo;
      
      if (!projectInfo) {
        vscode.window.showErrorMessage('No se pudo obtener la información del proyecto');
        return;
      }

      // Confirm deletion with user
      const confirmation = await vscode.window.showWarningMessage(
        `¿Estás seguro de que deseas eliminar el proyecto "${projectInfo.id}"?\n\nEsto eliminará:\n• Todos los embeddings del proyecto en LanceDB\n• La documentación generada\n• El directorio del proyecto en Memory Bank\n\nEsta acción no se puede deshacer.`,
        { modal: true },
        'Eliminar',
        'Cancelar'
      );

      if (confirmation !== 'Eliminar') {
        return;
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Eliminando proyecto ${projectInfo.id}...`,
          cancellable: false
        },
        async (progress) => {
          try {
            progress.report({ message: 'Eliminando embeddings...' });
            logger.appendLine(`[Delete] Starting deletion of project: ${projectInfo.id}`);

            const result = await getMemoryBankService().deleteProject(projectInfo.id);

            if (result.success) {
              logger.appendLine(`[Delete] Project deleted successfully`);
              logger.appendLine(`[Delete] - Embeddings deleted: ${result.embeddingsDeleted}`);
              logger.appendLine(`[Delete] - Files removed from index: ${result.filesRemoved}`);

              vscode.window.showInformationMessage(
                `Proyecto "${projectInfo.id}" eliminado correctamente.\n` +
                `• ${result.embeddingsDeleted} embeddings eliminados\n` +
                `• ${result.filesRemoved} archivos eliminados del índice`
              );

              // Refresh views
              memoryBankProjectsProvider.refresh();
              indexedFilesProvider.refresh();
              projectDocsProvider.refresh();
              relationsTreeProvider.refresh();

              // Clear selected project if it was the deleted one
              if (memoryBankProjectsProvider.getSelectedProject()?.id === projectInfo.id) {
                memoryBankProjectsProvider.setSelectedProject(null);
                projectDocsProvider.setSelectedProject(null);
              }
            } else {
              logger.appendLine(`[Delete] Error deleting project: ${result.error}`);
              vscode.window.showErrorMessage(
                `Error al eliminar el proyecto: ${result.error}`
              );
            }
          } catch (error: any) {
            logger.appendLine(`[Delete] Exception: ${error.message}`);
            vscode.window.showErrorMessage(`Error al eliminar el proyecto: ${error.message}`);
          }
        }
      );
    })
  );

  // Clean up orphaned embeddings (embeddings from projects that no longer exist)
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.cleanupOrphanedEmbeddings', async () => {
      const confirmation = await vscode.window.showWarningMessage(
        '¿Limpiar embeddings huérfanos?\n\nEsto eliminará los embeddings de proyectos que ya no existen en el Memory Bank.',
        { modal: true },
        'Limpiar',
        'Cancelar'
      );

      if (confirmation !== 'Limpiar') {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Limpiando embeddings huérfanos...',
          cancellable: false
        },
        async (progress) => {
          try {
            progress.report({ message: 'Analizando base de datos...' });
            logger.appendLine('[Cleanup] Starting orphaned embeddings cleanup...');

            const result = await getMemoryBankService().cleanupOrphanedEmbeddings();

            if (result.success) {
              logger.appendLine(`[Cleanup] Cleanup completed successfully`);
              logger.appendLine(`[Cleanup] - Orphaned projects found: ${result.orphanedProjectIds.length}`);
              logger.appendLine(`[Cleanup] - Chunks deleted: ${result.chunksDeleted}`);
              
              if (result.orphanedProjectIds.length > 0) {
                logger.appendLine(`[Cleanup] - Project IDs cleaned: ${result.orphanedProjectIds.join(', ')}`);
              }

              if (result.chunksDeleted > 0) {
                vscode.window.showInformationMessage(
                  `Limpieza completada:\n` +
                  `• ${result.chunksDeleted} embeddings eliminados\n` +
                  `• ${result.orphanedProjectIds.length} proyectos huérfanos: ${result.orphanedProjectIds.join(', ')}`
                );
              } else {
                vscode.window.showInformationMessage('No se encontraron embeddings huérfanos.');
              }

              // Refresh views
              indexedFilesProvider.refresh();
            } else {
              logger.appendLine(`[Cleanup] Error: ${result.error}`);
              vscode.window.showErrorMessage(`Error durante la limpieza: ${result.error}`);
            }
          } catch (error: any) {
            logger.appendLine(`[Cleanup] Exception: ${error.message}`);
            vscode.window.showErrorMessage(`Error durante la limpieza: ${error.message}`);
          }
        }
      );
    })
  );

  // Delete a specific orphaned project's embeddings
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.deleteOrphanedProject', async (item: any) => {
      // Get project ID from the tree item
      const projectId: string | undefined = item?.filePath || item?.label;
      
      if (!projectId) {
        vscode.window.showErrorMessage('No se pudo obtener el ID del proyecto huérfano');
        return;
      }

      const confirmation = await vscode.window.showWarningMessage(
        `¿Eliminar embeddings del proyecto huérfano "${projectId}"?\n\nEsta acción no se puede deshacer.`,
        { modal: true },
        'Eliminar',
        'Cancelar'
      );

      if (confirmation !== 'Eliminar') {
        return;
      }

      try {
        logger.appendLine(`[Cleanup] Deleting orphaned project: ${projectId}`);
        
        const result = await getMemoryBankService().deleteOrphanedProjectEmbeddings(projectId);
        
        if (result.success) {
          logger.appendLine(`[Cleanup] Deleted ${result.chunksDeleted} chunks for orphaned project ${projectId}`);
          
          vscode.window.showInformationMessage(
            `Proyecto huérfano "${projectId}" eliminado.\n• ${result.chunksDeleted} embeddings eliminados`
          );
          
          // Refresh views
          indexedFilesProvider.refresh();
        } else {
          logger.appendLine(`[Cleanup] Error: ${result.error}`);
          vscode.window.showErrorMessage(`Error al eliminar proyecto huérfano: ${result.error}`);
        }
      } catch (error: any) {
        logger.appendLine(`[Cleanup] Exception: ${error.message}`);
        vscode.window.showErrorMessage(`Error al eliminar proyecto huérfano: ${error.message}`);
      }
    })
  );

  // Open a document with Markdown preview
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.openDoc', async (docPath: string) => {
      try {
        const uri = vscode.Uri.file(docPath);
        // Use VS Code's built-in markdown preview for better visualization
        await vscode.commands.executeCommand('markdown.showPreview', uri);
      } catch (error: any) {
        logger.appendLine(`Error opening document: ${error.message}`);
        vscode.window.showErrorMessage(`No se pudo abrir el documento: ${error.message}`);
      }
    })
  );

  // Open an indexed file
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.openIndexedFile', async (filePath: string) => {
      try {
        const pathModule = await import('path');
        let resolvedPath = filePath;
        
        // The paths in index-metadata.json are relative to where the indexer was run
        // (the parent directory of .memorybank). So we resolve from there.
        // Example: if .memorybank is at C:\Users\goyoc\.memorybank
        // and filePath is ../../workspaces/GRECOAI/file.ts
        // We resolve from C:\Users\goyoc (parent of .memorybank)
        // Result: C:\workspaces\GRECOAI\file.ts
        
        if (filePath.startsWith('..') || !pathModule.isAbsolute(filePath)) {
          const mbPath = getMemoryBankService().getMemoryBankPath();
          if (mbPath) {
            // Resolve from the parent directory of .memorybank (where indexer was run)
            const baseDir = pathModule.dirname(mbPath);
            resolvedPath = pathModule.resolve(baseDir, filePath);
          }
        }

        logger.appendLine(`Opening indexed file: ${resolvedPath}`);
        const doc = await vscode.workspace.openTextDocument(resolvedPath);
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (error: any) {
        logger.appendLine(`Error opening indexed file: ${error.message}`);
        vscode.window.showWarningMessage(`Archivo no encontrado: ${filePath}`);
      }
    })
  );

  // Configure Memory Bank path
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.configure', async () => {
      const config = vscode.workspace.getConfiguration('memorybank');
      const currentPath = config.get<string>('path', '.memorybank');
      
      const newPath = await vscode.window.showInputBox({
        prompt: 'Ruta a la carpeta del Memory Bank',
        value: currentPath,
        placeHolder: '.memorybank',
        validateInput: (value) => {
          if (!value.trim()) {
            return 'La ruta no puede estar vacía';
          }
          return null;
        }
      });
      
      if (newPath !== undefined) {
        await config.update('path', newPath, vscode.ConfigurationTarget.Workspace);
        logger.appendLine(`Memory Bank path updated to: ${newPath}`);
        
        // Refresh views
        vscode.commands.executeCommand('memorybank.refresh');
      }
    })
  );
}

/**
 * Register Code Relations commands
 */
function registerRelationsCommands(context: vscode.ExtensionContext) {
  // Analyze relations for current project
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.relations.analyze', async () => {
      const selectedProject = memoryBankProjectsProvider.getSelectedProject();
      if (!selectedProject) {
        vscode.window.showWarningMessage('Selecciona un proyecto primero desde Memory Bank');
        return;
      }
      await relationsTreeProvider.analyzeProject(true);
    })
  );

  // Show dataflow viewer
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.relations.showFlow', async () => {
      const selectedProject = memoryBankProjectsProvider.getSelectedProject();
      if (!selectedProject) {
        vscode.window.showWarningMessage('Selecciona un proyecto primero desde Memory Bank');
        return;
      }
      
      if (relationsViewer) {
        await relationsViewer.show(selectedProject.id);
      }
    })
  );

  // Refresh relations view
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.relations.refresh', () => {
      relationsTreeProvider.refresh();
    })
  );

  // Open file from relations
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.relations.openFile', async (filePath: string) => {
      try {
        const pathModule = await import('path');
        const mbPath = getMemoryBankService().getMemoryBankPath();
        if (!mbPath) return;

        const baseDir = pathModule.dirname(mbPath);
        const resolvedPath = pathModule.resolve(baseDir, filePath);

        const doc = await vscode.workspace.openTextDocument(resolvedPath);
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (error: any) {
        logger.appendLine(`Error opening file: ${error.message}`);
        vscode.window.showWarningMessage(`Archivo no encontrado: ${filePath}`);
      }
    })
  );

  // Sync relations and framework providers with project selection
  // When a project is selected in Memory Bank, also update other providers
  const originalSetSelectedProject = memoryBankProjectsProvider.setSelectedProject.bind(memoryBankProjectsProvider);
  memoryBankProjectsProvider.setSelectedProject = (project: ProjectInfo | null) => {
    originalSetSelectedProject(project);
    relationsTreeProvider.setSelectedProject(project);
    frameworkComponentsProvider.setSelectedProject(project);
  };

  // Register Framework Components commands
  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.frameworks.refresh', async () => {
      logger.appendLine('Refreshing Framework Components...');
      await frameworkComponentsProvider.reanalyze();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.frameworks.search', async () => {
      await frameworkComponentsProvider.showSearchQuickPick();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memorybank.frameworks.openFile', async (filePath: string, line?: number) => {
      await frameworkComponentsProvider.openFile(filePath, line);
    })
  );
}

/**
 * Setup FileSystemWatcher for Memory Bank changes
 */
function setupMemoryBankWatcher(context: vscode.ExtensionContext) {
  const mbPath = getMemoryBankService().getMemoryBankPath();
  if (!mbPath) {
    logger.appendLine('Cannot setup Memory Bank watcher: path not configured');
    return;
  }

  // Watch for changes in .memorybank folder
  const pattern = new vscode.RelativePattern(mbPath, '**/*');
  memoryBankWatcher = vscode.workspace.createFileSystemWatcher(pattern);

  // Debounce refresh to avoid too many updates
  let refreshTimeout: NodeJS.Timeout | null = null;
  const debouncedRefresh = () => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    refreshTimeout = setTimeout(() => {
      logger.appendLine('Memory Bank changed, refreshing views...');
      memoryBankProjectsProvider.refresh();
      indexedFilesProvider.refresh();
      projectDocsProvider.refresh();
      relationsTreeProvider.refresh();
      activeAgentsProvider.refresh();
    }, 1000); // 1 second debounce
  };

  memoryBankWatcher.onDidCreate(debouncedRefresh);
  memoryBankWatcher.onDidChange(debouncedRefresh);
  memoryBankWatcher.onDidDelete(debouncedRefresh);

  context.subscriptions.push(memoryBankWatcher);
  logger.appendLine(`Memory Bank watcher setup for: ${mbPath}`);
}

/**
 * Initialize UI viewers (React-based webviews)
 */
function initializeUIViewers(context: vscode.ExtensionContext) {
  try {
    // Import and initialize viewers
    import('./commands/categories/ui').then(uiModule => {
      uiModule.initializeViewers(context);
      logger.appendLine('UI viewers initialized successfully');
    });
  } catch (error: any) {
    logger.appendLine(`Error initializing UI viewers: ${error.message}`);
  }
}

/**
 * Initialize the agent system
 * @param context Extension context
 */
async function initializeAgentSystem(context: vscode.ExtensionContext) {
  try {
    logger.appendLine('Initializing Memory Bank Agent System...');
    
    // Create and initialize the main agent
    agent = await agentSystem.createAgent('MemoryBank', context);
    
    // Make it globally accessible
    (global as any).mainAgent = agent;
    
    // Register agent-based command handlers
    registerAgentCommands(context);
    
    logger.appendLine('Memory Bank Agent System initialized successfully');
    
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
    vscode.window.showErrorMessage('Failed to initialize Memory Bank Agent System. Some advanced features may not be available.');
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
  
  logger.appendLine('Agent command wrappers created successfully');
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
  const config = vscode.workspace.getConfiguration('memorybank');
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
              logger.appendLine(`Error processing autofixer.md: ${error.message}`);
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
              'Error al procesar autofixer.md. Consulta el Output de Memory Bank para más detalles.',
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
  logger.appendLine('Memory Bank Inspector extension deactivated.');
  
  // Clean up Memory Bank watcher
  if (memoryBankWatcher) {
    memoryBankWatcher.dispose();
    memoryBankWatcher = null;
  }
  
  // Limpiar recursos del agente
  const currentAgent = getGlobalAgent(false); // false para no crear el agente si no existe
  if (currentAgent) {
    currentAgent.dispose();
  }
}
