/**
 * Core Agent Class
 * Orchestrates planning, reasoning, context management and tool execution
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as openaiService from '../../services/openaiService';
import * as vectraService from '../../services/vectraService';
import * as ragService from '../../services/ragService';
import * as modelPricingService from '../../services/modelPricingService';
import { AgentToolManager } from './AgentToolManager';
import { ContextManager } from './ContextManager';
import { WorkspaceManager } from './WorkspaceManager';
import { DatabaseManager } from '../storage/DatabaseManager';
import { AgentLogsView } from '../ui/logsView';
import { EventsViewer } from '../ui/EventsViewer';
import { FileSnapshotManager } from '../terminals/FileSnapshotManager';
import { CustomCLITerminalManager } from '../terminals/CustomCLITerminalManager';
import { PlanStep, Plan } from '../types/AgentTypes';
import type { ChatMessage, CompletionResult } from '../../types/openai';
import promptComposer from './PromptComposer';
import { PLAN_TASK_PROMPT } from './AgentPrompt';

export class Agent {
    name: string;
    context: vscode.ExtensionContext;
    logger: vscode.OutputChannel;
    contextManager: ContextManager;
    toolManager: AgentToolManager;
    workspaceManager: WorkspaceManager;
    databaseManager: DatabaseManager;
    llmClient: typeof openaiService;
    logsView: AgentLogsView | null = null;
    eventsViewer: EventsViewer | null = null;
    terminalManager: CustomCLITerminalManager;
    fileSnapshotManager: FileSnapshotManager;

    /**
     * Initialize a new Agent instance
     * @param name - Name of the agent
     * @param context - VSCode extension context
     */
    constructor(name: string, context: vscode.ExtensionContext) {
        this.name = name;
        this.context = context;
        this.logger = vscode.window.createOutputChannel(`Grec0AI Agent: ${name}`);
        this.contextManager = new ContextManager(this);
        this.toolManager = new AgentToolManager(this);
        this.workspaceManager = new WorkspaceManager(this);
        this.databaseManager = new DatabaseManager(this);
        this.llmClient = openaiService;
        this.terminalManager = new CustomCLITerminalManager();
        this.fileSnapshotManager = new FileSnapshotManager();
    }

    /**
     * Initialize the agent systems
     * @returns True if initialization was successful
     */
    async initialize(): Promise<boolean> {
        try {
            this.logger.appendLine(`Initializing agent: ${this.name}`);
            
            // Initialize services in order
            await this.workspaceManager.initialize();
            await this.databaseManager.initialize();
            
            // Initialize LLM client
            const llmInitialized = this.llmClient.initialize();
            
            if (!llmInitialized) {
                this.logger.appendLine("Failed to initialize LLM client");
                return false;
            }
            
            // Initialize tool manager and register tools
            await this.toolManager.initialize();
            
            // Inicializar y configurar LogsView
            this.initializeLogsView();
            
            // Inicializar y configurar EventsViewer
            this.initializeEventsViewer();
            
            this.logger.appendLine(`Agent ${this.name} initialized`);
            return true;
        } catch (error: any) {
            this.logger.appendLine(`Error initializing agent: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Inicializar y configurar el LogsView
     */
    private initializeLogsView(): void {
        try {
            // Intentar usar una vista existente o crear una nueva
            this.logsView = (global as any).agentLogsView || null;
            
            if (!this.logsView) {
                this.logsView = new AgentLogsView(this.context);
                (global as any).agentLogsView = this.logsView;
                this.logger.appendLine('Created new LogsView instance');
            }
            
            // Conectar con el DatabaseManager
            if (this.logsView) {
                this.logsView.setDatabaseManager(this.databaseManager);
                this.logger.appendLine('Connected LogsView with DatabaseManager');
            }
        } catch (error: any) {
            this.logger.appendLine(`Error initializing LogsView: ${error.message}`);
        }
    }
    
    /**
     * Inicializar y configurar el EventsViewer
     */
    private initializeEventsViewer(): void {
        try {
            // Crear una nueva instancia del visor de eventos
            this.eventsViewer = new EventsViewer(this.context);
            this.logger.appendLine('Created new EventsViewer instance');
            
            // Ya no registramos comandos aquí, están en la estructura centralizada
        } catch (error: any) {
            this.logger.appendLine(`Error initializing EventsViewer: ${error.message}`);
        }
    }
    
    /**
     * Muestra el visor de eventos
     */
    showEventsViewer(): void {
        if (this.eventsViewer) {
            this.eventsViewer.show();
        } else {
            this.initializeEventsViewer();
            if (this.eventsViewer) {
                this.eventsViewer.show();
            }
        }
    }

    /**
     * Handle user input and execute the appropriate actions
     * @param input - User input or request
     * @param context - Additional context (file, selection, etc.)
     * @returns The result of the operation
     */
    async handleUserInput(input: string, context: any = {}): Promise<any> {
        try {
            // 1. Update context with current input and session data
            this.contextManager.update(input, context);
            this.logger.appendLine(`Handling user input: "${input.substring(0, 100)}${input.length > 100 ? '...' : ''}"`);
            
            // Informar al usuario que estamos procesando
            vscode.window.showInformationMessage(`Procesando: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}`);
            
            // Añadir evento informativo al visor
            if (this.eventsViewer) {
                this.eventsViewer.addInfoEvent(
                    "Nueva solicitud",
                    input,
                    { timestamp: new Date() }
                );
            }
            
            // 2. Plan task using LLM
            const plan = await this.planTask(input, context);
            
            // Log the plan
            this.logger.appendLine("Generated plan:");
            plan.steps.forEach((step: any, index: number) => {
                this.logger.appendLine(`  ${index + 1}. ${step.description} [Tool: ${step.tool}]`);
            });
            
            // Add to logs view if available
            if (this.logsView) {
                this.logsView.addPlanLog(
                    plan.steps,
                    undefined,
                    plan.modelInfo,
                    plan.appliedRules || [],
                    plan.tokenCount,
                    plan.modelCost
                );
            }
            
            // Guardar las reglas aplicadas (si las hay) en el contextManager para usarlas en la reflexión
            if (plan.appliedRules) {
                this.contextManager.addItem('appliedRules', plan.appliedRules);
                this.logger.appendLine(`Se han registrado ${plan.appliedRules.length} reglas aplicables para este plan`);
            }
            
            // Tomar snapshots de archivos que podrían verse afectados
            let snapshotBeforeId: string | undefined;
            if (this.fileSnapshotManager) {
                try {
                    // Determinar qué archivos podrían verse afectados
                    const workspacePath = this.workspaceManager.getWorkspacePath();
                    if (workspacePath) {
                        const potentialFiles = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
                        const filePaths = potentialFiles.map(file => file.fsPath);
                        
                        snapshotBeforeId = await this.fileSnapshotManager.createSnapshot(filePaths);
                        this.logger.appendLine(`Created snapshot of workspace files: ${snapshotBeforeId}`);
                    }
                } catch (error: any) {
                    this.logger.appendLine(`Error creating file snapshot: ${error.message}`);
                }
            }
            
            // 4. Execute each step in the plan
            const results: any[] = [];
            let success = true;
            let stoppedAtStep: string | null = null;
            let stopReason: string | null = null;
            
            for (const step of plan.steps) {
                this.logger.appendLine(`Executing step: ${step.description}`);
                
                // Añadir evento al visor
                if (this.eventsViewer) {
                    this.eventsViewer.addInfoEvent(
                        `Ejecutando: ${step.description}`,
                        `Herramienta: ${step.tool}`,
                        { 
                            step: step,
                            status: 'running' 
                        }
                    );
                }
                
                // Select and execute appropriate tool
                const tool = this.toolManager.selectTool(step.tool);
                
                if (!tool) {
                    this.logger.appendLine(`Warning: Tool '${step.tool}' not found`);
                    results.push({
                        success: false,
                        error: `Tool '${step.tool}' not found`,
                        step: step
                    });
                    success = false;
                    stoppedAtStep = step.description;
                    stopReason = `La herramienta '${step.tool}' no está disponible`;
                    
                    // Añadir evento de error al visor
                    if (this.eventsViewer) {
                        this.eventsViewer.addErrorEvent(
                            `Error: Herramienta no encontrada`,
                            `La herramienta '${step.tool}' no está disponible`
                        );
                    }
                    
                    // Detener ejecución si no se encuentra la herramienta
                    break;
                }
                
                try {
                    // Verificar que los parámetros requeridos estén presentes
                    const missingParams = this.checkRequiredParams(tool, step.params);
                    if (missingParams.length > 0) {
                        const errorMsg = `Faltan parámetros requeridos: ${missingParams.join(', ')}`;
                        this.logger.appendLine(`Error: ${errorMsg}`);
                        
                        results.push({
                            success: false,
                            error: errorMsg,
                            step: step
                        });
                        
                        if (this.logsView) {
                            this.logsView.addStepLog(step.description, step.tool, step.params, { error: errorMsg }, false);
                        }
                        
                        // Añadir evento de error al visor
                        if (this.eventsViewer) {
                            this.eventsViewer.addErrorEvent(
                                `Error: Parámetros faltantes`,
                                errorMsg
                            );
                        }
                        
                        success = false;
                        stoppedAtStep = step.description;
                        stopReason = errorMsg;
                        
                        // Detener ejecución si faltan parámetros
                        break;
                    }
                    
                    // NUEVO: Enriquecer con RAG y reglas para herramientas relevantes
                    await this.enrichStepWithRAG(step);
                    
                    // Si es una herramienta que genera código, asegurarse de que las reglas se apliquen
                    const codeGenerationTools = ['WriteFileTool', 'FixErrorTool', 'GenerateTestTool'];
                    if (codeGenerationTools.includes(step.tool)) {
                        this.logger.appendLine(`Asegurando que las reglas se apliquen en la generación de código`);
                        
                        // Si no hay additionalContext (que contendría las reglas del RAG), intentar añadirlo
                        if (!step.params.additionalContext || !step.params.additionalContext.includes('REGLAS APLICABLES')) {
                            const workspacePath = this.workspaceManager.getWorkspacePath();
                            const filePath = step.params.filePath || step.params.sourcePath;
                            
                            if (workspacePath && filePath) {
                                const rulesContext = this.getRulesForFile(workspacePath, filePath);
                                if (rulesContext && rulesContext.length > 0) {
                                    step.params.additionalContext = (step.params.additionalContext || '') + 
                                        "\n\nREGLAS APLICABLES DEL WORKSPACE:\n\n" + rulesContext;
                                    this.logger.appendLine(`Reglas del workspace añadidas a los parámetros para ${step.tool}`);
                                }
                            }
                        }
                    }
                    
                    // Resolve variables in parameters before execution
                    // Pasamos el array de resultados acumulados hasta ahora
                    const resolvedParams = this.resolveVariables(step.params, results);
                    
                    // Registrar los parámetros después de resolver variables
                    this.logger.appendLine(`Parámetros resueltos para ${step.tool}: ${JSON.stringify(resolvedParams, null, 2)}`);
                    
                    // Caso especial para ExecuteCommandTool - usar nuestra terminal personalizada
                    if (step.tool === 'ExecuteCommandTool' && resolvedParams.command) {
                        // Capturar snapshots de archivos antes de ejecutar el comando
                        let cmdSnapshotBeforeId: string | undefined;
                        if (this.fileSnapshotManager) {
                            try {
                                const workspacePath = this.workspaceManager.getWorkspacePath();
                                if (workspacePath) {
                                    const potentialFiles = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
                                    const filePaths = potentialFiles.map(file => file.fsPath);
                                    
                                    cmdSnapshotBeforeId = await this.fileSnapshotManager.createSnapshot(filePaths);
                                }
                            } catch (e) {
                                this.logger.appendLine(`Error creating snapshot before command: ${e}`);
                            }
                        }
                        
                        // Ejecutar el comando en nuestra terminal personalizada
                        const workingDirectory = resolvedParams.workingDirectory || 
                                               resolvedParams.cwd || 
                                               this.workspaceManager.getWorkspacePath();
                        
                        // Crear una terminal o usar una existente
                        const terminalId = this.terminalManager.createTerminal(
                            'grec0ai-agent',
                            'Grec0AI Agent Terminal',
                            workingDirectory
                        );
                        
                        // Ejecutar el comando
                        const cmdResult = await this.terminalManager.executeCommand(
                            resolvedParams.command,
                            terminalId,
                            true // Capturar salida
                        );
                        
                        // Capturar snapshot después de ejecutar
                        let cmdSnapshotAfterId: string | undefined;
                        if (this.fileSnapshotManager && cmdSnapshotBeforeId) {
                            try {
                                const workspacePath = this.workspaceManager.getWorkspacePath();
                                if (workspacePath) {
                                    const potentialFiles = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
                                    const filePaths = potentialFiles.map(file => file.fsPath);
                                    
                                    cmdSnapshotAfterId = await this.fileSnapshotManager.createSnapshot(filePaths);
                                }
                            } catch (e) {
                                this.logger.appendLine(`Error creating snapshot after command: ${e}`);
                            }
                        }
                        
                        // Convertir el resultado a formato compatible con lo esperado
                        const stepResult = {
                            success: cmdResult.success,
                            output: cmdResult.output,
                            error: cmdResult.error,
                            commandId: cmdResult.commandId,
                            workingDirectory: cmdResult.workingDirectory
                        };
                        
                        // Añadir evento de comando al visor
                        if (this.eventsViewer) {
                            this.eventsViewer.addCommandEvent(
                                resolvedParams.command,
                                cmdResult,
                                {
                                    before: cmdSnapshotBeforeId,
                                    after: cmdSnapshotAfterId
                                }
                            );
                        }
                        
                        // Add result to context
                        this.contextManager.addStepResult(step, stepResult);
                        results.push({
                            success: true,
                            result: stepResult,
                            step: step
                        });
                        
                        // Add to logs view if available
                        if (this.logsView) {
                            this.logsView.addStepLog(step.description, step.tool, step.params, stepResult, true);
                        }
                        
                        this.logger.appendLine(`Command step completed: ${step.description}`);
                        // NUEVO: Indexar resultados relevantes para aprendizaje futuro
                        await this.indexStepResults(step, stepResult);
                    } else {
                        // Para otras herramientas, usar el flujo normal
                        const stepResult = await tool.run(resolvedParams);
                        
                        // Add result to context
                        this.contextManager.addStepResult(step, stepResult);
                        results.push({
                            success: true,
                            result: stepResult,
                            step: step
                        });
                        
                        // Add to logs view if available
                        if (this.logsView) {
                            this.logsView.addStepLog(step.description, step.tool, step.params, stepResult, true);
                        }
                        
                        // Añadir evento específico según el tipo de herramienta
                        if (this.eventsViewer) {
                            if (step.tool === 'AnalyzeCodeTool' && stepResult.analysis) {
                                this.eventsViewer.addAnalysisEvent(
                                    stepResult.sourcePath || 'code-snippet',
                                    stepResult.analysis
                                );
                            } else if (step.tool === 'WriteFileTool' && stepResult.filePath) {
                                // Añadir evento de cambio de archivo
                                this.eventsViewer.addFileChangeEvent(
                                    stepResult.filePath,
                                    stepResult.created ? 'create' : 'modify'
                                );
                            } else {
                                // Para otras herramientas, añadir evento genérico
                                this.eventsViewer.addInfoEvent(
                                    `Completado: ${step.description}`,
                                    `Herramienta ${step.tool} ejecutada con éxito`,
                                    { result: stepResult }
                                );
                            }
                        }
                        
                        this.logger.appendLine(`Step completed: ${step.description}`);
                        // NUEVO: Indexar resultados relevantes para aprendizaje futuro
                        await this.indexStepResults(step, stepResult);
                    }
                } catch (error: any) {
                    this.logger.appendLine(`Error executing step: ${error.message}`);
                    
                    // Add failure feedback to context
                    this.contextManager.addFeedback({
                        success: false,
                        error: error.message,
                        step: step
                    });
                    
                    results.push({
                        success: false,
                        error: error.message,
                        step: step
                    });
                    
                    // Add to logs view if available
                    if (this.logsView) {
                        this.logsView.addStepLog(step.description, step.tool, step.params, { error: error.message }, false);
                    }
                    
                    // Añadir evento de error al visor
                    if (this.eventsViewer) {
                        this.eventsViewer.addErrorEvent(
                            `Error en paso: ${step.description}`,
                            error.message
                        );
                    }
                    
                    // Verificar si este paso es crítico para el plan
                    const isStepCritical = this.isStepCritical(step, plan);
                    
                    // Optional: retry with modified instructions based on error
                    const shouldRetry = await this.shouldRetryStep(step, error);
                    
                    if (shouldRetry) {
                        const modifiedStep = await this.modifyStepAfterFailure(step, error);
                        this.logger.appendLine(`Retrying with modified step: ${modifiedStep.description}`);
                        
                        // Añadir evento informativo sobre reintento
                        if (this.eventsViewer) {
                            this.eventsViewer.addInfoEvent(
                                `Reintentando paso`,
                                `Reintentando ${step.description} con parámetros modificados`
                            );
                        }
                        
                        try {
                            const tool = this.toolManager.selectTool(modifiedStep.tool);
                            // Resolve variables in parameters for retry
                            // Pasamos el array de resultados acumulados hasta ahora
                            const resolvedParams = this.resolveVariables(modifiedStep.params, results);
                            
                            const retryResult = await tool.run(resolvedParams);
                            
                            this.contextManager.addStepResult(modifiedStep, retryResult);
                            results.push({
                                success: true,
                                result: retryResult,
                                step: modifiedStep,
                                wasRetry: true
                            });
                            
                            // Añadir evento de éxito al visor
                            if (this.eventsViewer) {
                                this.eventsViewer.addInfoEvent(
                                    `Reintento exitoso: ${modifiedStep.description}`,
                                    `El reintento fue exitoso`,
                                    { result: retryResult }
                                );
                            }
                        } catch (retryError: any) {
                            this.logger.appendLine(`Retry failed: ${retryError.message}`);
                            success = false;
                            
                            // Añadir evento de error al visor
                            if (this.eventsViewer) {
                                this.eventsViewer.addErrorEvent(
                                    `Fallo en reintento: ${modifiedStep.description}`,
                                    retryError.message
                                );
                            }
                            
                            if (isStepCritical) {
                                stoppedAtStep = step.description;
                                stopReason = `Fallo en reintento: ${retryError.message}`;
                                // Detener ejecución tras fallo en el reintento de un paso crítico
                                break;
                            }
                        }
                    } else {
                        success = false;
                        
                        if (isStepCritical) {
                            stoppedAtStep = step.description;
                            stopReason = `Error crítico: ${error.message}`;
                            // Detener ejecución tras fallo crítico sin reintento
                            break;
                        }
                    }
                }
                
                // Verificar si hay dependencias bloqueantes para los siguientes pasos
                if (!this.canContinueExecution(step, results, plan)) {
                    this.logger.appendLine(`Deteniendo ejecución: pasos posteriores dependen del éxito de "${step.description}"`);
                    stoppedAtStep = step.description;
                    stopReason = "Los pasos siguientes dependen del éxito de este paso";
                    
                    // Añadir evento informativo al visor
                    if (this.eventsViewer) {
                        this.eventsViewer.addInfoEvent(
                            `Ejecución detenida`,
                            `Los pasos siguientes dependen del éxito de "${step.description}"`
                        );
                    }
                    
                    break;
                }
            }
            
            // Tomar snapshot después de la ejecución
            let snapshotAfterId: string | undefined;
            if (this.fileSnapshotManager && snapshotBeforeId) {
                try {
                    // Usar los mismos archivos que en el snapshot inicial
                    const beforeSnapshots = this.fileSnapshotManager.getSnapshot(snapshotBeforeId);
                    if (beforeSnapshots) {
                        const filePaths = beforeSnapshots.map(snap => snap.path);
                        snapshotAfterId = await this.fileSnapshotManager.createSnapshot(filePaths);
                        this.logger.appendLine(`Created snapshot after execution: ${snapshotAfterId}`);
                    }
                } catch (error: any) {
                    this.logger.appendLine(`Error creating after snapshot: ${error.message}`);
                }
            }
            
            // 5. Final reflection on entire process
            const reflection = await this.reflectOnExecution(plan, results, stoppedAtStep, stopReason);
            
            // Add reflection to logs view
            if (this.logsView) {
                this.logsView.addReflectionLog(reflection);
            }
            
            // Añadir evento final al visor
            if (this.eventsViewer) {
                this.eventsViewer.addInfoEvent(
                    `Completado: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}`,
                    reflection.text,
                    { 
                        reflection: reflection,
                        snapshots: {
                            before: snapshotBeforeId,
                            after: snapshotAfterId
                        },
                        status: success ? 'success' : 'warning'
                    }
                );
            }
            
            // 6. Save the event and results to database
            await this.databaseManager.saveEvent({
                type: 'userRequest',
                input: input,
                plan: plan,
                results: results,
                reflection: reflection,
                timestamp: new Date(),
                success: success,
                stoppedAtStep: stoppedAtStep,
                stopReason: stopReason,
                // Calcular y añadir información de coste si hay datos de modelo y tokens
                modelCost: this.calculateModelCostFromPlan(plan)
            });
            
            // Mostrar mensaje al usuario si el plan se completó
            if (success) {
                vscode.window.showInformationMessage(`Solicitud completada: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}`);
                
                // Si hubo cambios, ofrecer mostrarlos
                if (snapshotBeforeId && snapshotAfterId && this.fileSnapshotManager) {
                    const diffs = await this.fileSnapshotManager.compareSnapshots(snapshotBeforeId, snapshotAfterId);
                    const changedFiles = diffs.filter(d => d.hasChanges).length;
                    
                    if (changedFiles > 0) {
                        const showChangesAction = "Ver cambios";
                        const showEventsAction = "Ver eventos";
                        
                        vscode.window.showInformationMessage(
                            `Se modificaron ${changedFiles} archivos`,
                            showChangesAction,
                            showEventsAction
                        ).then(selection => {
                            if (selection === showChangesAction) {
                                this.fileSnapshotManager.showAllDiffs(diffs, "Cambios realizados");
                            } else if (selection === showEventsAction) {
                                this.showEventsViewer();
                            }
                        });
                    }
                }
            } else {
                vscode.window.showWarningMessage(`La solicitud se completó parcialmente: ${stopReason || 'Ocurrieron errores'}`);
                
                // Ofrecer ver detalles
                const showDetailsAction = "Ver detalles";
                vscode.window.showWarningMessage(
                    `La solicitud se completó parcialmente: ${stopReason || 'Ocurrieron errores'}`,
                    showDetailsAction
                ).then(selection => {
                    if (selection === showDetailsAction) {
                        this.showEventsViewer();
                    }
                });
            }
            
            // 7. Return aggregate result
            return {
                success: success,
                results: results,
                reflection: reflection,
                stoppedAtStep: stoppedAtStep,
                stopReason: stopReason,
                // Incluir también el coste del modelo en el resultado
                modelCost: this.calculateModelCostFromPlan(plan),
                snapshots: {
                    before: snapshotBeforeId,
                    after: snapshotAfterId
                }
            };
        } catch (error: any) {
            this.logger.appendLine(`Error in handleUserInput: ${error.message}`);
            
            // Añadir evento de error al visor
            if (this.eventsViewer) {
                this.eventsViewer.addErrorEvent(
                    `Error procesando solicitud`,
                    error.message
                );
            }
            
            // Mostrar mensaje de error al usuario
            vscode.window.showErrorMessage(`Error procesando solicitud: ${error.message}`);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Display the logs view
     */
    showLogsView(): void {
        if (this.logsView) {
            this.logsView.show();
        } else {
            this.initializeLogsView();
            if (this.logsView) {
                this.logsView.show();
            }
        }
    }

    /**
     * Plan the execution of a task by breaking it into steps
     * @param input - User input to plan for
     * @param context - Additional context
     * @returns The execution plan
     */
    async planTask(input: string, context: any): Promise<any> {
        this.logger.appendLine("Planning task...");
        
        try {
            // Get available tools from tool manager
            const availableTools = this.toolManager.getAvailableTools();
            
            // Determinar si la tarea implica cambios, análisis o estudio de código
            const relevantTools = ['AnalyzeCodeTool', 'FixErrorTool', 'WriteFileTool', 'GenerateTestTool', 'ExplainCodeTool'];
            const isCodeRelatedTask = 
                relevantTools.some(tool => input.toLowerCase().includes(tool.toLowerCase())) ||
                (context && context.taskType && relevantTools.includes(context.taskType)) ||
                input.toLowerCase().includes('código') ||
                input.toLowerCase().includes('code') ||
                input.toLowerCase().includes('error') ||
                input.toLowerCase().includes('bug') ||
                input.toLowerCase().includes('refactor');
            
            // Verificar si estamos procesando un archivo autofixer.md (caso especial)
            const isAutofixer = input.toLowerCase().includes("autofixer.md") || 
                               (context && context.taskType === 'processAutoFixerFile');
            
            // Recolectar documentos RAG si están disponibles
            const attachedDocs = context?.ragDocs || [];
            
            // Obtener la ruta del workspace
            const workspacePath = this.workspaceManager.getWorkspacePath() || '';
            
            // Obtener la ruta del archivo actual (si está disponible)
            const currentFilePath = context?.filePath || 
                                   (vscode.window.activeTextEditor?.document.uri.fsPath);
            
            let planningPrompt;
            let rulesApplied = [];
            
            if (isAutofixer) {
                // Caso especial para autofixer.md
                planningPrompt = `
