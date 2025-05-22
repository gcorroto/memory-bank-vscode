/**
 * Servicio para interactuar con la API de OpenAI
 * Proporciona métodos para generar texto, obtener embeddings y manejar chat completions
 */

const OpenAI = require('openai');
const vscode = require('vscode');

class OpenAIService {
    constructor() {
        this._client = null;
        this._initialized = false;
    }

    /**
     * Inicializa el cliente de OpenAI con la clave API
     * @returns {boolean} - True si la inicialización fue exitosa
     */
    initialize() {
        try {
            // Obtener la clave API de la configuración de VS Code
            const config = vscode.workspace.getConfiguration('grec0ai');
            const apiKey = config.get('openai.apiKey');
            
            if (!apiKey) {
                vscode.window.showErrorMessage('La clave API de OpenAI no está configurada. Por favor, configúrela en las preferencias de Grec0AI.');
                return false;
            }

            // Configurar el cliente de OpenAI
            this._client = new OpenAI({
                apiKey: apiKey
            });
            
            this._initialized = true;
            return true;
        } catch (error) {
            console.error('Error al inicializar OpenAI:', error);
            vscode.window.showErrorMessage(`Error al inicializar OpenAI: ${error.message}`);
            return false;
        }
    }

    /**
     * Verifica si el cliente está inicializado, si no, intenta inicializarlo
     * @private
     * @returns {boolean} - True si el cliente está inicializado
     */
    _ensureInitialized() {
        if (!this._initialized) {
            return this.initialize();
        }
        return true;
    }

    /**
     * Genera texto utilizando la API de OpenAI
     * @param {string} prompt - El prompt de entrada
     * @param {string} model - El modelo a utilizar (por defecto: gpt-4o)
     * @param {object} options - Opciones adicionales
     * @returns {Promise<string>} - El texto generado
     */
    async generateText(prompt, model = 'gpt-4o', options = {}) {
        if (!this._ensureInitialized()) {
            throw new Error('Cliente OpenAI no inicializado');
        }

        try {
            const response = await this._client.responses.create({
                model: model,
                input: prompt,
                ...options
            });

            return response.output_text;
        } catch (error) {
            console.error('Error al generar texto con OpenAI:', error);
            throw error;
        }
    }

    /**
     * Genera una respuesta de chat utilizando la API de OpenAI
     * @param {Array<object>} messages - Los mensajes de la conversación
     * @param {string} model - El modelo a utilizar (por defecto: gpt-4o)
     * @param {object} options - Opciones adicionales
     * @returns {Promise<object>} - La respuesta completa
     */
    async chatCompletion(messages, model = 'gpt-4o', options = {}) {
        if (!this._ensureInitialized()) {
            throw new Error('Cliente OpenAI no inicializado');
        }

        try {
            const completion = await this._client.chat.completions.create({
                model: model,
                messages: messages,
                ...options
            });

            return completion;
        } catch (error) {
            console.error('Error al generar chat completion con OpenAI:', error);
            throw error;
        }
    }

    /**
     * Genera embeddings para un texto utilizando la API de OpenAI
     * @param {string|string[]} input - El texto o array de textos para generar embeddings
     * @param {string} model - El modelo a utilizar (por defecto: text-embedding-ada-002)
     * @returns {Promise<Array<number>|Array<Array<number>>>} - Los embeddings generados
     */
    async generateEmbeddings(input, model = 'text-embedding-ada-002') {
        if (!this._ensureInitialized()) {
            throw new Error('Cliente OpenAI no inicializado');
        }

        try {
            const response = await this._client.embeddings.create({
                model: model,
                input: input
            });

            // Si es un solo input, devolvemos el primer embedding
            if (typeof input === 'string') {
                return response.data[0].embedding;
            }
            
            // Si es un array, devolvemos todos los embeddings
            return response.data.map(item => item.embedding);
        } catch (error) {
            console.error('Error al generar embeddings con OpenAI:', error);
            throw error;
        }
    }

    /**
     * Genera código utilizando la API de OpenAI
     * @param {string} prompt - El prompt que describe el código a generar
     * @param {string} model - El modelo a utilizar (por defecto: gpt-4o)
     * @param {object} options - Opciones adicionales
     * @returns {Promise<string>} - El código generado
     */
    async generateCode(prompt, model = 'gpt-4o', options = {}) {
        if (!this._ensureInitialized()) {
            throw new Error('Cliente OpenAI no inicializado');
        }

        try {
            // Añadimos instrucciones específicas para generación de código
            const systemMessage = {
                role: 'system',
                content: 'Eres un asistente experto en programación. Genera código limpio, bien estructurado y siguiendo las mejores prácticas. Incluye comentarios donde sea necesario para explicar la lógica compleja. No incluyas explicaciones adicionales, solo el código solicitado.'
            };

            const userMessage = {
                role: 'user',
                content: prompt
            };

            const completion = await this._client.chat.completions.create({
                model: model,
                messages: [systemMessage, userMessage],
                ...options
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error al generar código con OpenAI:', error);
            throw error;
        }
    }

    /**
     * Genera tests unitarios para un código fuente
     * @param {string} sourceCode - El código fuente para el que generar tests
     * @param {string} language - El lenguaje de programación (js, ts, java, etc.)
     * @param {string} framework - El framework de testing (jest, mocha, jasmine, etc.)
     * @param {string} model - El modelo a utilizar (por defecto: gpt-4o)
     * @param {object} options - Opciones adicionales
     * @returns {Promise<string>} - Los tests generados
     */
    async generateTests(sourceCode, language, framework, model = 'gpt-4o', options = {}) {
        if (!this._ensureInitialized()) {
            throw new Error('Cliente OpenAI no inicializado');
        }

        try {
            // Construimos un prompt específico para generación de tests
            const prompt = `
Genera tests unitarios completos para el siguiente código ${language} utilizando ${framework}.

CÓDIGO FUENTE:
\`\`\`${language}
${sourceCode}
\`\`\`

Requisitos para los tests:
1. Deben cubrir todos los caminos de ejecución posibles
2. Deben incluir casos de prueba para situaciones normales y de error
3. Utiliza mocks/stubs cuando sea necesario para dependencias externas
4. Asegúrate de que sean tests unitarios puros, no de integración

Genera SOLO el código de los tests, sin explicaciones adicionales.
`;

            const systemMessage = {
                role: 'system',
                content: 'Eres un experto en testing de software. Tu tarea es generar tests unitarios completos y efectivos que cubran todos los aspectos del código proporcionado.'
            };

            const userMessage = {
                role: 'user',
                content: prompt
            };

            const completion = await this._client.chat.completions.create({
                model: model,
                messages: [systemMessage, userMessage],
                ...options
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error al generar tests con OpenAI:', error);
            throw error;
        }
    }
}

module.exports = new OpenAIService(); 