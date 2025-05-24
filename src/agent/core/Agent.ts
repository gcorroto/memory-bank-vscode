/**
 * Core Agent Class
 * Orchestrates planning, reasoning, context management and tool execution
 */

import * as vscode from 'vscode';
import { ContextManager } from './ContextManager';
import { AgentToolManager } from './AgentToolManager';
import { WorkspaceManager } from './WorkspaceManager';
import { DatabaseManager } from './DatabaseManager';
import * as openaiService from '../../services/openaiService';

export class Agent {
    name: string;
    context: vscode.ExtensionContext;
    logger: vscode.OutputChannel;
    contextManager: ContextManager;
    toolManager: AgentToolManager;
    workspaceManager: WorkspaceManager;
    databaseManager: DatabaseManager;
    llmClient: typeof openaiService;

    /**
     * Initialize a new Agent instance
     * @param name - Name of the agent
     * @param context - VSCode extension context
     */
    constructor(name: string, context: vscode.ExtensionContext) {
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
     * @returns True if initialization was successful
     */
    async initialize(): Promise<boolean> {
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
        } catch (error: any) {
            this.logger.appendLine(`Error initializing agent: ${error.message}`);
            return false;
        }
    }

    /**
     * Handle user input and execute the appropriate actions
     * @param input - User input or request
     * @param context - Additional context (file, selection, etc.)
     * @returns The result of the operation
     */
    async handleUserInput(input: string, context: any = {}): Promise<any> {
        try {
            // 1. Update context with current input and session data
            this.contextManager.update(input, context);
            this.logger.appendLine(`Handling user input: "${input.substring(0, 100)}${input.length > 100 ? '...' : ''}"`);
            
            // 2. Plan task using LLM
            const plan = await this.planTask(input, context);
            
            // Log the plan
            this.logger.appendLine("Generated plan:");
            plan.steps.forEach((step: any, index: number) => {
                this.logger.appendLine(`  ${index + 1}. ${step.description} [Tool: ${step.tool}]`);
            });
            
            // Add to logs view if available
            if ((global as any).agentLogsView) {
                (global as any).agentLogsView.addPlanLog(plan.steps);
            }
            
            // 4. Execute each step in the plan
            const results: any[] = [];
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
                    
                    // Add to logs view if available
                    if ((global as any).agentLogsView) {
                        (global as any).agentLogsView.addStepLog(step.description, step.tool, step.params, stepResult, true);
                    }
                    
                    this.logger.appendLine(`Step completed: ${step.description}`);
                } catch (error: any) {
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
                    
                    // Add to logs view if available
                    if ((global as any).agentLogsView) {
                        (global as any).agentLogsView.addStepLog(step.description, step.tool, step.params, { error: error.message }, false);
                    }
                    
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
                        } catch (retryError: any) {
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
            
            // Add reflection to logs view
            if ((global as any).agentLogsView) {
                (global as any).agentLogsView.addReflectionLog(reflection);
            }
            
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
        } catch (error: any) {
            this.logger.appendLine(`Error in handleUserInput: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Plan the execution of a task by breaking it into steps
     * @param input - User input to plan for
     * @param context - Additional context
     * @returns The execution plan
     */
    async planTask(input: string, context: any): Promise<any> {
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
${availableTools.map((tool: any) => `- ${tool.name}: ${tool.description}`).join('\n')}

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
            
            // Call LLM to generate plan
            const planResponse = await this.llmClient.generateCompletion(planningPrompt, {
                maxTokens: 1024,
                temperature: 0.2,
                format: 'json'
            });
            
            let plan;
            
            try {
                // Parse the plan from LLM response
                if (typeof planResponse === 'string') {
                    plan = JSON.parse(planResponse);
                } else {
                    plan = planResponse;
                }
                
                // Validate plan has expected structure
                if (!plan.plan || !plan.plan.steps || !Array.isArray(plan.plan.steps)) {
                    throw new Error('Invalid plan structure');
                }
                
                return plan.plan;
            } catch (parseError: any) {
                this.logger.appendLine(`Error parsing plan: ${parseError.message}`);
                this.logger.appendLine(`Raw plan: ${planResponse}`);
                
                // Fallback to simple plan
                return {
                    steps: [{
                        description: `Fallback: ${input}`,
                        tool: this.determineDefaultTool(input, context),
                        params: {
                            ...context,
                            input: input
                        }
                    }]
                };
            }
        } catch (error: any) {
            this.logger.appendLine(`Error in planTask: ${error.message}`);
            
            // Fallback to simple plan
            return {
                steps: [{
                    description: `Fallback for request: ${input}`,
                    tool: this.determineDefaultTool(input, context),
                    params: {
                        ...context,
                        input: input
                    }
                }]
            };
        }
    }

    /**
     * Determine if a failed step should be retried
     * @param step - The failed step
     * @param error - The error that occurred
     * @returns Whether to retry the step
     */
    async shouldRetryStep(step: any, error: any): Promise<boolean> {
        // Simple heuristic for now - only retry certain types of failures
        const retryableErrors = [
            'context length exceeded',
            'rate limit',
            'timeout',
            'network error',
            'temporary failure'
        ];
        
        // Check if error message contains any retryable patterns
        if (retryableErrors.some(e => error.message.toLowerCase().includes(e.toLowerCase()))) {
            return true;
        }
        
        // Don't retry if already modified
        if (step.wasModified) {
            return false;
        }
        
        // By default, don't retry
        return false;
    }

    /**
     * Modify a step after failure for retry
     * @param step - The failed step
     * @param error - The error that occurred
     * @returns Modified step for retry
     */
    async modifyStepAfterFailure(step: any, error: any): Promise<any> {
        // Create a modified copy of the step
        const modifiedStep = {
            ...step,
            wasModified: true,
            description: `Retry: ${step.description}`
        };
        
        // Modify based on error type
        if (error.message.toLowerCase().includes('context length')) {
            // Simplify parameters to reduce token count
            modifiedStep.params = {
                ...step.params,
                simplified: true
            };
        }
        
        return modifiedStep;
    }

    /**
     * Reflect on the execution of a plan
     * @param plan - The execution plan
     * @param results - The results of executing the plan
     * @returns Reflection on the execution
     */
    async reflectOnExecution(plan: any, results: any[]): Promise<string> {
        try {
            // Count successful and failed steps
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            
            // Simple reflection for now - could use LLM for more sophisticated analysis
            if (failCount === 0) {
                return `All ${successCount} steps completed successfully.`;
            } else {
                return `Completed ${successCount} steps successfully and ${failCount} steps failed.`;
            }
        } catch (error: any) {
            this.logger.appendLine(`Error in reflectOnExecution: ${error.message}`);
            return "Unable to generate reflection due to an error.";
        }
    }

    /**
     * Determine the default tool for a request
     * @param input - User input
     * @param context - Request context
     * @returns Name of the default tool
     */
    private determineDefaultTool(input: string, context: any): string {
        const lowercaseInput = input.toLowerCase();
        
        if (lowercaseInput.includes('test') || lowercaseInput.includes('generar test')) {
            return 'GenerateTestTool';
        } else if (lowercaseInput.includes('error') || lowercaseInput.includes('fix')) {
            return 'FixErrorTool';
        } else if (lowercaseInput.includes('explain') || lowercaseInput.includes('explicar')) {
            return 'ExplainCodeTool';
        } else {
            return 'AnalyzeCodeTool';
        }
    }

    /**
     * Get the agent's logger
     * @returns The logger instance
     */
    getLogger(): vscode.OutputChannel {
        return this.logger;
    }

    /**
     * Dispose the agent and free resources
     */
    dispose(): void {
        this.logger.dispose();
        this.contextManager.dispose();
        this.toolManager.dispose();
        this.workspaceManager.dispose();
        this.databaseManager.dispose();
    }
} 