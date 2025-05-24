/**
 * BaseTool
 * Base class for all agent tools
 */

import * as vscode from 'vscode';
import { Agent } from '../core/Agent';

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
            
            // Validate parameters
            this.validateParams(params);
            
            // Execute the tool implementation
            const result = await this.run_impl(params);
            
            // Log success
            this.logger.appendLine(`Tool ${this.name} executed successfully`);
            return result;
        } catch (error: any) {
            // Log failure
            this.logger.appendLine(`Tool ${this.name} execution failed: ${error.message}`);
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
     * Validate the parameters for the tool
     * @param params - Parameters to validate
     * @throws Error if parameters are invalid
     */
    protected validateParams(params: Record<string, any>): void {
        // Basic validation - check for required parameters
        if (!params) {
            throw new Error('No parameters provided');
        }
        
        // Check for required parameters (defined in this.parameters)
        for (const [paramName, paramDef] of Object.entries(this.parameters)) {
            if (paramDef.required && (params[paramName] === undefined || params[paramName] === null)) {
                throw new Error(`Required parameter '${paramName}' is missing`);
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