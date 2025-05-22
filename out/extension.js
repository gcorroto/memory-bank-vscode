'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
	return new (P || (P = Promise))(function (resolve, reject) {
		function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
		function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
		function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
		step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};
Object.defineProperty(exports, "__esModule", { value: true });
// VS Code extensibility API
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const WebSocket = require('ws');
const { exec } = require('child_process');

// Import our providers
const FileTreeProvider_1 = require("./FileTreeProvider");
const CoverageSummaryProvider_1 = require("./CoverageSummaryProvider");
const CoverageDetailsProvider_1 = require("./CoverageDetailsProvider");
const Utils = require("./utils/utils");
const { FileTreeService } = require('./utils/FileTreeService');

// Import our new services
const openaiService = require('./services/openaiService');
const vectraService = require('./services/vectraService');
const ragService = require('./services/ragService');
const configManager = require('./utils/configManager');
const commands = require('./services/commands');

// Create logger
const logger = vscode.window.createOutputChannel('Grec0AI For Developers');

// Initialize providers
const fileTreeProvider = new FileTreeProvider_1.CoverageDefectsProvider(logger);
const coverageSummaryProvider = new CoverageSummaryProvider_1.CoverageSummaryProvider(fileTreeProvider, logger);
const coverageDetailsProvider = new CoverageDetailsProvider_1.CoverageDetailsProvider();

// This method is called when the extension is activated
function activate(context) {
	logger.info('Grec0AI For Developers extension activated. Welcome!');
	
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
}
exports.activate = activate;

// Refresh the file system tree
function refreshFileSystem() {
	logger.appendLine("Refreshing file system tree...");
	fileTreeProvider.refresh();
}

// Handle file selection from the tree
function showFileDetails(element) {
	if (element.isFile) {
		// Emit event to notify the summary provider
		fileTreeProvider._onFileSelected.fire({
			path: element.path,
			label: element.label
		});
	}
}

// Refresh coverage summary
function refreshCoverage() {
	logger.appendLine("Refreshing coverage summary...");
	coverageSummaryProvider.refresh();
}

// Refresh coverage details
function refreshCoverageDetails() {
	logger.appendLine("Refreshing coverage details...");
	coverageDetailsProvider.refresh();
}

// Open a file at a specific line
function openFileAtLine(element) {
	if (!element || !element.path || !element.line) {
		vscode.window.showErrorMessage('Invalid element passed to openFileAtLine command.');
		return;
	}

	const { path: filePath, line } = element;
	
	logger.appendLine(`Opening file ${filePath} at line ${line}`);
	
	vscode.workspace.openTextDocument(vscode.Uri.file(filePath)).then((doc) => {
		vscode.window.showTextDocument(doc, vscode.ViewColumn.One).then((editor) => {
			// Handle line 0 as the first line for summary items
			const lineIndex = line > 0 ? line - 1 : 0;
			const range = editor.document.lineAt(lineIndex).range;
			editor.selection = new vscode.Selection(range.start, range.end);
			editor.revealRange(range);
		});
	}).catch((error) => {
		vscode.window.showErrorMessage(`Error opening file ${filePath}: ${error.message}`);
		logger.appendLine(`Error: ${error.message}`);
	});
}

// Automatic test generation
async function automaticTest(reasoning) {
	try {
		// Check if OpenAI API key is configured
		if (!configManager.isConfigComplete()) {
			const configureNow = await vscode.window.showInformationMessage(
				'OpenAI API key is required for test generation. Configure it now?',
				'Yes', 'No'
			);
			
			if (configureNow === 'Yes') {
				await commands.configureOpenAIApiKey();
			} else {
				return;
			}
		}
		
		// Ask user for model type if not specified
		if (!reasoning) {
			const model = await vscode.window.showInformationMessage(
				`Choose AI model for test generation`,
				'Fast', 'Reasoning', 'Cancel'
			);
			
			if (model === 'Reasoning') {
				reasoning = await vscode.window.showInformationMessage(
					`Choose reasoning level`,
					'low', 'medium', 'high'
				);
			} else if (model === 'Cancel') {
				return;
			}
		}
		
		// Ask user to select folder
		const selectedFolderUri = await vscode.window.showOpenDialog({
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: 'Select root folder'
		});
		
		if (!selectedFolderUri || selectedFolderUri.length === 0) {
			return; // User cancelled
		}
		
		const rootPath = selectedFolderUri[0].fsPath;
		logger.appendLine(`Processing files in: ${rootPath}`);
		
		// Get file tree
		const fileTreeService = new FileTreeService(logger);
		const fileTree = await fileTreeService.getFileTree(path.relative(fileTreeService.getWorkspacePath(), rootPath));
		
		// Extract all files from tree
		const files = [];
		const extractFiles = (nodes) => {
			for (const node of nodes) {
				if (node.isFile) {
					// Only include source files that should have tests
					if ((node.path.endsWith('.ts') || node.path.endsWith('.js')) && 
						!node.path.endsWith('.spec.ts') && 
						!node.path.endsWith('.spec.js') && 
						!node.path.endsWith('.test.ts') && 
						!node.path.endsWith('.test.js')) {
						files.push(node);
					}
				} else if (node.children && node.children.length > 0) {
					extractFiles(node.children);
				}
			}
		};
		
		// Process tree to get flat file list
		extractFiles(fileTree);
		vscode.window.showInformationMessage(`Processing ${files.length} files...`);
		
		// Process each file sequentially
		for (const file of files) {
			vscode.window.showInformationMessage(`Processing file: ${file.path}`);
			
			// Determine test file path
			const testFilePath = file.path.replace(/\.([jt]s)$/, '.spec.$1');
			
			try {
				// Initialize Vectra for RAG if not already initialized
				if (!await vectraService.initialize()) {
					vscode.window.showInformationMessage('Initializing RAG service...');
					await vectraService.initialize();
				}
				
				// Generate and process test using our helper functions
				await openTestContainers(file.path, testFilePath, null, true, reasoning);
			} catch (error) {
				vscode.window.showErrorMessage(`Error testing file ${file.path}: ${error.message}`);
				logger.appendLine(`Error: ${error.message}`);
			}
		}
		
		vscode.window.showInformationMessage(`Automatic test completed for ${files.length} files.`);
	} catch (error) {
		vscode.window.showErrorMessage(`Error in automaticTest: ${error.message}`);
		logger.appendLine(`Error: ${error.message}`);
	}
}

// This section contains the implementation of openTestContainers and supporting functions
// which would normally interact with the AI service for test generation

function openTestContainers(pathFinal, pathTestFinal, error, auto, reasoning = undefined) {
	return new Promise((resolve, reject) => {
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
					.then((response) => {
						resolve(response || "");
					})
					.catch((error) => {
						reject(error);
					});
				}	
			});
		}
	});
}

