/**
 * ExecuteCommandTool
 * Tool para ejecutar comandos del sistema operativo usando una terminal personalizada
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BaseTool } from './BaseTool';
import { CustomCLITerminalManager } from '../terminals/CustomCLITerminalManager';
import { FileSnapshotManager } from '../terminals/FileSnapshotManager';
import * as vscode from 'vscode';

interface CommandResult {
    output: string;
    error?: string;
    success: boolean;
    workingDirectory?: string;
    affectedFiles?: string[];
    commandId?: string;
    executionTime?: number;
    fileChanges?: {
        filePath: string;
        hasChanges: boolean;
    }[];
    snapshotBefore?: string;
    snapshotAfter?: string;
}

export class ExecuteCommandTool extends BaseTool {
    private terminalManager: CustomCLITerminalManager;
    private snapshotManager: FileSnapshotManager;
    private allowedCommands: string[];
    private defaultWorkingDir: string | null = null;
    
    constructor(agent: any) {
        super(agent);
        this.name = 'ExecuteCommandTool';
        this.description = 'Ejecuta comandos del sistema operativo en una terminal bash integrada';
        this.parameters = {
            command: {
                description: 'Comando a ejecutar',
                type: 'string',
                required: true
            },
            workingDirectory: {
                description: 'Directorio de trabajo para ejecutar el comando',
                type: 'string',
                required: false
            },
            timeout: {
                description: 'Tiempo máximo de ejecución en milisegundos',
                type: 'number',
                required: false,
                default: 60000 // 60 segundos por defecto
            },
            allowedCommands: {
                description: 'Lista de comandos permitidos (vacío para todos)',
                type: 'array',
                required: false,
                default: []
            },
            captureSnapshots: {
                description: 'Si debe capturar snapshots de archivos modificables',
                type: 'boolean',
                required: false,
                default: true
            },
            filePatterns: {
                description: 'Patrones de archivos para monitorear cambios',
                type: 'array',
                required: false,
                default: ['**/*']
            }
        };
        
        // Inicializar el gestor de terminales y snapshots
        this.terminalManager = new CustomCLITerminalManager();
        this.snapshotManager = new FileSnapshotManager();
        
        // Definir comandos permitidos por defecto
        this.allowedCommands = [
            'ls', 'dir', 'find', 'grep', 'cat', 'type',
            'cd', 'pwd', 'mkdir', 'rmdir', 'cp', 'copy',
            'mv', 'move', 'rm', 'del', 'echo', 'npm',
            'node', 'npx', 'git', 'code', 'python',
            'pip', 'java', 'javac', 'gcc', 'g++',
            'dotnet', 'yarn', 'pnpm', 'ng', 'nx'
        ];
        
        // Determinar el directorio de trabajo por defecto
        this.initializeWorkspace();
    }
    
    /**
     * Inicializa y determina el workspace
     */
    private initializeWorkspace(): void {
        try {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                this.defaultWorkingDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
                this.logger.appendLine(`Found user workspace at: ${this.defaultWorkingDir}`);
            } else {
                this.defaultWorkingDir = os.homedir();
                this.logger.appendLine(`No workspace found, using home directory: ${this.defaultWorkingDir}`);
            }
        } catch (error: any) {
            this.logger.appendLine(`Error initializing workspace: ${error.message}`);
            this.defaultWorkingDir = os.tmpdir();
        }
    }
    
    /**
     * Implementación principal de la herramienta
     */
    async run_impl(params: Record<string, any>): Promise<CommandResult> {
        const {
            command,
            workingDirectory,
            timeout = 60000,
            allowedCommands = [],
            captureSnapshots = true,
            filePatterns = ['**/*']
        } = params;
        
        // Validar comando
        if (!command || typeof command !== 'string') {
            throw new Error('Se requiere un comando válido');
        }
        
        // Verificar si el comando está permitido
        const cmdAllowed = this.isCommandAllowed(command, allowedCommands);
        if (!cmdAllowed.allowed) {
            throw new Error(`Comando no permitido: ${cmdAllowed.reason}`);
        }
        
        // Determinar directorio de trabajo
        const workDir = workingDirectory || this.getPrimaryWorkspacePath();
        
        this.logger.appendLine(`Using primary workspace as cwd: ${workDir}`);
        this.logger.appendLine(`Executing command in directory: ${workDir}`);
        
        // Adaptar el comando según el sistema operativo si es necesario
        const adaptedCommand = this.adaptCommandForOS(command);
        
        if (adaptedCommand !== command) {
            this.logger.appendLine(`Adjusted command for OS: ${command} -> ${adaptedCommand}`);
        }
        
        this.logger.appendLine(`Executing command: ${adaptedCommand}`);
        
        // Capturar snapshot de archivos antes de ejecutar el comando si está habilitado
        let snapshotBeforeId: string | undefined;
        const startTime = Date.now();
        
        if (captureSnapshots) {
            try {
                // Obtener archivos que podrían verse afectados
                const potentialFiles = await this.findPotentialAffectedFiles(workDir, filePatterns);
                
                if (potentialFiles.length > 0) {
                    this.logger.appendLine(`Creating snapshot for ${potentialFiles.length} files before command execution`);
                    snapshotBeforeId = await this.snapshotManager.createSnapshot(potentialFiles);
                }
            } catch (error: any) {
                this.logger.appendLine(`Error creating snapshot: ${error.message}`);
                // Continuar incluso si falla la captura de snapshot
            }
        }
        
        try {
            // Crear terminal si no existe aún
            const terminalId = this.terminalManager.createTerminal('memorybank-command', 'Memory Bank Command', workDir);
            
            // Ejecutar el comando
            const result = await this.terminalManager.executeCommand(adaptedCommand, terminalId, true);
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            // Capturar snapshot después de ejecutar y analizar cambios
            let snapshotAfterId: string | undefined;
            let fileChanges = [];
            
            if (captureSnapshots && snapshotBeforeId) {
                try {
                    // Obtener los mismos archivos después de la ejecución
                    const snapBefore = this.snapshotManager.getSnapshot(snapshotBeforeId);
                    if (snapBefore) {
                        const filePaths = snapBefore.map(snap => snap.path);
                        snapshotAfterId = await this.snapshotManager.createSnapshot(filePaths);
                        
                        // Comparar snapshots
                        const diffs = await this.snapshotManager.compareSnapshots(snapshotBeforeId, snapshotAfterId);
                        
                        // Filtrar sólo los que tienen cambios
                        fileChanges = diffs.map(diff => ({
                            filePath: diff.filePath,
                            hasChanges: diff.hasChanges
                        }));
                        
                        const changedFiles = fileChanges.filter(fc => fc.hasChanges).length;
                        this.logger.appendLine(`Detected changes in ${changedFiles} files after command execution`);
                    }
                } catch (error: any) {
                    this.logger.appendLine(`Error analyzing file changes: ${error.message}`);
                }
            }
            
            // Construir el resultado final
            const commandResult: CommandResult = {
                output: result.output,
                error: result.error,
                success: result.success,
                workingDirectory: result.workingDirectory || workDir,
                commandId: result.commandId,
                executionTime,
                fileChanges,
                snapshotBefore: snapshotBeforeId,
                snapshotAfter: snapshotAfterId
            };
            
            return commandResult;
        } catch (error: any) {
            this.logger.appendLine(`Command execution failed: ${error.message}`);
            throw new Error(`Command execution failed: ${error.message}`);
        }
    }
    
    /**
     * Verifica si un comando está permitido según las reglas de seguridad
     */
    private isCommandAllowed(command: string, additionalAllowed: string[] = []): { allowed: boolean, reason?: string } {
        // Normalizar el comando extrayendo el comando base
        const baseCommand = this.extractBaseCommand(command);
        
        // Lista combinada de comandos permitidos
        const combinedAllowed = [...this.allowedCommands, ...additionalAllowed];
        
        // Si la lista está vacía, permitir todos los comandos
        if (combinedAllowed.length === 0) {
            return { allowed: true };
        }
        
        // Verificar si el comando base está en la lista permitida
        if (combinedAllowed.includes(baseCommand)) {
            return { allowed: true };
        }
        
        return {
            allowed: false,
            reason: `El comando "${baseCommand}" no está en la lista de comandos permitidos`
        };
    }
    
    /**
     * Extrae el comando base de una línea de comando completa
     */
    private extractBaseCommand(command: string): string {
        // Remover opciones como sudo, tiempo, etc.
        let cmd = command.trim();
        
        // Remover sudo y similares
        cmd = cmd.replace(/^(sudo|time)\s+/i, '');
        
        // Extraer el primer componente (comando base)
        const parts = cmd.split(/\s+/);
        return parts[0];
    }
    
    /**
     * Adapta un comando para el sistema operativo actual
     */
    private adaptCommandForOS(command: string): string {
        const platform = os.platform();
        
        // Si estamos en Windows, adaptar comandos Unix comunes
        if (platform === 'win32') {
            // Convertir comando find a dir o powershell equivalente
            if (command.startsWith('find ')) {
                // Analizar el comando find
                const findMatch = command.match(/find\s+([^\s]+)\s+-type\s+([^\s]+)\s+-name\s+['"]([^'"]+)['"]/);
                if (findMatch) {
                    const [_, searchPath, fileType, pattern] = findMatch;
                    
                    // Si es búsqueda de archivos, usar dir
                    if (fileType === 'f') {
                        // Escapar * en el patrón para Windows
                        const winPattern = pattern.replace(/\*/g, '*');
                        return `dir /s /b "${searchPath}\\${winPattern}"`;
                    } else if (fileType === 'd') {
                        // Para directorios, usar dir con /ad
                        return `dir /s /b /ad "${searchPath}"`;
                    }
                }
                
                // Si no pudimos parsear el comando find, intentar con PowerShell
                return `powershell -Command "Get-ChildItem -Path . -Recurse -Filter '*' | Select-Object FullName"`;
            }
            
            // Convertir ls a dir
            if (command === 'ls' || command === 'ls -la' || command === 'ls -l') {
                return 'dir';
            }
            
            // Convertir cat a type
            if (command.startsWith('cat ')) {
                return command.replace(/^cat/, 'type');
            }
            
            // Otras adaptaciones pueden añadirse según sea necesario
        }
        
        return command;
    }
    
    /**
     * Obtiene la ruta del workspace principal
     */
    private getPrimaryWorkspacePath(): string {
        try {
            if (this.agent && this.agent.workspaceManager) {
                const wsPath = this.agent.workspaceManager.getWorkspacePath();
                if (wsPath) {
                    return wsPath;
                }
            }
        } catch (e) {
            this.logger.appendLine(`Error getting workspace from agent: ${e}`);
        }
        
        return this.defaultWorkingDir || os.homedir();
    }
    
    /**
     * Encuentra archivos que podrían verse afectados por un comando
     */
    private async findPotentialAffectedFiles(workDir: string, patterns: string[]): Promise<string[]> {
        try {
            const allFiles: string[] = [];
            
            // Usar la API de VSCode para encontrar archivos que coincidan con los patrones
            for (const pattern of patterns) {
                try {
                    const files = await vscode.workspace.findFiles(
                        new vscode.RelativePattern(workDir, pattern),
                        '**/node_modules/**' // Excluir node_modules por defecto
                    );
                    
                    // Convertir URI a rutas de archivo
                    const filePaths = files.map(file => file.fsPath);
                    allFiles.push(...filePaths);
                } catch (e) {
                    this.logger.appendLine(`Error searching files with pattern ${pattern}: ${e}`);
                }
            }
            
            // Filtrar duplicados
            return [...new Set(allFiles)];
        } catch (error: any) {
            this.logger.appendLine(`Error finding potential affected files: ${error.message}`);
            return [];
        }
    }
    
    /**
     * Muestra los cambios realizados por un comando en una vista diff
     */
    async showCommandChanges(result: CommandResult, title: string = 'Cambios por comando'): Promise<void> {
        if (!result.snapshotBefore || !result.snapshotAfter) {
            vscode.window.showInformationMessage('No hay información de cambios disponible para este comando');
            return;
        }
        
        try {
            // Comparar snapshots
            const diffs = await this.snapshotManager.compareSnapshots(result.snapshotBefore, result.snapshotAfter);
            
            // Mostrar diffs
            this.snapshotManager.showAllDiffs(diffs, title);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error mostrando cambios: ${error.message}`);
        }
    }
    
    /**
     * Limpia recursos al destruir la herramienta
     */
    dispose(): void {
        this.terminalManager.dispose();
        this.snapshotManager.dispose();
    }
} 