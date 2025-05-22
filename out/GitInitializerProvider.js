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

    // Initialize a new Git repository
    initializeGitRepository() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let issueKey = yield this.validateAndStoreIssue();
                if (!issueKey) {
                    return;
                }
                yield this.initializeRepository(issueKey);
                yield this.addGitIgnore();
            } catch (error) {
                vscode.window.showErrorMessage(error.message);
            }
        });
    }

    // Create .gitignore file with common patterns
    addGitIgnore() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                    throw new Error("No workspace folder open.");
                }
                const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const fs = require('fs');
                const path = require('path');
                const gitignorePath = path.join(workspaceFolder, '.gitignore');
                const gitignoreContent = `
# Dependencies
node_modules/
bower_components/

# Build outputs
dist/
build/
out/
target/
bin/
obj/

# IDEs and editors
.idea/
.vscode/
*.sublime-workspace
*.sublime-project
.settings/
.classpath
.project

# Operating System Files
.DS_Store
Thumbs.db
*.swp
*.swo

# Logs and databases
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.sqlite
*.db

# Testing and coverage
coverage/
.nyc_output/
.jest/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
`;
                fs.writeFileSync(gitignorePath, gitignoreContent);
                vscode.window.showInformationMessage("Se ha creado el archivo .gitignore con configuraciones comunes.");
            } catch (error) {
                vscode.window.showErrorMessage(`Error creating .gitignore: ${error.message}`);
            }
        });
    }

    // Get Git password from stored credentials or prompt user
    getGitPassword() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to retrieve the stored password
                const storedPassword = yield this.context.secrets.get("git.connectionSettings.gitToken");
                if (storedPassword) {
                    return storedPassword;
                }
            } catch (error) {
                console.error("Error retrieving stored password:", error);
            }

            // If no stored password or error retrieving, prompt user
            const password = yield vscode.window.showInputBox({
                prompt: "Introduce el token de acceso a Git",
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
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // In the refactored version, we accept any Jira ID format 
                // that matches the pattern: letters-numbers
                const isValidJiraFormat = /^[A-Z]+-\d+$/i.test(jira);
                
                if (!isValidJiraFormat) {
                    vscode.window.showWarningMessage("El formato de la tarea de Jira no es válido. Se esperaba algo como 'PROJ-123'.");
                    return false;
                }
                
                // Since we no longer verify against API, we'll just return true
                return true;
            } catch (error) {
                vscode.window.showErrorMessage("Error al validar la tarea de jira, " + jira + ".");
                return false;
            }
        });
    }

    // Validate and store Jira issue information
    validateAndStoreIssue() {
        return __awaiter(this, void 0, void 0, function* () {
            let issueKey = vscode.workspace.getConfiguration('git.connectionSettings').get('jira');

            // If not configured, prompt user for Jira ID
            if (!issueKey) {
                issueKey = yield vscode.window.showInputBox({ 
                    prompt: 'Introduce el ID de la tarjeta de Jira (por ejemplo, PROJ-123)' 
                });
                
                if (!issueKey) {
                    vscode.window.showErrorMessage("No se proporcionó un ID de tarjeta de Jira.");
                    return undefined;
                }
            }

            // Validate Jira ticket format
            const isValid = yield this.validateJiraBranch(issueKey);
            if (!isValid) {
                vscode.window.showErrorMessage(`La tarjeta ${issueKey} no es válida.`);
                return undefined;
            }

            // Store Jira ID in settings
            yield vscode.workspace.getConfiguration('git.connectionSettings').update('jira', issueKey, vscode.ConfigurationTarget.Workspace);
            
            vscode.window.showInformationMessage(`Tarjeta ${issueKey} validada y almacenada.`);
            return issueKey;
        });
    }

    // Initialize Git repository with initial commit
    initializeRepository(issueKey) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                throw new Error("No workspace folder open.");
            }

            const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);

            try {
                // Check if git is already initialized
                try {
                    yield execPromise('git rev-parse --is-inside-work-tree', { cwd: workspaceFolder });
                    vscode.window.showInformationMessage("El repositorio Git ya está inicializado.");
                    return;
                } catch (error) {
                    // Git not initialized, continue with initialization
                }

                // Initialize repository
                yield execPromise('git init', { cwd: workspaceFolder });
                vscode.window.showInformationMessage("Repositorio Git inicializado.");

                // Create branch with Jira ID
                const branchName = `feature/${issueKey.toLowerCase()}`;
                yield execPromise(`git checkout -b ${branchName}`, { cwd: workspaceFolder });
                vscode.window.showInformationMessage(`Rama ${branchName} creada.`);

                // Configure user info if not already set
                try {
                    yield execPromise('git config user.name', { cwd: workspaceFolder });
                } catch (error) {
                    const username = vscode.workspace.getConfiguration('git.connectionSettings').get('gitUsername');
                    if (username) {
                        yield execPromise(`git config user.name "${username}"`, { cwd: workspaceFolder });
                    } else {
                        const inputUsername = yield vscode.window.showInputBox({ prompt: 'Introduce tu nombre de usuario para Git' });
                        if (inputUsername) {
                            yield execPromise(`git config user.name "${inputUsername}"`, { cwd: workspaceFolder });
                            yield vscode.workspace.getConfiguration('git.connectionSettings').update('gitUsername', inputUsername, vscode.ConfigurationTarget.Workspace);
                        }
                    }
                }

                try {
                    yield execPromise('git config user.email', { cwd: workspaceFolder });
                } catch (error) {
                    const email = yield vscode.window.showInputBox({ prompt: 'Introduce tu email para Git' });
                    if (email) {
                        yield execPromise(`git config user.email "${email}"`, { cwd: workspaceFolder });
                    }
                }

                // Create initial commit
                yield execPromise('git add .', { cwd: workspaceFolder });
                yield execPromise(`git commit -m "Initial commit for ${issueKey}"`, { cwd: workspaceFolder });
                vscode.window.showInformationMessage("Commit inicial creado.");

                // Set remote origin if URL is configured
                const repoUrl = vscode.workspace.getConfiguration('git.connectionSettings').get('gitRepoUrl');
                if (repoUrl) {
                    try {
                        yield execPromise(`git remote add origin ${repoUrl}`, { cwd: workspaceFolder });
                        vscode.window.showInformationMessage(`Repositorio remoto configurado: ${repoUrl}`);
                    } catch (error) {
                        // Remote might already exist
                        vscode.window.showWarningMessage(`Remote origin ya existía. No se ha modificado.`);
                    }
                } else {
                    const inputRepoUrl = yield vscode.window.showInputBox({ prompt: 'Introduce la URL del repositorio remoto' });
                    if (inputRepoUrl) {
                        yield execPromise(`git remote add origin ${inputRepoUrl}`, { cwd: workspaceFolder });
                        yield vscode.workspace.getConfiguration('git.connectionSettings').update('gitRepoUrl', inputRepoUrl, vscode.ConfigurationTarget.Workspace);
                        vscode.window.showInformationMessage(`Repositorio remoto configurado: ${inputRepoUrl}`);
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error inicializando el repositorio Git: ${error.message}`);
                throw error;
            }
        });
    }
}

exports.GitInitializerProvider = GitInitializerProvider;
