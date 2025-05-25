/**
 * LogsView Usage Example
 * Este archivo muestra cómo utilizar la vista de logs con múltiples sesiones
 */

import * as vscode from 'vscode';
import { AgentLogsView } from '../ui/logsView';

/**
 * Ejemplo de uso del LogsView con sesiones
 * @param context - Contexto de extensión de VSCode
 */
export function runLogsViewExample(context: vscode.ExtensionContext): void {
    // Crear una instancia de LogsView
    const logsView = new AgentLogsView(context);
    
    // Mostrar la vista
    logsView.show();
    
    // Crear algunas entradas de log en la sesión por defecto
    logsView.addStepLog(
        'Analizando código fuente',
        'analyzeCode',
        { filePath: 'src/example.ts' },
        { issues: ['Posible error de null pointer en línea 42'] },
        true
    );
    
    logsView.addReflectionLog('El código parece tener problemas en la validación de datos de entrada.');
    
    // Crear una nueva sesión para otro agente
    const session2Id = logsView.createNewSession('Generador de Tests');
    
    // Agregar logs a la segunda sesión
    logsView.addStepLog(
        'Generando casos de test',
        'generateTests',
        { filePath: 'src/example.ts', coverage: 'high' },
        { generatedTests: 'src/example.test.ts' },
        true,
        session2Id
    );
    
    // Crear una tercera sesión
    const session3Id = logsView.createNewSession('Reparador de Errores');
    
    // Agregar un plan y pasos a la tercera sesión
    const plan = [
        {
            description: 'Identificar error de compilación',
            tool: 'analyzeError',
            params: { error: 'TS2532: Object is possibly \'undefined\'.' }
        },
        {
            description: 'Corregir validación de nulos',
            tool: 'fixCode',
            params: { filePath: 'src/example.ts', lineNumber: 42 }
        },
        {
            description: 'Verificar corrección',
            tool: 'validateFix',
            params: { filePath: 'src/example.ts' }
        }
    ];
    
    // Agregar información de ejemplo sobre el modelo y tokens
    const exampleModelInfo = {
        name: 'gpt-4.1-mini',
        taskType: 'planning'
    };
    
    const exampleTokenCount = {
        prompt: 450,
        completion: 120,
        total: 570
    };
    
    const exampleRules = [
        'Usar validación estricta de tipos',
        'Evitar nulos sin verificación',
        'Seguir patrones de código del proyecto'
    ];
    
    logsView.addPlanLog(plan, session3Id, exampleModelInfo, exampleRules, exampleTokenCount);
    
    // Simular ejecución de los pasos del plan
    setTimeout(() => {
        logsView.addStepLog(
            'Identificar error de compilación',
            'analyzeError',
            { error: 'TS2532: Object is possibly \'undefined\'.' },
            { location: { file: 'src/example.ts', line: 42 }, suggestion: 'Agregar validación de nulos' },
            true,
            session3Id
        );
    }, 1000);
    
    setTimeout(() => {
        logsView.addStepLog(
            'Corregir validación de nulos',
            'fixCode',
            { filePath: 'src/example.ts', lineNumber: 42 },
            { 
                changes: 'Added null check: if (data && data.user) { ... }',
                success: true
            },
            true,
            session3Id
        );
    }, 2000);
    
    setTimeout(() => {
        logsView.addStepLog(
            'Verificar corrección',
            'validateFix',
            { filePath: 'src/example.ts' },
            { 
                compilationSuccess: true,
                message: 'El error ha sido corregido correctamente' 
            },
            true,
            session3Id
        );
        
        logsView.addReflectionLog(
            'La corrección fue exitosa. Se agregó una validación de nulos para prevenir errores en tiempo de ejecución.',
            session3Id
        );
    }, 3000);
    
    // Volver a la sesión original después de un tiempo
    setTimeout(() => {
        logsView.setActiveSession(session2Id);
    }, 4000);
}

