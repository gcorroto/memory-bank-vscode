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
// The module 'vscode' contains the VS Code extensibility API. Import the module and reference it with the alias vscode in your code below.
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const WebSocket = require('ws');
const { exec } = require('child_process');
// Imports from our sources
const KiuwanService_1 = require("./KiuwanService");
const KiuwanSourceProvider_1 = require("./KiuwanSourceProvider");
const KiuwanDetailsProvider_1 = require("./KiuwanDetailsProvider");
const KiuwanDefectsProvider_1 = require("./KiuwanDefectsProvider");
const KiuwanDefectsProvider_2 = require("./KiuwanDefectsProvider");
const KiuwanDefectsProvider_3 = require("./KiuwanDefectsProvider");
const KiuwanDefectsProvider_4 = require("./KiuwanDefectsProvider");
const KiuwanDefectsProvider_5 = require("./KiuwanDefectsProvider");
const CoverageDefectsProvider_1 = require("./CoverageDefectsProvider");
const CoverageDefectsProvider_2 = require("./CoverageSummaryProvider");
const CoverageDefectsProvider_3 = require("./CoverageDetailsProvider");
const GitInitializerProvider_1 = require('./GitInitializerProvider');
const ConfigLog4j_1 = require("./utils/ConfigLog4j");
const Utils = require("./utils/utils");
const logger = vscode.window.createOutputChannel('Grec0AI For Developers (K4D)');
const kiuwanDetailsProvider = new KiuwanDetailsProvider_1.KiuwanDetailsProvider();
const kiuwanDefectsProvider = new KiuwanDefectsProvider_1.KiuwanDefectsProvider();
const coverageDefectsProvider = new CoverageDefectsProvider_1.CoverageDefectsProvider(logger);
const coverageSummaryProvider = new CoverageDefectsProvider_2.CoverageSummaryProvider(coverageDefectsProvider,logger);
const coverageDetailsProvider = new CoverageDefectsProvider_3.CoverageDetailsProvider();
const kiuwanSourceProvider = new KiuwanSourceProvider_1.KiuwanSourceProvider(kiuwanDefectsProvider);
const gitInitializerProvider = new GitInitializerProvider_1.GitInitializerProvider();
const log = ConfigLog4j_1.LogFactory.getLogger("k4d.extension");
// This method is called when your extension is activated. Your extension is activated the very first time the command is executed.
function activate(context) {
	log.info('Grec0AI For Developers (K4D) extension activated. Welcome!');
	// Register providers for all three sections of kiuwan-defects activity bar
	vscode.window.registerTreeDataProvider('kiuwan-defects-source', kiuwanSourceProvider);
	vscode.window.registerTreeDataProvider('kiuwan-defects-list', kiuwanDefectsProvider);
	vscode.window.registerTreeDataProvider('kiuwan-defects-details', kiuwanDetailsProvider);
	vscode.window.registerTreeDataProvider('coverage-defects-source', coverageDefectsProvider);
	vscode.window.registerTreeDataProvider('coverage-defects-list', coverageSummaryProvider);
	vscode.window.registerTreeDataProvider('coverage-defects-details', coverageDetailsProvider);


	// The command has been defined in the package.json file (parameter 'commandId' must match the command field in package.json)
	let disposable = vscode.commands.registerCommand('k4d.enterPassword', enterPassword);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.checkConnection', checkConnection);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.getApplications', configureApplication);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.getActionPlans', configureActionPlan);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.getAuditDeliveries', configureAuditDelivery);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.getDeliveries', configureDelivery);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.kiuwan-defects.refresh', refreshDefects);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.browseToFile', browseToFile);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.refreshDetails', refreshDetails);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.browseToDocumentation', KiuwanDefectsProvider_2.browseToDocumentation);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.muteDefect', KiuwanDefectsProvider_3.muteDefect);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.changeDefectStatus', KiuwanDefectsProvider_4.changeDefectStatus);
	context.subscriptions.push(disposable);
	//grec0ai
	disposable = vscode.commands.registerCommand('k4d.fixGrec0Ai', KiuwanDefectsProvider_5.fixGrec0Ai);
	context.subscriptions.push(disposable);
	//coverage
	disposable = vscode.commands.registerCommand('k4d.coverage-source.refresh', refreshCoverageDefects);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.coverage-details.refresh', refreshCoverageDetails);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('k4d.coverage-list.refresh', refreshCoverageSummary);
	context.subscriptions.push(disposable);

	// Registrar el TreeDataProvider en la vista del Explorador
	vscode.window.registerTreeDataProvider('gitInitializerView', gitInitializerProvider);

	// Registrar el comando para inicializar el repositorio
	const initializeRepoCommand = vscode.commands.registerCommand('git.connectionSettings.initializeGitRepository', () => {
		gitInitializerProvider.initializeGitRepository();
	});

	// Comando para validar y almacenar la información de la tarjeta
	const validateIssueCommand = vscode.commands.registerCommand('git.connectionSettings.validateAndStoreIssue', () => {
		gitInitializerProvider.validateAndStoreIssue();
	});

	// Registrar el comando para mostrar detalles de cobertura
	const showCoverageDetailsCommand = vscode.commands.registerCommand('jenkins.connectionSettings.showCoverageDetails', (element) => {
		if (element.isFile) {
			// Emitir el evento en CoverageDefectsProvider cuando se selecciona un archivo
			coverageDefectsProvider._onFileSelected.fire({
				path: element.path,
				label: element.label
			});
		}
	});

		// ... otros registros de comandos
	
	let automaticTestCommand = vscode.commands.registerCommand('k4d.automaticTest', async () => {
		try {
			const model = await vscode.window.showInformationMessage(`¿ Modelo para automatizacion de test ?`, 'Rapido', 'Razonamiento', 'Cancelar');
			let reasoning = undefined;
			if(model === 'Razonamiento') {
				reasoning = await vscode.window.showInformationMessage(`¿ Computación para el razonamiento ?`,'bajo', 'medio', 'alto');
				if(reasoning === 'bajo') {
					reasoning = 'low';
				}else if(reasoning === 'medio') {
					reasoning = 'medium';
				}else if(reasoning === 'alto') {
					reasoning = 'high';
				}
			} else if(model === 'Cancelar') {
				return;
			}
			await automaticTest(reasoning);
		} catch (error) {
			vscode.window.showErrorMessage(`Error en automaticTest: ${error}`);
		}
	});
	context.subscriptions.push(automaticTestCommand);


	const showFileAtLineCommand = vscode.commands.registerCommand('jenkins.connectionSettings.openFileAtLine', (element) => {
		if (!element || !element.path || !element.line) {
			vscode.window.showErrorMessage('Invalid element passed to openFileAtLine command.');
			return;
		}

		const { path, line } = element;
		const area = vscode.workspace.getConfiguration('jenkins.connectionSettings').get('area');
		const app = vscode.workspace.getConfiguration('jenkins.connectionSettings').get('jobName');
		const folderApp = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('PROJECT_FOLDER');
		const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
		vscode.window.showInformationMessage(`Opening file workspaceFolder ${workspaceFolder} at folderApp ${folderApp}`);
		const pathFinal = path.replace(`/Users/admin/jenkins_config_cd/workspace/${area.toUpperCase()}/app${area}-${app}-pipeline/`, `${workspaceFolder}/` + `${folderApp}/`);
		const pathTestFinal = path.replace(`/Users/admin/jenkins_config_cd/workspace/${area.toUpperCase()}/app${area}-${app}-pipeline/`, `${workspaceFolder}/` + `${folderApp}/`)
		.replace('.ts', '.spec.ts');

		vscode.window.showInformationMessage(`Opening file ${pathFinal} at line ${line}`);
		vscode.workspace.openTextDocument(vscode.Uri.file(pathFinal)).then((doc) => {
			vscode.window.showTextDocument(doc, vscode.ViewColumn.One).then((editor) => {
				const range = editor.document.lineAt(line - 1).range;
				editor.selection = new vscode.Selection(range.start, range.end);
				editor.revealRange(range);
			});
		}).catch((error) => {
			vscode.window.showErrorMessage(`Error abriendo archivo original, ${pathFinal}: ${error.message}`);
		});
		
// vscode.workspace.openTextDocument(vscode.Uri.file(pathTestFinal)).then((doc) => {
		openTestContainers(pathFinal, pathTestFinal, undefined)
		.then((response) => {
			resolve(response);
		})
		.catch((error) => {
			reject(error);
		});
	// vscode.window.showTextDocument(doc, vscode.ViewColumn.Two).then((editor) => {
					// Puedes agregar cualquier lógica adicional aquí si es necesario
	// });
// }).catch((error) => {
// 	vscode.window.showInformationMessage(`El archivo ${pathTestFinal} no existe. deseas Crearlo?`, 'Aceptar', 'Cancelar').then(selection => {
// 					if (selection === 'Aceptar') {
// 						openTestContainers(pathFinal, pathTestFinal);
// 			}
// 		});
// 	});
});

	// Añadir el comando y el provider al contexto para que se limpien cuando la extensión se desactive
	context.subscriptions.push(initializeRepoCommand, validateIssueCommand, showCoverageDetailsCommand, showFileAtLineCommand, gitInitializerProvider);

}
exports.activate = activate;

