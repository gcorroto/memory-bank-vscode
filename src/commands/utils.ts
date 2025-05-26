import * as vscode from 'vscode';
import { CommandHandler, CommandWithArgsHandler, CommandRegistration, CommandDisposable } from './types';

export function registerCommand(commandId: string, handler: CommandHandler | CommandWithArgsHandler): CommandDisposable {
    return vscode.commands.registerCommand(commandId, handler);
}

export function registerCommands(commands: CommandRegistration[]): CommandDisposable[] {
    return commands.map(cmd => registerCommand(cmd.commandId, cmd.handler));
}

export function createCommandRegistration(commandId: string, handler: CommandHandler | CommandWithArgsHandler): CommandRegistration {
    return { commandId, handler };
}

export function showErrorMessage(message: string): void {
    vscode.window.showErrorMessage(message);
}

export function showInformationMessage(message: string): void {
    vscode.window.showInformationMessage(message);
}

export function showWarningMessage(message: string): void {
    vscode.window.showWarningMessage(message);
} 