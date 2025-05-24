/**
 * Core Agent Class
 * Orchestrates planning, reasoning, context management and tool execution
 */

const vscode = require('vscode');
const ContextManager = require('./ContextManager');
const AgentToolManager = require('./AgentToolManager');
const WorkspaceManager = require('./WorkspaceManager');
const DatabaseManager = require('./DatabaseManager');
const openaiService = require('../../services/openaiService');

class Agent {
    /**
     * Initialize a new Agent instance
     * @param {string} name - Name of the agent
     * @param {vscode.ExtensionContext} context - VSCode extension context
     */
    constructor(name, context) {
        this.name = name;
        this.context = context;
        this.logger = vscode.window.createOutputChannel(`Grec0AI Agent: ${name}`);
        this.contextManager = new ContextManager(this);
        this.toolManager = new AgentToolManager(this);
        this.workspaceManager = new WorkspaceManager(this);
        this.databaseManager = new DatabaseManager(this);
        this.llmClient = openaiService;
    }

    /**
     * Initialize the agent systems
     * @returns {Promise<boolean>} - True if initialization was successful
     */
    async initialize() {
        try {
            this.logger.appendLine(`Initializing agent: ${this.name}`);
            
            // Initialize services in order
            await this.workspaceManager.initialize();
            await this.databaseManager.initialize();
            
            // Initialize LLM client
            const llmInitialized = this.llmClient.initialize();
            
            if (!llmInitialized) {
                this.logger.appendLine("Failed to initialize LLM client");
                return false;
            }
            
            // Initialize tool manager and register tools
            await this.toolManager.initialize();
            
            this.logger.appendLine(`Agent ${this.name} initialized`);
            return true;
        } catch (error) {
            this.logger.appendLine(`Error initializing agent: ${error.message}`);
            return false;
        }
    }

