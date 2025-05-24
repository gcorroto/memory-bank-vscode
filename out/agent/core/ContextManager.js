/**
 * Context Manager
 * Manages conversation history and context, handles token counting and truncation
 */

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

class ContextManager {
    /**
     * Initialize the Context Manager
     * @param {Object} agent - The parent agent instance
     */
    constructor(agent) {
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
     * @param {string} input - User input
     * @param {Object} context - Additional context (file, selection, etc.)
     */
    update(input, context = {}) {
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
     * @param {Object} step - The executed step
     * @param {Object} result - The result of the step
     */
    addStepResult(step, result) {
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
     * @param {Object} feedback - Feedback data
     */
    addFeedback(feedback) {
        this.history.push({
            role: 'system',
            type: 'feedback',
            content: feedback,
            timestamp: new Date()
        });

        // Update token count
        this.updateTokenCount();
    }

    /**
     * Get the current conversation history
     * @returns {Array} - The history array
     */
    getHistory() {
        return this.history;
    }

    /**
     * Get the most recent conversation history, limited by tokens
     * @param {number} maxTokens - Maximum number of tokens to include
     * @returns {Array} - The recent history within token limits
     */
    getRecentHistory(maxTokens = this.maxTokens) {
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
        const truncatedHistory = [];
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
     * @param {number} maxTokens - Maximum tokens to include
     * @returns {Array} - Formatted conversation history
     */
    getFormattedHistory(maxTokens = this.maxTokens) {
        const recentHistory = this.getRecentHistory(maxTokens);
        
        // Format into LLM-friendly structure
        return recentHistory.map(item => {
            if (item.role === 'user') {
                return {
                    role: 'user',
                    content: item.content
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
                    content: item.content && item.content.toString ? 
                             item.content.toString() : 
                             JSON.stringify(item.content)
                };
            }
        });
    }

    /**
     * Persist context to disk if it exceeds token limits
     * @returns {Promise<string>} - Path to the persisted file
     */
    async persistToDisk() {
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
        } catch (error) {
            this.logger.appendLine(`Error persisting context to disk: ${error.message}`);
            return '';
        }
    }

    /**
     * Load context from a persisted file
     * @param {string} filePath - Path to the persisted context file
     * @returns {Promise<boolean>} - True if loaded successfully
     */
    async loadFromDisk(filePath) {
        try {
            // Read and parse the context file
            const contextData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Restore context
            this.history = contextData.history || [];
            this.currentContext = contextData.currentContext || {};
            
            this.updateTokenCount();
            
            this.logger.appendLine(`Context loaded from disk: ${filePath}`);
            return true;
        } catch (error) {
            this.logger.appendLine(`Error loading context from disk: ${error.message}`);
            return false;
        }
    }

    /**
     * Update the token count for the current context
     */
    updateTokenCount() {
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
            this.logger.appendLine(`Token count (${this.tokenCount}) approaching limit (${this.maxTokens})`);
            this.persistToDisk().catch(err => {
                this.logger.appendLine(`Error during auto-persistence: ${err.message}`);
            });
        }
    }

    /**
     * Get a summary of the current context state
     * @returns {Object} - Context summary
     */
    getSummary() {
        return {
            historyItems: this.history.length,
            tokenCount: this.tokenCount,
            maxTokens: this.maxTokens,
            persistedPath: this.persistencePath,
            currentContext: Object.keys(this.currentContext)
        };
    }

    /**
     * Estimate tokens in an object
     * @param {*} obj - Object to estimate tokens for
     * @returns {number} - Estimated token count
     */
    estimateTokens(obj) {
        // Simple estimation based on string length
        // In a production environment, use a proper token counting library
        // based on the tokenization approach of your LLM
        
        if (!obj) {
            return 0;
        }
        
        const objString = typeof obj === 'string' ? 
            obj : JSON.stringify(obj);
            
        // Very rough estimate: ~4 characters per token for English text
        return Math.ceil(objString.length / 4);
    }
}

module.exports = ContextManager;