/**
 * BaseTool
 * Base class for all agent tools
 */

import * as vscode from 'vscode';
import { Agent } from '../core/Agent';
import * as path from 'path';
import * as fs from 'fs';

export interface ToolParameter {
    type: string;
    description: string;
    required: boolean;
    default?: any;
}

export interface ToolParameters {
    [key: string]: ToolParameter;
}

export abstract class BaseTool {
    protected agent: Agent;
    protected logger: vscode.OutputChannel;
    name: string;
    description: string;
    parameters: ToolParameters;

    /**
     * Initialize a new Tool instance
     * @param agent - The parent agent instance
     */
    constructor(agent: Agent) {
        this.agent = agent;
        this.logger = agent.getLogger();
        this.name = this.constructor.name;
        this.description = '';
        this.parameters = {};
    }

    /**
     * Run the tool with the provided parameters
     * @param params - Parameters for the tool
     * @returns Result of the tool execution
     */
    async run(params: Record<string, any>): Promise<any> {
        try {
            this.logger.appendLine(`Running tool: ${this.name}`);
            
            // Log tool parameters (without sensitive information)
            const safeParams = this.sanitizeParams(params);
            this.logger.appendLine(`Parameters: ${JSON.stringify(safeParams)}`);

            // Log current working directory for debugging
            this.logger.appendLine(`Current working directory: ${process.cwd()}`);
            
            // Register event start
            await this.registerEvent('tool_start', {
                tool: this.name,
                params: safeParams
            });
            
            // Validate parameters
            this.validateParams(params);
            
            // Execute the tool implementation
            const result = await this.run_impl(params);
            
            // Log success and register success event
            this.logger.appendLine(`Tool ${this.name} executed successfully`);
            await this.registerEvent('tool_success', {
                tool: this.name,
                params: safeParams,
                result: this.sanitizeResult(result)
            }, true);
            
            return result;
        } catch (error: any) {
            // Log failure and register failure event
            this.logger.appendLine(`Tool ${this.name} execution failed: ${error.message}`);
            await this.registerEvent('tool_error', {
                tool: this.name,
                error: error.message,
                stack: error.stack
            }, false);
            
            throw error;
        }
    }

    /**
     * Actual implementation of the tool (to be overridden by subclasses)
     * @param params - Parameters for the tool
     * @returns Result of the tool execution
     */
    protected abstract run_impl(params: Record<string, any>): Promise<any>;

    /**
     * Register an event in the database
     * @param type - Event type
     * @param data - Event data
     * @param success - Whether the event was successful
     */
    protected async registerEvent(type: string, data: any, success: boolean = true): Promise<void> {
        try {
            if (this.agent.databaseManager) {
                await this.agent.databaseManager.saveEvent({
                    type,
                    ...data,
                    success,
                    timestamp: new Date()
                });
                
                // También agregamos al logsView para visualización inmediata
                if (type === 'tool_start') {
                    // No hacemos nada aquí, se manejará en el LogsView
                } else if (type === 'tool_success' || type === 'tool_error') {
                    this.agent.logsView?.addStepLog(
                        data.description || `Executing ${this.name}`,
                        this.name,
                        data.params || {},
                        data.result || (type === 'tool_error' ? { error: data.error } : {}),
                        success
                    );
                }
            }
        } catch (error: any) {
            this.logger.appendLine(`Error registering event: ${error.message}`);
        }
    }

    /**
     * Normalize a file path to an absolute path
     * @param filePath - File path (relative or absolute)
     * @returns Absolute file path
     */
    protected normalizePath(filePath: string): string {
        if (!filePath) {
            throw new Error('No file path provided');
        }
        
        // Si ya es absoluto, lo devolvemos tal cual
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        
        // Intentamos primero en el workspace del usuario
        try {
            const userWorkspacePath = this.agent.workspaceManager.getUserWorkspacePath();
            if (userWorkspacePath) {
                const userWorkspaceFilePath = path.join(userWorkspacePath, filePath);
                this.logger.appendLine(`Checking if file exists in user workspace: ${userWorkspaceFilePath}`);
                
                if (fs.existsSync(userWorkspaceFilePath)) {
                    this.logger.appendLine(`File found in user workspace: ${userWorkspaceFilePath}`);
                    return userWorkspaceFilePath;
                }
            }
        } catch (error: any) {
            this.logger.appendLine(`Error checking user workspace: ${error.message}`);
        }
        
        // Si no se encuentra en el workspace del usuario, intentamos en el directorio actual
        try {
            const cwdFilePath = path.resolve(process.cwd(), filePath);
            this.logger.appendLine(`Checking if file exists in current directory: ${cwdFilePath}`);
            
            if (fs.existsSync(cwdFilePath)) {
                this.logger.appendLine(`File found in current directory: ${cwdFilePath}`);
                return cwdFilePath;
            }
        } catch (error: any) {
            this.logger.appendLine(`Error checking current directory: ${error.message}`);
        }
        
        // Como último recurso, usamos la ruta principal (puede ser usuario o agente)
        try {
            // Usamos el método getPrimaryWorkspacePath que decide el mejor workspace
            const workspacePath = this.agent.workspaceManager.getPrimaryWorkspacePath();
            const normalizedPath = path.join(workspacePath, filePath);
            this.logger.appendLine(`Using primary workspace path: ${filePath} -> ${normalizedPath}`);
            return normalizedPath;
        } catch (error: any) {
            this.logger.appendLine(`Error normalizing to primary workspace: ${error.message}`);
            // Fallback a CWD si falla todo lo anterior
            return path.resolve(process.cwd(), filePath);
        }
    }

