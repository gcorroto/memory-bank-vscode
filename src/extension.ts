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

async function automaticTest(reasoning?: any) {
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

async function handleAutomaticTestWithAgent(reasoning: any) {
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

function openTestContainers(pathFinal: string, pathTestFinal: string, error: any, auto: boolean, reasoning: any = undefined) {
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

function testWithGrec0AI(sourcePath: string, testPath: string, reasoning: any, error: any, auto: boolean = false): void {
  vscode.window.showInformationMessage('Generando prueba con Grec0AI...');
  // En una implementación real, aquí generaríamos el test
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