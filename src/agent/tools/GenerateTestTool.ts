/**
 * GenerateTestTool
 * Tool for generating test files using the existing RAG service
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import * as ragService from '../../services/ragService';
import * as openaiService from '../../services/openaiService';
import * as configManager from '../../utils/configManager';

export class GenerateTestTool extends BaseTool {
    private testTemplate: string;

    constructor(agent: any) {
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
                type: 'string',
                required: false
            },
            framework: {
                description: 'Test framework to use (e.g., jest, mocha, jasmine)',
                type: 'string',
                required: false,
                default: 'jasmine'
            },
            reasoning: {
                description: 'Level of reasoning detail (low, medium, high)',
                type: 'string',
                required: false
            },
            instructions: {
                description: 'Additional instructions for test generation',
                type: 'string',
                required: false
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
     * @param params - Tool parameters
     * @returns - Result of test generation
     */
    async run_impl(params: Record<string, any>): Promise<any> {
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
            let generatedTest: string;
            
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
                        framework
                    );
                } catch (ragError: any) {
                    this.logger.appendLine(`Error generating tests with RAG: ${ragError.message}`);
                    
                    // Fallback to direct OpenAI generation
                    generatedTest = await this.generateTestsWithOpenAI(
                        sourceContent,
                        language,
                        framework,
                        reasoningContext,
                        additionalInstructions
                    );
                }
            } else {
                // Use OpenAI directly if RAG is not available
                generatedTest = await this.generateTestsWithOpenAI(
                    sourceContent,
                    language,
                    framework,
                    reasoningContext,
                    additionalInstructions
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
        } catch (error: any) {
            throw new Error(`Error generating test: ${error.message}`);
        }
    }

    /**
     * Generate tests using OpenAI directly
     * @param sourceContent - Source code content
     * @param language - Programming language
     * @param framework - Test framework
     * @param reasoningContext - Reasoning context
     * @param additionalInstructions - Additional instructions
     * @returns - Generated test code
     */
    private async generateTestsWithOpenAI(
        sourceContent: string,
        language: string,
        framework: string,
        reasoningContext: string,
        additionalInstructions: string
    ): Promise<string> {
        // Create prompt for test generation
        const prompt = `
Genera tests unitarios completos para el siguiente código ${language} utilizando ${framework}.

CÓDIGO FUENTE:
\`\`\`${language}
${sourceContent}
\`\`\`

Requisitos para los tests:
1. Deben cubrir todos los caminos de ejecución posibles
2. Deben incluir casos de prueba para situaciones normales y de error
3. Utiliza mocks/stubs cuando sea necesario para dependencias externas
4. Asegúrate de que sean tests unitarios puros, no de integración
${reasoningContext}
${additionalInstructions}

Genera SOLO el código de los tests, sin explicaciones adicionales.
`;

        // Generate using OpenAI
        const systemMessage = {
            role: 'system',
            content: `Eres un experto programador de ${language} especializado en escribir tests unitarios de alta calidad.`
        };
        
        const userMessage = {
            role: 'user',
            content: prompt
        };
        
        const completion = await openaiService.chatCompletion(
            [systemMessage, userMessage],
            "gpt-4"
        );
        
        return completion.choices[0].message.content.trim();
    }

    /**
     * Get default test path based on source path
     * @param sourcePath - Path to source file
     * @returns - Default test path
     */
    private getDefaultTestPath(sourcePath: string): string {
        const dir = path.dirname(sourcePath);
        const ext = path.extname(sourcePath);
        const baseName = path.basename(sourcePath, ext);
        
        // Add .spec or .test before the extension
        return path.join(dir, `${baseName}.spec${ext}`);
    }
} 