    /**
     * Check if a file exists with proper error handling
     * @param filePath - Path to check
     * @returns True if file exists
     */
    protected fileExists(filePath: string): boolean {
        try {
            const normalizedPath = this.normalizePath(filePath);
            this.logger.appendLine(`Checking if file exists: ${normalizedPath}`);
            return fs.existsSync(normalizedPath);
        } catch (error: any) {
            this.logger.appendLine(`Error checking if file exists: ${error.message}`);
            return false;
        }
    }

    /**
     * Sanitize the result for logging and event recording
     * @param result - Result to sanitize
     * @returns Sanitized result
     */
    protected sanitizeResult(result: any): any {
        // Implementación básica, se puede mejorar
        if (!result) {
            return {};
        }
        
        // Si es string muy largo, lo truncamos
        if (typeof result === 'string' && result.length > 1000) {
            return result.substring(0, 1000) + '... [truncated]';
        }
        
        // Si es un objeto con propiedades grandes, las truncamos
        if (typeof result === 'object') {
            const sanitized: Record<string, any> = {};
            
            for (const [key, value] of Object.entries(result)) {
                if (typeof value === 'string' && value.length > 1000) {
                    sanitized[key] = value.substring(0, 1000) + '... [truncated]';
                } else {
                    sanitized[key] = value;
                }
            }
            
            return sanitized;
        }
        
        return result;
    }

    /**
     * Validate the parameters for the tool
     * @param params - Parameters to validate
     * @throws Error if parameters are invalid
     */
    protected validateParams(params: Record<string, any>): void {
        // Basic validation - check for required parameters
        if (!params) {
            throw new Error('No parameters provided');
        }
        
        // Normalize parameters (handle common variations)
        this.normalizeParams(params);
        
        // Check for required parameters (defined in this.parameters)
        for (const [paramName, paramDef] of Object.entries(this.parameters)) {
            if (paramDef.required && (params[paramName] === undefined || params[paramName] === null)) {
                throw new Error(`Required parameter '${paramName}' is missing`);
            }
        }
    }

    /**
     * Normalize parameters to handle common variations and apply defaults
     * @param params - Parameters to normalize
     */
    protected normalizeParams(params: Record<string, any>): void {
        // Handle common parameter name variations
        const commonVariations: Record<string, string[]> = {
            'filePath': ['filepath', 'file_path', 'path'],
            'sourcePath': ['source_path', 'sourcepath', 'path', 'file'],
            'content': ['code', 'text', 'data'],
            'command': ['cmd', 'exec', 'script']
        };
        
        // Apply parameter variations
        for (const [standardName, variations] of Object.entries(commonVariations)) {
            // If the standard parameter is already defined, skip
            if (params[standardName] !== undefined) {
                continue;
            }
            
            // Check if any variation is present and use its value
            for (const variation of variations) {
                if (params[variation] !== undefined) {
                    params[standardName] = params[variation];
                    this.logger.appendLine(`Normalized parameter ${variation} to ${standardName}`);
                    break;
                }
            }
        }
        
        // Apply default values for missing parameters
        for (const [paramName, paramDef] of Object.entries(this.parameters)) {
            if (params[paramName] === undefined && paramDef.default !== undefined) {
                params[paramName] = paramDef.default;
                this.logger.appendLine(`Applied default value for parameter ${paramName}`);
            }
        }
    }

    /**
     * Remove sensitive information from parameters for logging
     * @param params - Original parameters
     * @returns Sanitized parameters safe for logging
     */
    protected sanitizeParams(params: Record<string, any>): Record<string, any> {
        if (!params) {
            return {};
        }
        
        const safeParams = { ...params };
        
        // List of parameter names that might contain sensitive info
        const sensitiveParams = [
            'password', 'token', 'apiKey', 'secret', 'credential', 
            'api_key', 'auth_token', 'key'
        ];
        
        // Replace sensitive values with asterisks
        for (const [key, value] of Object.entries(safeParams)) {
            if (sensitiveParams.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
                safeParams[key] = '********';
            }
        }
        
        return safeParams;
    }

    /**
     * Get the metadata for this tool
     * @returns Tool metadata
     */
    getMetadata(): {name: string, description: string, parameters: ToolParameters} {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
} 