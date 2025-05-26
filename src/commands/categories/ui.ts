import * as vscode from 'vscode';
import { CommandRegistration } from '../types';
import { createCommandRegistration } from '../utils';
import { EventsViewer } from '../../agent/ui/EventsViewer';

// Variable para acceder a la instancia global del EventsViewer
let eventsViewer: EventsViewer | null = null;

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
    
    // No hay instancia disponible y no podemos crear una sin contexto
    return null;
}

export const uiCommands: CommandRegistration[] = [
    createCommandRegistration('grec0ai.showEventsViewer', () => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.show();
        } else {
            vscode.window.showErrorMessage('No se puede mostrar el visor de eventos: No hay instancia disponible');
        }
    }),

    createCommandRegistration('grec0ai.clearEvents', () => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.clearEvents();
            vscode.window.showInformationMessage('Eventos eliminados');
        } else {
            vscode.window.showErrorMessage('No se pueden eliminar los eventos: No hay instancia disponible');
        }
    }),

    createCommandRegistration('grec0ai.showEventDetails', (eventId: string) => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.showEventDetails(eventId);
        } else {
            vscode.window.showErrorMessage('No se pueden mostrar detalles: No hay instancia disponible');
        }
    }),

    createCommandRegistration('grec0ai.showChanges', (eventId: string) => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.showEventChanges(eventId);
        } else {
            vscode.window.showErrorMessage('No se pueden mostrar cambios: No hay instancia disponible');
        }
    }),

    createCommandRegistration('grec0ai.toggleTerminal', () => {
        const viewer = getEventsViewer();
        if (viewer) {
            viewer.toggleTerminalVisibility();
        } else {
            vscode.window.showErrorMessage('No se puede mostrar la terminal: No hay instancia disponible');
        }
    })
]; 