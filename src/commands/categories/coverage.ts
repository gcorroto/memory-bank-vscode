import * as vscode from 'vscode';
import { CommandRegistration } from '../types';
import { createCommandRegistration } from '../utils';

export const coverageCommands: CommandRegistration[] = [
    createCommandRegistration('grec0ai.coverage.refresh', async () => {
        try {
            // Implementar lógica de refresh de cobertura
            vscode.window.showInformationMessage('Coverage data refreshed');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh coverage: ${error}`);
        }
    }),

    createCommandRegistration('grec0ai.coverage.details.refresh', async () => {
        try {
            // Implementar lógica de refresh de detalles de cobertura
            vscode.window.showInformationMessage('Coverage details refreshed');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh coverage details: ${error}`);
        }
    })
]; 