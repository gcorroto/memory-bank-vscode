import * as vscode from 'vscode';
import { CommandRegistration } from '../types';
import { createCommandRegistration } from '../utils';
import { EventsViewer } from '../../agent/ui/EventsViewer';
import { FlowViewer } from '../../agent/ui/FlowViewer';
import { ConfigViewer } from '../../agent/ui/ConfigViewer';
import { DashboardViewer } from '../../agent/ui/DashboardViewer';
import { getGlobalAgent } from '../../extension';

// Variables para acceder a las instancias globales
let eventsViewer: EventsViewer | null = null;
let flowViewer: FlowViewer | null = null;
let configViewer: ConfigViewer | null = null;
let dashboardViewer: DashboardViewer | null = null;

// Función para obtener o crear la instancia de EventsViewer
function getEventsViewer(): EventsViewer | null {
    // Si ya existe una instancia global, usarla
    if ((global as any).eventsViewer) {
        return (global as any).eventsViewer;
    }
    
    // Si existe una instancia local, usarla
    if (eventsViewer) {
        return eventsViewer;
    }
    
    // No hay instancia disponible
    return null;
}

// Función para obtener o crear la instancia de FlowViewer
function getFlowViewer(context?: vscode.ExtensionContext): FlowViewer | null {
    if ((global as any).flowViewer) {
        return (global as any).flowViewer;
    }
    
    if (flowViewer) {
        return flowViewer;
    }
    
    // Crear nueva instancia si se proporciona contexto
    if (context) {
        flowViewer = new FlowViewer(context);
        (global as any).flowViewer = flowViewer;
        return flowViewer;
    }
    
    return null;
}

// Función para obtener o crear la instancia de ConfigViewer
function getConfigViewer(context?: vscode.ExtensionContext): ConfigViewer | null {
    if ((global as any).configViewer) {
        return (global as any).configViewer;
    }
    
    if (configViewer) {
        return configViewer;
    }
    
    // Crear nueva instancia si se proporciona contexto
    if (context) {
        configViewer = new ConfigViewer(context);
        (global as any).configViewer = configViewer;
        return configViewer;
    }
    
    return null;
}

// Función para obtener o crear la instancia de DashboardViewer
function getDashboardViewer(context?: vscode.ExtensionContext): DashboardViewer | null {
    if ((global as any).dashboardViewer) {
        return (global as any).dashboardViewer;
    }
    
    if (dashboardViewer) {
        return dashboardViewer;
    }
    
    // Crear nueva instancia si se proporciona contexto
    if (context) {
        const extensionUri = context.extensionUri;
        dashboardViewer = DashboardViewer.getInstance(extensionUri);
        (global as any).dashboardViewer = dashboardViewer;
        return dashboardViewer;
    }
    
    return null;
}

// Función para inicializar los viewers con el contexto
export function initializeViewers(context: vscode.ExtensionContext): void {
    getFlowViewer(context);
    getConfigViewer(context);
}

// Función para obtener el contexto de extensión desde el global
function getExtensionContext(): vscode.ExtensionContext | null {
    return (global as any).extensionContext || null;
}

export const uiCommands: CommandRegistration[] = [
    createCommandRegistration('memorybank.showEventsViewer', () => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.show();
        } else {
            vscode.window.showErrorMessage('No se puede mostrar el visor de eventos: No hay instancia disponible');
        }
    }),

    createCommandRegistration('memorybank.clearEvents', () => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.clearEvents();
            vscode.window.showInformationMessage('Eventos eliminados');
        } else {
            vscode.window.showErrorMessage('No se pueden eliminar los eventos: No hay instancia disponible');
        }
    }),

    createCommandRegistration('memorybank.showEventDetails', (eventId: string) => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.showEventDetails(eventId);
        } else {
            vscode.window.showErrorMessage('No se pueden mostrar detalles: No hay instancia disponible');
        }
    }),

    createCommandRegistration('memorybank.showChanges', (eventId: string) => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.showEventChanges(eventId);
        } else {
            vscode.window.showErrorMessage('No se pueden mostrar cambios: No hay instancia disponible');
        }
    }),

    createCommandRegistration('memorybank.toggleTerminal', () => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.toggleTerminalVisibility();
        } else {
            vscode.window.showErrorMessage('No se puede mostrar la terminal: No hay instancia disponible');
        }
    }),

    createCommandRegistration('memorybank.showFlowViewer', () => {
        const context = getExtensionContext();
        const viewer = getFlowViewer(context || undefined);
        if (viewer) {
            viewer.show();
        } else {
            vscode.window.showErrorMessage('No se puede mostrar el visualizador de flujos: No hay contexto disponible');
        }
    }),

    createCommandRegistration('memorybank.showConfigViewer', () => {
        const context = getExtensionContext();
        const viewer = getConfigViewer(context || undefined);
        if (viewer) {
            viewer.show();
        } else {
            vscode.window.showErrorMessage('No se puede mostrar el configurador: No hay contexto disponible');
        }
    }),

    createCommandRegistration('memorybank.showDashboard', () => {
        const context = getExtensionContext();
        const viewer = getDashboardViewer(context || undefined);
        const agent = getGlobalAgent(true);
        if (viewer) {
            try {
                viewer.show(agent || undefined, (agent as any)?.contextManager || undefined, context || undefined);
            } catch {
                // Fallback if types differ
                viewer.show();
            }
            vscode.window.showInformationMessage('Dashboard de Agente abierto');
        } else {
            vscode.window.showErrorMessage('No se puede mostrar el dashboard: No hay contexto disponible');
        }
    })
];
