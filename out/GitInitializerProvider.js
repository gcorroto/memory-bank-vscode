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
const vscode = require('vscode');

class GitInitializerProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getChildren(element) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!element) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    const repoPath = workspaceFolders[0].uri;
                    const gitRepo = yield this.getGitRepository(repoPath);

                    if (gitRepo) {
                        return [new vscode.TreeItem("Repositorio Git ya inicializado")];
                    } else {
                        return [new vscode.TreeItem("Repositorio no inicializado - Haz clic para inicializar")];
                    }
                }
                return [];
            } else {
                return [];
            }
        });
    }

    getTreeItem(element) {
        return element;
    }

    initializeGitRepository() {
        return __awaiter(this, void 0, void 0, function* () {
            const gitApi = this.getGitApi();
            const workspaceFolders = vscode.workspace.workspaceFolders;

            if (!gitApi || !workspaceFolders) {
                vscode.window.showErrorMessage("Git API o carpeta de trabajo no disponible.");
                return;
            }

            const repoPath = workspaceFolders[0].uri;
            const jira = vscode.workspace.getConfiguration('git.connectionSettings').get('jira');
            const gitRepoUrl = vscode.workspace.getConfiguration('git.connectionSettings').get('gitRepoUrl');
            const gitUsername = vscode.workspace.getConfiguration('git.connectionSettings').get('gitUsername');
            const gitToken = yield this.getGitToken();

            if (!jira || !(yield this.validateBranchName(jira))) {
                vscode.window.showErrorMessage("Nombre de rama no válido o no configurado.");
                return;
            }

            if (!gitRepoUrl || !gitUsername || !gitToken) {
                vscode.window.showErrorMessage("Configuración de conexión al repositorio Git incompleta.");
                return;
            }

            const branchExists = yield this.checkIfBranchExists(gitRepoUrl, gitUsername, gitToken, `feature/${jira}`);

            if (branchExists) {
                const userResponse = yield vscode.window.showQuickPick(["Sí", "No"], {
                    placeHolder: `La rama '${jira}' ya existe. ¿Deseas conectarte a ella?`
                });

                if (userResponse === "Sí") {
                    yield gitApi.init(repoPath);
                    const repo = gitApi.getRepository(repoPath);
                    if (repo) {
                        yield repo.checkout(`feature/${jira}`);
                        vscode.window.showInformationMessage(`Conectado a la rama 'feature/${jira}'`);
                    }
                    return;
                }
            } else {
                yield gitApi.init(repoPath);
                const repo = gitApi.getRepository(repoPath);

                if (repo) {
                    yield repo.createBranch(`feature/${jira}`, true);
                    vscode.window.showInformationMessage(`Repositorio inicializado con la rama feature/${jira}`);
                    this.refresh();
                }
            }
        });
    }

    getGitApi() {
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        return gitExtension ? gitExtension.getAPI(1) : null;
    }

    getGitToken() {
        return __awaiter(this, void 0, void 0, function* () {
            const gitToken = yield this.context.secrets.get("git.connectionSettings.gitToken");

            if (gitToken) {
                return gitToken;
            }

            const password = yield vscode.window.showInputBox({
                prompt: "Introduce tu contraseña de Git",
                password: true,
            });

            if (password) {
                yield this.context.secrets.store("git.connectionSettings.gitToken", password);
                return password;
            }

            vscode.window.showErrorMessage("No se proporcionó una contraseña para Git.");
            return undefined;
        });
    }

    validateJiraBranch(jira) {
					
					const settings = vscode.workspace.getConfiguration('jenkins.connectionSettings');
					const settingsApi = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl');

					let url = settingsApi.get('URL');
					let jwt = settingsApi.get('JWT');

					const urlApi = `${url}/api/v1/jira/${jira}`;

        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(urlApi, {
																	method: 'GET',
																	headers: {
																					'Content-Type': 'application/json',
																					'Authorization': `Bearer ${jwt}`
																	}
													});
                const result = yield response.json();
                return result.isValid;
            } catch (error) {
                vscode.window.showErrorMessage("Error al validar la tarea de jira, " + jira + ".");
                return false;
            }
        });
    }

    checkIfBranchExists(repoUrl, username, token, branchName) {
        return __awaiter(this, void 0, void 0, function* () {
            const auth = Buffer.from(`${username}:${token}`).toString('base64');
            try {
                const response = yield fetch(`${repoUrl}/branches/${branchName}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (response.status === 200) {
                    return true;
                } else if (response.status === 404) {
                    return false;
                } else {
                    throw new Error(`Error al verificar la rama: ${response.statusText}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage("Error al verificar si la rama ya existe.");
                return false;
            }
        });
    }


    // Nueva función para validar y almacenar la información de la tarjeta
    validateAndStoreIssue(jira) {

					const settingsApi = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl');

					let url = settingsApi.get('URL');
					let jwt = settingsApi.get('JWT');

					const urlApi = `${url}/api/v1/jira/${jira}`;

								return __awaiter(this, void 0, void 0, function* () {
									let issueKey = vscode.workspace.getConfiguration('git.connectionSettings').get('jira');;

									// Si no está configurado, solicitar al usuario el ID de la tarjeta de Jira
									if (!issueKey) {
													issueKey = yield vscode.window.showInputBox({ prompt: 'Introduce el ID de la tarjeta de Jira (por ejemplo, UAAPT-7626)' });
													if (!issueKey) {
																	vscode.window.showErrorMessage("No se proporcionó un ID de tarjeta de Jira.");
																	return;
													}
									}

												try {
																const response = yield fetch(urlApi, {
																			method: 'GET',
																			headers: {
																							'Authorization': `Basic ${auth}`,
																							'Accept': 'application/vnd.github.v3+json'
																			}
																});

																if (response.ok) {
																				const data = yield response.json();
																				const status = data.fields.status.name;

																				if (status === 'WIP') {
																								vscode.window.showInformationMessage(`La tarea ${issueKey} está en estado WIP.`);
																								this.issueData = {
																												id: data.id,
																												key: data.key,
																												summary: data.fields.summary,
																												description: data.fields.description,
																												assignee: data.fields.assignee.displayName,
																												reporter: data.fields.reporter.displayName,
																												priority: data.fields.priority.name,
																												status: status,
																												labels: data.fields.labels,
																												fixVersions: data.fields.fixVersions.map(v => v.name),
																												issuelinks: data.fields.issuelinks.map(link => ({
																																id: link.id,
																																type: link.type.name,
																																outwardIssueKey: link.outwardIssue?.key,
																																outwardIssueSummary: link.outwardIssue?.fields?.summary
																												}))
																								};
																								vscode.window.showInformationMessage('Información de la tarea almacenada correctamente.');
																				} else {
																								vscode.window.showErrorMessage(`La tarea ${issueKey} no está en estado WIP.`);
																				}
																} else {
																				vscode.window.showErrorMessage(`Error al obtener la tarea ${issueKey}: ${response.statusText}`);
																}
												} catch (error) {
																vscode.window.showErrorMessage(`Error al validar la tarea: ${error.message}`);
												}
								});
				}

					// Función para acceder a la información almacenada de la tarea
					getStoredIssueData() {
									return this.issueData;
					}


    getGitRepository(repoPath) {
        const gitApi = this.getGitApi();
        return gitApi ? gitApi.getRepository(repoPath) : null;
    }
}

exports.GitInitializerProvider = GitInitializerProvider;
