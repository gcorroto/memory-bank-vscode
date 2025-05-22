/**
 * Servicio RAG (Retrieval-Augmented Generation)
 * Combina Vectra y OpenAI para proporcionar respuestas contextuales sobre el código
 */

const vscode = require('vscode');
const openaiService = require('./openaiService');
const vectraService = require('./vectraService');

class RAGService {
    constructor() {
        this._initialized = false;
    }

    /**
     * Inicializa el servicio RAG
     * @returns {Promise<boolean>} - True si la inicialización fue exitosa
     */
    async initialize() {
        try {
            // Inicializar servicios dependientes
            const openaiInitialized = openaiService.initialize();
            const vectraInitialized = await vectraService.initialize();
            
            this._initialized = openaiInitialized && vectraInitialized;
            return this._initialized;
        } catch (error) {
            console.error('Error al inicializar RAG:', error);
            vscode.window.showErrorMessage(`Error al inicializar el servicio RAG: ${error.message}`);
            return false;
        }
    }

    /**
     * Verifica si el servicio está inicializado, si no, intenta inicializarlo
     * @private
     * @returns {Promise<boolean>} - True si el servicio está inicializado
     */
    async _ensureInitialized() {
        if (!this._initialized) {
            return await this.initialize();
        }
        return true;
    }

    /**
     * Formatea el contexto recuperado para incluirlo en el prompt
     * @private
     * @param {Array<object>} contextResults - Resultados de la consulta a Vectra
     * @returns {string} - Contexto formateado
     */
    _formatContext(contextResults) {
        if (!contextResults || contextResults.length === 0) {
            return '';
        }
        
        let formattedContext = '### CONTEXTO RELEVANTE DEL CÓDIGO:\n\n';
        
        for (let i = 0; i < contextResults.length; i++) {
            const result = contextResults[i];
            const relevanceScore = (result.score * 100).toFixed(2);
            const filePath = result.metadata.filePath || 'Desconocido';
            const language = result.metadata.language || '';
            
            formattedContext += `[${i + 1}] Relevancia: ${relevanceScore}% - Archivo: ${filePath}\n`;
            formattedContext += '```' + language + '\n';
            formattedContext += result.code + '\n';
            formattedContext += '```\n\n';
        }
        
        return formattedContext;
    }

    /**
     * Genera respuestas enriquecidas con contexto del código
     * @param {string} query - Consulta o pregunta del usuario
     * @param {number} contextCount - Número de fragmentos de contexto a recuperar (por defecto: 3)
     * @param {string} model - Modelo de OpenAI a utilizar (por defecto: gpt-4o)
     * @param {object} options - Opciones adicionales
     * @returns {Promise<string>} - Respuesta generada
     */
    async generateResponse(query, contextCount = 3, model = 'gpt-4o', options = {}) {
        if (!await this._ensureInitialized()) {
            throw new Error('Servicio RAG no inicializado');
        }

        try {
            // 1. Recuperar contexto relevante
            const contextResults = await vectraService.query(query, contextCount);
            
            // 2. Formatear el contexto
            const formattedContext = this._formatContext(contextResults);
            
            // 3. Construir el prompt enriquecido
            const enrichedPrompt = `${formattedContext}

### PREGUNTA:
${query}

Responde basándote en el contexto proporcionado. Si el contexto no contiene información suficiente para responder, indica qué información adicional se necesitaría.`;

            // 4. Generar respuesta con OpenAI
            const systemMessage = {
                role: 'system',
                content: 'Eres un asistente experto en programación que proporciona respuestas precisas y detalladas sobre código. Utilizas el contexto proporcionado para dar respuestas más precisas. Hablas en español pero conservas los términos técnicos en inglés cuando es apropiado.'
            };

            const userMessage = {
                role: 'user',
                content: enrichedPrompt
            };

            const completion = await openaiService.chatCompletion([systemMessage, userMessage], model, options);
            
            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error al generar respuesta con RAG:', error);
            throw error;
        }
    }