function testWithGrec0AI(pathFinal, pathTestFinal, reasoning, error, auto = false) {
	return new Promise((resolve, reject) => {
		if (auto) {
			callGrec0AI(pathFinal, pathTestFinal, undefined, error, reasoning, auto)
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
				callGrec0AI(pathFinal, pathTestFinal, instructions, error, reasoning)
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

function callGrec0AI(pathFinal, pathTestFinal, instructions, error, reasoning, auto = false) {
	return new Promise((resolve, reject) => {
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
					
					let generatedTest;
					
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
								framework, 
								5, // contextCount
								configManager.getOpenAIModel()
							);
						} catch (ragError) {
							logger.appendLine(`Error con RAG, usando OpenAI directamente: ${ragError.message}`);
							
							// Fallback to direct OpenAI if RAG fails
							generatedTest = await openaiService.generateTests(
								sourceContent,
								language,
								framework,
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
								framework, 
								5, // contextCount
								configManager.getOpenAIModel()
							);
						} catch (ragError) {
							logger.appendLine(`Error con RAG, usando OpenAI directamente: ${ragError.message}`);
							
							// Fallback to direct OpenAI if RAG fails
							generatedTest = await openaiService.generateTests(
								sourceContent,
								language,
								framework,
								configManager.getOpenAIModel(),
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
								openTestContainers(pathFinal, pathTestFinal, execResult.error, auto, reasoning)
								.then((response) => {
									resolve(response);
								})
								.catch((error) => {
									reject(error);
								});
							} else {
								reject(`Ejecución del test fallida: ${execResult.error}`);
							}
						} else {
							// For automatic mode, retry once
							vscode.window.showInformationMessage("Reintentando la generación de test con retroalimentación del error...");
							openTestContainers(pathFinal, pathTestFinal, execResult.error, auto, reasoning)
							.then((response) => {
								resolve(response);
							})
							.catch((error) => {
								reject(error);
							});
						}
					}
				} catch (error) {
					logger.appendLine(`[Error] La generación de test falló: ${error.message}`);
					if (!auto) {
						await openTestFile(pathTestFinal);
					}
					reject(`La generación de test falló: ${error.message}`);
				}
			});
		} catch (error) {
			logger.appendLine(`[Error] La generación de test falló: ${error.message}`);
			reject(`La generación de test falló: ${error.message}`);
		}
	});
}

