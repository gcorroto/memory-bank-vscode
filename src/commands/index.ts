import * as vscode from 'vscode';
import { CommandDisposable } from './types';
import { registerCommands } from './utils';
import { agentCommands } from './categories/agent';
import { filesystemCommands } from './categories/filesystem';
import { coverageCommands } from './categories/coverage';
import { ragCommands } from './categories/rag';
import { uiCommands } from './categories/ui';

export function registerAllCommands(): CommandDisposable[] {
    const allCommands = [
        ...agentCommands,
        ...filesystemCommands,
        ...coverageCommands,
        ...ragCommands,
        ...uiCommands
    ];

    return registerCommands(allCommands);
}

export * from './types';
export * from './utils';
export * from './categories/agent';
export * from './categories/filesystem';
export * from './categories/coverage';
export * from './categories/rag';
export * from './categories/ui'; 