    /**
     * Genera tests para un archivo de código utilizando RAG
     * @param {string} sourceCode - Código fuente para el que generar tests
     * @param {string} filePath - Ruta del archivo
     * @param {string} language - Lenguaje de programación
     * @param {string} framework - Framework de testing
     * @param {number} contextCount - Número de fragmentos de contexto a recuperar (por defecto: 5)
     * @param {string} model - Modelo de OpenAI a utilizar (por defecto: gpt-4o)
     * @returns {Promise<string>} - Tests generados
     */
    async generateTests(sourceCode, filePath, language, framework, contextCount = 5, model = 'gpt-4o') {
        if (!await this._ensureInitialized()) {
            throw new Error('Servicio RAG no inicializado');
        }

        try {
            // Construir una consulta para encontrar ejemplos de tests similares
            const testQuery = `Ejemplos de tests para ${language} con ${framework} similares a este código: ${sourceCode.substring(0, 200)}`;
            
            // Recuperar contexto relevante (ejemplos de tests similares)
            const contextResults = await vectraService.query(testQuery, contextCount);
            
            // Formatear el contexto
            const formattedContext = this._formatContext(contextResults);
            
            // Construir un prompt enriquecido
            const enrichedPrompt = `${formattedContext}

### CÓDIGO FUENTE PARA TESTEAR:
\`\`\`${language}
${sourceCode}
\`\`\`

### INSTRUCCIONES:
Genera tests unitarios completos para el código anterior utilizando el framework ${framework}.
Utiliza los ejemplos de tests proporcionados como referencia para el estilo y estructura.
Los tests deben:
1. Cubrir todos los caminos de ejecución posibles
2. Incluir casos de prueba para situaciones normales y de error
3. Utilizar mocks/stubs cuando sea necesario para dependencias externas
4. Asegurarse de que sean tests unitarios puros, no de integración

Genera SOLO el código de los tests, sin explicaciones adicionales.`;

            // Generar tests con OpenAI
            const systemMessage = {
                role: 'system',
                content: 'Eres un experto en testing de software. Tu tarea es generar tests unitarios completos y efectivos que cubran todos los aspectos del código proporcionado. Sigue el estilo y las convenciones mostradas en los ejemplos.'
            };

            const userMessage = {
                role: 'user',
                content: enrichedPrompt
            };

            const completion = await openaiService.chatCompletion([systemMessage, userMessage], model);
            
            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error al generar tests con RAG:', error);
            throw error;
        }
    }