Eres un asistente especializado en procesar archivos autofixer.md que contienen instrucciones para mejorar código.
Tu tarea es interpretar estas instrucciones y ejecutar los comandos necesarios.

Instrucciones del archivo autofixer.md:
"""
${context.content || 'No se proporcionó contenido del archivo'}
"""

Información contextual:
Ruta del archivo: ${context.filePath || 'Desconocido'}
Workspace: ${workspacePath || 'Desconocido'}

Herramientas disponibles:
${availableTools.map((tool: any) => `- ${tool.name}: ${tool.description}`).join('\n')}

IMPORTANTE: CUANDO NECESITES USAR RESULTADOS DE PASOS ANTERIORES EN TUS PARÁMETROS:
- Para usar el contenido leído por ReadFileTool, usa "$PREVIOUS_STEP.content" como valor del parámetro
- Para usar otra propiedad del resultado anterior, usa "$PREVIOUS_STEP.nombrePropiedad" 
- Para referenciar un paso específico, usa "$STEP[n].nombrePropiedad" donde n es el índice del paso (empezando en 0)
NUNCA uses frases como "contenido leído en el paso anterior" o "content from previous step", usa las variables específicas.

Crea un plan paso a paso para implementar las instrucciones del archivo autofixer.md.
Para cada paso, especifica:
1. Descripción clara del paso
2. La herramienta a usar
3. Parámetros específicos para la herramienta

