/**
 * AgentToolManager
 * Manages the registration, selection, and execution of tools
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Agent } from './Agent';
import { ReadFileTool } from '../tools/ReadFileTool';
import { WriteFileTool } from '../tools/WriteFileTool';
import { FixErrorTool } from '../tools/FixErrorTool';
import { GenerateTestTool } from '../tools/GenerateTestTool';
import { AnalyzeCodeTool } from '../tools/AnalyzeCodeTool';
import { ExecuteCommandTool } from '../tools/ExecuteCommandTool';
import { FindFileTool } from '../tools/FindFileTool';

export interface Tool {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
    run: (params: any) => Promise<any>;
}

export class AgentToolManager {
    private agent: Agent;
    private logger: vscode.OutputChannel;
    private tools: Map<string, Tool>;
    private initialized: boolean;

    /**
     * Initialize the Tool Manager
     * @param agent - The parent agent instance
     */
    constructor(agent: Agent) {
        this.agent = agent;
        this.logger = agent.getLogger();
        this.tools = new Map();
        this.initialized = false;
    }

    /**
     * Initialize the tool manager
     * @returns True if initialization was successful
     */
    async initialize(): Promise<boolean> {
        try {
            this.logger.appendLine("Initializing Agent Tool Manager");
            
            // Load default tools
            await this.registerDefaultTools();
            
            this.initialized = true;
            this.logger.appendLine(`Tool Manager initialized with ${this.tools.size} tools`);
            return true;
        } catch (error: any) {
            this.logger.appendLine(`Error initializing Tool Manager: ${error.message}`);
            return false;
        }
    }

    /**
     * Register a tool with the manager
     * @param tool - Tool instance
     * @returns True if registration was successful
     */
    registerTool(tool: Tool): boolean {
        try {
            if (!tool || !tool.name || !tool.run || typeof tool.run !== 'function') {
                this.logger.appendLine(`Invalid tool provided: ${tool && tool.name ? tool.name : 'unnamed'}`);
                return false;
            }
            
            if (this.tools.has(tool.name)) {
                this.logger.appendLine(`Tool ${tool.name} already registered, overwriting`);
            }
            
            this.tools.set(tool.name, tool);
            this.logger.appendLine(`Registered tool: ${tool.name}`);
            return true;
        } catch (error: any) {
            this.logger.appendLine(`Error registering tool ${tool && tool.name}: ${error.message}`);
            return false;
        }
    }

    /**
     * Load and register the default set of tools
     * @returns Promise that resolves when tools are registered
     */
    async registerDefaultTools(): Promise<void> {
        try {
            this.logger.appendLine("Registering default tools");
            
            // Crear e instanciar directamente cada herramienta
            const tools = [
                new ReadFileTool(this.agent),
                new WriteFileTool(this.agent),
                new ExecuteCommandTool(this.agent),
                new GenerateTestTool(this.agent),
                new FixErrorTool(this.agent),
                new AnalyzeCodeTool(this.agent),
                new FindFileTool(this.agent) // <-- Añadido aquí
            ];
            
            // Registrar cada herramienta
            for (const tool of tools) {
                this.registerTool(tool);
            }
            
            this.logger.appendLine(`Registered ${tools.length} default tools`);
        } catch (error: any) {
            this.logger.appendLine(`Error registering default tools: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a tool by name
     * @param toolName - Name of the tool to get
     * @returns The tool instance or null if not found
     */
    selectTool(toolName: string): Tool | null {
        if (!toolName) {
            this.logger.appendLine('No tool name provided');
            return null;
        }
        
        const tool = this.tools.get(toolName);
        
        if (!tool) {
            this.logger.appendLine(`Tool not found: ${toolName}`);
            return null;
        }
        
        return tool;
    }

    /**
     * Execute a tool with parameters
     * @param toolName - Name of the tool to execute
     * @param params - Parameters for the tool
     * @returns Result of the tool execution
     */
    async executeTool(toolName: string, params: any): Promise<any> {
        const tool = this.selectTool(toolName);
        
        if (!tool) {
            throw new Error(`Tool not found: ${toolName}`);
        }
        
        try {
            this.logger.appendLine(`Executing tool: ${toolName}`);
            const result = await tool.run(params);
            this.logger.appendLine(`Tool ${toolName} executed successfully`);
            return result;
        } catch (error: any) {
            this.logger.appendLine(`Error executing tool ${toolName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a list of all available tools with descriptions
     * @returns List of tool metadata
     */
    getAvailableTools(): Array<{name: string, description: string, parameters: Record<string, any>}> {
        const toolList: Array<{name: string, description: string, parameters: Record<string, any>}> = [];
        
        this.tools.forEach(tool => {
            toolList.push({
                name: tool.name,
                description: tool.description || 'No description provided',
                parameters: tool.parameters || {}
            });
        });
        
        return toolList;
    }

    /**
     * Get information about a specific tool
     * @param toolName - Name of the tool
     * @returns Tool metadata or null if not found
     */
    getToolInfo(toolName: string): {name: string, description: string, parameters: Record<string, any>} | null {
        const tool = this.tools.get(toolName);
        
        if (!tool) {
            return null;
        }
        
        return {
            name: tool.name,
            description: tool.description || 'No description provided',
            parameters: tool.parameters || {}
        };
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // Clean up resources if needed
        this.tools.clear();
    }
}