/**
 * ExecuteCommandTool
 * Tool for executing shell commands
 */

import { exec } from 'child_process';
import { BaseTool } from './BaseTool';

interface CommandResult {
    stdout: string;
    stderr: string;
    command: string;
    exitCode: number;
}

export class ExecuteCommandTool extends BaseTool {
    constructor(agent: any) {
        super(agent);
        this.name = 'ExecuteCommandTool';
        this.description = 'Executes a shell command and returns the output';
        this.parameters = {
            command: {
                description: 'Command to execute',
                type: 'string',
                required: true
            },
            cwd: {
                description: 'Working directory for command execution',
                type: 'string',
                required: false
            },
            timeout: {
                description: 'Timeout in milliseconds',
                type: 'number',
                required: false,
                default: 30000 // 30 seconds
            },
            allowedCommands: {
                description: 'List of allowed command prefixes (for safety)',
                type: 'array',
                required: false,
                default: ['npm', 'node', 'ls', 'cat', 'echo', 'find', 'grep']
            }
        };
    }

    /**
     * Execute a shell command
     * @param params - Tool parameters
     * @returns - Command execution results
     */
    async run_impl(params: Record<string, any>): Promise<CommandResult> {
        const { command, cwd, timeout = 30000 } = params;
        
        // Security check
        this.validateCommand(command, params.allowedCommands);
        
        return new Promise<CommandResult>((resolve, reject) => {
            // Execute the command
            const process = exec(command, {
                cwd: cwd || undefined,
                timeout: timeout
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Command execution failed: ${error.message}`));
                    return;
                }
                
                resolve({
                    stdout: stdout.toString(),
                    stderr: stderr.toString(),
                    command: command,
                    exitCode: 0 // Since there was no error
                });
            });
            
            // Handle potential timeout
            process.on('timeout', () => {
                process.kill();
                reject(new Error(`Command timed out after ${timeout}ms`));
            });
        });
    }

    /**
     * Validate that the command is allowed (security check)
     * @param command - Command to validate
     * @param allowedCommands - List of allowed command prefixes
     * @throws Error if command is not allowed
     */
    validateCommand(command: string, allowedCommands: string[] = []): void {
        // Default allowed commands (safe operations)
        const defaultAllowedCommands = [
            'npm', 'node', 'ls', 'cat', 'echo', 'find', 'grep'
        ];
        
        // Combine with user-provided allowed commands
        const allAllowedCommands = [
            ...new Set([...defaultAllowedCommands, ...(allowedCommands || [])])
        ];
        
        // Check if the command starts with any of the allowed prefixes
        const isCommandAllowed = allAllowedCommands.some(allowed => {
            // Check if command starts with the allowed prefix
            // Ensure it's either the whole command or followed by a space or other delimiter
            const regex = new RegExp(`^${allowed}($|\\s|\\.|/)`);
            return regex.test(command.trim());
        });
        
        if (!isCommandAllowed) {
            throw new Error(`Command not allowed for security reasons: ${command}`);
        }
    }
} 