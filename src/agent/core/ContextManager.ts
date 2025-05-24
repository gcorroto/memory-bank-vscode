/**
 * Context Manager
 * Manages conversation history and context, handles token counting and truncation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Agent } from './Agent';

interface HistoryItem {
    role: 'user' | 'assistant' | 'system';
    content?: string;
    step?: string;
    tool?: string;
    result?: any;
    type?: string;
    timestamp: Date;
}

export class ContextManager {
    private agent: Agent;
    private logger: vscode.OutputChannel;
    private history: HistoryItem[];
    private currentContext: Record<string, any>;
    private tokenCount: number;
    private maxTokens: number;
    private persistencePath: string;

    /**
     * Initialize the Context Manager
     * @param agent - The parent agent instance
     */
    constructor(agent: Agent) {
        this.agent = agent;
        this.logger = agent.getLogger();
        this.history = [];
        this.currentContext = {};
        this.tokenCount = 0;
        this.maxTokens = 16000; // Default limit, can be adjusted based on model
        this.persistencePath = '';
    }

    /**
     * Update the context with new input and state
     * @param input - User input
     * @param context - Additional context (file, selection, etc.)
     */
    update(input: string, context: Record<string, any> = {}): void {
        // Add input to history
        this.history.push({
            role: 'user',
            content: input,
            timestamp: new Date()
        });

        // Update current context
        this.currentContext = {
            ...this.currentContext,
            ...context
        };

        // Handle token counting
        this.updateTokenCount();
    }

    /**
     * Add result of a step execution to the context
     * @param step - The executed step
     * @param result - The result of the step
     */
    addStepResult(step: any, result: any): void {
        // Add to history
        this.history.push({
            role: 'assistant',
            step: step.description,
            tool: step.tool,
            result: result,
            timestamp: new Date()
        });

        // Update token count
        this.updateTokenCount();
    }

    /**
     * Add feedback for improvement to the context
     * @param feedback - Feedback data
     */
    addFeedback(feedback: any): void {
        this.history.push({
            role: 'system',
            type: 'feedback',
            content: JSON.stringify(feedback),
            timestamp: new Date()
        });

        // Update token count
        this.updateTokenCount();
    }

    /**
     * Get the current conversation history
     * @returns The history array
     */
    getHistory(): HistoryItem[] {
        return this.history;
    }

    /**
     * Get the most recent conversation history, limited by tokens
     * @param maxTokens - Maximum number of tokens to include
     * @returns The recent history within token limits
     */
    getRecentHistory(maxTokens: number = this.maxTokens): HistoryItem[] {
        // Implement token-based truncation
        // Simple version: just take the most recent items
        
        // In a more sophisticated version, you would:
        // 1. Calculate tokens for each history item
        // 2. Take the most recent items that fit within maxTokens
        // 3. Consider importance/relevance of history items
        
        // For now, simple truncation of older messages
        if (this.tokenCount <= maxTokens) {
            return this.history;
        }
        
        // Truncate history to fit within token limit
        const truncatedHistory: HistoryItem[] = [];
        let tokensUsed = 0;
        
        // Start from the most recent and go backwards
        for (let i = this.history.length - 1; i >= 0; i--) {
            const item = this.history[i];
            const itemTokens = this.estimateTokens(item);
            
            if (tokensUsed + itemTokens <= maxTokens) {
                truncatedHistory.unshift(item); // Add to beginning
                tokensUsed += itemTokens;
            } else {
                break;
            }
        }
        
        return truncatedHistory;
    }

    /**
     * Get the formatted conversation history for LLM consumption
     * @param maxTokens - Maximum tokens to include
     * @returns Formatted conversation history
     */
    getFormattedHistory(maxTokens: number = this.maxTokens): Array<{role: string, content: string}> {
        const recentHistory = this.getRecentHistory(maxTokens);
        
        // Format into LLM-friendly structure
        return recentHistory.map(item => {
            if (item.role === 'user') {
                return {
                    role: 'user',
                    content: item.content || ''
                };
            } else if (item.role === 'assistant') {
                if (item.result && item.result.text) {
                    return {
                        role: 'assistant',
                        content: item.result.text
                    };
                } else {
                    // Format tool use
                    return {
                        role: 'assistant',
                        content: `Used ${item.tool} tool: ${JSON.stringify(item.result)}`
                    };
                }
            } else {
                // System messages
                return {
                    role: 'system',
                    content: item.content && typeof item.content === 'string' ? 
                             item.content : 
                             JSON.stringify(item.content)
                };
            }
        });
    }

    /**
     * Persist context to disk if it exceeds token limits
     * @returns Path to the persisted file
     */
    async persistToDisk(): Promise<string> {
        try {
            // Create a unique filename for this session
            const sessionId = Date.now().toString();
            const filename = `context_${sessionId}.json`;
            
            // Ensure the workspace directory exists
            const workspacePath = this.agent.workspaceManager.getWorkspacePath();
            const persistencePath = path.join(workspacePath, 'context');
            
            if (!fs.existsSync(persistencePath)) {
                fs.mkdirSync(persistencePath, { recursive: true });
            }
            
            const filePath = path.join(persistencePath, filename);
            
            // Write context to file
            const contextData = {
                history: this.history,
                currentContext: this.currentContext,
                timestamp: new Date()
            };
            
            fs.writeFileSync(filePath, JSON.stringify(contextData, null, 2));
            
            this.persistencePath = filePath;
            this.logger.appendLine(`Context persisted to disk: ${filePath}`);
            
            return filePath;
        } catch (error: any) {
            this.logger.appendLine(`Error persisting context to disk: ${error.message}`);
            return '';
        }
    }

    /**
     * Load context from a persisted file
     * @param filePath - Path to the persisted context file
     * @returns True if loaded successfully
     */
    async loadFromDisk(filePath: string): Promise<boolean> {
        try {
            // Read and parse the context file
            const contextData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Restore context
            this.history = contextData.history || [];
            this.currentContext = contextData.currentContext || {};
            
            this.updateTokenCount();
            
            this.logger.appendLine(`Context loaded from disk: ${filePath}`);
            return true;
        } catch (error: any) {
            this.logger.appendLine(`Error loading context from disk: ${error.message}`);
            return false;
        }
    }

    /**
     * Update the token count for the current context
     */
    private updateTokenCount(): void {
        let total = 0;
        
        // Count tokens in history
        for (const item of this.history) {
            total += this.estimateTokens(item);
        }
        
        // Count tokens in current context
        total += this.estimateTokens(this.currentContext);
        
        this.tokenCount = total;
        
        // If tokens exceed threshold, consider persisting to disk
        if (this.tokenCount > this.maxTokens * 0.9) { // 90% of max
            this.logger.appendLine(`Token count is approaching limit (${this.tokenCount}/${this.maxTokens})`);
            this.persistToDisk().catch(error => {
                this.logger.appendLine(`Error auto-persisting context: ${error.message}`);
            });
        }
    }

    /**
     * Get a summary of the current context
     * @returns Summary object
     */
    getSummary(): {historyItems: number, tokenCount: number, contextSize: number} {
        return {
            historyItems: this.history.length,
            tokenCount: this.tokenCount,
            contextSize: Object.keys(this.currentContext).length
        };
    }

    /**
     * Estimate the number of tokens in an object
     * @param obj - The object to estimate tokens for
     * @returns Estimated token count
     */
    private estimateTokens(obj: any): number {
        // Simple token estimation - in a real implementation, you would use a proper tokenizer
        // This is a very rough approximation
        
        if (!obj) {
            return 0;
        }
        
        if (typeof obj === 'string') {
            // Roughly 4 characters per token for English text
            return Math.ceil(obj.length / 4);
        }
        
        if (typeof obj === 'number') {
            return 1;
        }
        
        if (typeof obj === 'boolean') {
            return 1;
        }
        
        if (Array.isArray(obj)) {
            let total = 0;
            for (const item of obj) {
                total += this.estimateTokens(item);
            }
            return total;
        }
        
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            let total = keys.length; // Count for the keys
            
            // Add token counts for all values
            for (const key of keys) {
                total += this.estimateTokens(obj[key]);
            }
            
            return total;
        }
        
        return 1; // Default for other types
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // Clean up resources if needed
        this.history = [];
        this.currentContext = {};
    }
} 