IMPORTANTE: Para ejecutar comandos, usa SIEMPRE comandos específicos y concretos, NUNCA uses placeholders como "comando_resultante" o similares.
SIEMPRE SE DEBE CONSULTAR los archivos implicados en las modificaciones y errores antes de ejecutar los comandos.
En caso de que al leer el contenido implicado en el error/cambio conlleve otro plan de acción, se debe crear un nuevo plan de acción para corregir el error.
Los comandos permitidos incluyen: npm, node, ls, cat, echo, find, grep, mkdir, cp, mv, rm, git, yarn, pnpm, npx, ng, nx, react-scripts, etc.

Responde en el siguiente formato JSON:
{
  "plan": {
    "steps": [
      {
        "description": "Descripción del paso",
        "tool": "NombreHerramienta",
        "params": {
          "param1": "valor1",
          "param2": "valor2"
        }
      }
    ]
  }
}
`;
            } else if (isCodeRelatedTask) {
                // Para tareas relacionadas con código, usar el sistema de composición de prompts avanzado
                this.logger.appendLine("Tarea relacionada con código detectada. Usando promptComposer...");
                
                // Construir el prompt con el sistema de composición
                const composedPrompt = promptComposer.buildPrompt({
                    userQuery: input,
                    workspacePath,
                    attachedDocs,
                    currentFilePath
                });
                
                // Guardar información sobre las reglas aplicadas para la reflexión final
                rulesApplied = this.extractAppliedRules(composedPrompt);
                
                // Guardar las reglas en el contextManager para usarlas en la reflexión
                this.contextManager.addItem('appliedRules', rulesApplied);
                
                // Usar la plantilla de PLAN_TASK_PROMPT e interpolar los campos necesarios
                const toolsList = availableTools.map((tool: any) => 
                    `- ${tool.name}: ${tool.description}`).join('\n');
                
                // Añadir instrucciones sobre cómo referenciar resultados de pasos anteriores
                const variablesInstructions = `
