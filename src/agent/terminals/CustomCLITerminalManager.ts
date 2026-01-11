/**
 * Gestor de terminales personalizadas para Memory Bank
 * Gestiona la creación, visualización y ejecución de comandos en terminales VSCode
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

export interface TerminalExecutionResult {
    success: boolean;
    output: string;
    error?: string;
    commandId: string;
    timestamp: Date;
    workingDirectory?: string;
}

export class CustomCLITerminalManager {
    private terminals: Map<string, vscode.Terminal>;
    private outputChannels: Map<string, vscode.OutputChannel>;
    private activeTerminalId: string | null;
    private executions: Map<string, TerminalExecutionResult>;
    private outputListeners: Map<string, (output: string) => void>;
    private workspaceRoot: string | undefined;
    private defaultShell: string;

    constructor() {
        this.terminals = new Map();
        this.outputChannels = new Map();
        this.activeTerminalId = null;
        this.executions = new Map();
        this.outputListeners = new Map();
        
        // Determinar el workspace principal
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        
        // Configurar el shell por defecto (bash)
        this.defaultShell = this.determineBashPath();
        
        // Registrar listeners para eventos de terminal
        this.registerTerminalListeners();
    }

    /**
     * Determina la ruta a bash según el sistema operativo
     */
    private determineBashPath(): string {
        const platform = os.platform();
        
        if (platform === 'win32') {
            // En Windows, intentar encontrar Git Bash o WSL
            const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
            const gitBashPathAlt = 'C:\\Program Files (x86)\\Git\\bin\\bash.exe';
            
            if (vscode.workspace.getConfiguration('terminal.integrated.shell.windows').get<string>('bash')) {
                return vscode.workspace.getConfiguration('terminal.integrated.shell.windows').get<string>('bash')!;
            } else if (require('fs').existsSync(gitBashPath)) {
                return gitBashPath;
            } else if (require('fs').existsSync(gitBashPathAlt)) {
                return gitBashPathAlt;
            } else {
                // Si no se encuentra bash, intentar con WSL
                return 'wsl.exe';
            }
        } else {
            // En Unix/Mac, bash normalmente está disponible
            return '/bin/bash';
        }
    }

    /**
     * Registra listeners para eventos de terminal
     */
    private registerTerminalListeners() {
        // Registrar evento para cuando una terminal es cerrada
        vscode.window.onDidCloseTerminal((terminal) => {
            // Buscar y eliminar la terminal cerrada de nuestro mapa
            for (const [id, term] of this.terminals.entries()) {
                if (term === terminal) {
                    this.terminals.delete(id);
                    
                    // Si era la terminal activa, actualizar el estado
                    if (this.activeTerminalId === id) {
                        this.activeTerminalId = null;
                    }
                    
                    break;
                }
            }
        });
    }

    /**
     * Crea una nueva terminal personalizada
     * @param id - Identificador único para la terminal
     * @param name - Nombre para mostrar en la UI
     * @param cwd - Directorio de trabajo (opcional)
     * @returns El ID de la terminal creada
     */
    createTerminal(id: string = 'memorybank-cli', name: string = 'Memory Bank CLI', cwd?: string): string {
        // Usar un ID único si no se proporciona uno o si ya existe
        if (!id || this.terminals.has(id)) {
            id = `memorybank-cli-${Date.now()}`;
        }
        
        // Crear un canal de salida para capturar los resultados
        const outputChannel = vscode.window.createOutputChannel(`${name} Output`);
        this.outputChannels.set(id, outputChannel);
        
        // Configurar opciones de la terminal
        const options: vscode.TerminalOptions = {
            name,
            shellPath: this.defaultShell,
            cwd: cwd || this.workspaceRoot
        };
        
        // Crear la terminal
        const terminal = vscode.window.createTerminal(options);
        this.terminals.set(id, terminal);
        this.activeTerminalId = id;
        
        // Configurar para capturar la salida (VSCode API no permite esto directamente,
        // tendríamos que usar comandos que redirigen la salida a archivos)
        
        return id;
    }
    
    /**
     * Muestra la terminal identificada por ID
     * @param id - ID de la terminal a mostrar
     */
    showTerminal(id: string = 'memorybank-cli'): void {
        const terminal = this.terminals.get(id);
        if (terminal) {
            terminal.show();
            this.activeTerminalId = id;
        } else {
            const newId = this.createTerminal(id);
            this.terminals.get(newId)?.show();
        }
    }
    
    /**
     * Oculta la terminal identificada por ID
     * @param id - ID de la terminal a ocultar
     */
    hideTerminal(id: string = 'memorybank-cli'): void {
        // En VSCode API no hay un método directo para ocultar,
        // podemos usar el workbench.action.terminal.toggleTerminal command
        vscode.commands.executeCommand('workbench.action.togglePanel');
    }
    
    /**
     * Ejecuta un comando en la terminal
     * @param command - Comando a ejecutar
     * @param terminalId - ID de la terminal (usa la activa o crea una nueva si no se especifica)
     * @param captureOutput - Si es true, intentará capturar la salida redirigiendo a un archivo
     * @returns Promise con el resultado de la ejecución
     */
    async executeCommand(command: string, terminalId?: string, captureOutput: boolean = true): Promise<TerminalExecutionResult> {
        // Generar un ID único para esta ejecución
        const executionId = `exec-${Date.now()}`;
        
        // Usar la terminal especificada, la activa, o crear una nueva
        let terminal: vscode.Terminal | undefined;
        let actualTerminalId = terminalId;
        
        if (actualTerminalId && this.terminals.has(actualTerminalId)) {
            terminal = this.terminals.get(actualTerminalId);
        } else if (this.activeTerminalId) {
            terminal = this.terminals.get(this.activeTerminalId);
            actualTerminalId = this.activeTerminalId;
        } else {
            actualTerminalId = this.createTerminal();
            terminal = this.terminals.get(actualTerminalId);
        }
        
        if (!terminal || !actualTerminalId) {
            throw new Error("No se pudo obtener o crear una terminal para ejecutar el comando");
        }
        
        // Mostrar la terminal
        terminal.show();
        
        // Crear registro de ejecución
        const executionResult: TerminalExecutionResult = {
            success: false,
            output: '',
            commandId: executionId,
            timestamp: new Date()
        };
        
        this.executions.set(executionId, executionResult);
        
        // Si queremos capturar la salida, modificar el comando para redirigir a un archivo temporal
        if (captureOutput) {
            const tmpDir = os.tmpdir();
            const outputFile = path.join(tmpDir, `memorybank-output-${executionId}.txt`);
            const errorFile = path.join(tmpDir, `memorybank-error-${executionId}.txt`);
            
            // Guardar el directorio de trabajo actual
            const pwdCommand = `pwd > "${path.join(tmpDir, `memorybank-pwd-${executionId}.txt`)}"`;
            terminal.sendText(pwdCommand);
            
            // Modificar el comando para capturar la salida y errores
            const modifiedCommand = `{ ${command}; } > "${outputFile}" 2> "${errorFile}" && echo "MEMORYBANK_COMMAND_FINISHED:${executionId}"`;
            terminal.sendText(modifiedCommand);
            
            // Esperar a que el comando termine y leer los archivos
            try {
                await this.waitForCommandCompletion(executionId, terminal);
                
                // Leer la salida
                const fs = require('fs');
                if (fs.existsSync(outputFile)) {
                    executionResult.output = fs.readFileSync(outputFile, 'utf8');
                }
                
                // Leer errores si existen
                if (fs.existsSync(errorFile)) {
                    const errorContent = fs.readFileSync(errorFile, 'utf8');
                    if (errorContent && errorContent.trim()) {
                        executionResult.error = errorContent;
                        executionResult.success = false;
                    } else {
                        executionResult.success = true;
                    }
                } else {
                    executionResult.success = true;
                }
                
                // Leer directorio de trabajo
                const pwdFile = path.join(tmpDir, `memorybank-pwd-${executionId}.txt`);
                if (fs.existsSync(pwdFile)) {
                    executionResult.workingDirectory = fs.readFileSync(pwdFile, 'utf8').trim();
                }
                
                // Actualizar el resultado en nuestro mapa
                this.executions.set(executionId, executionResult);
                
                // Limpiar archivos temporales
                try {
                    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                    if (fs.existsSync(errorFile)) fs.unlinkSync(errorFile);
                    if (fs.existsSync(pwdFile)) fs.unlinkSync(pwdFile);
                } catch (e) {
                    console.error('Error al limpiar archivos temporales:', e);
                }
                
                // Enviar la salida al canal
                const outputChannel = this.outputChannels.get(actualTerminalId);
                if (outputChannel) {
                    outputChannel.append(`\n> ${command}\n`);
                    outputChannel.append(executionResult.output);
                    if (executionResult.error) {
                        outputChannel.append(`\nError: ${executionResult.error}`);
                    }
                }
                
                return executionResult;
            } catch (error) {
                executionResult.success = false;
                executionResult.error = `Error esperando a que el comando termine: ${error}`;
                this.executions.set(executionId, executionResult);
                return executionResult;
            }
        } else {
            // Si no capturamos la salida, simplemente enviar el comando a la terminal
            terminal.sendText(command);
            
            // No podemos saber cuándo termina ni capturar la salida
            executionResult.success = true;
            executionResult.output = "Salida no capturada";
            this.executions.set(executionId, executionResult);
            
            return executionResult;
        }
    }
    
    /**
     * Espera a que un comando termine detectando el marcador en la terminal
     */
    private async waitForCommandCompletion(executionId: string, terminal: vscode.Terminal): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const maxWaitTime = 60000; // 60 segundos máximo
            const startTime = Date.now();
            
            // Configurar un intervalo para verificar el archivo de salida
            const checkInterval = setInterval(() => {
                const fs = require('fs');
                const tmpDir = os.tmpdir();
                const outputFile = path.join(tmpDir, `memorybank-output-${executionId}.txt`);
                
                // Verificar si el archivo existe y contiene el marcador de finalización
                if (fs.existsSync(outputFile)) {
                    const content = fs.readFileSync(outputFile, 'utf8');
                    if (content.includes(`MEMORYBANK_COMMAND_FINISHED:${executionId}`)) {
                        clearInterval(checkInterval);
                        resolve();
                        return;
                    }
                }
                
                // Verificar si hemos excedido el tiempo máximo
                if (Date.now() - startTime > maxWaitTime) {
                    clearInterval(checkInterval);
                    reject(new Error('Tiempo de espera excedido para la ejecución del comando'));
                }
            }, 500); // Verificar cada 500ms
        });
    }
    
    /**
     * Obtiene el resultado de una ejecución por su ID
     */
    getExecutionResult(executionId: string): TerminalExecutionResult | undefined {
        return this.executions.get(executionId);
    }
    
    /**
     * Obtiene todas las ejecuciones realizadas
     */
    getAllExecutions(): Map<string, TerminalExecutionResult> {
        return this.executions;
    }
    
    /**
     * Limpia recursos cuando no se necesitan más
     */
    dispose(): void {
        // Cerrar todas las terminales
        for (const terminal of this.terminals.values()) {
            terminal.dispose();
        }
        
        // Cerrar todos los canales de salida
        for (const channel of this.outputChannels.values()) {
            channel.dispose();
        }
        
        // Limpiar mapas
        this.terminals.clear();
        this.outputChannels.clear();
        this.executions.clear();
        this.outputListeners.clear();
    }
} 