    /**
     * Handle user input and execute the appropriate actions
     * @param {string} input - User input or request
     * @param {Object} context - Additional context (file, selection, etc.)
     * @returns {Promise<Object>} - The result of the operation
     */
    async handleUserInput(input, context = {}) {
        try {
            // 1. Update context with current input and session data
            this.contextManager.update(input, context);
            this.logger.appendLine(`Handling user input: "${input.substring(0, 100)}${input.length > 100 ? '...' : ''}"`);
            
            // 2. Plan task using LLM
            const plan = await this.planTask(input, context);
            
            // 3. Log the plan
            this.logger.appendLine("Generated plan:");
            plan.steps.forEach((step, index) => {
                this.logger.appendLine(`  ${index + 1}. ${step.description} [Tool: ${step.tool}]`);
            });
            
            // 4. Execute each step in the plan
            const results = [];
            let success = true;
            
            for (const step of plan.steps) {
                this.logger.appendLine(`Executing step: ${step.description}`);
                
                // Select and execute appropriate tool
                const tool = this.toolManager.selectTool(step.tool);
                
                if (!tool) {
                    this.logger.appendLine(`Warning: Tool '${step.tool}' not found`);
                    results.push({
                        success: false,
                        error: `Tool '${step.tool}' not found`,
                        step: step
                    });
                    success = false;
                    continue;
                }
                
                try {
                    const stepResult = await tool.run(step.params);
                    
                    // Add result to context
                    this.contextManager.addStepResult(step, stepResult);
                    results.push({
                        success: true,
                        result: stepResult,
                        step: step
                    });
                    
                    this.logger.appendLine(`Step completed: ${step.description}`);
                } catch (error) {
                    this.logger.appendLine(`Error executing step: ${error.message}`);
                    
                    // Add failure feedback to context
                    this.contextManager.addFeedback({
                        success: false,
                        error: error.message,
                        step: step
                    });
                    
                    results.push({
                        success: false,
                        error: error.message,
                        step: step
                    });
                    
                    // Optional: retry with modified instructions based on error
                    const shouldRetry = await this.shouldRetryStep(step, error);
                    
                    if (shouldRetry) {
                        const modifiedStep = await this.modifyStepAfterFailure(step, error);
                        this.logger.appendLine(`Retrying with modified step: ${modifiedStep.description}`);
                        
                        try {
                            const tool = this.toolManager.selectTool(modifiedStep.tool);
                            const retryResult = await tool.run(modifiedStep.params);
                            
                            this.contextManager.addStepResult(modifiedStep, retryResult);
                            results.push({
                                success: true,
                                result: retryResult,
                                step: modifiedStep,
                                wasRetry: true
                            });
                        } catch (retryError) {
                            this.logger.appendLine(`Retry failed: ${retryError.message}`);
                            success = false;
                        }
                    } else {
                        success = false;
                    }
                }
            }
            
            // 5. Final reflection on entire process
            const reflection = await this.reflectOnExecution(plan, results);
            
            // 6. Save the event and results to database
            await this.databaseManager.saveEvent({
                type: 'userRequest',
                input: input,
                plan: plan,
                results: results,
                reflection: reflection,
                timestamp: new Date(),
                success: success
            });
            
            // 7. Return aggregate result
            return {
                success: success,
                results: results,
                reflection: reflection
            };
        } catch (error) {
            this.logger.appendLine(`Error in handleUserInput: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Plan the execution of a task by breaking it into steps
     * @param {string} input - User input to plan for
     * @param {Object} context - Additional context
     * @returns {Promise<Object>} - The execution plan
     */
    async planTask(input, context) {
        this.logger.appendLine("Planning task...");
        
        try {
            // Get available tools from tool manager
            const availableTools = this.toolManager.getAvailableTools();
            
            // Create planning prompt for LLM
            const planningPrompt = `
You are a planning assistant for the Grec0AI Agent. Your task is to break down the user's request into a series of steps that can be executed by the agent.

User request: "${input}"

Current context:
File: ${context.filePath || 'None'}
Language: ${context.language || 'Unknown'}
Selected text: ${context.selection ? 'Yes (length: ' + context.selection.length + ')' : 'None'}

Available tools:
${availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Create a step-by-step plan to fulfill the user's request. For each step, specify:
1. A description of the step
2. The tool to use
3. Parameters for the tool

Respond in the following JSON format:
{
  "plan": {
    "steps": [
      {
        "description": "Step description",
        "tool": "ToolName",
        "params": {
          "param1": "value1",
          "param2": "value2"
        }
      }
    ]
  }
}
`;
            
            // Get plan from LLM
            const systemMessage = {
                role: 'system',
                content: 'You are a task planning assistant that creates detailed step-by-step plans. Always respond in valid JSON format.'
            };
            
            const userMessage = {
                role: 'user',
                content: planningPrompt
            };
            
            const responseFormat = {
                type: 'json_object',
                schema: {
                    type: 'object',
                    properties: {
                        plan: {
                            type: 'object',
                            properties: {
                                steps: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            description: { type: 'string' },
                                            tool: { type: 'string' },
                                            params: { type: 'object' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            
            const completion = await this.llmClient.chatCompletion(
                [systemMessage, userMessage], 
                undefined, // Use default model
                { response_format: responseFormat }
            );
            
            // Parse the plan
            const response = JSON.parse(completion.choices[0].message.content);
            
            // Simple validation
            if (!response.plan || !Array.isArray(response.plan.steps)) {
                throw new Error("Invalid plan format received from LLM");
            }
            
            return {
                steps: response.plan.steps,
                rawPlan: response
            };
        } catch (error) {
            this.logger.appendLine(`Error planning task: ${error.message}`);
            
            // Fallback to a simple default plan
            return {
                steps: [{
                    description: "Execute user request directly",
                    tool: "ExecuteCommandTool",
                    params: {
                        command: input
                    }
                }],
                error: error.message
            };
        }
    }

    /**
     * Determine if a failed step should be retried
     * @param {Object} step - The step that failed
     * @param {Error} error - The error that occurred
     * @returns {Promise<boolean>} - Whether to retry the step
     */
    async shouldRetryStep(step, error) {
        // For now, use simple heuristics - retry on certain error types
        const retryableErrors = [
            "timeout",
            "rate limit",
            "connection",
            "network",
            "temporary"
        ];
        
        const errorText = error.message.toLowerCase();
        return retryableErrors.some(term => errorText.includes(term));
    }

    /**
     * Modify a step after it has failed to improve chances of success
     * @param {Object} step - The step that failed
     * @param {Error} error - The error that occurred
     * @returns {Promise<Object>} - The modified step
     */
    async modifyStepAfterFailure(step, error) {
        // Simple modification approach - add error information to the step
        // A more sophisticated version would use LLM to modify the step
        return {
            ...step,
            description: `${step.description} (retry after error: ${error.message})`,
            params: {
                ...step.params,
                previousError: error.message
            }
        };
    }

    /**
     * Reflect on the execution of a plan
     * @param {Object} plan - The original plan
     * @param {Array<Object>} results - The results of each step
     * @returns {Promise<Object>} - Reflection and suggestions for improvement
     */
    async reflectOnExecution(plan, results) {
        this.logger.appendLine("Reflecting on execution...");
        
        try {
            // Count successful and failed steps
            const successfulSteps = results.filter(result => result.success).length;
            const totalSteps = plan.steps.length;
            
            // Simple reflection for minimal changes
            // A more complex version would use LLM to generate reflections
            return {
                success: successfulSteps === totalSteps,
                successRate: totalSteps > 0 ? (successfulSteps / totalSteps) : 0,
                message: successfulSteps === totalSteps ?
                    "All steps completed successfully" :
                    `${successfulSteps} of ${totalSteps} steps completed successfully`,
                suggestions: successfulSteps === totalSteps ? [] : ["Consider revising the failed steps"]
            };
        } catch (error) {
            this.logger.appendLine(`Error in reflection: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get the logger for this agent
     * @returns {vscode.OutputChannel} - The logger
     */
    getLogger() {
        return this.logger;
    }

    /**
     * Dispose of resources used by the agent
     */
    dispose() {
        this.logger.dispose();
    }
}

module.exports = Agent;