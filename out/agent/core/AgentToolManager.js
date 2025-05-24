/**
 * AgentToolManager
 * Manages the registration, selection, and execution of tools
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class AgentToolManager {
    /**
     * Initialize the Tool Manager
     * @param {Object} agent - The parent agent instance
     */
    constructor(agent) {
        this.agent = agent;
        this.logger = agent.getLogger();
        this.tools = new Map();
        this.initialized = false;
    }

    /**
     * Initialize the tool manager
     * @returns {Promise<boolean>} - True if initialization was successful
     */
    async initialize() {
        try {
            this.logger.appendLine("Initializing Agent Tool Manager");
            
            // Load default tools
            await this.registerDefaultTools();
            
            this.initialized = true;
            this.logger.appendLine(`Tool Manager initialized with ${this.tools.size} tools`);
            return true;
        } catch (error) {
            this.logger.appendLine(`Error initializing Tool Manager: ${error.message}`);
            return false;
        }
    }

    /**
     * Register a tool with the manager
     * @param {Object} tool - Tool instance
     * @returns {boolean} - True if registration was successful
     */
    registerTool(tool) {
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
        } catch (error) {
            this.logger.appendLine(`Error registering tool ${tool && tool.name}: ${error.message}`);
            return false;
        }
    }

    /**
     * Load and register the default set of tools
     * @returns {Promise<void>}
     */
    async registerDefaultTools() {
        try {
            // Define the list of default tools
            const defaultTools = [
                'ReadFileTool',
                'WriteFileTool',
                'ExecuteCommandTool',
                'GenerateTestTool',
                'FixErrorTool',
                'AnalyzeCodeTool'
            ];
            
            // Import and register each tool
            for (const toolName of defaultTools) {
                try {
                    const toolPath = `../tools/${toolName}`;
                    const ToolClass = require(toolPath);
                    
                    // Create a new instance and register it
                    const tool = new ToolClass(this.agent);
                    this.registerTool(tool);
                } catch (toolError) {
                    this.logger.appendLine(`Error loading tool ${toolName}: ${toolError.message}`);
                    // Continue with other tools if one fails
                }
            }
        } catch (error) {
            this.logger.appendLine(`Error registering default tools: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a tool by name
     * @param {string} toolName - Name of the tool to get
     * @returns {Object|null} - The tool instance or null if not found
     */
    selectTool(toolName) {
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
     * @param {string} toolName - Name of the tool to execute
     * @param {Object} params - Parameters for the tool
     * @returns {Promise<Object>} - Result of the tool execution
     */
    async executeTool(toolName, params) {
        const tool = this.selectTool(toolName);
        
        if (!tool) {
            throw new Error(`Tool not found: ${toolName}`);
        }
        
        try {
            this.logger.appendLine(`Executing tool: ${toolName}`);
            const result = await tool.run(params);
            this.logger.appendLine(`Tool ${toolName} executed successfully`);
            return result;
        } catch (error) {
            this.logger.appendLine(`Error executing tool ${toolName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a list of all available tools with descriptions
     * @returns {Array<Object>} - List of tool metadata
     */
    getAvailableTools() {
        const toolList = [];
        
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
     * @param {string} toolName - Name of the tool
     * @returns {Object|null} - Tool metadata or null if not found
     */
    getToolInfo(toolName) {
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
}

module.exports = AgentToolManager;