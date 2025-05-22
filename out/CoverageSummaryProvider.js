// Define el patrón _awaiter y __generator para TypeScript
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
	return new (P || (P = Promise))(function (resolve, reject) {
					function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
					function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
					function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
					step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};

// Para un entorno sin `async/await` directo
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

class CoverageSummaryProvider {
	_onDidChangeTreeData = new vscode.EventEmitter();
	onDidChangeTreeData = this._onDidChangeTreeData.event;
	fileDetails = [];
	logger;

	constructor(coverageProvider, logger) {
					// Suscribirse al evento de archivo seleccionado en CoverageDefectsProvider
					coverageProvider.onFileSelected(file => {
									vscode.window.showInformationMessage(`File selected: ${file.label}`);
									this.loadFileDetails(file.path, file.label);
					});
					this.logger = logger;
	}

	async loadFileDetails(path, label) {
		try {
						// Limpiar los detalles del archivo anterior
						this.fileDetails = [];

						// Carga la información de cobertura de las líneas del archivo
						const coverageData = await this.fetchCoverageLines(path);
						this.logger.appendLine("Coverage Data: " + coverageData);
						this.fileDetails = {};
						// Filtrar las líneas no cubiertas basándote en el estado de cobertura
						this.fileDetails = Object.keys(coverageData.statementMap)
										.filter(index => coverageData.s[index] === 0)  // Solo incluir sentencias no cubiertas (s = 0)
										.map(index => {
														const statement = coverageData.statementMap[index];
														const startLine = statement.start.line;
														const endLine = statement.end.line;

														// Si la sentencia cubre un rango, incluir todas las líneas en ese rango
														const lines = [];
														for (let line = startLine; line <= endLine; line++) {
																		lines.push({
																						line: line,
																						path: path,
																						coverage: 'not covered'
																		});
														}
														return lines;
										})
										.flat();

						// Ordenar las líneas de menor a mayor
						this.fileDetails.sort((a, b) => a.line - b.line);

						// Refrescar la vista para mostrar solo las líneas no cubiertas
						this._onDidChangeTreeData.fire();
		} catch (error) {
						vscode.window.showErrorMessage(`Error loading file details: ${error}`);
						this.logger.appendLine(error);
		}
}


async loadFileDetailsReturned(path) {
	// Limpiar los detalles del archivo anterior
	let fileDetails = [];
	try {
					// Carga la información de cobertura de las líneas del archivo
					const coverageData = await this.fetchCoverageLines(path);
					this.logger.appendLine("Coverage Data:"+  coverageData);
					fileDetails = {};
					// Filtrar las líneas no cubiertas basándote en el estado de cobertura
					fileDetails = Object.keys(coverageData.statementMap)
									.filter(index => coverageData.s[index] === 0)  // Solo incluir sentencias no cubiertas (s = 0)
									.map(index => {
													const statement = coverageData.statementMap[index];
													const startLine = statement.start.line;
													const endLine = statement.end.line;

													// Si la sentencia cubre un rango, incluir todas las líneas en ese rango
													const lines = [];
													for (let line = startLine; line <= endLine; line++) {
																	lines.push({
																					line: line,
																					path: path,
																					coverage: 'not covered'
																	});
													}
													return lines;
									})
									.flat();

					// Ordenar las líneas de menor a mayor
					fileDetails.sort((a, b) => a.line - b.line);

	} catch (error) {
					vscode.window.showErrorMessage(`Error loading file details: ${error}`);
					this.logger.appendLine(error);
	}

	return fileDetails;
}
getTreeItem(element) {
	const treeItem = new vscode.TreeItem(`Línea ${element.line} - ${element.coverage}`);
		treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;

		// Definir el comando para abrir el archivo en la línea específica
			treeItem.command = {
					command: 'jenkins.connectionSettings.openFileAtLine', // Nombre del comando
					title: 'Open File at Line',
					arguments: [element] // Pasar el elemento como argumento
		};

		element = treeItem;

		return element;
	}

	getChildren() {
					// Retorna las líneas de detalles del archivo seleccionado
					return this.fileDetails.map(detail => ({
									path: detail.path,
									line: detail.line,
									coverage: detail.coverage
					}));
	}

	
	async fetchCoverageLines(path) {
			const settings = vscode.workspace.getConfiguration('jenkins.connectionSettings');
			const settingsApi = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl');

			let url = settingsApi.get('URL');
			let jwt = settingsApi.get('JWT');

			let area = settings.get('area');
			let app = settings.get('jobName');
			let buildNumber = settings.get('buildNumber');

			const urlApi = `${url}/api/v1/jenkins/area/${area}/app/${app}/build/${buildNumber}/coverage/lines?path=${path}`;
			this.logger.appendLine('call lines path coverage url = ' + urlApi);

			try {
							const response = await fetch(urlApi, {
											method: 'GET',
											headers: {
															'Content-Type': 'application/json',
															'Authorization': `Bearer ${jwt}`
											}
							});
							const data = await response.json();
							return data; // Asumiendo que data es un array de strings (rutas)
			} catch (error) {
							vscode.window.showErrorMessage(`Error fetching lines path coverage: ${error}`);
							this.logger.appendLine(error);
							return [];
			}
	}
}

exports.CoverageSummaryProvider = CoverageSummaryProvider;