    /**
     * Analiza código en busca de errores o problemas utilizando RAG
     * @param {string} sourceCode - Código fuente a analizar
     * @param {string} language - Lenguaje de programación
     * @param {number} contextCount - Número de fragmentos de contexto a recuperar (por defecto: 3)
     * @param {string} model - Modelo de OpenAI a utilizar (por defecto: gpt-4o)
     * @returns {Promise<object>} - Resultados del análisis con posibles soluciones
     */
    async analyzeCode(sourceCode, language, contextCount = 3, model = 'gpt-4o') {
        if (!await this._ensureInitialized()) {
            throw new Error('Servicio RAG no inicializado');
        }

        try {
            // Construir una consulta para encontrar código similar
            const analysisQuery = `Análisis de código ${language} para detectar errores y mejores prácticas: ${sourceCode.substring(0, 200)}`;
            
            // Recuperar contexto relevante
            const contextResults = await vectraService.query(analysisQuery, contextCount);
            
            // Formatear el contexto
            const formattedContext = this._formatContext(contextResults);
            
            // Construir un prompt enriquecido
            const enrichedPrompt = `${formattedContext}

### CÓDIGO A ANALIZAR:
\`\`\`${language}
${sourceCode}
\`\`\`

### INSTRUCCIONES:
Analiza el código anterior en busca de:
1. Errores de sintaxis
2. Problemas potenciales de seguridad
3. Ineficiencias de rendimiento
4. Violaciones de mejores prácticas
5. Problemas de mantenibilidad

Para cada problema encontrado, proporciona:
- Descripción del problema
- Nivel de gravedad (Alto/Medio/Bajo)
- Solución recomendada con código corregido`;

            // Generar análisis con OpenAI
            const systemMessage = {
                role: 'system',
                content: 'Eres un experto en análisis de código y revisión de calidad. Tu tarea es identificar problemas en el código proporcionado y sugerir soluciones concretas. Estructura tu respuesta en formato JSON para facilitar su procesamiento.'
            };

            const userMessage = {
                role: 'user',
                content: enrichedPrompt
            };

            const responseFormat = {
                type: 'json_object',
                schema: {
                    type: 'object',
                    properties: {
                        issues: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    description: { type: 'string' },
                                    severity: { type: 'string', enum: ['Alto', 'Medio', 'Bajo'] },
                                    solution: { type: 'string' },
                                    code: { type: 'string' }
                                }
                            }
                        },
                        summary: { type: 'string' }
                    }
                }
            };

            const completion = await openaiService.chatCompletion(
                [systemMessage, userMessage], 
                model,
                { response_format: responseFormat }
            );
            
            // Parsear la respuesta JSON
            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Error al analizar código con RAG:', error);
            return {
                issues: [],
                summary: `Error al analizar código: ${error.message}`
            };
        }
    }

    /**
     * Resuelve un error específico utilizando RAG
     * @param {string} errorMessage - Mensaje de error a resolver
     * @param {string} sourceCode - Código fuente que produce el error
     * @param {string} language - Lenguaje de programación
     * @param {number} contextCount - Número de fragmentos de contexto a recuperar (por defecto: 4)
     * @param {string} model - Modelo de OpenAI a utilizar (por defecto: gpt-4o)
     * @returns {Promise<object>} - Explicación del error y solución propuesta
     */
    async resolveError(errorMessage, sourceCode, language, contextCount = 4, model = 'gpt-4o') {
        if (!await this._ensureInitialized()) {
            throw new Error('Servicio RAG no inicializado');
        }

        try {
            // Construir una consulta para encontrar soluciones similares
            const errorQuery = `Error en ${language}: ${errorMessage}`;
            
            // Recuperar contexto relevante
            const contextResults = await vectraService.query(errorQuery, contextCount);
            
            // Formatear el contexto
            const formattedContext = this._formatContext(contextResults);
            
            // Construir un prompt enriquecido
            const enrichedPrompt = `${formattedContext}

### CÓDIGO CON ERROR:
\`\`\`${language}
${sourceCode}
\`\`\`

### MENSAJE DE ERROR:
${errorMessage}

### INSTRUCCIONES:
Analiza el error y proporciona una solución detallada. Explica la causa del error y cómo solucionarlo.
Proporciona el código corregido completo.`;

            // Generar solución con OpenAI
            const systemMessage = {
                role: 'system',
                content: 'Eres un experto en depuración y resolución de errores de programación. Tu tarea es explicar de manera clara la causa de un error y proporcionar una solución precisa y funcional.'
            };

            const userMessage = {
                role: 'user',
                content: enrichedPrompt
            };

            const responseFormat = {
                type: 'json_object',
                schema: {
                    type: 'object',
                    properties: {
                        explanation: { type: 'string' },
                        solution: { type: 'string' },
                        fixedCode: { type: 'string' }
                    }
                }
            };

            const completion = await openaiService.chatCompletion(
                [systemMessage, userMessage], 
                model,
                { response_format: responseFormat }
            );
            
            // Parsear la respuesta JSON
            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Error al resolver error con RAG:', error);
            return {
                explanation: `Error al procesar la solicitud: ${error.message}`,
                solution: 'No se pudo generar una solución',
                fixedCode: sourceCode
            };
        }
    }
}

module.exports = new RAGService(); 