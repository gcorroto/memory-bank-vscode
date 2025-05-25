/**
 * Servicio de búsqueda vectorial para RAG (Retrieval Augmented Generation)
 * Este servicio proporciona funcionalidades para buscar contenido relevante
 * en una base de conocimiento vectorial.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as openaiService from './openaiService';

// Interfaz para los resultados de búsqueda vectorial
export interface VectorSearchResult {
  metadata: {
    filePath: string;
    fileName: string;
    extension: string;
    code: string;
    [key: string]: any;
  };
  score: number;
}

let LocalIndex: any;
try {
  const vectra = require('vectra');
  LocalIndex = vectra.LocalIndex;
} catch (error) {
  // Handle missing vectra module gracefully
  console.error('The "vectra" module is missing. Please run "npm install" in the extension directory.');
}

let index: any = null;
let indexPath: string | null = null;
let initialized = false;

/**
 * Inicializa el servicio de búsqueda vectorial
 * @returns true si la inicialización fue exitosa, false en caso contrario
 */
export async function initialize(workspacePath?: string): Promise<boolean> {
  try {
    // Check if Vectra module is available
    if (!LocalIndex) {
      vscode.window.showErrorMessage('El módulo Vectra no está instalado. Por favor, ejecute "npm install" en el directorio de la extensión.');
      return false;
    }

    // Determinar la ruta del índice
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
    indexPath = path.join(workspacePath, '.grec0ai', 'vectra-index');
    
    if (!fs.existsSync(path.dirname(indexPath))) {
      fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    }
    
    // Crear el índice de Vectra
    index = new LocalIndex(indexPath);
    
    // Verificar si el índice ya existe, si no, crearlo
    if (!(await index.isIndexCreated())) {
      await index.createIndex();
    }
    
    initialized = true;
    return true;
  } catch (error) {
    console.error('Error al inicializar Vectra:', error);
    vscode.window.showErrorMessage(`Error al inicializar el índice vectorial: ${error.message}`);
    return false;
  }
}

/**
 * Asegura que el servicio esté inicializado antes de usarlo
 */
async function ensureInitialized(): Promise<boolean> {
  if (!initialized) {
    return await initialize();
  }
  return true;
}

/**
 * Crea o recrea el índice vectorial para un directorio
 * @param directory Directorio a indexar
 */
export async function createIndex(directory: string): Promise<void> {
  if (!await ensureInitialized()) {
    throw new Error('Servicio Vectra no inicializado');
  }

  try {
    console.log(`Creating Vectra index for ${directory}`);
    
    // Recreate the index
    if (index) {
      await index.deleteIndex();
      await index.createIndex();
    }
    
    console.log(`Index created for ${directory}`);
  } catch (error: any) {
    console.error(`Error creating Vectra index: ${error.message}`);
    throw error;
  }
}

/**
 * Divide el código en fragmentos más pequeños para indexar
 * @param code Código fuente a dividir
 * @param chunkSize Tamaño aproximado de cada fragmento
 * @returns Array de fragmentos de código
 */
function chunkCode(code: string, chunkSize: number = 1000): string[] {
  const lines = code.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const line of lines) {
    // Si añadir esta línea excedería el tamaño del fragmento y ya tenemos contenido
    if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  // Añadir el último fragmento si tiene contenido
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Indexa código fuente en el vector store
 * @param code Código fuente a indexar
 * @param metadata Metadatos asociados al código
 * @returns true si la indexación fue exitosa
 */
export async function indexCode(code: string, metadata: any): Promise<boolean> {
  if (!await ensureInitialized()) {
    throw new Error('Servicio Vectra no inicializado');
  }

  try {
    // Dividir código en fragmentos si es muy grande
    const chunks = chunkCode(code);
    let success = true;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Metadatos específicos para este fragmento
      const chunkMetadata = {
        ...metadata,
        code: chunk,
        chunkIndex: i,
        totalChunks: chunks.length
      };
      
      // Obtener embeddings para el fragmento
      const vector = await openaiService.generateEmbeddings(chunk);
      
      // Insertar en el índice
      await index.insertItem({
        vector: vector,
        metadata: chunkMetadata
      });
    }
    
    return success;
  } catch (error) {
    console.error('Error al indexar código en Vectra:', error);
    return false;
  }
}

