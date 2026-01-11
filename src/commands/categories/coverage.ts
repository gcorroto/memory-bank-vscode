import * as vscode from 'vscode';
import { CommandRegistration } from '../types';
import { createCommandRegistration } from '../utils';

// Memory Bank commands (replacing old coverage commands)
// Note: Main Memory Bank commands are registered in extension.ts
// This file is kept for compatibility but commands are now minimal

export const coverageCommands: CommandRegistration[] = [
    // Empty - Memory Bank commands are registered directly in extension.ts
    // This array is kept for backwards compatibility with the command registration system
];
