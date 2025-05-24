/**
 * Grec0AI Agent System
 * Main entry point for the agent architecture
 */

const Agent = require('./core/Agent');
const AgentToolManager = require('./core/AgentToolManager');
const ContextManager = require('./core/ContextManager');
const WorkspaceManager = require('./core/WorkspaceManager');
const DatabaseManager = require('./core/DatabaseManager');

// Export the Agent classes
module.exports = {
    Agent,
    AgentToolManager,
    ContextManager,
    WorkspaceManager,
    DatabaseManager,
    
    /**
     * Create and initialize the main agent
     * @param {string} name - Name of the agent
     * @param {vscode.ExtensionContext} context - VSCode extension context
     * @returns {Promise<Agent>} - Initialized agent instance
     */
    createAgent: async function(name, context) {
        const agent = new Agent(name, context);
        
        // Initialize the agent
        const initialized = await agent.initialize();
        
        if (!initialized) {
            throw new Error(`Failed to initialize agent: ${name}`);
        }
        
        return agent;
    },
    
    /**
     * Create a command wrapper for the agent 
     * This facilitates using agent functionality in existing command handlers
     * @param {Agent} agent - The agent instance
     * @param {string} taskType - Type of task for the agent to perform
     * @returns {Function} - Command handler function
     */
    createCommandWrapper: function(agent, taskType) {
        return async function(...args) {
            // Package arguments into context
            const context = {
                taskType,
                arguments: args,
                timestamp: new Date()
            };
            
            // Stringify user request based on task type
            let userRequest;
            
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
};