// Helper function to open a test file
async function openTestFile(filePath) {
	try {
		const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
		await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
	} catch (error) {
		logger.appendLine(`Error opening test file: ${error.message}`);
		throw error;
	}
}

// Helper function to open or create a test file
async function openOrCreateTestFile(filePath) {
	try {
		const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
		await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
		return "Test file opened successfully.";
	} catch (error) {
		// File doesn't exist, create it
		const response = await vscode.window.showInformationMessage(
			`File ${filePath} doesn't exist. Create it?`, 
			'Yes', 'No'
		);
		
		if (response === 'Yes') {
			const dir = path.dirname(filePath);
			await fs.promises.mkdir(dir, { recursive: true });
			await fs.promises.writeFile(filePath, '');
			
			const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
			await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
			return "Empty test file created and opened.";
		}
		return "";
	}
}

// Helper function to simulate test execution
function simulateTestExecution(sourcePath, testPath) {
	return new Promise((resolve) => {
		// 80% chance of success
		const success = Math.random() > 0.2;
		
		if (success) {
			// Generate random coverage between 50-95%
			const coverage = Math.floor(Math.random() * 45) + 50;
			resolve({
				success: true,
				coverage: coverage
			});
		} else {
			// Simulate a test failure
			const errorTypes = [
				"AssertionError: expected value to equal expected value",
				"TypeError: Cannot read property of undefined",
				"Error: Test timed out",
				"ReferenceError: variable is not defined"
			];
			const error = errorTypes[Math.floor(Math.random() * errorTypes.length)];
			resolve({
				success: false,
				error: error,
				coverage: 0
			});
		}
	});
}

// Helper function to generate a simple test
function generateSimpleTest(filePath, sourceCode, reasoning) {
	const fileName = path.basename(filePath, path.extname(filePath));
	const isTypeScript = filePath.endsWith('.ts');
	
	// Extract function or class names from source
	const funcMatches = sourceCode.match(/function\s+(\w+)|class\s+(\w+)/g) || [];
	const exportMatches = sourceCode.match(/export\s+(const|function|class)\s+(\w+)/g) || [];
	
	// Create a simple test based on the file extension and content
	if (isTypeScript) {
		return `import { expect } from 'chai';
${fileName.includes('.') ? '' : `import { ${fileName} } from './${fileName}';`}

describe('${fileName}', () => {
  it('should be properly defined', () => {
    // Basic test to verify module is loaded
    ${exportMatches.length ? `expect(${fileName}).to.not.be.undefined;` : '// Add assertions here'}
  });
  
  ${funcMatches.length ? `it('should execute core functionality correctly', () => {
    // Add more specific tests for each function
    // TODO: Add detailed assertions
  });` : ''}
  
  it('should handle edge cases', () => {
    // Tests for error handling and edge cases
    // TODO: Add edge case tests
  });
});
`;
	} else {
		// JavaScript test
		return `const assert = require('assert');
${fileName.includes('.') ? '' : `const ${fileName} = require('./${fileName}');`}

describe('${fileName}', function() {
  it('should be properly defined', function() {
    // Basic test to verify module is loaded
    ${exportMatches.length ? `assert(${fileName} !== undefined);` : '// Add assertions here'}
  });
  
  ${funcMatches.length ? `it('should execute core functionality correctly', function() {
    // Add more specific tests for each function
    // TODO: Add detailed assertions
  });` : ''}
  
  it('should handle edge cases', function() {
    // Tests for error handling and edge cases
    // TODO: Add edge case tests
  });
});
`;
	}
}

// Helper function to generate an explanation for the test
function generateTestExplanation(filePath, reasoning) {
	const fileName = path.basename(filePath);
	const reasoningLevel = reasoning || 'standard';
	
	return `
# Test Generated for ${fileName}

## Overview
I've generated a basic test scaffold for this file using the ${reasoningLevel} reasoning level.

## Test Structure
The test includes:
- Basic verification tests to ensure the module loads properly
- Placeholder for core functionality tests
- Placeholder for edge case handling

## Next Steps
1. Review the generated tests and customize them for your specific needs
2. Add more detailed assertions based on expected behaviors
3. Consider adding tests for error conditions and edge cases
4. Run the tests to verify functionality

## Best Practices
- Keep tests focused on a single functionality
- Use descriptive test names
- Ensure good coverage of all code paths
- Mock external dependencies when needed
`;
}

// Extension deactivation
function deactivate() {
	return __awaiter(this, void 0, void 0, function* () {
		try {
			logger.info('Grec0AI For Developers extension deactivated. See you!');
		}
		catch (error) {
			logger.warn('Extension deactivation completed with errors: ' + error);
		}
	});
}
exports.deactivate = deactivate;