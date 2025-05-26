import * as vscode from 'vscode';

export interface CommandHandler {
    (): Promise<void> | void;
}

export interface CommandWithArgsHandler<T = any> {
    (args: T): Promise<void> | void;
}

export interface CommandRegistration {
    commandId: string;
    handler: CommandHandler | CommandWithArgsHandler;
}

export interface CommandCategory {
    name: string;
    commands: CommandRegistration[];
}

export type CommandDisposable = vscode.Disposable; 