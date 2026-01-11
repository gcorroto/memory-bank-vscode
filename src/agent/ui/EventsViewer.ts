/**
 * Visor de Eventos y Cambios
 * Proporciona una interfaz para visualizar eventos, ejecuciones de comandos y cambios en archivos
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FileSnapshotManager } from '../terminals/FileSnapshotManager';
import { CustomCLITerminalManager } from '../terminals/CustomCLITerminalManager';

export interface EventItem {
    id: string;
    title: string;
    type: 'command' | 'analysis' | 'file_change' | 'error' | 'info';
    timestamp: Date;
    description: string;
    details?: any;
    status: 'success' | 'error' | 'running' | 'warning' | 'info';
    icon?: string;
    snapshots?: {
        before?: string;
        after?: string;
    };
}

export class EventsViewer {
    private view: vscode.WebviewPanel | undefined;
    private events: EventItem[];
    private fileSnapshotManager: FileSnapshotManager;
    private terminalManager: CustomCLITerminalManager;
    private context: vscode.ExtensionContext;
    private refreshInterval: NodeJS.Timeout | undefined;
    
    constructor(context: vscode.ExtensionContext) {
        this.events = [];
        this.context = context;
        this.fileSnapshotManager = new FileSnapshotManager();
        this.terminalManager = new CustomCLITerminalManager();
        
        // No registramos comandos aquí, están en la estructura centralizada (src/commands/categories/ui.ts)
    }
    
    /**
     * Registra comandos para interactuar con el visor de eventos
     * @deprecated Use la estructura centralizada de comandos en su lugar
     */
    private registerCommands(): void {
        // Esta función ya no se usa, los comandos están en src/commands/categories/ui.ts
        console.warn('EventsViewer.registerCommands está obsoleto. Use la estructura centralizada de comandos.');
    }
    
    /**
     * Muestra el visor de eventos
     */
    show(): void {
        if (this.view) {
            this.view.reveal();
            return;
        }
        
        // Crear el panel webview
        this.view = vscode.window.createWebviewPanel(
            'memorybankEventsViewer',
            'Memory Bank: Eventos y Cambios',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media')
                ],
                retainContextWhenHidden: true
            }
        );
        
        // Actualizar el contenido inicialmente
        this.updateWebviewContent();
        
        // Configurar manejo de mensajes desde la webview
        this.setupMessageHandling();
        
        // Configurar actualización periódica
        this.refreshInterval = setInterval(() => {
            if (this.view) {
                this.updateWebviewContent();
            }
        }, 5000); // Actualizar cada 5 segundos
        
        // Limpiar recursos cuando se cierra el panel
        this.view.onDidDispose(() => {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = undefined;
            }
            this.view = undefined;
        });
    }
    
    /**
     * Configura el manejo de mensajes desde la webview
     */
    private setupMessageHandling(): void {
        if (!this.view) return;
        
        this.view.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'showChanges':
                    this.showEventChanges(message.eventId);
                    break;
                    
                case 'showDetails':
                    this.showEventDetails(message.eventId);
                    break;
                    
                case 'toggleTerminal':
                    this.toggleTerminalVisibility();
                    break;
                    
                case 'clearEvents':
                    this.clearEvents();
                    break;
                    
                case 'executeCommand':
                    this.executeCommand(message.command);
                    break;
            }
        });
    }
    
    /**
     * Actualiza el contenido de la webview
     */
    private updateWebviewContent(): void {
        if (!this.view) return;
        
        // Ordenar eventos por timestamp (más recientes primero)
        const sortedEvents = [...this.events].sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
        );
        
        // Obtener las URI para los recursos estáticos
        const styleUri = this.view.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'events-viewer.css')
        );
        
        const scriptUri = this.view.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'events-viewer.js')
        );
        
        // Generar el HTML para la webview
        const html = this.generateHtml(sortedEvents, styleUri, scriptUri);
        
        // Actualizar el contenido
        this.view.webview.html = html;
    }
    
    /**
     * Genera el HTML para la webview
     */
    private generateHtml(events: EventItem[], styleUri: vscode.Uri, scriptUri: vscode.Uri): string {
        // Generar el HTML para cada evento
        const eventsHtml = events.map(event => {
            // Determinar clase de estado y icono
            const statusClass = `status-${event.status}`;
            let iconClass = 'codicon-';
            
            switch (event.type) {
                case 'command':
                    iconClass += 'terminal';
                    break;
                case 'analysis':
                    iconClass += 'microscope';
                    break;
                case 'file_change':
                    iconClass += 'diff';
                    break;
                case 'error':
                    iconClass += 'error';
                    break;
                default:
                    iconClass += 'info';
            }
            
            // Determinar si hay cambios disponibles
            const hasChanges = event.snapshots && (event.snapshots.before || event.snapshots.after);
            
            // Formatear timestamp
            const formattedTime = event.timestamp.toLocaleTimeString();
            const formattedDate = event.timestamp.toLocaleDateString();
            
            return `
            <div class="event-item ${statusClass}" data-id="${event.id}">
                <div class="event-header">
                    <span class="event-icon codicon ${iconClass}"></span>
                    <span class="event-title">${event.title}</span>
                    <span class="event-time">${formattedTime} - ${formattedDate}</span>
                </div>
                <div class="event-description">${event.description}</div>
                <div class="event-actions">
                    <button class="action-button" onclick="showDetails('${event.id}')">
                        <span class="codicon codicon-info"></span>
                        Detalles
                    </button>
                    ${hasChanges ? `
                    <button class="action-button" onclick="showChanges('${event.id}')">
                        <span class="codicon codicon-diff"></span>
                        Ver Cambios
                    </button>
                    ` : ''}
                    ${event.type === 'command' ? `
                    <button class="action-button" onclick="toggleTerminal()">
                        <span class="codicon codicon-terminal"></span>
                        Terminal
                    </button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');
        
        // Generar el HTML completo
        return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Memory Bank: Eventos y Cambios</title>
            <link href="${styleUri}" rel="stylesheet">
            <link href="https://cdn.jsdelivr.net/npm/vscode-codicons/dist/codicon.css" rel="stylesheet">
            <script src="${scriptUri}"></script>
        </head>
        <body>
            <div class="toolbar">
                <h2>Eventos y Cambios</h2>
                <button class="action-button" onclick="clearEvents()">
                    <span class="codicon codicon-clear-all"></span>
                    Limpiar
                </button>
                <button class="action-button" onclick="toggleTerminal()">
                    <span class="codicon codicon-terminal"></span>
                    Terminal
                </button>
            </div>
            
            <div class="events-container">
                ${events.length > 0 ? eventsHtml : '<div class="no-events">No hay eventos para mostrar</div>'}
            </div>
            
            <div class="command-bar">
                <input type="text" id="command-input" placeholder="Ejecutar comando...">
                <button class="action-button" onclick="executeCommand()">
                    <span class="codicon codicon-play"></span>
                    Ejecutar
                </button>
            </div>
        </body>
        </html>
        `;
    }
    
    /**
     * Agrega un nuevo evento al visor
     */
    addEvent(event: EventItem): void {
        this.events.push(event);
        this.updateWebviewContent();
    }
    
    /**
     * Agrega un evento de comando con su resultado
     */
    addCommandEvent(command: string, result: any, snapshots?: {before?: string, after?: string}): void {
        const success = result.success === true;
        
        const event: EventItem = {
            id: `cmd-${Date.now()}`,
            title: `Comando: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`,
            type: 'command',
            timestamp: new Date(),
            description: success 
                ? `Comando ejecutado exitosamente en ${result.executionTime}ms`
                : `Error ejecutando comando: ${result.error || 'Error desconocido'}`,
            details: {
                command,
                output: result.output,
                error: result.error,
                workingDirectory: result.workingDirectory,
                executionTime: result.executionTime,
                fileChanges: result.fileChanges
            },
            status: success ? 'success' : 'error',
            snapshots
        };
        
        this.addEvent(event);
    }
    
    /**
     * Agrega un evento de análisis de código
     */
    addAnalysisEvent(filePath: string, analysis: any): void {
        const fileName = path.basename(filePath);
        const issueCount = analysis.issues ? analysis.issues.length : 0;
        
        const event: EventItem = {
            id: `analysis-${Date.now()}`,
            title: `Análisis: ${fileName}`,
            type: 'analysis',
            timestamp: new Date(),
            description: issueCount > 0 
                ? `Se encontraron ${issueCount} problemas en el archivo`
                : 'No se encontraron problemas en el archivo',
            details: {
                filePath,
                analysis
            },
            status: issueCount > 0 ? 'warning' : 'success'
        };
        
        this.addEvent(event);
    }
    
    /**
     * Agrega un evento de cambio de archivo
     */
    addFileChangeEvent(filePath: string, changeType: 'create' | 'modify' | 'delete', snapshots?: {before?: string, after?: string}): void {
        const fileName = path.basename(filePath);
        
        let description: string;
        let status: 'success' | 'error' | 'running' | 'warning' | 'info' = 'info';
        
        switch (changeType) {
            case 'create':
                description = `Archivo ${fileName} creado`;
                status = 'success';
                break;
            case 'modify':
                description = `Archivo ${fileName} modificado`;
                status = 'warning';
                break;
            case 'delete':
                description = `Archivo ${fileName} eliminado`;
                status = 'warning';
                break;
        }
        
        const event: EventItem = {
            id: `file-${Date.now()}`,
            title: `Cambio: ${fileName}`,
            type: 'file_change',
            timestamp: new Date(),
            description,
            details: {
                filePath,
                changeType
            },
            status,
            snapshots
        };
        
        this.addEvent(event);
    }
    
    /**
     * Agrega un evento de error
     */
    addErrorEvent(title: string, error: string | Error): void {
        const errorMessage = error instanceof Error ? error.message : error;
        
        const event: EventItem = {
            id: `error-${Date.now()}`,
            title,
            type: 'error',
            timestamp: new Date(),
            description: errorMessage,
            details: {
                error: error instanceof Error ? error : new Error(errorMessage)
            },
            status: 'error'
        };
        
        this.addEvent(event);
    }
    
    /**
     * Agrega un evento informativo
     */
    addInfoEvent(title: string, message: string, details?: any): void {
        const event: EventItem = {
            id: `info-${Date.now()}`,
            title,
            type: 'info',
            timestamp: new Date(),
            description: message,
            details,
            status: 'info'
        };
        
        this.addEvent(event);
    }
    
    /**
     * Limpia todos los eventos
     */
    clearEvents(): void {
        this.events = [];
        this.updateWebviewContent();
    }
    
    /**
     * Muestra los detalles de un evento
     */
    showEventDetails(eventId: string): void {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;
        
        // Generar el mensaje según el tipo de evento
        let message = '';
        
        switch (event.type) {
            case 'command':
                message = `Comando: ${event.details.command}\n\n`;
                message += `Directorio: ${event.details.workingDirectory}\n`;
                message += `Tiempo de ejecución: ${event.details.executionTime}ms\n\n`;
                message += event.details.output 
                    ? `Salida:\n${event.details.output}`
                    : 'No hay salida del comando';
                
                if (event.details.error) {
                    message += `\n\nError:\n${event.details.error}`;
                }
                break;
                
            case 'analysis':
                message = `Análisis de ${path.basename(event.details.filePath)}\n\n`;
                message += `Resumen: ${event.details.analysis.summary}\n\n`;
                
                if (event.details.analysis.issues && event.details.analysis.issues.length > 0) {
                    message += `Problemas encontrados (${event.details.analysis.issues.length}):\n\n`;
                    
                    event.details.analysis.issues.forEach((issue: any, index: number) => {
                        message += `${index + 1}. ${issue.description} (${issue.severity})\n`;
                        message += `   Solución: ${issue.solution}\n\n`;
                    });
                } else {
                    message += 'No se encontraron problemas.';
                }
                break;
                
            case 'file_change':
                message = `Cambio en archivo: ${event.details.filePath}\n`;
                message += `Tipo de cambio: ${event.details.changeType}\n`;
                
                if (event.snapshots) {
                    message += `\nHay snapshots disponibles. Use el botón "Ver Cambios" para visualizarlos.`;
                }
                break;
                
            case 'error':
                message = `Error: ${event.description}\n\n`;
                if (event.details.error.stack) {
                    message += `Stack trace:\n${event.details.error.stack}`;
                }
                break;
                
            default:
                message = event.description;
        }
        
        // Mostrar un panel con los detalles
        const panel = vscode.window.createWebviewPanel(
            'eventDetails',
            `Detalles: ${event.title}`,
            vscode.ViewColumn.Beside,
            {
                enableFindWidget: true
            }
        );
        
        panel.webview.html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Detalles del Evento</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                }
                pre {
                    background-color: var(--vscode-editor-background);
                    padding: 10px;
                    border-radius: 5px;
                    overflow: auto;
                    white-space: pre-wrap;
                }
                .event-header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                }
                .event-timestamp {
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <div class="event-header">
                <h2>${event.title}</h2>
                <div class="event-timestamp">
                    ${event.timestamp.toLocaleString()}
                </div>
            </div>
            <pre>${this.escapeHtml(message)}</pre>
        </body>
        </html>
        `;
    }
    
    /**
     * Muestra los cambios de un evento en una vista diff
     */
    async showEventChanges(eventId: string): Promise<void> {
        const event = this.events.find(e => e.id === eventId);
        if (!event || !event.snapshots) return;
        
        // Si tenemos IDs de snapshots, mostrar los cambios
        if (event.snapshots.before && event.snapshots.after) {
            try {
                const diffs = await this.fileSnapshotManager.compareSnapshots(
                    event.snapshots.before,
                    event.snapshots.after
                );
                
                // Mostrar todos los diffs
                this.fileSnapshotManager.showAllDiffs(diffs, `Cambios por ${event.title}`);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error mostrando cambios: ${error.message}`);
            }
        } else {
            vscode.window.showInformationMessage('No hay información de cambios disponible para este evento');
        }
    }
    
    /**
     * Alterna la visibilidad de la terminal integrada
     */
    toggleTerminalVisibility(): void {
        // Mostrar u ocultar la terminal
        this.terminalManager.showTerminal();
    }
    
    /**
     * Ejecuta un comando desde la interfaz
     */
    async executeCommand(command: string): Promise<void> {
        if (!command) {
            vscode.window.showInputBox({
                prompt: 'Ingrese el comando a ejecutar',
                placeHolder: 'Ejemplo: ls -la'
            }).then(async (cmd) => {
                if (cmd) {
                    await this.doExecuteCommand(cmd);
                }
            });
        } else {
            await this.doExecuteCommand(command);
        }
    }
    
    /**
     * Implementación de la ejecución de comandos
     */
    private async doExecuteCommand(command: string): Promise<void> {
        try {
            // Capturar snapshot antes de ejecutar
            const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspacePath) throw new Error('No workspace found');
            
            // Encontrar archivos potencialmente afectados
            const potentialFiles = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
            const filePaths = potentialFiles.map(file => file.fsPath);
            
            const snapshotBeforeId = await this.fileSnapshotManager.createSnapshot(filePaths);
            
            // Ejecutar comando
            const terminalId = this.terminalManager.createTerminal('memorybank-user', 'Memory Bank User Terminal', workspacePath);
            const result = await this.terminalManager.executeCommand(command, terminalId, true);
            
            // Capturar snapshot después
            const snapshotAfterId = await this.fileSnapshotManager.createSnapshot(filePaths);
            
            // Agregar evento
            this.addCommandEvent(command, result, {
                before: snapshotBeforeId,
                after: snapshotAfterId
            });
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error ejecutando comando: ${error.message}`);
            this.addErrorEvent('Error al ejecutar comando', error);
        }
    }
    
    /**
     * Escapa caracteres HTML para evitar XSS
     */
    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    /**
     * Limpia recursos
     */
    dispose(): void {
        if (this.view) {
            this.view.dispose();
        }
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.fileSnapshotManager.dispose();
        this.terminalManager.dispose();
    }
} 