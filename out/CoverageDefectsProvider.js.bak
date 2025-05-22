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

const vscode = require('vscode');
const path = require('path');
const Dictionary = require('./utils/Dictionary').Dictionary;
const coverageProvider = new vscode.EventEmitter();
const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
if (!workspaceFolder) {
				vscode.window.showErrorMessage('No se pudo encontrar la carpeta de trabajo.');
				return;
}



// const absoluteFilePath = path.join(workspaceFolder, folderProject, relativeFilePath); // Combinar la raíz con la ruta relativa


class CoverageDefectsProvider {
	_onDidChangeTreeData = new vscode.EventEmitter();
	_onFileSelected = new vscode.EventEmitter();
	onFileSelected = this._onFileSelected.event;
	onDidChangeTreeData = this._onDidChangeTreeData.event;
	coverageTreeItems = new Map();
	logger;

	constructor(logger) {
			this.logger = logger;
	}

	refresh() {
					this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {

					const treeItem = new vscode.TreeItem(element.label);
					if (element.isFile) {
									treeItem.command = {
													command: 'jenkins.connectionSettings.showCoverageDetails', // Define un comando específico para la selección de archivos
													title: 'Show Coverage Details'  + element.label,
													arguments: [element] // Pasa el elemento como argumento
									};
									element = treeItem;
					}
					return element;
	}

// 	getChildren(element) {
// 		return __awaiter(this, void 0, void 0, function* () {
// 						if (!element) {
// 										vscode.window.showInformationMessage('open coverage defects Folder');
// 										const coveragePaths = yield this.fetchDefectData();
// 										return this.buildCoverageTree(coveragePaths);
// 						} else if (element.isFile) {
// 										vscode.window.showInformationMessage('open coverage defects File');
// 										const packagePath = element.path;
// 										const className = '';
// 										const lineCoverage = yield this.fetchCoverageReportSummary(packagePath, className);
// 										const isFile = element.isFile;
// 										vscode.window.showInformationMessage('open coverage lines data fetched.');
// 										const coverageText = `${lineCoverage.totalStatements}/${lineCoverage.totalFunctions}/${lineCoverage.totalBranches}`;

// 										// Retorna cada línea con la cobertura, incluyendo el resumen en la derecha
// 										return lineCoverage.map(lineInfo => 
// 														new CoverageDefectTreeItem(
// 																		element.label, 
// 																		vscode.TreeItemCollapsibleState.None, 
// 																		true, 
// 																		packagePath, 
// 																		isFile,
// 																		`Coverage: totalStatements = ${lineCoverage.totalStatements}, totalFunctions = ${lineCoverage.totalFunctions}, totalBranches = ${lineCoverage.totalBranches}`, 
// 																		`${lineInfo.lineNumber}: ${lineInfo.coverage} (${coverageText})`,
// 														)
// 										);
// 						} else {
// 										vscode.window.showInformationMessage('open coverage defects Folder with children');
// 										// Obtener los hijos de la carpeta
// 										// const children = yield element.getChildren();

// 										// Para cada hijo, si es un archivo, calcula el número de líneas cubiertas y totales
// 										// for (const child of children) {
// 														// if (child.isFile) {
// 																		const packagePath = element.path;
// 																		const className = '';
// 																		const lineCoverage = yield this.fetchCoverageReportSummary(packagePath, className);


// 																		// Crear el TreeItem con tooltip y descripción
// 																		const folderItem = new CoverageDefectTreeItem(
// 																						element.label,
// 																						vscode.TreeItemCollapsibleState.Collapsed,
// 																						false,
// 																						packagePath,
// 																						false,
// 																						`Coverage: totalStatements = ${lineCoverage.totalStatements}, totalFunctions = ${lineCoverage.totalFunctions}, totalBranches = ${lineCoverage.totalBranches}`,
// 																						`${lineCoverage.totalStatements}/${lineCoverage.totalFunctions}/${lineCoverage.totalBranches}`
// 																		);
																		
																		
// 																		element.description = `${lineCoverage.totalStatements}/${lineCoverage.totalFunctions}/${lineCoverage.totalBranches}`; // Agrega el resumen a la derecha
// 																		element.tooltip = `Coverage: totalStatements = ${lineCoverage.totalStatements}, totalFunctions = ${lineCoverage.totalFunctions}, totalBranches = ${lineCoverage.totalBranches}`;
// 																		console.table(element);
// 														// }
// 										// }

// 										return element.getChildren();
// 						}
// 		});
// }
getChildren(element) {
	return __awaiter(this, void 0, void 0, function* () {
					if (!element) {
									vscode.window.showInformationMessage('open coverage defects Folder');
									const coveragePaths = yield this.fetchDefectData();
									return this.buildCoverageTree(coveragePaths);
					} else {
									const packagePath = element.path;
									const className = '';
									const lineCoverage = yield this.fetchCoverageReportSummary(packagePath, className);
									this.logger.appendLine(lineCoverage);
									const isFile = element.isFile;

									if (isFile) {

										this._onFileSelected.fire({
														path: element.path,
														label: element.label
										});
													// Retorna cada línea con la cobertura del archivo
													return lineCoverage.map(lineInfo =>
																	new CoverageDefectTreeItem(
																					element.label,
																					vscode.TreeItemCollapsibleState.None,
																					packagePath,
																					true,
																					`Coverage: uncoveredStatements = ${lineCoverage.uncoveredStatements}, totalStatements = ${lineCoverage.totalStatements}, uncoveredFunctions = ${lineCoverage.uncoveredFunctions}, totalFunctions = ${lineCoverage.totalFunctions}, uncoveredBranches = ${lineCoverage.uncoveredBranches}, totalBranches = ${lineCoverage.totalBranches}`,
																					`L=[${lineCoverage.uncoveredStatements}/${lineCoverage.totalStatements}] -  F=[${lineCoverage.uncoveredFunctions}/${lineCoverage.totalFunctions}], B=[${lineCoverage.uncoveredBranches}/${lineCoverage.totalBranches}]`
																	)
													);
													
									} else {
													// Para elementos de tipo carpeta, agrega la cobertura total en tooltip y descripción
													const coverageText = `L=[${lineCoverage.uncoveredStatements}/${lineCoverage.totalStatements}] -  F=[${lineCoverage.uncoveredFunctions}/${lineCoverage.totalFunctions}], B=[${lineCoverage.uncoveredBranches}/${lineCoverage.totalBranches}]`;
													element.description = coverageText;
													element.tooltip = `Coverage: uncoveredStatements = ${lineCoverage.uncoveredStatements}, totalStatements = ${lineCoverage.totalStatements}, uncoveredFunctions = ${lineCoverage.uncoveredFunctions}, totalFunctions = ${lineCoverage.totalFunctions}, uncoveredBranches = ${lineCoverage.uncoveredBranches}, totalBranches = ${lineCoverage.totalBranches}`;
													
													// Obtiene los hijos de la carpeta y les agrega su cobertura
													const children = yield element.getChildren();
													for (const child of children) {
																	// if (child.isFile) {
																					const childCoverage = yield this.fetchCoverageReportSummary(child.isFile? child.path.replace(`/${child.label}`,'') : child.path, child.isFile? child.label :'');
																					const coverageChildText = `L=[${childCoverage.uncoveredStatements}/${childCoverage.totalStatements}] -  F=[${childCoverage.uncoveredFunctions}/${childCoverage.totalFunctions}], B=[${childCoverage.uncoveredBranches}/${childCoverage.totalBranches}]`;
																					child.description = coverageChildText;
																					child.tooltip = `Coverage: uncoveredStatements = ${childCoverage.uncoveredStatements}, totalStatements = ${childCoverage.totalStatements}, uncoveredFunctions = ${childCoverage.uncoveredFunctions}, totalFunctions = ${childCoverage.totalFunctions}, uncoveredBranches = ${childCoverage.uncoveredBranches}, totalBranches = ${childCoverage.totalBranches}`;
																	// }
													}
													return children;
									}
					}
	});
}



	fetchDefectData() {

					return __awaiter(this, void 0, void 0, function* () {
									try {
													const packages = yield this.fetchCoveragePaths();
													vscode.window.showInformationMessage('Coverage packages data fetched successfully.');
													// console.table(packages);
													return packages;
									} catch (error) {
													vscode.window.showErrorMessage('Failed to fetch coverage data.' + error);
													this.logger.appendLine(error);
													return [];
									}
					});
	}

	fetchCoveragePaths() {
					const settings = vscode.workspace.getConfiguration('jenkins.connectionSettings');
					const settingsApi = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl');

					let url = settingsApi.get('URL');
					let jwt = settingsApi.get('JWT');

					let area = settings.get('area');
					let app = settings.get('jobName');
					let buildNumber = settings.get('buildNumber');

					const urlApi = `${url}/api/v1/jenkins/area/${area}/app/${app}/build/${buildNumber}/coverage/paths`;
					this.logger.appendLine( 'call paths coverage url = ' + urlApi);

					return fetch(urlApi, {
									method: 'GET',
									headers: {
													'Content-Type': 'application/json',
													'Authorization': `Bearer ${jwt}`
									}
					})
					.then(response => response.json())
					.then(data => data) // Asumiendo que data es un array de strings (rutas)
					.catch(error => {
									vscode.window.showErrorMessage(`Error fetching coverage paths: ${error}`);
									this.logger.appendLine(error);
									return [];
					});
	}


	fetchCoverageReportSummary(packagePath, className) {

		const settings = vscode.workspace.getConfiguration('jenkins.connectionSettings');
		const settingsApi = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl');

		let url = settingsApi.get('URL');
		let jwt = settingsApi.get('JWT');

		let area = settings.get('area');
		let app = settings.get('jobName');
		let buildNumber = settings.get('buildNumber');

			const urlApi = `${url}/api/v1/jenkins/area/${area}/app/${app}/build/${buildNumber}/coverage?package=${encodeURIComponent(packagePath)}&class=${encodeURIComponent(className)}`;

			return fetch(urlApi, {
							method: 'GET',
							headers: {
											'Content-Type': 'application/json',
											'Authorization': `Bearer ${jwt}`
							}
			})
			.then(response => response.json())
			.catch(error => {
							vscode.window.showErrorMessage(`Error fetching coverage lines: ${error}`);
							this.logger.appendLine(error);
							return [];
			});
}
async buildCoverageTree(paths) {
	const rootItems = new Map();
	if (Array.isArray(paths)) {
					for (const [pathIndex, path] of paths.entries()) {
									// Eliminar el prefijo de cada ruta
									const cleanedPath = path.replace('/Users/admin/jenkins_config_cd/workspace/', '');
									const parts = cleanedPath.split('/'); // Divide la ruta en carpetas y archivos

									// Construir nodos del árbol dinámicamente
									let currentMap = rootItems;
									let currentParent = null;

									for (const [index, part] of parts.entries()) {
													const isFile = index === parts.length - 1; // Último elemento es el archivo

													if (!currentMap.has(part)) {
																	const item = new CoverageDefectTreeItem(part, isFile ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed, path, isFile);

																	// Agregar descripción y tooltip al primer elemento del árbol
																	if (pathIndex === 0 && index === 0) {
																					const lineCoverage = await this.fetchCoverageReportSummary(path, '');
																					if(lineCoverage?.totalStatements){
																						const coverageText = `L=[${lineCoverage.uncoveredStatements}/${lineCoverage.totalStatements}] -  F=[${lineCoverage.uncoveredFunctions}/${lineCoverage.totalFunctions}], B=[${lineCoverage.uncoveredBranches}/${lineCoverage.totalBranches}]`;
																						item.description = coverageText;
																						item.tooltip = `Coverage: uncoveredStatements = ${lineCoverage.uncoveredStatements}, totalStatements = ${lineCoverage.totalStatements}, uncoveredFunctions = ${lineCoverage.uncoveredFunctions}, totalFunctions = ${lineCoverage.totalFunctions}, uncoveredBranches = ${lineCoverage.uncoveredBranches}, totalBranches = ${lineCoverage.totalBranches}`;
																					}
																	}

																	currentMap.set(part, item);
																	if (currentParent) {
																					currentParent.addChild(item);
																	}
													}

													const nextItem = currentMap.get(part);
													if (!isFile && nextItem) {
																	currentParent = nextItem;
																	currentMap = nextItem.childrenMap;
													}
									}
					}
	} else {
					this.logger.appendLine('paths is not an array:', paths);
	}

	return Array.from(rootItems.values());
}
}

class CoverageDefectTreeItem extends vscode.TreeItem {
	childrenMap = new Map();

	constructor(
						label,
						collapsibleState,
						path,
						isFile,
						toolTip,
						description
	) {
					super(label, collapsibleState);
					this.setIcon();
					this.path = path;
					this.isFile = isFile;
					this.tooltip = toolTip;
					this.description = description;
	}

	addChild(child) {
					this.childrenMap.set(child.label, child);
	}

	getChildren() {
					return Array.from(this.childrenMap.values());
	}

	setIcon() {
					if (this.isFile) {
									this.iconPath = new vscode.ThemeIcon('file');
					} else {
									this.iconPath = new vscode.ThemeIcon('folder');
					}
	}
}


exports.CoverageDefectsProvider = CoverageDefectsProvider;