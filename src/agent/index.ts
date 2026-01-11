/**
 * Memory Bank Agent System
 * Main entry point for the agent architecture
 */

import * as vscode from 'vscode';
import { Agent } from './core/Agent';
import { AgentToolManager } from './core/AgentToolManager';
import { ContextManager } from './core/ContextManager';
import { WorkspaceManager } from './core/WorkspaceManager';
import { DatabaseManager } from './core/DatabaseManager';

// Import all tools
import { BaseTool } from './tools/BaseTool';
import { ReadFileTool } from './tools/ReadFileTool';
import { WriteFileTool } from './tools/WriteFileTool';
import { FixErrorTool } from './tools/FixErrorTool';
import { GenerateTestTool } from './tools/GenerateTestTool';
import { AnalyzeCodeTool } from './tools/AnalyzeCodeTool';
import { ExecuteCommandTool } from './tools/ExecuteCommandTool';

// Export the Agent classes
export {
    Agent,
    AgentToolManager,
    ContextManager,
    WorkspaceManager,
    DatabaseManager
};

// Export all tools
export {
    BaseTool,
    ReadFileTool,
    WriteFileTool,
    FixErrorTool,
    GenerateTestTool,
    AnalyzeCodeTool,
    ExecuteCommandTool
};
    
/**
 * Create and initialize the main agent
 * @param name - Name of the agent
 * @param context - VSCode extension context
 * @returns Initialized agent instance
 */
export async function createAgent(name: string, context: vscode.ExtensionContext): Promise<Agent> {
    const agent = new Agent(name, context);
    
    // Initialize the agent
    const initialized = await agent.initialize();
    
    if (!initialized) {
        throw new Error(`Failed to initialize agent: ${name}`);
    }
    
    return agent;
}

/**
 * Create a command wrapper for the agent 
 * This facilitates using agent functionality in existing command handlers
 * @param agent - The agent instance
 * @param taskType - Type of task for the agent to perform
 * @returns Command handler function
 */
export function createCommandWrapper(agent: Agent, taskType: string): (...args: any[]) => Promise<any> {
    return async function(...args: any[]): Promise<any> {
        // Package arguments into context
        const context = {
            taskType,
            arguments: args,
            timestamp: new Date()
        };
        
        // Stringify user request based on task type
        let userRequest: string;
        
        switch (taskType) {
            case 'generateTest':
                userRequest = `Generate a test for the file ${args[0] || 'selected'} using ${args[1] || 'default'} framework`;
                break;
            case 'analyzeCode':
                userRequest = `Analyze the code in ${args[0] || 'selected file'} for issues and suggest improvements`;
                break;
            case 'fixError':
                userRequest = `Fix the error "${args[1] || 'unknown'}" in file ${args[0] || 'selected'}`;
                break;
            case 'explain':
                userRequest = `Explain how the code works in ${args[0] || 'selected'} file`;
                break;
            default:
                userRequest = `Perform ${taskType} task with args: ${JSON.stringify(args)}`;
        }
        
        // Let the agent handle the request
        return agent.handleUserInput(userRequest, context);
    };
} 