IMPORTANTE: CUANDO NECESITES USAR RESULTADOS DE PASOS ANTERIORES EN TUS PARÁMETROS:
- Para usar el contenido leído por ReadFileTool, usa "$PREVIOUS_STEP.content" como valor del parámetro
- Para usar otra propiedad del resultado anterior, usa "$PREVIOUS_STEP.nombrePropiedad" 
- Para referenciar un paso específico, usa "$STEP[n].nombrePropiedad" donde n es el índice del paso (empezando en 0)
NUNCA uses frases como "contenido leído en el paso anterior" o "content from previous step", usa las variables específicas.

IMPORTANTE PARA HERRAMIENTAS DE ANÁLISIS DE CÓDIGO:
- Cuando uses AnalyzeCodeTool, FixErrorTool o cualquier herramienta que analice código, SIEMPRE pasa TANTO el contenido como la ruta del archivo.
- Ejemplo correcto: { "content": "$STEP[0].content", "sourcePath": "$STEP[0].path", "focus": "NombreClase" }
- El parámetro sourcePath es OBLIGATORIO para que la herramienta funcione correctamente.
`;
                
                const modifiedPrompt = PLAN_TASK_PROMPT
                    .replace('{{tools}}', toolsList)
                    .replace('{{context}}', composedPrompt)
                    .replace('{{input}}', input);
                
                // Insertar las instrucciones de variables justo antes de la sección de JSON format
                planningPrompt = modifiedPrompt.replace(
                    'Respond in the following JSON format:', 
                    `${variablesInstructions}\n\nRespond in the following JSON format:`
                );
                
                this.logger.appendLine("Prompt compuesto generado con reglas y contexto del workspace");
            } else {
                // Usar el prompt estándar para otras tareas
                planningPrompt = `
You are a planning assistant for the Grec0AI Agent. Your task is to break down the user's request into a series of steps that can be executed by the agent.

User request: "${input}"

Current context:
File: ${context.filePath || 'None'}
Language: ${context.language || 'Unknown'}
Selected text: ${context.selection ? 'Yes (length: ' + context.selection.length + ')' : 'None'}

Available tools:
${availableTools.map((tool: any) => `- ${tool.name}: ${tool.description}`).join('\n')}

IMPORTANT: WHEN REFERENCING RESULTS FROM PREVIOUS STEPS IN YOUR PARAMETERS:
- To use content read by ReadFileTool, use "$PREVIOUS_STEP.content" as the parameter value
- To use another property from the previous result, use "$PREVIOUS_STEP.propertyName"
- To reference a specific step, use "$STEP[n].propertyName" where n is the step index (starting at 0)
NEVER use phrases like "content read in previous step" or "content from previous step", use the specific variables.

IMPORTANT FOR CODE ANALYSIS TOOLS:
- When using AnalyzeCodeTool, FixErrorTool, or any tool that analyzes code, ALWAYS pass BOTH the content and the path of the file.
- Correct example: { "content": "$STEP[0].content", "sourcePath": "$STEP[0].path", "focus": "ClassName" }
- The sourcePath parameter is MANDATORY for the tool to work correctly.

Create a step-by-step plan to fulfill the user's request. For each step, specify:
1. A description of the step
2. The tool to use
3. Parameters for the tool

