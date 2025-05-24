/**
 * Servicio para gestionar el índice vectorial local con Vectra
 * Proporciona métodos para indexar código fuente y realizar consultas semánticas
 */

let LocalIndex;
try {
    const vectra = require('vectra');
    LocalIndex = vectra.LocalIndex;
} catch (error) {
    // Handle missing vectra module gracefully
    console.error('The "vectra" module is missing. Please run "npm install" in the extension directory.');
}
const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const openaiService = require('./openaiService');

class VectraService {
    constructor() {
        this._index = null;
        this._indexPath = null;
        this._initialized = false;
    }

    /**
     * Inicializa el índice vectorial
     * @param {string} workspacePath - Ruta base del workspace (opcional)
     * @returns {Promise<boolean>} - True si la inicialización fue exitosa
     */
    async initialize(workspacePath) {
        try {
            // Check if Vectra module is available
            if (!LocalIndex) {
                vscode.window.showErrorMessage('El módulo Vectra no está instalado. Por favor, ejecute "npm install" en el directorio de la extensión.');
                return false;
            }

            // Determinar la ruta del índice
            const config = vscode.workspace.getConfiguration('grec0ai');
            
            // Si no se proporciona workspacePath, usar la carpeta del workspace
            if (!workspacePath) {
                const folders = vscode.workspace.workspaceFolders;
                if (folders && folders.length > 0) {
                    workspacePath = folders[0].uri.fsPath;
                } else {
                    throw new Error('No se pudo determinar la ruta del workspace');
                }
            }
            
            // Crear la carpeta .grec0ai si no existe
            this._indexPath = path.join(workspacePath, '.grec0ai', 'vectra-index');
            
            if (!fs.existsSync(path.dirname(this._indexPath))) {
                fs.mkdirSync(path.dirname(this._indexPath), { recursive: true });
            }
            
            // Crear el índice de Vectra
            this._index = new LocalIndex(this._indexPath);
            
            // Verificar si el índice ya existe, si no, crearlo
            if (!(await this._index.isIndexCreated())) {
                await this._index.createIndex();
            }
            
            this._initialized = true;
            return true;
        } catch (error) {
            console.error('Error al inicializar Vectra:', error);
            vscode.window.showErrorMessage(`Error al inicializar el índice vectorial: ${error.message}`);
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
     * Obtiene embeddings para un texto utilizando el servicio de OpenAI
     * @private
     * @param {string} text - Texto para generar embeddings
     * @returns {Promise<Array<number>>} - Vector de embeddings
     */
    async _getEmbeddings(text) {
        return await openaiService.generateEmbeddings(text);
    }

    /**
     * Indexa un fragmento de código en el índice vectorial
     * @param {string} code - Código fuente a indexar
     * @param {object} metadata - Metadatos asociados al código (ruta, lenguaje, etc.)
     * @returns {Promise<boolean>} - True si la indexación fue exitosa
     */
    async indexCode(code, metadata) {
        if (!await this._ensureInitialized()) {
            throw new Error('Servicio Vectra no inicializado');
        }

        try {
            // Obtener embeddings para el código
            const vector = await this._getEmbeddings(code);
            
            // Insertar en el índice
            await this._index.insertItem({
                vector: vector,
                metadata: {
                    ...metadata,
                    code: code
                }
            });
            
            return true;
        } catch (error) {
            console.error('Error al indexar código en Vectra:', error);
            return false;
        }
    }

    /**
     * Indexa un archivo completo
     * @param {string} filePath - Ruta del archivo a indexar
     * @param {string} language - Lenguaje de programación del archivo
     * @returns {Promise<boolean>} - True si la indexación fue exitosa
     */
    async indexFile(filePath, language) {
        try {
            // Leer el contenido del archivo
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Indexar el archivo completo
            return await this.indexCode(content, {
                filePath: filePath,
                language: language,
                type: 'file'
            });
        } catch (error) {
            console.error(`Error al indexar archivo ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Realiza una consulta semántica al índice
     * @param {string} query - Consulta en texto natural
     * @param {number} topK - Número de resultados a devolver (por defecto: 5)
     * @returns {Promise<Array<object>>} - Resultados de la consulta
     */
    async query(query, topK = 5) {
        if (!await this._ensureInitialized()) {
            throw new Error('Servicio Vectra no inicializado');
        }

        try {
            // Obtener embeddings para la consulta
            const vector = await this._getEmbeddings(query);
            
            // Realizar la consulta al índice
            const results = await this._index.queryItems(vector, topK);
            
            // Transformar los resultados para hacerlos más amigables
            return results.map(result => ({
                score: result.score,
                code: result.item.metadata.code,
                metadata: {
                    filePath: result.item.metadata.filePath,
                    language: result.item.metadata.language,
                    type: result.item.metadata.type
                }
            }));
        } catch (error) {
            console.error('Error al consultar Vectra:', error);
            return [];
        }
    }

    /**
     * Borra un ítem del índice por su ID
     * @param {string} id - ID del ítem a borrar
     * @returns {Promise<boolean>} - True si el borrado fue exitoso
     */
    async deleteItem(id) {
        if (!await this._ensureInitialized()) {
            throw new Error('Servicio Vectra no inicializado');
        }

        try {
            await this._index.deleteItem(id);
            return true;
        } catch (error) {
            console.error(`Error al borrar ítem ${id}:`, error);
            return false;
        }
    }

    /**
     * Actualiza un archivo en el índice (borra entradas anteriores y reindexado)
     * @param {string} filePath - Ruta del archivo a actualizar
     * @param {string} language - Lenguaje de programación del archivo
     * @returns {Promise<boolean>} - True si la actualización fue exitosa
     */
    async updateFile(filePath, language) {
        if (!await this._ensureInitialized()) {
            throw new Error('Servicio Vectra no inicializado');
        }

        try {
            // Buscar entradas anteriores para este archivo
            const vector = await this._getEmbeddings(filePath); // Usamos la ruta como consulta
            const results = await this._index.queryItems(vector, 100);
            
            // Filtrar por ruta exacta
            const matchingItems = results.filter(
                result => result.item.metadata.filePath === filePath
            );
            
            // Borrar entradas anteriores
            for (const item of matchingItems) {
                await this._index.deleteItem(item.id);
            }
            
            // Reindexar el archivo
            return await this.indexFile(filePath, language);
        } catch (error) {
            console.error(`Error al actualizar archivo ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Borra el índice vectorial completo
     * @returns {Promise<boolean>} - True si el borrado fue exitoso
     */
    async deleteIndex() {
        if (!this._initialized || !this._index) {
            return false;
        }

        try {
            await this._index.deleteIndex();
            this._initialized = false;
            return true;
        } catch (error) {
            console.error('Error al borrar índice Vectra:', error);
            return false;
        }
    }
}

module.exports = new VectraService(); 