/**
 * Utilidades para gestionar la configuración de la extensión
 */

const vscode = require('vscode');

class ConfigManager {
    /**
     * Obtiene la configuración de Grec0AI
     * @returns {vscode.WorkspaceConfiguration} - Configuración de la extensión
     */
    getConfig() {
        return vscode.workspace.getConfiguration('grec0ai');
    }

    /**
     * Actualiza un valor en la configuración
     * @param {string} key - Clave de configuración
     * @param {any} value - Valor a establecer
     * @param {boolean} global - Si se debe actualizar globalmente o solo para el workspace
     * @returns {Promise<void>}
     */
    async updateConfig(key, value, global = false) {
        const config = this.getConfig();
        await config.update(key, value, global);
    }

    /**
     * Obtiene la clave API de OpenAI
     * @returns {string|null} - Clave API o null si no está configurada
     */
    getOpenAIApiKey() {
        const config = this.getConfig();
        return config.get('openai.apiKey');
    }

    /**
     * Establece la clave API de OpenAI
     * @param {string} apiKey - Clave API a establecer
     * @param {boolean} global - Si se debe guardar globalmente
     * @returns {Promise<void>}
     */
    async setOpenAIApiKey(apiKey, global = true) {
        await this.updateConfig('openai.apiKey', apiKey, global);
    }

    /**
     * Obtiene el modelo de OpenAI a utilizar
     * @returns {string} - Nombre del modelo (por defecto: gpt-4o)
     */
    getOpenAIModel() {
        const config = this.getConfig();
        return config.get('openai.model') || 'gpt-4o';
    }

    /**
     * Obtiene la ruta del índice Vectra
     * @returns {string|null} - Ruta del índice o null si no está configurada
     */
    getVectraIndexPath() {
        const config = this.getConfig();
        return config.get('vectra.indexPath');
    }

    /**
     * Obtiene el umbral de similitud para consultas RAG
     * @returns {number} - Umbral entre 0 y 1 (por defecto: 0.7)
     */
    getRagSimilarityThreshold() {
        const config = this.getConfig();
        return config.get('rag.similarityThreshold') || 0.7;
    }

    /**
     * Obtiene el número de fragmentos de contexto a recuperar para RAG
     * @returns {number} - Número de fragmentos (por defecto: 3)
     */
    getRagContextCount() {
        const config = this.getConfig();
        return config.get('rag.contextCount') || 3;
    }

    /**
     * Verifica si el modo autofixer está habilitado
     * @returns {boolean} - True si el autofixer está activado
     */
    isAutofixerEnabled() {
        const config = this.getConfig();
        // Check configuration first, then environment variable
        return config.get('autofixer.enabled') || process.env.GREC0AI_AUTOFIXER === '1';
    }

    /**
     * Comprueba si la configuración necesaria está completa
     * @returns {boolean} - True si la configuración está completa
     */
    isConfigComplete() {
        return !!this.getOpenAIApiKey();
    }

    /**
     * Solicita al usuario que configure la clave API de OpenAI
     * @returns {Promise<boolean>} - True si la configuración fue exitosa
     */
    async promptForApiKey() {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Introduce tu clave API de OpenAI',
            placeHolder: 'sk-...',
            ignoreFocusOut: true,
            password: true
        });

        if (apiKey) {
            await this.setOpenAIApiKey(apiKey, true);
            return true;
        }

        return false;
    }

    /**
     * Registra las configuraciones de la extensión
     */
    registerConfiguration() {
        // Normalmente esto se haría en el package.json, pero aquí podemos
        // agregar validaciones adicionales o lógica personalizada
        return {
            'grec0ai.openai.apiKey': {
                type: 'string',
                default: '',
                description: 'Clave API de OpenAI'
            },
            'grec0ai.openai.model': {
                type: 'string',
                default: 'gpt-4o',
                description: 'Modelo de OpenAI a utilizar'
            },
            'grec0ai.vectra.indexPath': {
                type: 'string',
                default: null,
                description: 'Ruta personalizada para el índice Vectra'
            },
            'grec0ai.rag.similarityThreshold': {
                type: 'number',
                default: 0.7,
                description: 'Umbral de similitud para consultas RAG'
            },
            'grec0ai.rag.contextCount': {
                type: 'number',
                default: 3,
                description: 'Número de fragmentos de contexto a recuperar para RAG'
            },
            'grec0ai.autofixer.enabled': {
                type: 'boolean',
                default: false,
                description: 'Enable automatic execution of instructions from autofixer.md file on startup'
            }
        };
    }
}

module.exports = new ConfigManager(); 