Respond in the following JSON format:
{
  "plan": {
    "steps": [
      {
        "description": "Step description",
        "tool": "ToolName",
        "params": {
          "param1": "value1",
          "param2": "value2"
        }
      }
    ]
  }
}
`;
            }
            
            // Registrar un evento de build_rules antes de invocar al LLM si hay reglas aplicadas
            if (isCodeRelatedTask && rulesApplied.length > 0 && this.logsView) {
                this.logsView.addBuildRulesLog(
                    rulesApplied,
                    `Reglas que serán aplicadas para planificar: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`
                );
                this.logger.appendLine(`Registrado evento de build_rules con ${rulesApplied.length} reglas`);
            }
            
            // Call LLM to generate plan
            this.logger.appendLine("Calling LLM to generate plan...");
            const planResult = await this.llmClient.generateCompletion(planningPrompt, {
                maxTokens: 1024,
                temperature: 0.2,
                format: 'json',
                taskType: 'planning'
            });
            
            let plan;
            
            try {
                // Extraer la información del modelo y el conteo de tokens
                const modelInfo = planResult.modelInfo;
                const tokenCount = planResult.tokenCount;
                
                // Parse the plan from LLM response
                if (typeof planResult.content === 'string') {
                    plan = JSON.parse(planResult.content);
                } else {
                    plan = planResult.content;
                }
                
                // Validate plan has expected structure
                if (!plan.plan || !plan.plan.steps || !Array.isArray(plan.plan.steps)) {
                    throw new Error('Invalid plan structure');
                }
                
                // Añadir las reglas aplicadas al plan para usarlas en la reflexión
                if (isCodeRelatedTask && rulesApplied.length > 0) {
                    plan.plan.appliedRules = rulesApplied;
                }
                
                // Añadir la información del modelo al plan
                plan.plan.modelInfo = modelInfo;
                plan.plan.tokenCount = tokenCount;
                
                // Calcular y añadir información de coste del modelo
                if (modelInfo && tokenCount) {
                    const modelCost = modelPricingService.getModelCostBreakdown(
                        modelInfo.name,
                        tokenCount.prompt || 0,
                        tokenCount.completion || 0
                    );
                    plan.plan.modelCost = modelCost;
                    this.logger.appendLine(`Coste del modelo: $${modelCost.totalUSD} USD / €${modelCost.totalEUR} EUR`);
                }
                
                return plan.plan;
            } catch (parseError: any) {
                this.logger.appendLine(`Error parsing plan: ${parseError.message}`);
                this.debugOpenAIResponse(planResult, `Error parsing plan: ${parseError.message}`);
                
                // Intentar una solución de fallback si el formato de respuesta es incorrecto
                try {
                    if (planResult.content && typeof planResult.content === 'object') {
                        // Si el contenido ya es un objeto, intentar usarlo directamente
                        const fallbackPlan = {
                            steps: Array.isArray(planResult.content) ? planResult.content : [],
                            modelInfo: planResult.modelInfo,
                            tokenCount: planResult.tokenCount
                        };
                        if (fallbackPlan.steps.length === 0 && planResult.content && typeof planResult.content === 'object' && 'steps' in planResult.content) {
                            fallbackPlan.steps = (planResult.content as { steps: any[] }).steps;
                        }
                        
                        if (fallbackPlan.steps.length > 0) {
                            this.logger.appendLine("Usando plan de fallback reconstruido");
                            return fallbackPlan;
                        }
                    }
                } catch (fallbackError) {
                    this.logger.appendLine(`Error en plan de fallback: ${fallbackError}`);
                }
                
                // Fallback final: plan simple con la herramienta por defecto
                return {
                    steps: [{
                        description: `Fallback: ${input}`,
                        tool: this.determineDefaultTool(input, context),
                        params: {
                            ...context,
                            input: input
                        }
                    }],
                    modelInfo: planResult.modelInfo,
                    tokenCount: planResult.tokenCount
                };
            }
        } catch (error: any) {
            this.logger.appendLine(`Error in planTask: ${error.message}`);
            
            // Fallback to simple plan
            return {
                steps: [{
                    description: `Fallback for request: ${input}`,
                    tool: this.determineDefaultTool(input, context),
                    params: {
                        ...context,
                        input: input
                    }
                }]
            };
        }
    }

    /**
     * Extrae las reglas aplicadas del prompt compuesto
     * @param composedPrompt El prompt compuesto generado
     * @returns Lista de reglas aplicadas
     */
    private extractAppliedRules(composedPrompt: string): string[] {
        const rulesApplied: string[] = [];
        
        // Buscar sección de reglas en el prompt
        const rulesIndex = composedPrompt.indexOf('---\n## Rules');
        
        if (rulesIndex !== -1) {
            // Extraer la sección de reglas
            const rulesSection = composedPrompt.substring(rulesIndex);
            const nextSectionIndex = rulesSection.indexOf('---\n', 4); // Buscar la siguiente sección
            
            const rulesSectionContent = nextSectionIndex !== -1 
                ? rulesSection.substring(0, nextSectionIndex)
                : rulesSection;
            
            // Extraer nombres/descripciones de reglas
            const ruleLines = rulesSectionContent.split('\n');
            for (const line of ruleLines) {
                // Buscar líneas que parezcan descripciones de reglas (heurística simple)
                if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^[0-9]+\./)) {
                    rulesApplied.push(line.trim());
                } else if (line.startsWith('### ') || line.startsWith('## ')) {
                    // Capturar títulos de secciones de reglas
                    rulesApplied.push(line.trim());
                }
            }
        }
        
        return rulesApplied;
    }

    /**
     * Determine if a failed step should be retried
     * @param step - The failed step
     * @param error - The error that occurred
     * @returns Whether to retry the step
     */
    async shouldRetryStep(step: any, error: any): Promise<boolean> {
        // Simple heuristic for now - only retry certain types of failures
        const retryableErrors = [
            'context length exceeded',
            'rate limit',
            'timeout',
            'network error',
            'temporary failure'
        ];
        
        // Check if error message contains any retryable patterns
        if (retryableErrors.some(e => error.message.toLowerCase().includes(e.toLowerCase()))) {
            return true;
        }
        
        // Don't retry if already modified
        if (step.wasModified) {
            return false;
        }
        
        // By default, don't retry
        return false;
    }

    /**
     * Modify a step after failure for retry
     * @param step - The failed step
     * @param error - The error that occurred
     * @returns Modified step for retry
     */
    async modifyStepAfterFailure(step: any, error: any): Promise<any> {
        // Create a modified copy of the step
        const modifiedStep = {
            ...step,
            wasModified: true,
            description: `Retry: ${step.description}`
        };
        
        // Modify based on error type
        if (error.message.toLowerCase().includes('context length')) {
            // Simplify parameters to reduce token count
            modifiedStep.params = {
                ...step.params,
                simplified: true
            };
        }
        
        return modifiedStep;
    }

    /**
     * Reflect on the execution of a plan
     * @param plan - The execution plan
     * @param results - The results of executing the plan
     * @param stoppedAtStep - The step where execution stopped (if applicable)
     * @param stopReason - The reason execution stopped (if applicable)
     * @returns Reflection on the execution
     */
    async reflectOnExecution(plan: any, results: any[], stoppedAtStep: string | null, stopReason: string | null): Promise<any> {
        try {
            // Count successful and failed steps
            const successfulSteps = results.filter(r => r.success).length;
            const failedSteps = results.filter(r => !r.success).length;
            
            // Determine overall status
            let status = 'success';
            if (failedSteps > 0) {
                status = successfulSteps > 0 ? 'partial' : 'failed';
            }
            
            // Calculate model usage and costs
            const modelUsage = this.calculateModelUsage(results, plan);
            
            // Calculate total costs
            const totalCostUSD = modelUsage.reduce((total, model) => total + model.costUSD, 0);
            const totalCostEUR = modelUsage.reduce((total, model) => total + model.costEUR, 0);
            
            // Build recommendations based on execution results
            const recommendations: string[] = [];
            
            // Add recommendation based on the reason for stopping
            if (stoppedAtStep && stopReason) {
                if (stopReason.includes('no está disponible')) {
                    recommendations.push(`Se recomienda verificar que todas las herramientas necesarias estén registradas correctamente.`);
                } else if (stopReason.includes('Faltan parámetros')) {
                    recommendations.push(`Se recomienda revisar los parámetros necesarios para este paso en la documentación de la herramienta.`);
                } else if (stopReason.includes('Error crítico')) {
                    recommendations.push(`Se recomienda revisar los logs para entender el error y corregirlo antes de continuar.`);
                } else if (stopReason.includes('dependen del éxito')) {
                    recommendations.push(`Se recomienda solucionar el problema en este paso antes de continuar con el resto del plan.`);
                }
            }
            
            // Add cost-related recommendation
            if (totalCostUSD > 0.05) {
                recommendations.push(`El coste total de esta operación ha sido alto ($${totalCostUSD.toFixed(4)} USD). Considere optimizar los prompts o usar modelos más económicos.`);
            } else if (totalCostUSD > 0) {
                recommendations.push(`El coste total de esta operación ha sido bajo ($${totalCostUSD.toFixed(6)} USD).`);
            }
            
            // Simple reflection text
            let reflectionText = `Completed ${successfulSteps} steps successfully and ${failedSteps} steps failed.`;
            
            // Add information about early termination
            if (stoppedAtStep && stopReason) {
                reflectionText += `\nLa ejecución se detuvo en el paso "${stoppedAtStep}" por la siguiente razón: ${stopReason}.`;
            }
            
            // Construct a structured reflection object
            const reflection: any = {
                text: reflectionText,
                status: status,
                successfulSteps,
                failedSteps,
                stoppedAtStep,
                stopReason,
                modelUsage,
                totalCostUSD,
                totalCostEUR,
                recommendations,
                timestamp: new Date()
            };
            
            // Add information about applied rules if available
            const appliedRules = plan.appliedRules || this.contextManager.getItemByKey('appliedRules') || [];
            if (appliedRules && appliedRules.length > 0) {
                reflection.appliedRules = appliedRules;
                
                // Registrar un evento de build_rules antes de enviar la reflexión
                if (this.logsView) {
                    this.logsView.addBuildRulesLog(
                        appliedRules,
                        "Reglas aplicadas durante la reflexión del agente"
                    );
                    this.logger.appendLine(`Registrado evento de build_rules para reflexión con ${appliedRules.length} reglas`);
                }
            }
            
            return reflection;
        } catch (error) {
            return {
                text: `Reflection failed: ${error.message}`,
                status: 'failed',
                successfulSteps: 0,
                failedSteps: 0,
                timestamp: new Date()
            };
        }
    }

    /**
     * Calculate model usage and costs from execution results
     * @param results Results from executing the plan
     * @param plan The execution plan
     * @returns Array of model usage objects
     */
    private calculateModelUsage(results: any[], plan: any): any[] {
        try {
            // Use a map to aggregate usage by model
            const modelMap = new Map<string, {
                model: string;
                calls: number;
                inputTokens: number;
                outputTokens: number;
                costUSD: number;
                costEUR: number;
            }>();
            
            // Add the planning step if it has model info
            if (plan && plan.modelInfo && plan.tokenCount) {
                const modelName = plan.modelInfo.name || 'unknown';
                const inputTokens = plan.tokenCount.prompt || 0;
                const outputTokens = plan.tokenCount.completion || 0;
                
                // Calculate costs
                let costUSD = 0;
                let costEUR = 0;
                
                if (modelName && (inputTokens > 0 || outputTokens > 0)) {
                    const modelCost = modelPricingService.getModelCostBreakdown(
                        modelName,
                        inputTokens,
                        outputTokens
                    );
                    costUSD = modelCost.totalUSD;
                    costEUR = modelCost.totalEUR;
                }
                
                modelMap.set(modelName, {
                    model: modelName,
                    calls: 1,
                    inputTokens,
                    outputTokens,
                    costUSD,
                    costEUR
                });
            }
            
            // Process all results
            for (const result of results) {
                // Skip if no result or not successful
                if (!result || !result.result) continue;
                
                // Extract model info and token count if available
                const modelInfo = result.result.modelInfo || 
                                 (result.step && result.step.modelInfo) || 
                                 null;
                const tokenCount = result.result.tokenCount || 
                                  (result.step && result.step.tokenCount) || 
                                  null;
                
                if (modelInfo && tokenCount) {
                    const modelName = modelInfo.name || 'unknown';
                    const inputTokens = tokenCount.prompt || 0;
                    const outputTokens = tokenCount.completion || 0;
                    
                    // Calculate costs
                    let costUSD = 0;
                    let costEUR = 0;
                    
                    if (modelName && (inputTokens > 0 || outputTokens > 0)) {
                        const modelCost = modelPricingService.getModelCostBreakdown(
                            modelName,
                            inputTokens,
                            outputTokens
                        );
                        costUSD = modelCost.totalUSD;
                        costEUR = modelCost.totalEUR;
                    }
                    
                    // Update or create model usage entry
                    if (modelMap.has(modelName)) {
                        const existing = modelMap.get(modelName)!;
                        existing.calls += 1;
                        existing.inputTokens += inputTokens;
                        existing.outputTokens += outputTokens;
                        existing.costUSD += costUSD;
                        existing.costEUR += costEUR;
                    } else {
                        modelMap.set(modelName, {
                            model: modelName,
                            calls: 1,
                            inputTokens,
                            outputTokens,
                            costUSD,
                            costEUR
                        });
                    }
                }
            }
            
            // Convert map to array
            return Array.from(modelMap.values());
        } catch (error: any) {
            this.logger.appendLine(`Error calculating model usage: ${error.message}`);
            return [];
        }
    }

    /**
     * Método de utilidad para depurar respuestas de OpenAI
     * @param planResult - Resultado de OpenAI
     * @param errorMessage - Mensaje de error opcional
     */
    private debugOpenAIResponse(planResult: any, errorMessage?: string): void {
        this.logger.appendLine('----------- DEBUG: OPENAI RESPONSE -----------');
        if (errorMessage) {
            this.logger.appendLine(`ERROR: ${errorMessage}`);
        }
        
        try {
            this.logger.appendLine(`Model used: ${planResult.modelInfo?.name || 'unknown'}`);
            this.logger.appendLine(`Task type: ${planResult.modelInfo?.taskType || 'unknown'}`);
            this.logger.appendLine(`Tokens: ${JSON.stringify(planResult.tokenCount || {})}`);
            
            if (planResult.content) {
                if (typeof planResult.content === 'string') {
                    this.logger.appendLine(`Content (string): ${planResult.content.substring(0, 200)}...`);
                } else {
                    this.logger.appendLine(`Content (object): ${JSON.stringify(planResult.content).substring(0, 200)}...`);
                }
            } else {
                this.logger.appendLine('No content found in response');
            }
        } catch (e) {
            this.logger.appendLine(`Error debugging response: ${e}`);
            this.logger.appendLine(`Raw response: ${JSON.stringify(planResult)}`);
        }
        this.logger.appendLine('---------------------------------------------');
    }
    
    /**
     * Extrae las reglas de un contexto de texto
     * @param context Texto del contexto
     * @returns Lista de reglas extraídas
     */
    private extractRulesFromContext(context: string): string[] {
        const rules: string[] = [];
        
        // Buscar líneas que parezcan descripciones de reglas (heurística simple)
        const ruleLines = context.split('\n').filter(line => {
            if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^[0-9]+\./)) {
                rules.push(line.trim());
                return false;
            }
            return true;
        });
        
        return rules;
    }
    
    /**
     * Calcula el coste del modelo a partir de un plan
     * @param plan El plan de ejecución
     * @returns Desglose de costes del modelo o undefined si no hay datos suficientes
     */
    private calculateModelCostFromPlan(plan: any): modelPricingService.CostBreakdown | undefined {
        try {
            // Verificar si tenemos la información necesaria
            if (!plan || !plan.modelInfo || !plan.tokenCount) {
                return undefined;
            }
            
            const modelName = plan.modelInfo.name;
            const inputTokens = plan.tokenCount.prompt || 0;
            const outputTokens = plan.tokenCount.completion || 0;
            
            // Si no hay tokens o modelo, no calculamos coste
            if (!modelName || (inputTokens === 0 && outputTokens === 0)) {
                return undefined;
            }
            
            this.logger.appendLine(`Calculando coste para modelo: ${modelName}, tokens entrada: ${inputTokens}, tokens salida: ${outputTokens}`);
            
            // Calcular el desglose de costes
            const costBreakdown = modelPricingService.getModelCostBreakdown(
                modelName, 
                inputTokens,
                outputTokens
            );
            
            // Añadir información adicional
            return {
                ...costBreakdown,
                model: modelName,
                inputTokens,
                outputTokens
            };
        } catch (error: any) {
            this.logger.appendLine(`Error calculando coste del modelo: ${error.message}`);
            return undefined;
        }
    }

    /**
     * Determine the default tool for a request
     * @param input - User input
     * @param context - Request context
     * @returns Name of the default tool
     */
    private determineDefaultTool(input: string, context: any): string {
        const lowercaseInput = input.toLowerCase();
        
        if (lowercaseInput.includes('test') || lowercaseInput.includes('generar test')) {
            return 'GenerateTestTool';
        } else if (lowercaseInput.includes('error') || lowercaseInput.includes('fix')) {
            return 'FixErrorTool';
        } else if (lowercaseInput.includes('explain') || lowercaseInput.includes('explicar')) {
            return 'ExplainCodeTool';
        } else {
            return 'AnalyzeCodeTool';
        }
    }

    /**
     * Get the agent's logger
     * @returns The logger instance
     */
    getLogger(): vscode.OutputChannel {
        return this.logger;
    }

    /**
     * Dispose the agent and free resources
     */
    dispose(): void {
        this.logger.dispose();
        this.contextManager.dispose();
        this.toolManager.dispose();
        this.workspaceManager.dispose();
        this.databaseManager.dispose();
    }

    /**
     * Resolve variables in parameters before tool execution
     * @param params - Original parameters
     * @param results - Optional array of previous results
     * @returns Parameters with variables resolved
     */
    private resolveVariables(params: Record<string, any>, results: any[] = []): Record<string, any> {
        if (!params) {
            return {};
        }
        
        // Helper function to get current active editor info
        const getActiveEditorInfo = (): { filePath?: string, content?: string, selection?: string } => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const selection = editor.selection;
                    return {
                        filePath: editor.document.uri.fsPath,
                        content: editor.document.getText(),
                        selection: selection && !selection.isEmpty ? 
                            editor.document.getText(selection) : undefined
                    };
                }
            } catch (e) {
                // Ignore errors
                this.logger.appendLine(`Error getting editor info: ${e}`);
            }
            return {};
        };

        // Helper para obtener resultados de pasos previos
        const getPreviousStepResult = (key: string, stepIndex: number = -1): any => {
            if (results.length === 0) return undefined;
            
            // Si stepIndex es -1, usar el último resultado
            const resultIndex = stepIndex === -1 ? results.length - 1 : stepIndex;
            if (resultIndex < 0 || resultIndex >= results.length) return undefined;
            
            const result = results[resultIndex];
            if (!result || !result.result) return undefined;
            
            return result.result[key];
        };

        // Helper para obtener el paso completo anterior
        const getPreviousStep = (stepIndex: number = -1): any => {
            if (results.length === 0) return undefined;
            
            // Si stepIndex es -1, usar el último resultado
            const resultIndex = stepIndex === -1 ? results.length - 1 : stepIndex;
            if (resultIndex < 0 || resultIndex >= results.length) return undefined;
            
            return results[resultIndex];
        };
        
        // Process parameters recursively
        const processValue = (value: any): any => {
            // Handle primitive types
            if (typeof value !== 'object') {
                if (typeof value === 'string') {
                    // Get info only once if needed
                    let editorInfo: { filePath?: string, content?: string, selection?: string } | null = null;
                    
                    // Detectar referencias a resultados de pasos anteriores
                    if (value === '$PREVIOUS_STEP.content' || 
                        value === '$PREVIOUS_RESULT.content' || 
                        value.match(/contenido.*le[ií]do.*paso anterior/i) || 
                        value.match(/content.*from.*previous step/i) ||
                        value.match(/content.*of.*file/i)) {
                        
                        const contentFromPrevious = getPreviousStepResult('content');
                        if (contentFromPrevious) {
                            this.logger.appendLine(`Resolving reference to previous step content`);
                            return contentFromPrevious;
                        }
                    }
                    
                    // Detectar otras propiedades del resultado anterior
                    const previousStepMatch = value.match(/\$PREVIOUS_STEP\.(\w+)/);
                    if (previousStepMatch && previousStepMatch[1]) {
                        const property = previousStepMatch[1];
                        const propValue = getPreviousStepResult(property);
                        if (propValue !== undefined) {
                            this.logger.appendLine(`Resolving $PREVIOUS_STEP.${property} to value from previous step`);
                            return propValue;
                        }
                    }
                    
                    // Detectar referencias a pasos específicos
                    const specificStepMatch = value.match(/\$STEP\[(\d+)\]\.(\w+)/);
                    if (specificStepMatch && specificStepMatch[1] && specificStepMatch[2]) {
                        const stepIndex = parseInt(specificStepMatch[1], 10);
                        const property = specificStepMatch[2];
                        const propValue = getPreviousStepResult(property, stepIndex);
                        if (propValue !== undefined) {
                            this.logger.appendLine(`Resolving $STEP[${stepIndex}].${property} to value from specific step`);
                            return propValue;
                        }
                    }
                    
                    // Replace common variables
                    if (value === '$SELECTED_FILE' || value === 'path_to_selected_file') {
                        if (!editorInfo) editorInfo = getActiveEditorInfo();
                        this.logger.appendLine(`Resolving $SELECTED_FILE to: ${editorInfo.filePath || 'undefined'}`);
                        return editorInfo.filePath || value;
                    }
                    
                    if (value === '$CONTENT_OF_SELECTED_FILE' || value === 'content_of_the_file' || 
                        value === 'content from previous step') {
                        if (!editorInfo) editorInfo = getActiveEditorInfo();
                        this.logger.appendLine(`Resolving content variable to file content`);
                        return editorInfo.content || value;
                    }
                    
                    if (value === '$SELECTED_TEXT' || value === 'selected_text') {
                        if (!editorInfo) editorInfo = getActiveEditorInfo();
                        this.logger.appendLine(`Resolving $SELECTED_TEXT to: ${editorInfo.selection ? 'selection' : 'undefined'}`);
                        return editorInfo.selection || value;
                    }
                    
                    // Replace special template placeholders
                    if (value.includes('comando_o_accion') || value.includes('$COMMAND')) {
                        this.logger.appendLine(`Detected template placeholder in parameter value: ${value}`);
                        return 'echo "Comando no específico detectado"';
                    }
                    
                    // Replace contenido_leído_del_archivo_autofixer.md with actual file content
                    if (value === 'contenido_leído_del_archivo_autofixer.md') {
                        // Get the autofixer.md content from context if available
                        const autofixerContent = this.contextManager.getItemByKey('autofixerContent');
                        if (autofixerContent) {
                            this.logger.appendLine(`Resolving contenido_leído_del_archivo_autofixer.md with actual content`);
                            return autofixerContent;
                        }
                        
                        // Try to find and read autofixer.md as fallback
                        try {
                            const workspacePath = this.workspaceManager.getWorkspacePath();
                            if (workspacePath) {
                                const autofixerPath = `${workspacePath}/autofixer.md`;
                                if (require('fs').existsSync(autofixerPath)) {
                                    const content = require('fs').readFileSync(autofixerPath, 'utf8');
                                    this.logger.appendLine(`Resolved autofixer content from file`);
                                    return content;
                                }
                            }
                        } catch (e) {
                            this.logger.appendLine(`Error reading autofixer.md: ${e}`);
                        }
                    }
                }
                return value;
            }
            
            // Handle arrays
            if (Array.isArray(value)) {
                return value.map(item => processValue(item));
            }
            
            // Handle objects
            const result: Record<string, any> = {};
            for (const [key, val] of Object.entries(value)) {
                result[key] = processValue(val);
            }
            
            return result;
        };
        
        // Process all parameters
        const processedParams = processValue(params);
        
        // Enriquecer parámetros automáticamente con información del archivo
        this.enrichParamsWithFileInfo(processedParams, results);
        
        return processedParams;
    }
    
    /**
     * Enriquece los parámetros automáticamente con información del archivo
     * @param params Parámetros procesados
     * @param results Resultados previos
     */
    private enrichParamsWithFileInfo(params: Record<string, any>, results: any[]): void {
        try {
            // Si hay un parámetro content pero no hay sourcePath o filePath, intentar encontrarlo
            if (params.content && (!params.sourcePath && !params.filePath)) {
                // Comprobar si el contenido viene de un paso anterior de lectura de archivo
                const stepWithContent = this.findStepWithContent(params.content, results);
                
                if (stepWithContent) {
                    // Intentar obtener la ruta del archivo del paso que proporcionó el contenido
                    const filePath = this.getFilePathFromStep(stepWithContent);
                    
                    if (filePath) {
                        this.logger.appendLine(`Auto-enriquecimiento: Añadiendo sourcePath (${filePath}) a los parámetros`);
                        
                        // Añadir la ruta como sourcePath y filePath para mayor compatibilidad
                        params.sourcePath = filePath;
                        params.filePath = filePath;
                    }
                }
                
                // Si estamos usando AnalyzeCodeTool y no tenemos sourcePath, intentar obtenerlo del editor actual
                if ((!params.sourcePath || !params.filePath) && this.isAnalyzeCodeRequest(params)) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const activeFilePath = editor.document.uri.fsPath;
                        this.logger.appendLine(`Auto-enriquecimiento: Añadiendo sourcePath del editor activo (${activeFilePath})`);
                        params.sourcePath = activeFilePath;
                        params.filePath = activeFilePath;
                    }
                }
            }
        } catch (error: any) {
            // No interrumpir el flujo si hay errores en el enriquecimiento
            this.logger.appendLine(`Error enriqueciendo parámetros: ${error.message}`);
        }
    }
    
    /**
     * Encuentra el paso que proporcionó un contenido específico
     * @param content Contenido a buscar
     * @param results Resultados previos
     * @returns El paso que proporcionó el contenido o undefined si no se encuentra
     */
    private findStepWithContent(content: string, results: any[]): any {
        // Recorrer los resultados en orden inverso (de más reciente a más antiguo)
        for (let i = results.length - 1; i >= 0; i--) {
            const result = results[i];
            
            // Verificar si este paso tiene el contenido
            if (result && result.result && result.result.content === content) {
                return result;
            }
            
            // También verificar si este paso tiene el contenido como parte de otro campo
            if (result && result.result) {
                for (const [key, value] of Object.entries(result.result)) {
                    if (value === content) {
                        return result;
                    }
                }
            }
        }
        
        return undefined;
    }
    
    /**
     * Obtiene la ruta del archivo a partir de un paso
     * @param step Paso de donde obtener la ruta
     * @returns La ruta del archivo o undefined si no se encuentra
     */
    private getFilePathFromStep(step: any): string | undefined {
        if (!step || !step.step || !step.result) {
            return undefined;
        }
        
        // Primero verificar en el resultado
        if (step.result.filePath) {
            return step.result.filePath;
        }
        
        if (step.result.sourcePath) {
            return step.result.sourcePath;
        }
        
        if (step.result.path) {
            return step.result.path;
        }
        
        // Luego verificar en los parámetros del paso
        if (step.step.params) {
            if (step.step.params.filePath) {
                return step.step.params.filePath;
            }
            
            if (step.step.params.sourcePath) {
                return step.step.params.sourcePath;
            }
            
            if (step.step.params.path) {
                return step.step.params.path;
            }
        }
        
        return undefined;
    }
    
    /**
     * Determina si la solicitud es para AnalyzeCodeTool basado en los parámetros
     * @param params Parámetros de la solicitud
     * @returns true si parece ser una solicitud para AnalyzeCodeTool
     */
    private isAnalyzeCodeRequest(params: Record<string, any>): boolean {
        // Verificar si hay parámetros típicos de AnalyzeCodeTool
        return params.hasOwnProperty('focus') || 
               params.hasOwnProperty('language') || 
               params.hasOwnProperty('query');
    }

    /**
     * Verifica si un paso es crítico para el plan
     * @param step Paso actual
     * @param plan Plan completo
     * @returns true si el paso es crítico
     */
    private isStepCritical(step: PlanStep, plan: Plan): boolean {
        // Si el paso tiene explícitamente definida la propiedad isCritical, usamos ese valor
        if (step.isCritical !== undefined) {
            return step.isCritical;
        }
        
        // Por defecto, consideramos todos los pasos como críticos
        return true;
    }
    
    /**
     * Verifica si se puede continuar con la ejecución después de un paso
     * @param currentStep Paso actual
     * @param results Resultados hasta ahora
     * @param plan Plan completo
     * @returns true si se puede continuar con los siguientes pasos
     */
    private canContinueExecution(currentStep: PlanStep, results: any[], plan: Plan): boolean {
        // Si el último resultado fue un éxito, podemos continuar
        const lastResult = results[results.length - 1];
        if (lastResult.success) {
            return true;
        }
        
        // Si hay pasos posteriores que dependen explícitamente de éste, no podemos continuar
        const currentIndex = plan.steps.findIndex((s) => s.description === currentStep.description);
        const remainingSteps = plan.steps.slice(currentIndex + 1);
        
        // Verificar dependencias explícitas
        const stepHasDependents = remainingSteps.some((step: PlanStep) => 
            step.dependsOn && step.dependsOn.includes(currentStep.description)
        );
        
        if (stepHasDependents) {
            return false;
        }
        
        // Lógica de inferencia para dependencias implícitas
        // Si hay pasos de tipo WriteFileTool, FixErrorTool, o ExecuteCommandTool
        // que probablemente dependan del éxito del paso actual, no continuamos
        const dependentToolTypes = ['WriteFileTool', 'FixErrorTool', 'ExecuteCommandTool'];
        const currentTool = currentStep.tool;
        
        // Si el paso actual involucra leer un archivo y los siguientes modificarlo
        if (currentTool === 'ReadFileTool') {
            return !remainingSteps.some((step: PlanStep) => 
                step.tool === 'WriteFileTool' || step.tool === 'FixErrorTool'
            );
        }
        
        // Si el paso actual involucra búsqueda y los siguientes requieren ese resultado
        if (currentTool === 'ExecuteCommandTool' && currentStep.params?.command?.includes('grep')) {
            return !remainingSteps.some((step: PlanStep) => dependentToolTypes.includes(step.tool));
        }
        
        // Por defecto, si el paso falló y no tenemos certeza de que los siguientes dependan de él,
        // permitimos continuar pero marcamos el plan como no exitoso
        return true;
    }
    
    /**
     * Verifica que todos los parámetros requeridos estén presentes
     * @param tool Herramienta a utilizar
     * @param params Parámetros proporcionados
     * @returns Lista de parámetros faltantes
     */
    private checkRequiredParams(tool: any, params: any): string[] {
        const missingParams: string[] = [];
        
        // Verificar si la herramienta tiene definidos los parámetros requeridos
        if (tool.requiredParams && Array.isArray(tool.requiredParams)) {
            for (const param of tool.requiredParams) {
                if (params[param] === undefined) {
                    missingParams.push(param);
                }
            }
        } else if (tool.getRequiredParams && typeof tool.getRequiredParams === 'function') {
            // Algunas herramientas pueden definir sus parámetros requeridos mediante un método
            const requiredParams = tool.getRequiredParams();
            for (const param of requiredParams) {
                if (params[param] === undefined) {
                    missingParams.push(param);
                }
            }
        } else if (tool.metadata && tool.metadata.requiredParams) {
            // Algunas herramientas pueden definir sus parámetros en los metadatos
            for (const param of tool.metadata.requiredParams) {
                if (params[param] === undefined) {
                    missingParams.push(param);
                }
            }
        }
        
        return missingParams;
    }

    /**
     * Enriquece un paso con información relevante del vector store
     * @param step Paso a enriquecer
     */
    private async enrichStepWithRAG(step: PlanStep): Promise<void> {
        try {
            // Determinar si el paso necesita enriquecimiento RAG
            const ragRelevantTools = ['AnalyzeCodeTool', 'FixErrorTool', 'GenerateTestTool', 'WriteFileTool', 'ExplainCodeTool'];
            
            if (!ragRelevantTools.includes(step.tool)) {
                return; // No es relevante para RAG
            }
            
            // Importar el servicio RAG
            const ragService = require('../../services/ragService');
            
            // Asegurarse de que RAG esté inicializado
            const initialized = await ragService.initialize();
            if (!initialized) {
                this.logger.appendLine('RAG service not initialized, skipping enrichment');
                return;
            }
            
            // Consultar por información relevante según el tipo de herramienta
            let query = '';
            let contextCount = 3;
            
            if (step.tool === 'AnalyzeCodeTool') {
                // Si hay una ruta de archivo, usarla para la consulta
                if (step.params.sourcePath) {
                    const filePath = step.params.sourcePath;
                    query = `código similar a ${path.basename(filePath)} patrones estructura`;
                } else if (step.params.code) {
                    // Tomar primeras 200 caracteres del código para la consulta
                    const snippet = step.params.code.substring(0, 200);
                    query = `fragmentos de código similares a: ${snippet}`;
                }
            } else if (step.tool === 'FixErrorTool') {
                // Buscar soluciones para errores similares
                query = `solución para error "${step.params.errorMessage || ''}"`;
                contextCount = 5;
            } else if (step.tool === 'GenerateTestTool') {
                // Buscar tests similares
                if (step.params.sourcePath) {
                    query = `tests para ${path.basename(step.params.sourcePath)}`;
                }
                contextCount = 5;
            } else if (step.tool === 'WriteFileTool') {
                // Si es una herramienta de escritura, buscar archivos similares
                if (step.params.filePath) {
                    query = `código similar a ${path.basename(step.params.filePath)}`;
                    contextCount = 5;
                }
            }
            
            if (!query) {
                this.logger.appendLine('No se pudo construir una consulta RAG relevante');
                return;
            }
            
            // Realizar la consulta al vector store
            this.logger.appendLine(`Realizando consulta RAG: ${query}`);
            
            // Importar vectraService directamente para asegurar el tipado correcto
            const vectraService = require('../../services/vectraService');
            const searchResults = await vectraService.query(query, contextCount);
            
            // Preparar el contexto para incluir las reglas relevantes del workspace
            let formattedContext = 'CONTEXTO RELEVANTE DEL PROYECTO:\n\n';
            
            // Añadir resultados de búsqueda vectorial
            if (searchResults && searchResults.length > 0) {
                searchResults.forEach((result: any, index: number) => {
                    const filePath = result.metadata?.filePath || 'Sin ruta';
                    const code = result.metadata?.code || '';
                    const relevance = Math.round((result.score || 0) * 100);
                    
                    formattedContext += `[${index + 1}] Archivo: ${filePath} (Relevancia: ${relevance}%)\n${code}\n\n`;
                });
            } else {
                this.logger.appendLine('No se encontraron resultados RAG relevantes');
            }
            
            // Añadir reglas relevantes del workspace
            const workspacePath = this.workspaceManager.getWorkspacePath();
            const filePath = step.params.sourcePath || step.params.filePath;
            
            if (workspacePath && filePath) {
                // Importar promptComposer para obtener reglas
                const rulesContext = this.getRulesForFile(workspacePath, filePath);
                
                if (rulesContext && rulesContext.length > 0) {
                    formattedContext += "\nREGLAS APLICABLES DEL WORKSPACE:\n\n";
                    formattedContext += rulesContext;
                    this.logger.appendLine(`Se añadieron reglas del workspace para el archivo ${filePath}`);
                    
                    // Extraer las reglas individuales para registrarlas como evento
                    const rulesArray = this.extractRulesFromContext(rulesContext);
                    if (rulesArray.length > 0 && this.logsView) {
                        this.logsView.addBuildRulesLog(
                            rulesArray,
                            `Reglas aplicables para ${path.basename(filePath)} - ${step.tool}`
                        );
                        this.logger.appendLine(`Registrado evento de build_rules para la herramienta ${step.tool}`);
                    }
                }
            }
            
            // Añadir el contexto a los parámetros
            step.params.additionalContext = formattedContext;
            
            this.logger.appendLine(`Paso enriquecido con resultados RAG y reglas del workspace`);
        } catch (error: any) {
            // No interrumpir el flujo si falla el enriquecimiento
            this.logger.appendLine(`Error al enriquecer paso con RAG: ${error.message}`);
        }
    }
    
    /**
     * Obtiene las reglas aplicables para un archivo específico
     * @param workspacePath Ruta del workspace
     * @param filePath Ruta del archivo
     * @returns Reglas en formato de texto
     */
    private getRulesForFile(workspacePath: string, filePath: string): string {
        try {
            // Verificar si existe el archivo de reglas tradicional
            const rulesPath = path.join(workspacePath, '.cursor', 'rules');
            if (require('fs').existsSync(rulesPath)) {
                return require('fs').readFileSync(rulesPath, 'utf8');
            }
            
            // Verificar si existe el archivo @rules.mdc
            const altRulesPath = path.join(workspacePath, '@rules.mdc');
            if (require('fs').existsSync(altRulesPath)) {
               
                const content = require('fs').readFileSync(altRulesPath, 'utf8');
                
                // Verificar si el archivo contiene frontmatter
                if (content.startsWith('---')) {
                    // Extraer solo el contenido (sin frontmatter)
                    const endFrontmatter = content.indexOf('---', 3);
                    if (endFrontmatter !== -1) {
                        return content.substring(endFrontmatter + 3).trim();
                    }
                }
                
                return content;
            }
            
            // Verificar si existe el directorio de reglas
            const rulesDir = path.join(workspacePath, '.cursor', 'rules.d');
            if (require('fs').existsSync(rulesDir) && require('fs').statSync(rulesDir).isDirectory()) {
                const files = require('fs').readdirSync(rulesDir);
                let allRules = '';
                
                for (const file of files) {
                    if (file.endsWith('.mdc')) {
                        const filePath = path.join(rulesDir, file);
                        const content = require('fs').readFileSync(filePath, 'utf8');
                        
                        // Verificar si el archivo contiene frontmatter
                        if (content.startsWith('---')) {
                            // Extraer solo el contenido (sin frontmatter)
                            const endFrontmatter = content.indexOf('---', 3);
                            if (endFrontmatter !== -1) {
                                allRules += content.substring(endFrontmatter + 3).trim() + '\n\n';
                                continue;
                            }
                        }
                        
                        allRules += content + '\n\n';
                    }
                }
                
                return allRules.trim();
            }
            
            return '';
        } catch (error: any) {
            this.logger.appendLine(`Error al obtener reglas para el archivo: ${error.message}`);
            return '';
        }
    }
    
    /**
     * Indexa resultados relevantes de pasos para aprendizaje futuro
     * @param step Paso ejecutado
     * @param result Resultado del paso
     */
    private async indexStepResults(step: PlanStep, result: any): Promise<void> {
        try {
            // Solo indexar ciertos tipos de resultados
            if (step.tool !== 'WriteFileTool' && step.tool !== 'FixErrorTool') {
                return; // No indexar este tipo de resultado
            }
            
            // Para WriteFileTool, indexar el contenido escrito
            if (step.tool === 'WriteFileTool' && result.success && step.params.content) {
                const vectraService = require('../../services/vectraService');
                await vectraService.initialize();
                
                const metadata = {
                    filePath: result.filePath || step.params.filePath,
                    fileName: path.basename(result.filePath || step.params.filePath),
                    extension: path.extname(result.filePath || step.params.filePath),
                    createdAt: new Date().toISOString(),
                    stepDescription: step.description
                };
                
                await vectraService.indexCode(step.params.content, metadata);
                this.logger.appendLine(`Contenido indexado para futura recuperación: ${metadata.filePath}`);
            }
        } catch (error: any) {
            this.logger.appendLine(`Error indexando resultados: ${error.message}`);
        }
    }

    /**
     * Método de ejemplo para demostrar el uso de modelos de razonamiento con herramientas
     * Este método puede integrarse con las capacidades existentes del agente
     */
    async demoReasoningModel(userInput: string): Promise<any> {
        try {
            this.logger.appendLine(`Demostrando modelo de razonamiento con input: ${userInput}`);
            
            // Crear herramientas de ejemplo para la demostración
            const demoTools = [
                {
                    type: 'function',
                    function: {
                        name: 'list_files',
                        description: 'Listar archivos en un directorio',
                        parameters: {
                            type: 'object',
                            properties: {
                                path: {
                                    type: 'string',
                                    description: 'Ruta del directorio a listar'
                                }
                            },
                            required: ['path']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'search_code',
                        description: 'Buscar en el código del proyecto',
                        parameters: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Término de búsqueda'
                                },
                                file_type: {
                                    type: 'string',
                                    description: 'Tipo de archivo (opcional)'
                                }
                            },
                            required: ['query']
                        }
                    }
                }
            ];
            
            // Definir manejador de herramientas
            const toolCallHandler = async (toolCall: any) => {
                this.logger.appendLine(`Procesando llamada a herramienta: ${toolCall.function.name}`);
                
                // Simular respuestas para las herramientas de demostración
                if (toolCall.function.name === 'list_files') {
                    const params = JSON.parse(toolCall.function.arguments);
                    return {
                        files: [
                            'example1.ts',
                            'example2.ts',
                            'utilities.ts',
                            'README.md'
                        ],
                        path: params.path
                    };
                } else if (toolCall.function.name === 'search_code') {
                    const params = JSON.parse(toolCall.function.arguments);
                    return {
                        results: [
                            {
                                file: 'example1.ts',
                                line: 42,
                                snippet: `function ${params.query}() { return 'example'; }`
                            }
                        ],
                        query: params.query
                    };
                } else {
                    return {
                        error: `Herramienta no implementada: ${toolCall.function.name}`
                    };
                }
            };
            
            // Crear mensajes para la conversación
            const messages: ChatMessage[] = [
                {
                    role: 'system',
                    content: 'Eres un asistente de programación que puede usar herramientas para ayudar al usuario a encontrar información y analizar código. Explora el contexto disponible para dar respuestas precisas y útiles.'
                },
                {
                    role: 'user',
                    content: userInput
                }
            ];
            
            // Llamar al servicio de OpenAI con herramientas
            const result = await openaiService.callWithTools(
                messages,
                demoTools,
                toolCallHandler,
                'o3-mini',
                { reasoning_effort: 'medium' }
            );
            
            // Registro para debug
            this.logger.appendLine(`Respuesta del modelo: ${result.choices[0].message.content}`);
            
            // Devolver resultado con la conversación completa para visualización
            return {
                message: result.choices[0].message,
                conversation: messages.concat(result.choices[0].message),
                tool_calls: result.tool_calls || []
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.appendLine(`Error en demoReasoningModel: ${errorMessage}`);
            throw error;
        }
    }
}