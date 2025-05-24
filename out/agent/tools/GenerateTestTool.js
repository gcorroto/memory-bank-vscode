/**
 * GenerateTestTool
 * Tool for generating test files using the existing RAG service
 */

const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');
const ragService = require('../../services/ragService');
const openaiService = require('../../services/openaiService');
const configManager = require('../../utils/configManager');

class GenerateTestTool extends BaseTool {
    constructor(agent) {
        super(agent);
        this.name = 'GenerateTestTool';
        this.description = 'Generates test files for source code';
        this.parameters = {
            sourcePath: {
                description: 'Path to the source file',
                type: 'string',
                required: true
            },
            testPath: {
                description: 'Path where the test file should be written (optional)',
                type: 'string'
            },
            framework: {
                description: 'Test framework to use (e.g., jest, mocha, jasmine)',
                type: 'string',
                default: 'jasmine'
            },
            reasoning: {
                description: 'Level of reasoning detail (low, medium, high)',
                type: 'string',
                enum: ['low', 'medium', 'high']
            },
            instructions: {
                description: 'Additional instructions for test generation',
                type: 'string'
            }
        };
        
        this.testTemplate = `
describe('{{className}}', () => {
  it('should be properly defined', () => {
    // Basic test to verify module is loaded
    expect({{className}}).toBeDefined();
  });
});
`;
    }

    /**
     * Generate a test file for a given source file
     * @param {Object} params - Tool parameters
     * @returns {Promise<Object>} - Result of test generation
     */
    async run_impl(params) {
        const { 
            sourcePath, 
            testPath = this.getDefaultTestPath(sourcePath), 
            framework = 'jasmine',
            reasoning,
            instructions 
        } = params;
        
        try {
            // Check if source file exists
            if (!fs.existsSync(sourcePath)) {
                throw new Error(`Source file not found: ${sourcePath}`);
            }
            
            // Read source file
            const sourceContent = fs.readFileSync(sourcePath, 'utf8');
            
            // Get file extension and determine language
            const extension = path.extname(sourcePath).substring(1);
            const language = extension === 'ts' ? 'typescript' : 'javascript';
            
            // Initialize services if needed
            const ragInitialized = await ragService.initialize();
            
            // Generate test using the most appropriate service
            let generatedTest;
            
            // Set up additional context based on reasoning level
            let reasoningContext = '';
            if (reasoning) {
                if (reasoning === 'high') {
                    reasoningContext = 'Utiliza un enfoque muy detallado y exhaustivo, con pruebas para todos los casos posibles.';
                } else if (reasoning === 'medium') {
                    reasoningContext = 'Utiliza un enfoque equilibrado con buena cobertura de los casos más importantes.';
                } else if (reasoning === 'low') {
                    reasoningContext = 'Utiliza un enfoque simple que cubra la funcionalidad básica.';
                }
            }
            
            // Format additional instructions
            let additionalInstructions = '';
            if (instructions) {
                additionalInstructions = `\nInstrucciones adicionales: ${instructions}`;
            }
            
            // Generate tests with RAG if available
            if (ragInitialized) {
                try {
                    this.logger.appendLine(`Generating tests with RAG for ${sourcePath}`);
                    generatedTest = await ragService.generateTests(
                        sourceContent, 
                        sourcePath, 
                        language, 
                        framework, 
                        5, // contextCount
                        configManager.getOpenAIModel()
                    );
                } catch (ragError) {
                    this.logger.appendLine(`Error generating tests with RAG: ${ragError.message}`);
                    
                    // Fallback to direct OpenAI if RAG fails
                    generatedTest = await openaiService.generateTests(
                        sourceContent,
                        language,
                        framework,
                        configManager.getOpenAIModel(),
                        {
                            instructions: `Genera tests unitarios completos para este código. ${reasoningContext} ${additionalInstructions}`
                        }
                    );
                }
            } else {
                // Use OpenAI directly if RAG is not available
                generatedTest = await openaiService.generateTests(
                    sourceContent,
                    language,
                    framework,
                    configManager.getOpenAIModel(),
                    {
                        instructions: `Genera tests unitarios completos para este código. ${reasoningContext} ${additionalInstructions}`
                    }
                );
            }
            
            // Create directories if needed
            const testDir = path.dirname(testPath);
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            
            // Write test file
            fs.writeFileSync(testPath, generatedTest);
            
            return {
                success: true,
                sourcePath,
                testPath,
                generatedTest,
                language,
                framework,
                message: `Test file generated: ${testPath}`
            };
        } catch (error) {
            throw new Error(`Error generating test: ${error.message}`);
        }
    }

    /**
     * Get default test path based on source path
     * @param {string} sourcePath - Path to source file
     * @returns {string} - Default test path
     */
    getDefaultTestPath(sourcePath) {
        const dir = path.dirname(sourcePath);
        const ext = path.extname(sourcePath);
        const baseName = path.basename(sourcePath, ext);
        
        // Add .spec or .test before the extension
        return path.join(dir, `${baseName}.spec${ext}`);
    }
}

module.exports = GenerateTestTool;