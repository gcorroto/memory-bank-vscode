/**
 * BaseTool
 * Base class for all agent tools
 */

class BaseTool {
    /**
     * Initialize a new Tool instance
     * @param {Object} agent - The parent agent instance
     */
    constructor(agent) {
        this.agent = agent;
        this.logger = agent.getLogger();
        this.name = this.constructor.name;
        this.description = '';
        this.parameters = {};
    }

    /**
     * Run the tool with the provided parameters
     * @param {Object} params - Parameters for the tool
     * @returns {Promise<Object>} - Result of the tool execution
     */
    async run(params) {
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
        } catch (error) {
            // Log failure
            this.logger.appendLine(`Tool ${this.name} execution failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Actual implementation of the tool (to be overridden by subclasses)
     * @param {Object} params - Parameters for the tool
     * @returns {Promise<Object>} - Result of the tool execution
     */
    async run_impl(params) {
        throw new Error('Tool implementation not provided');
    }

    /**
     * Validate the parameters for the tool
     * @param {Object} params - Parameters to validate
     * @throws {Error} - If parameters are invalid
     */
    validateParams(params) {
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
     * @param {Object} params - Original parameters
     * @returns {Object} - Sanitized parameters safe for logging
     */
    sanitizeParams(params) {
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
     * @returns {Object} - Tool metadata
     */
    getMetadata() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
}

module.exports = BaseTool;