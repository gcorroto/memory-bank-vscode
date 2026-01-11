import * as vscode from 'vscode';
import { CommandRegistration } from '../types';
import { createCommandRegistration } from '../utils';

export const filesystemCommands: CommandRegistration[] = [
    createCommandRegistration('memorybank.runAutofixer', async () => {
        try {
            // Importar la función checkAndProcessAutofixerMd desde extension.ts
            // Aquí estamos usando require para evitar problemas de importación circular
            const extension = require('../../extension');
            if (typeof extension.checkAndProcessAutofixerMd !== 'function') {
                throw new Error('checkAndProcessAutofixerMd function not found in extension');
            }

            // Llamar a la función con forceProcess=true para forzar el procesamiento
            const result = await extension.checkAndProcessAutofixerMd(true);
            
            if (result.processed) {
                vscode.window.showInformationMessage('Autofixer.md procesado correctamente');
            } else if (result.found) {
                vscode.window.showErrorMessage(`Error al procesar autofixer.md: ${result.error || 'Error desconocido'}`);
            } else {
                vscode.window.showWarningMessage('No se encontró el archivo autofixer.md en el workspace');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error al ejecutar runAutofixer: ${error}`);
        }
    }),

    createCommandRegistration('memorybank.filesystem.refresh', async () => {
        try {
            // Implementar lógica de refresh
            vscode.window.showInformationMessage('File system refreshed');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh file system: ${error}`);
        }
    }),

    createCommandRegistration('memorybank.filesystem.showFileDetails', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const document = editor.document;
            const filePath = document.uri.fsPath;
            const fileStats = await vscode.workspace.fs.stat(document.uri);

            vscode.window.showInformationMessage(
                `File: ${filePath}\n` +
                `Size: ${fileStats.size} bytes\n` +
                `Last Modified: ${new Date(fileStats.mtime).toLocaleString()}`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show file details: ${error}`);
        }
    }),

    createCommandRegistration('memorybank.filesystem.openFileAtLine', async () => {
        try {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter file path and line number (e.g., src/file.ts:42)',
                placeHolder: 'path/to/file:line'
            });

            if (!input) return;

            const [filePath, lineStr] = input.split(':');
            const line = parseInt(lineStr, 10);

            if (isNaN(line)) {
                vscode.window.showErrorMessage('Invalid line number');
                return;
            }

            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            const position = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    })
]; 