function openTestContainers(pathFinal, pathTestFinal, error, auto, reasonig = undefined) {

		return new Promise((resolve, reject) => {
			if (auto) {
				testWithGrec0AI(pathFinal, pathTestFinal, reasonig, error, auto)
				.then((response) => {
					resolve(response);
				})
				.catch((error) => {
					reject(error);
				});
			} else {

					vscode.window.showInformationMessage(`¿ Deseas inicializar los test con Grec0AI ?`, 'Rapido', 'Razonado', 'Cancelar').then(selection2 => {
							// Create an empty file
							if (selection2 === 'Rapido' || selection2 === 'Razonado') {

									if (selection2 === 'Razonado') {
										vscode.window.showInformationMessage(`¿ Computación para el razonamiento ?`, 'bajo', 'medio', 'alto').then(selection2 => {
											if (selection2 === 'bajo') {
												testWithGrec0AI(pathFinal, pathTestFinal, 'low', error)
												.then((response) => {
													resolve(response);
												})
												.catch((error) => {
													reject(error);
												});
											} else if (selection2 === 'medio') {
												testWithGrec0AI(pathFinal, pathTestFinal, 'medium', error)
												.then((response) => {
													resolve(response);
												})
												.catch((error) => {
													reject(error);
												});
											} else if (selection2 === 'alto') {
												testWithGrec0AI(pathFinal, pathTestFinal, 'high', error)
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
								vscode.workspace.openTextDocument(vscode.Uri.file(pathTestFinal)).then((doc) => {
										vscode.window.showTextDocument(doc, vscode.ViewColumn.Two).then((editor) => {
												// Puedes agregar cualquier lógica adicional aquí si es necesario
												resolve("Respuesta generativa de cobertura cargada exitosamente...");
										});
								}).catch((error) => {
										vscode.window.showInformationMessage(`El archivo ${pathTestFinal} no existe. deseas Crearlo?`, 'Aceptar', 'Cancelar').then(selection => {
												const dir = path.dirname(pathTestFinal);
												fs.mkdirSync(dir, { recursive: true });
												fs.writeFileSync(pathTestFinal, '');
					
												if (selection === 'Aceptar') {
														vscode.workspace.openTextDocument(vscode.Uri.file(pathTestFinal)).then((doc) => {
																vscode.window.showTextDocument(doc, vscode.ViewColumn.Two).then((editor) => {
																	resolve("");
																});
														})
												} else {
													resolve("");
												}
										});
									});
							}	
				});
			}
		});
}

function testWithGrec0AI(pathFinal, pathTestFinal, reasonig, error, auto = false) {
	return new Promise((resolve, reject) => {
		if (auto) {
			callGrec0AI(pathFinal, pathTestFinal, undefined, error, reasonig, auto)
			.then((response) => {
				resolve(response);
			})
			.catch((error) => {
				reject(error);
			});
		} else {
			vscode.window.showInputBox({
				placeHolder: 'Introduce cualquier instrucción adicional que desees incluir.',
				prompt: 'Instrucciones adicionales',
			}).then(instructions => {
				callGrec0AI(pathFinal, pathTestFinal, instructions, error, reasonig)
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

function callGrec0AI(pathFinal, pathTestFinal, instructions, error, reasonig, auto = false) {
	return new Promise((resolve, reject) => {

		const lang = vscode.workspace.getConfiguration('kiuwan.connectionSettings.opts').get('LANG_CODE');

		const frameName = vscode.workspace.getConfiguration('kiuwan.connectionSettings.opts').get('FRAMEWORK_NAME');
		const frameVers = vscode.workspace.getConfiguration('kiuwan.connectionSettings.opts').get('FRAMEWORK_VER');

		const frameTest = vscode.workspace.getConfiguration('kiuwan.connectionSettings.opts').get('FRAMEWORK_TEST');
		
		try {

			let bodyToIa = {
				"lang": {
						"name": lang,
				},
				"framework": {
						"name": frameName,
						"version": frameVers
				},
				"core": {
						"name": frameTest
				},
				"file": {
						"name": pathFinal.split('/').pop(),
						"content": fs.readFileSync(pathFinal, 'utf8')
				},
				"test": {
						"name": pathTestFinal.split('/').pop(),
						"content": fs.existsSync(pathTestFinal) ? fs.readFileSync(pathTestFinal, 'utf8') : ''
				},
				"logError": {
						"content": error,
						"instructions": instructions
				},
				"reasoning": reasonig
		};

		let body = JSON.stringify(bodyToIa);
		const url = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('URL');
		const jwt = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('JWT');

		log.info(`URL:${url}/api/v1/jenkins/test`);
		log.info(`Body: ${body}`);

		vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Cargando cobertura con IA...",
				cancellable: true
		}, async (progress, token) => {
				token.onCancellationRequested(() => {
						vscode.window.showWarningMessage("La operación fue cancelada.");
				});

				try {

					
					const finalTestPath = pathTestFinal.split('src')[1];
			
					// if(!error){
					// 	try {
					// 		logger.appendLine(`[Info] Reading lines file : ${finalTestPath}`);
					// 		const coverageRatio = await linesCovered( finalTestPath);
					// 		bodyToIa['logError']['content'] = `Cobertura de código: ${coverageRatio}% insuficiente se requiere > 70%`;
					// 		logger.appendLine(`[Info] Coverage ratio : ${coverageRatio}`);
					// 	} catch (error) {
					// 		logger.appendLine(`[Error] Reading lines file : ${error}`);
					// 	}
					// }
					
					const response = await fetch(`${url}/api/v1/jenkins/test`, {
							method: 'POST',
							headers: {
									'Content-Type': 'application/json',
									'Authorization': `Bearer ${jwt}`
							},
							body: body
					});

					let dataJson = '';
					if (response.ok) {
							dataJson = await response.json(); // Convertir la respuesta a JSON
					} else {
							reject(`Error fixing defect: ${response.statusText}`);
					}

					let sessionId = dataJson.sessionId ? dataJson.sessionId : '';
					const data = await connectSocketTest(sessionId);

					const dir = path.dirname(pathTestFinal);
					

					fs.mkdirSync(dir, { recursive: true });
					if (data && data.testCoverageCode) {
						data.testCoverageCode = data.testCoverageCode.replace(/"/g, '\\"');
						fs.writeFileSync(pathTestFinal, data.testCoverageCode);
					} else {
							vscode.window.showErrorMessage("La respuesta de la API no contiene el código de cobertura esperado.");
					}

					if (data && data.actionDescription) {
							vscode.window.showInformationMessage(data.actionDescription);
							coverageDetailsProvider.updateDetails(data.actionDescription);
					} else {
							reject("La respuesta de la API no contiene la descripción de la acción esperada.");
					}

					if(auto){
						const finalTestPath = pathTestFinal.split('src')[1];
						execCmd(pathFinal, pathTestFinal, finalTestPath, auto, reasonig)
						.then((response) => {
							resolve(response);
						})
						.catch((error) => {
							reject(error);
						});
					} else {

						vscode.workspace.openTextDocument(vscode.Uri.file(pathTestFinal)).then((doc) => {
								vscode.window.showTextDocument(doc, vscode.ViewColumn.Two).then((editor) => {
										vscode.window.showInformationMessage("Cobertura cargada exitosamente ejecutando pruebas...");
										const finalTestPath = pathTestFinal.split('src')[1];
										execCmd(pathFinal, pathTestFinal, finalTestPath, auto, reasonig)
										.then((response) => {
											resolve(response);
										})
										.catch((error) => {
											reject(error);
										});

								});
						}).catch((error) => {
								vscode.window.showInformationMessage(`El archivo ${pathTestFinal} no existe. deseas Crearlo?`, 'Aceptar', 'Cancelar').then(selection => {
										const dir = path.dirname(pathTestFinal);
										fs.mkdirSync(dir, { recursive: true });
										fs.writeFileSync(pathTestFinal, '');

										if (selection === 'Aceptar') {
												vscode.workspace.openTextDocument(vscode.Uri.file(pathTestFinal)).then((doc) => {
														vscode.window.showTextDocument(doc, vscode.ViewColumn.Two).then((editor) => {
																vscode.window.showInformationMessage("Cobertura cargada exitosamente ejecutando pruebas...");
																const finalTestPath = pathTestFinal.split('src/')[1];
																execCmd(pathFinal, pathTestFinal, finalTestPath, auto, reasonig)
																.then((response) => {
																	resolve(response);
																})
																.catch((error) => {
																	reject(error);
																});
														});
												})
										}
								});
						});
					}
				} catch (error) {
						logger.appendLine(`[Error] Testing coverage with IA : ${error}`);
						if(!auto){
							vscode.workspace.openTextDocument(vscode.Uri.file(pathTestFinal)).then((doc) => {
									vscode.window.showTextDocument(doc, vscode.ViewColumn.Two).then((editor) => {
											// Puedes agregar cualquier lógica adicional aquí si es necesario
									});
							})
						}
						reject(`Error Testing coverage with IA : ${error}`);
				}
		});
	} catch (error) {
		logger.appendLine(`[Error] Comparando test con archivo : ${error}`);
		reject(`Error Testing coverage with IA : ${error}`);
	}
	});
}

function execCmd(pathFinal, pathTestFinal, finalTestPath, auto, reasonig = undefined) {
	return new Promise((resolve, reject) => {
		try {
			const folderApp = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('PROJECT_FOLDER');
			const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
			const cmd = `npm test -- --include=src${finalTestPath}`;
			logger.appendLine("Ejecutando comando:" + cmd);

			exec(cmd, { cwd: workspaceFolder + '/' + folderApp}, (error, stdout, stderr) => {
				logger.appendLine("stdout:" + stdout);
				logger.appendLine("stderr:" +  stderr);
				
				if (stderr || stdout) {
					// Convertir error a string para comparar
					if (stderr && stderr.includes('Error:')) {
						vscode.window.showInformationMessage("Error al compilar los test generados por GrecOAI " + stderr);
						logger.appendLine('Error al compilar los test generados por GrecOAI:' + stdout);
						openTestContainers(pathFinal, pathTestFinal, stderr, auto, reasonig)
						.then((response) => {
							resolve(response);
						})
						.catch((error) => {
							reject(error);
						}
						);
					} else if (stdout && stdout.includes('(1 FAILED)')) {
						vscode.window.showInformationMessage("Error al ejecutar los test unitarios generados por GrecOAI " + stdout);
						logger.appendLine('Error al ejecutar los test unitarios generados por GrecOAI:' + stdout);
						openTestContainers(pathFinal, pathTestFinal, stdout, auto, reasonig)
						.then((response) => {
							resolve(response);
						})
						.catch((error) => {
							reject(error);
						}
						);
					} 
					else if(stdout){
						const regex = /Lines\s*:\s*([\d.]+)%/;
						const match = stdout.match(regex);
						if (match) {
							// console.log(match[1]); // Imprime "25.97" por ejemplo
							const coverage = parseFloat(match[1]);
							if(coverage<70){
								vscode.window.showInformationMessage("Cobertura de codigo insuficiente" + coverage + "< 70%");
								logger.appendLine("Cobertura de codigo insuficiente" + coverage + "< 70%");
								openTestContainers(pathFinal, pathTestFinal, "Cobertura de codigo insuficiente" + coverage + "< 70% debes incrementar la cobertura del archivo origen", auto, reasonig)
								.then((response) => {
									resolve(response);
								})
								.catch((error) => {
									reject(error);
								}
								);
							} else {
								resolve("Cobertura de codigo exitosa " + coverage + "%");
							}
						} else {
							resolve("No se encuentra la cobertura de codigo");
						}
					}
					 else{
						resolve("Respuesta generativa de cobertura cargada exitosamente...");
					}
				} else{
					resolve("Respuesta generativa de cobertura cargada exitosamente...");
				}
			});
		} catch (error) {
			logger.appendLine(`[Error] Testing coverage with IA : ${error}`);
			vscode.workspace.openTextDocument(vscode.Uri.file(pathTestFinal)).then((doc) => {
				vscode.window.showTextDocument(doc, vscode.ViewColumn.Two).then((editor) => {
					// Puedes agregar cualquier lógica adicional aquí si es necesario
				});
			})
			reject(`Error Testing coverage with IA : ${error}`);
		}
	});
}


function linesCovered(finalTestPath) {
	return new Promise((resolve, reject) => {
		try {
			const folderApp = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('PROJECT_FOLDER');
			const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
			const cmd = `npm test -- --include=src${finalTestPath}`;
			logger.appendLine("Ejecutando comando:" + cmd);

			if (!fs.existsSync(workspaceFolder + '/' + folderApp + '/src' + finalTestPath)) {
				vscode.window.showInformationMessage("El archivo de test no existe, se creará uno vacío.");
				const dir = path.dirname(workspaceFolder + '/' + folderApp + '/src' + finalTestPath);
				fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(workspaceFolder + '/' + folderApp + '/src' + finalTestPath, '');
				resolve(0.0);
			} else {

				exec(cmd, { cwd: workspaceFolder + '/' + folderApp}, (error, stdout, stderr) => {
					
						// Convertir error a string para comparar
						if (stderr && stderr.includes('Error:')) {
							logger.appendLine('Error transpile reading coverage:' + stdout);
							reject(error);
						} else if (stdout && stdout.includes('(1 FAILED)')) {
							logger.appendLine('Error run test reading coverage:' + stdout);
							reject(error);
						} else {
							if(stdout){
								const regex = /Lines\s*:\s*([\d.]+)%/;
								const match = stdout.match(regex);
								if (match) {
									const coverage = parseFloat(match[1]);
									resolve(coverage);
								} else {
									resolve(0.0);
								}
							} else {
								resolve(0.0);
							}
						}
				});
			}
		} catch (error) {
			logger.appendLine(`[Error] Testing coverage with IA : ${error}`);

			reject(`Error reading coverage lines: ${error}`);
		}
	});
}

function connectSocketTest(sessionId) {
	const url = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('URL').replace('http', 'ws').replace('grecoai', 'wsai'); // Cambiar a WebSocket
	logger.appendLine('URL websocket : ' +  url);
	 return new Promise((resolve, reject) => {
		const socket = new WebSocket(`${url}/ws/v3/test/subscribe?token=${sessionId}`, [], {
			headers: {
					'Upgrade': 'WebSocket',
					'Connection': 'Upgrade',
					'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
					'Sec-WebSocket-Version': '13'
			}
	});

	let closeSocket = false;

		socket.onopen = async () => {
			logger.appendLine('Conexión WebSocket ['+sessionId+'] abierta');
		};

		socket.onerror = (error) => {
			reject(error);
		};

		socket.onclose = function(event) {
			if(!closeSocket){
				logger.appendLine('WebSocket is closed from server. Reconnecting...');
				return connectSocketTest(sessionId);
			} else {
			logger.appendLine('WebSocket is closed now.');
			}
	};

		socket.onmessage = (event) => {
						const message = JSON.parse(event.data);
						closeSocket = true;
						socket.close();
						resolve(message);
		};

		setTimeout(() => {
			if (!closeSocket) {
				closeSocket = true;
				socket.close();
				reject({ actionDescription: 'No se harecibido respuesta del servidor.' });
			}
		}, 180000);

	});
}





// function openTestContainers(pathFinal, pathTestFinal) {
// 	vscode.window.showInformationMessage(`¿Deseas inicializar los test con Grec0AI?`, 'Aceptar', 'Cancelar').then(selection2 => {
// 					if (selection2 === 'Aceptar') {

// 									// Crear conexión WebSocket
// 									const url = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('URL').replace('http', 'ws'); // Cambiar a WebSocket
// 									const jwt = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('JWT');
// 									const socket = new WebSocket(`${url}/ws/test?token=${jwt}`);

// 									socket.onopen = async () => {
// 													// Enviar archivos de la categoría `code`
// 													sendFileContent(socket, pathFinal, 'code');

// 													// Enviar archivo de la categoría `test`, si existe
// 													if (fs.existsSync(pathTestFinal)) {
// 																	sendFileContent(socket, pathTestFinal, 'test');
// 													}

// 													// Enviar todos los imports de la categoría `imports`
// 													const imports = getImportsContent(pathFinal);
// 													for (const importFile of imports) {
// 																	sendFileContent(socket, importFile.path, 'imports');
// 													}

// 													// Cerrar el WebSocket al final
// 													socket.send(JSON.stringify({ action: 'finalize' }));
// 													socket.close();
// 									};

// 									socket.onerror = (error) => {
// 													vscode.window.showErrorMessage(`Error en la conexión WebSocket: ${error.message}`);
// 									};

// 									socket.onmessage = (event) => {
// 													const message = JSON.parse(event.data);
// 													if (message.status === 'completed') {
// 																	vscode.window.showInformationMessage("Cobertura de IA cargada exitosamente.");
// 													}
// 									};
// 					}
// 	});
// }


// Función para enviar el contenido del archivo por WebSocket
function sendFileContent(socket, filePath, folder) {
	const fileName = path.basename(filePath);
	const content = fs.readFileSync(filePath);

	// Preparar datos para enviar
	const data = {
					folder,
					fileName,
					content: content.toString('base64') // Convertir a base64 para enviar en bytes
	};

	// Enviar datos por WebSocket
	socket.send(JSON.stringify(data));
}

// Función para extraer y resolver los imports relativos
function getImportsContent(filePath) {
	const fileContent = fs.readFileSync(filePath, 'utf8');
	const importRegex = /import\s.*?from\s+['"](.*)['"]/g;
	const importsContent = [];

	let match;
	while ((match = importRegex.exec(fileContent)) !== null) {
					const importPath = match[1];

					// Filtrar imports que no son librerías externas (empiezan con './' o '../')
					if (importPath.startsWith('.')) {
									const absolutePath = path.resolve(path.dirname(filePath), importPath) + '.ts';

									if (fs.existsSync(absolutePath)) {
													importsContent.push({
																	path: absolutePath,
																	content: fs.readFileSync(absolutePath, 'utf8')
													});
									}
					}
	}

	return importsContent;
}


// This method is called when your extension is deactivated.
function deactivate() {
	return __awaiter(this, void 0, void 0, function* () {
		try {
			yield KiuwanService_1.KiuwanService.getKiuwanLicenseApi().ungetLicense();
			log.info('Floating license release operation successfully completed');
		}
		catch (error) {
			log.warn('Floating license release operation completed with errors: ' + error);
		}
		finally {
			log.info('Grec0AI For Developers (K4D) extension deactivated. See you!');
		}
	});
}
exports.deactivate = deactivate;
function enterPassword() {
	vscode.window.showInputBox({
		placeHolder: 'Please type your Kiuwan account password.',
		prompt: 'This password will be stored encrypted as a User Setting in `Extensions > Kiuwan`',
		password: true
	}).then(selection => {
		if (!selection)
			return;
		let section = 'kiuwan.connectionSettings.credentials.password';
		try {
			let encrypted = Utils.encrypt(selection);
			vscode.workspace.getConfiguration().update(section, encrypted, vscode.ConfigurationTarget.Global).then(function onfulfilled() { vscode.window.showInformationMessage('Password successfully updated'); }, function onrejected() { vscode.window.showInformationMessage('Password update failed, it is still set to old value', 'OK'); });
			// uncomment for debugging purposes
			//let decrypted: string = Utils.decrypt(encrypted);
			//vscode.window.showInformationMessage(`Encrypted password then decrypted to: "${decrypted}"`);
		}
		catch (error) {
			vscode.window.showErrorMessage('Password update failed, error: ' + error, 'OK');
			log.error(error.stack);
		}
	});
}
function checkConnection() {
	let kiuwanBasePath = KiuwanService_1.getBasePath();
	KiuwanService_1.KiuwanService.getInformationApi().getInformation().then(result => {
		if (result && result.response && result.response.statusCode === 200) {
			let message = `Connection to ${kiuwanBasePath} succeeded for user ${result.body.username}`;
			vscode.window.showInformationMessage(message);
			log.info('Check connection OK, result is: ' + message);
		}
		else {
			let message = `Connection to ${kiuwanBasePath} failed with HTTP status ${result.response.statusCode} and message ${result.response.statusMessage}`;
			vscode.window.showErrorMessage(message, 'OK');
			log.info('Check connection KO, result is: ' + message);
		}
	}).catch(error => {
		if (error.message) {
			let message = `Connection to ${kiuwanBasePath} failed, cause: ${error.message}`;
			vscode.window.showErrorMessage(message, 'OK');
			log.error(message);
			if (error.stack)
				log.error(error.stack);
		}
		else if (error.response) {
			let message = `Connection to ${kiuwanBasePath} failed with HTTP status ${error.response.statusCode} and message ${error.response.statusMessage}`;
			vscode.window.showErrorMessage(message, 'OK');
			log.error('Check connection error, result is: ' + message);
		}
	});
}
function configureApplication() {
	return __awaiter(this, void 0, void 0, function* () {
		if (vscode.workspace.name == null) {
			vscode.window.showInformationMessage('Please open a workspace before linking it to a Kiuwan application', 'OK');
			return;
		}
		KiuwanService_1.KiuwanService.getApplicationApi().getApplications().then(result => {
			if (result.body) {
				// Extract proper data structures from result's body
				let applications = [];
				result.body.forEach((app) => {
					applications.push({
						label: app.name,
						description: app.description,
						value: app
					});
				});
				// Show applications combobox in top bar
				vscode.window.showQuickPick(applications, {
					placeHolder: 'Please select the Kiuwan application to associate to this project.'
				}).then(selection => {
					if (!selection)
						return;
					// Update user settings
					let section = 'kiuwan.connectionSettings.remoteApplication.name';
					let value = selection.value.name;
					vscode.workspace.getConfiguration().update(section, value, vscode.ConfigurationTarget.Workspace).then(function onfulfilled() {
						let remoteApplication = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');
						vscode.window.showInformationMessage('Application successfully updated to ' + remoteApplication, 'OK');
					}, function onrejected() {
						let remoteApplication = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');
						vscode.window.showInformationMessage('Application update failed, it is still set to ' + remoteApplication, 'OK');
					});
				});
			}
			else if (result.response) {
				let msg = 'There\'s no body in get applications result (HTTP status = ' + result.response.statusCode + ' - ' + result.response.statusMessage + ')';
				vscode.window.showErrorMessage(msg, 'OK');
			}
		}).catch(error => {
			vscode.window.showErrorMessage(error.message, 'OK');
		});
	});
}
function configureActionPlan() {
	return __awaiter(this, void 0, void 0, function* () {
		let application = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');
		if (application) {
			KiuwanService_1.KiuwanService.getActionPlanApi().getActionPlans(application).then(result => {
				if (result.body) {
					if (result.body.length < 1) {
						vscode.window.showErrorMessage('Kiuwan application ' + application + ' has no action plans.', 'OK');
						return;
					}
					// Extract proper data structures from result's body
					let actionplans = [];
					result.body.forEach((plan) => {
						actionplans.push({
							label: plan.name,
							description: plan.description,
							value: plan
						});
					});
					// Show action plans combobox in top bar
					vscode.window.showQuickPick(actionplans, {
						placeHolder: 'Please select the Action Plan to associate as source analysis.'
					}).then(selection => {
						if (!selection)
							return;
						// Update user settings
						let section = 'kiuwan.defectsList.analysisSource';
						let value = 'Action plan';
						vscode.workspace.getConfiguration().update(section, value, vscode.ConfigurationTarget.Workspace).then(function onfulfilled() {
							let analysisSource = vscode.workspace.getConfiguration('kiuwan.defectsList').get('analysisSource', '');
							vscode.window.showInformationMessage('Source analysis successfully updated to ' + analysisSource, 'OK');
							section = 'kiuwan.defectsList.analysisSourceActionPlan.name';
							value = selection.value.name;
							vscode.workspace.getConfiguration().update(section, value, vscode.ConfigurationTarget.Workspace).then(function onfulfilled() {
								let actionPlan = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceActionPlan').get('name');
								vscode.window.showInformationMessage('Action Plan successfully updated to ' + actionPlan, 'OK');
							}, function onrejected() {
								let actionPlan = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceActionPlan').get('name');
								vscode.window.showInformationMessage('Action Plan update failed, it is still set to ' + actionPlan, 'OK');
							});
						}, function onrejected() {
							let analysisSource = vscode.workspace.getConfiguration('kiuwan.defectsList').get('analysisSource', '');
							vscode.window.showInformationMessage('Source analysis update failed, it is still set to ' + analysisSource, 'OK');
						});
					});
				}
				else if (result.response) {
					let msg = 'There\'s no body in get action plans result (HTTP status = ' + result.response.statusCode + ' - ' + result.response.statusMessage + ')';
					vscode.window.showErrorMessage(msg, 'OK');
				}
			}).catch(error => {
				vscode.window.showErrorMessage(error.message, 'OK');
			});
		}
		else {
			let msg = 'This command lists the action plans of a Kiuwan application, you have to choose a Kiuwan application first.';
			vscode.window.showErrorMessage(msg, 'OK');
		}
	});
}
function configureAuditDelivery() {
	return __awaiter(this, void 0, void 0, function* () {
		let application = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');
		if (application) {
			let maxdays = undefined; // based on configuration combobox (e.g. today = 1, last week = 7)
			let page = 1; // always one, one and the first page
			let count = undefined; // based on configuration combobox (e.g. last 10 = 10)
			let auditSuccess = false; // false for audit deliveries (failed ones); undefined for deliveries (both failed and passed)
			let filterPurgedAnalyses = true; // always filter purged analyses, someone removed them for a good reason
			let changeRequestFilter = undefined; // no changeRequestFilter, k4d for vscode doesnt support filtering by CR message
			let auditRange = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceAuditDelivery').get('pickRange');
			switch (auditRange) {
				case 'Last 30 days':
					maxdays = 30;
					break;
				case 'Last 7 days':
					maxdays = 7;
					break;
				case 'Today':
					maxdays = 1;
					break;
				case 'Last 10':
				default:
					count = 10;
					break;
			}
			KiuwanService_1.KiuwanService.getDeliveryApi().listDeliveries(application, maxdays, page, count, auditSuccess, filterPurgedAnalyses, changeRequestFilter).then(result => {
				if (result.body) {
					if (result.body.length < 1) {
						vscode.window.showErrorMessage('Kiuwan application ' + application + ' has no audit deliveries.', 'OK');
						return;
					}
					// Extract proper data structures from result's body
					let audits = [];
					result.body.forEach((audit) => {
						audits.push({
							label: audit.code,
							description: audit.changeRequest + ' • ' + audit.label + ' • ' + new Date(audit.creationDate).toLocaleString(),
							value: audit
						});
					});
					// Show audit deliveries combobox in top bar
					vscode.window.showQuickPick(audits, {
						placeHolder: 'Please select the Audit Delivery to associate as source analysis.'
					}).then(selection => {
						if (!selection)
							return;
						// Update user settings
						let section = 'kiuwan.defectsList.analysisSource';
						let value = 'Audit delivery';
						vscode.workspace.getConfiguration().update(section, value, vscode.ConfigurationTarget.Workspace).then(function onfulfilled() {
							let analysisSource = vscode.workspace.getConfiguration('kiuwan.defectsList').get('analysisSource', '');
							vscode.window.showInformationMessage('Source analysis successfully updated to ' + analysisSource, 'OK');
							section = 'kiuwan.defectsList.analysisSourceAuditDelivery.code';
							value = selection.value.code;
							vscode.workspace.getConfiguration().update(section, value, vscode.ConfigurationTarget.Workspace).then(function onfulfilled() {
								let audit = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceAuditDelivery').get('code');
								vscode.window.showInformationMessage('Audit Delivery successfully updated to ' + audit, 'OK');
							}, function onrejected() {
								let audit = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceAuditDelivery').get('code');
								vscode.window.showInformationMessage('Audit Delivery update failed, it is still set to ' + audit, 'OK');
							});
						}, function onrejected() {
							let analysisSource = vscode.workspace.getConfiguration('kiuwan.defectsList').get('analysisSource', '');
							vscode.window.showInformationMessage('Source analysis update failed, it is still set to ' + analysisSource, 'OK');
						});
					});
				}
				else if (result.response) {
					let msg = 'There\'s no body in get audit deliveries result (HTTP status = ' + result.response.statusCode + ' - ' + result.response.statusMessage + ')';
					vscode.window.showErrorMessage(msg, 'OK');
				}
			}).catch(error => {
				vscode.window.showErrorMessage(error.message, 'OK');
			});
		}
		else {
			let msg = 'This command lists the audit deliveries of a Kiuwan application, you have to choose a Kiuwan application first.';
			vscode.window.showErrorMessage(msg, 'OK');
		}
	});
}
function configureDelivery() {
	return __awaiter(this, void 0, void 0, function* () {
		let application = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');
		if (application) {
			let maxdays = undefined; // based on configuration combobox (e.g. today = 1, last week = 7)
			let page = 1; // always one, one and the first page
			let count = undefined; // based on configuration combobox (e.g. last 10 = 10)
			let auditSuccess = undefined; // false for audit deliveries (failed ones); undefined for deliveries (both failed and passed)
			let filterPurgedAnalyses = true; // always filter purged analyses, someone removed them for a good reason
			let changeRequestFilter = undefined; // no changeRequestFilter, k4d for vscode doesnt support filtering by CR message
			let deliveryRange = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceDelivery').get('pickRange');
			switch (deliveryRange) {
				case 'Last 30 days':
					maxdays = 30;
					break;
				case 'Last 7 days':
					maxdays = 7;
					break;
				case 'Today':
					maxdays = 1;
					break;
				case 'Last 10':
				default:
					count = 10;
					break;
			}
			KiuwanService_1.KiuwanService.getDeliveryApi().listDeliveries(application, maxdays, page, count, auditSuccess, filterPurgedAnalyses, changeRequestFilter).then(result => {
				if (result.body) {
					if (result.body.length < 1) {
						vscode.window.showErrorMessage('Kiuwan application ' + application + ' has no deliveries.', 'OK');
						return;
					}
					// Extract proper data structures from result's body
					let deliveries = [];
					result.body.forEach((delivery) => {
						deliveries.push({
							label: delivery.code,
							description: delivery.changeRequest + ' • ' + delivery.label + ' • ' + new Date(delivery.creationDate).toLocaleString(),
							value: delivery
						});
					});
					// Show deliveries combobox in top bar
					vscode.window.showQuickPick(deliveries, {
						placeHolder: 'Please select the Delivery to associate as source analysis.'
					}).then(selection => {
						if (!selection)
							return;
						// Update user settings
						let section = 'kiuwan.defectsList.analysisSource';
						let value = 'Delivery';
						vscode.workspace.getConfiguration().update(section, value, vscode.ConfigurationTarget.Workspace).then(function onfulfilled() {
							let analysisSource = vscode.workspace.getConfiguration('kiuwan.defectsList').get('analysisSource', '');
							vscode.window.showInformationMessage('Source analysis successfully updated to ' + analysisSource, 'OK');
							section = 'kiuwan.defectsList.analysisSourceDelivery.code';
							value = selection.value.code;
							vscode.workspace.getConfiguration().update(section, value, vscode.ConfigurationTarget.Workspace).then(function onfulfilled() {
								let delivery = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceDelivery').get('code');
								vscode.window.showInformationMessage('Delivery successfully updated to ' + delivery, 'OK');
							}, function onrejected() {
								let delivery = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceDelivery').get('code');
								vscode.window.showInformationMessage('Delivery update failed, it is still set to ' + delivery, 'OK');
							});
						}, function onrejected() {
							let analysisSource = vscode.workspace.getConfiguration('kiuwan.defectsList').get('analysisSource', '');
							vscode.window.showInformationMessage('Source analysis update failed, it is still set to ' + analysisSource, 'OK');
						});
					});
				}
				else if (result.response) {
					let msg = 'There\'s no body in get deliveries result (HTTP status = ' + result.response.statusCode + ' - ' + result.response.statusMessage + ')';
					vscode.window.showErrorMessage(msg, 'OK');
				}
			}).catch(error => {
				vscode.window.showErrorMessage(error.message, 'OK');
			});
		}
		else {
			let msg = 'This command lists the deliveries of a Kiuwan application, you have to choose a Kiuwan application first.';
			vscode.window.showErrorMessage(msg, 'OK');
		}
	});
}
function refreshDefects() {
	// Force client configuration, in case user just changed connection settings
	log.info("Refreshing Kiuwan defects sections...");
	// Make 'Source Provider' refresh its contents (it will call kiuwanDefectsProvider's refresh if license check is ok)
	kiuwanSourceProvider.refresh();
	// Call 'Details Provider' without contents to ensure nothing is shown
	kiuwanDetailsProvider.refresh();
}

function refreshCoverageDefects() {
	// Force client configuration, in case user just changed connection settings
	vscode.window.showInformationMessage("Refreshing Jenkins Coverage defects sections...");
	// Make 'Source Provider' refresh its contents (it will call kiuwanDefectsProvider's refresh if license check is ok)
	coverageDefectsProvider.refresh();
}


async function automaticTest(reasoning) {
	// Force client configuration, in case user just changed connection settings
	vscode.window.showInformationMessage("Automatic test for..." + vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('PROJECT_FOLDER'));

	const selectedFolderUri = await vscode.window.showOpenDialog({
		canSelectFolders: true,
		canSelectFiles: false,
		openLabel: 'Seleccionar carpeta raíz'
	});
	if (!selectedFolderUri || selectedFolderUri.length === 0) {
		return; // El usuario canceló la selección
	}
	const rootPath = selectedFolderUri[0].fsPath;


  // Obtener todos los archivos del árbol
  // const fileItems = await getAllCoverageFiles();
	const fileItems = await getAllCoverageFilesFrom(rootPath);
	vscode.window.showInformationMessage(`Procesando ${fileItems.length} archivos...`);
  // Iterar de forma secuencial cada archivo
  for (const fileItem of fileItems) {
    // Verificar si el archivo tiene líneas sin cobertura utilizando el provider de resumen,
    // por ejemplo, llamando a loadFileDetails; si no tiene líneas sin cobertura, saltarlo.


    // Determinar la ruta del archivo de test correspondiente. Aquí puedes definir tu lógica,
    // por ejemplo, cambiando la extensión de ".ts" por ".spec.ts"
    // const testFilePath = getTestFilePath(fileItem.path);
		const filePath = getFilePathJenkins(fileItem.path);
		const fileDetails = await coverageSummaryProvider.loadFileDetailsReturned(filePath);
    if (!fileDetails || fileDetails.length === 0 ) {
			logger.appendLine(`El archivo ${fileItem.path} no tiene líneas para cubrir.`);
      continue;
    }

		if((!fileItem.path.includes('.ts') || fileItem.path.includes('spec.ts'))){
			logger.appendLine(`El archivo ${fileItem.path} no es un archivo que necesite cobertura de test.`);
			continue;
		}

    // Mostrar información para saber qué archivo se está procesando
    vscode.window.showInformationMessage(`Procesando archivo: ${fileItem.path}`);

    // Ejecutar openTestContainers en modo automático, donde el último parámetro (auto) es true
    try {
      await openTestContainers(fileItem.path, getTestFilePath(fileItem.path), null, true, reasoning);
      // Una vez completado el test para este archivo, se continúa con el siguiente
    } catch (error) {
      vscode.window.showErrorMessage(`Error al testear internal path ${fileItem.path} external path ${filePath} : ${error}`);
			logger.appendLine(`Error al testear internal path ${fileItem.path} external path ${filePath} : ${error}`);
      // Puedes decidir si detener el proceso o continuar con el siguiente archivo
    }
  }
  vscode.window.showInformationMessage("Proceso automaticTest completado. con " + fileItems.length + " archivos.");
	logger.appendLine("Proceso automaticTest completado. con " + fileItems.length + " archivos.");
	
}

function getTestFilePath(sourcePath) {
		return sourcePath.replace('.ts', '.spec.ts');
}

function getFilePathJenkins(sourcePath) {
	
	const area = vscode.workspace.getConfiguration('jenkins.connectionSettings').get('area');
	const app = vscode.workspace.getConfiguration('jenkins.connectionSettings').get('jobName');
	const folderApp = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('PROJECT_FOLDER');
	const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	//PROD EXTENSION EMPAQUETADA
  return sourcePath.replace(`${workspaceFolder}\\` + `${folderApp}\\`,`/Users/admin/jenkins_config_cd/workspace/${area.toUpperCase()}/app${area}-${app}-pipeline/`).replaceAll('\\', '/');
	//DEV EXT DEBUG LOCAL
	// return sourcePath.replace(`${workspaceFolder}\\`,`/Users/admin/jenkins_config_cd/workspace/${area.toUpperCase()}/app${area}-${app}-pipeline/`).replaceAll('\\', '/');
}

/**
 * Función que recorre de forma recursiva los elementos del árbol de cobertura
 * y retorna un arreglo con todos los items que sean archivos.
 */
async function getAllCoverageFiles() {
  // Se obtiene la raíz del árbol desde el provider
  const rootItems = await coverageDefectsProvider.getChildren();
  const files = [];

  // Función recursiva para recorrer el árbol
  function recorrer(items) {
    for (const item of items) {
      // Si el elemento es un archivo, se agrega al arreglo
      if (item.isFile) {
        files.push(item);
      }
      // Si el elemento no es archivo y tiene hijos, se recorre sus hijos
      else if (typeof item.getChildren === 'function') {
        // Puede que getChildren retorne una promesa, en cuyo caso se debe esperar
        const children = item.getChildren();
        if (children instanceof Promise) {
          children.then(childItems => {
            recorrer(childItems);
          });
        } else {
          recorrer(children);
        }
      }
    }
  }

  recorrer(rootItems);
  return files;
}

async function getAllCoverageFilesFrom(rootPath) {
  const files = [];

  async function recorrer(path) {
    const entries = await fs.promises.readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path + '/' + entry.name;
      if (entry.isFile()) {
        files.push({ path: fullPath, isFile: true });
      } else if (entry.isDirectory()) {
        await recorrer(fullPath);
      }
    }
  }

  await recorrer(rootPath);
  return files;
}


function refreshCoverageDetails() {
	vscode.window.showInformationMessage("Refreshing Jenkins Coverage details sections...");
	coverageDetailsProvider.refresh();
}

function refreshCoverageSummary() {
	vscode.window.showInformationMessage("Refreshing Jenkins Coverage summary sections...");
	coverageSummaryProvider.refresh();

}

function browseToFile(details, fileName, line) {
	if (!vscode.workspace.rootPath) {
		vscode.window.showInformationMessage('There is no folder opened, cannot browse to defect file.', 'OK');
		return;
	}
	// Refresh details view with details
	kiuwanDetailsProvider.refresh(details);
	// Try to resolve existing file path from opened folder and defect's file, and browse to it
	findWorkspaceFile(vscode.workspace.rootPath, fileName).then(filePath => {
		if (filePath) {
			vscode.workspace.openTextDocument(filePath).then(document => {
				vscode.window.showTextDocument(document).then(editor => {
					// Our engine's line is one-based and vscode.Position is zero-based
					var position = new vscode.Position(line - 1, 0);
					editor.selection = new vscode.Selection(position, position);
					editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenter);
					vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
				}); // end showTextDocument.then
			}); // end openTextDocument.then
		}
		else {
			vscode.window.showInformationMessage('File cannot be found, cannot browse to defect file.', 'OK');
		}
	}).catch(error => {
		vscode.window.showInformationMessage('File cannot be found, cannot browse to defect file.', 'OK');
	});
}
function refreshDetails(details) {
	kiuwanDetailsProvider.refresh(details);
}
function findWorkspaceFile(workspaceAbsolutePath, fileRelativePath) {
	return __awaiter(this, void 0, void 0, function* () {
		// Basic case: VSCode's root folder and KLA's analysis basedir are the same
		let candidate = path.join(workspaceAbsolutePath, fileRelativePath);
		if (fs.existsSync(candidate)) {
			return candidate;
		}
		// Cheap search: VSCode's root folder is subfolder of KLA's analysis basedir, try with root folder ancestors
		let shortenedFolderPath = workspaceAbsolutePath.replace(/\\/g, '/');
		let lastSlashIndex = shortenedFolderPath.lastIndexOf('/');
		while (lastSlashIndex >= 0) {
			shortenedFolderPath = shortenedFolderPath.substring(0, lastSlashIndex);
			candidate = path.join(shortenedFolderPath, fileRelativePath);
			if (fs.existsSync(candidate)) {
				return candidate;
			}
			lastSlashIndex = shortenedFolderPath.lastIndexOf('/');
		}
		// Expensive search: KLA's analysis basedir is subfolder of VSCode's root folder, try with root folder descendants
		let includeGlobPattern = '**/' + fileRelativePath;
		try {
			let files = yield vscode.workspace.findFiles(includeGlobPattern, null, 1);
			if (files.length > 0) {
				return files[0].fsPath;
			}
		}
		catch (reason) {
			log.info("Method find files failed because: " + reason);
		}
		// Not found, return null
		return null;
	});
}
//# sourceMappingURL=extension.js.map