/**
 * Ejemplo de integración con un agente real
 * @param agent - Instancia del agente
 * @param logsView - Instancia de LogsView
 * @returns ID de la sesión creada para el agente
 */
export function setupAgentLogging(agent: any, logsView: AgentLogsView): string {
    // Crear una nueva sesión para este agente
    const sessionId = logsView.createNewSession(agent.name || 'Agente');
    
    // Mostrar la vista
    logsView.show();
    
    // Definir hooks para capturar eventos del agente
    agent.onPlan((plan: any[]) => {
        logsView.addPlanLog(
            plan, 
            sessionId,
            agent.lastModelInfo || { name: 'unknown', taskType: 'unknown' },
            agent.lastAppliedRules || [],
            agent.lastTokenCount || { prompt: 0, completion: 0, total: 0 }
        );
    });
    
    agent.onStep((description: string, tool: string, params: any, result: any, success: boolean) => {
        logsView.addStepLog(description, tool, params, result, success, sessionId);
    });
    
    agent.onReflection((reflection: string) => {
        logsView.addReflectionLog(reflection, sessionId);
    });
    
    return sessionId;
}

// Interfaz para extender los agentes con propiedades de logging
interface LoggableAgent {
    name: string;
    logsSessionId?: string;
    lastModelInfo?: { name: string; taskType?: string };
    lastAppliedRules?: string[];
    lastTokenCount?: { prompt: number; completion: number; total: number };
    onPlan: (callback: (plan: any[]) => void) => void;
    onStep: (callback: (description: string, tool: string, params: any, result: any, success: boolean) => void) => void;
    onReflection: (callback: (reflection: string) => void) => void;
}

/**
 * Ejemplo de uso en la extensión principal
 */
export function exampleMainUsage(context: vscode.ExtensionContext): void {
    // Esta función simula lo que se haría en extension.ts
    
    // Crear una instancia global de LogsView
    const globalLogsView = new AgentLogsView(context);
    
    // Guardarla en el contexto global para acceso desde cualquier parte
    (global as any).agentLogsView = globalLogsView;
    
    // Registrar comando para mostrar logs
    const disposable = vscode.commands.registerCommand('grec0ai.agent.showLogs', () => {
        globalLogsView.show();
    });
    
    context.subscriptions.push(disposable);
    
    // Ejemplo de cómo usar la vista al crear múltiples agentes
    const mockAgent1: LoggableAgent = { 
        name: 'TestGenerator',
        lastModelInfo: { name: 'gpt-4.1-mini', taskType: 'codegen' },
        lastAppliedRules: ['Usar assertions específicas', 'Incluir casos de error'],
        lastTokenCount: { prompt: 320, completion: 150, total: 470 },
        onPlan: () => {},
        onStep: () => {},
        onReflection: () => {}
    };
    const mockAgent2: LoggableAgent = { 
        name: 'CodeFixer',
        lastModelInfo: { name: 'gpt-4.1-mini', taskType: 'analysis' },
        lastAppliedRules: ['Evitar side effects', 'Mantener compatibilidad API'],
        lastTokenCount: { prompt: 280, completion: 90, total: 370 },
        onPlan: () => {},
        onStep: () => {},
        onReflection: () => {}
    };
    
    // Configurar logging para cada agente
    const agent1SessionId = setupAgentLogging(mockAgent1, globalLogsView);
    const agent2SessionId = setupAgentLogging(mockAgent2, globalLogsView);
    
    // Los agentes pueden guardar su sessionId para usarlo después
    mockAgent1.logsSessionId = agent1SessionId;
    mockAgent2.logsSessionId = agent2SessionId;
    
    // Ahora los agentes pueden agregar logs a su sesión
    // mockAgent1.executeTask().then(() => {
    //     globalLogsView.addReflectionLog('Tarea completada con éxito', mockAgent1.logsSessionId);
    // });
} 