/**
 * Realiza una búsqueda semántica basada en la consulta proporcionada
 * @param query Texto de consulta para buscar contenido relevante
 * @param limit Número máximo de resultados a devolver
 * @returns Array de resultados de la búsqueda
 */
export async function query(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
  if (!await ensureInitialized()) {
    throw new Error('El servicio vectorial no está inicializado');
  }
  
  try {
    // Generar embedding para la consulta
    const queryVector = await openaiService.generateEmbeddings(query);
    
    // Realizar búsqueda por similitud
    const searchResults = await index.queryItems(queryVector, limit);
    
    if (!searchResults || searchResults.length === 0) {
      console.log('No se encontraron resultados para la consulta');
      return [];
    }
    
    // Mapear los resultados a un formato más útil
    return searchResults.map((result: any) => ({
      metadata: result.metadata || {},
      score: result.score || 0
    }));
  } catch (error: any) {
    console.error('Error en la búsqueda vectorial:', error);
    
    // Si hay un error, devolver resultados simulados para no bloquear el desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('Devolviendo resultados simulados en modo desarrollo');
      return generateMockResults(query, limit);
    }
    
    throw error;
  }
}

/**
 * Genera resultados simulados para pruebas en desarrollo
 */
function generateMockResults(query: string, limit: number): VectorSearchResult[] {
  const mockResults: VectorSearchResult[] = [
    {
      metadata: {
        filePath: "src/utils/helpers.ts",
        fileName: "helpers.ts",
        extension: ".ts",
        code: "// La función solicitada está en este archivo\nexport function formatDate(date: Date): string {\n  return date.toISOString().split('T')[0];\n}"
      },
      score: 0.95
    },
    {
      metadata: {
        filePath: "src/services/errorHandling.ts",
        fileName: "errorHandling.ts",
        extension: ".ts",
        code: "// Para manejar errores, use try/catch\nexport function handleError(error: Error) {\n  logger.error(error.message);\n  return { success: false, error: error.message };\n}"
      },
      score: 0.87
    },
    {
      metadata: {
        filePath: "src/utils/configManager.ts",
        fileName: "configManager.ts",
        extension: ".ts",
        code: "// Gestión de configuración\nexport function getConfig(key: string): any {\n  const config = vscode.workspace.getConfiguration('grec0ai');\n  return config.get(key);\n}"
      },
      score: 0.82
    },
    {
      metadata: {
        filePath: "src/tests/helpers.test.ts",
        fileName: "helpers.test.ts",
        extension: ".ts",
        code: "// Tests con Jest\ndescribe('formatDate', () => {\n  it('formats date correctly', () => {\n    expect(formatDate(new Date('2023-01-01'))).toBe('2023-01-01');\n  });\n});"
      },
      score: 0.75
    }
  ];
  
  return mockResults.slice(0, limit);
}

/**
 * Calcula la similitud semántica entre dos textos
 * @param text1 Primer texto para comparar
 * @param text2 Segundo texto para comparar
 * @returns Puntuación de similitud entre 0 y 1
 */
export async function calculateSimilarity(text1: string, text2: string): Promise<number> {
  if (!await ensureInitialized()) {
    throw new Error('El servicio vectorial no está inicializado');
  }
  
  try {
    // Generar embeddings para ambos textos
    const vector1 = await openaiService.generateEmbeddings(text1);
    const vector2 = await openaiService.generateEmbeddings(text2);
    
    // Calcular similitud del coseno
    return calculateCosineSimilarity(vector1, vector2);
  } catch (error) {
    console.error('Error al calcular similitud:', error);
    return Math.random(); // Valor simulado en caso de error
  }
}

/**
 * Calcula la similitud del coseno entre dos vectores
 */
function calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Los vectores deben tener la misma dimensión');
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Genera embeddings para un texto dado
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    return await openaiService.generateEmbeddings(text);
  } catch (error: any) {
    console.error(`Error generating embeddings: ${error.message}`);
    throw error;
  }
} 