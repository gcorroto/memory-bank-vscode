/**
 * Servicio de búsqueda vectorial para RAG (Retrieval Augmented Generation)
 * Este servicio proporciona funcionalidades para buscar contenido relevante
 * en una base de conocimiento vectorial.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as openaiService from './openaiService';
import type { 
  VectraLocalIndex, 
  VectraItem, 
  VectraMetadata,
  VectraSearchResult
} from '../types/vectra';

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

// Variable para el módulo Vectra
let LocalIndex: any;

/**
 * Carga el módulo Vectra de manera dinámica
 */
async function loadVectraModule(): Promise<any> {
  try {
    const vectra = await import('vectra');
    return vectra.LocalIndex;
  } catch (error) {
    console.error('The "vectra" module is missing. Please run "npm install" in the extension directory.');
    return undefined;
  }
}

// Inicializar la carga del módulo
loadVectraModule().then(loadedIndex => {
  LocalIndex = loadedIndex;
});

let index: VectraLocalIndex | null = null;
let indexPath: string | null = null;
let initialized = false;

/**
 * Inicializa el servicio de búsqueda vectorial
 * @param workspacePath - Ruta del workspace (opcional)
 * @returns Promise que se resuelve a true si la inicialización fue exitosa
 */
export async function initialize(workspacePath?: string): Promise<boolean> {
  try {
    // Si el módulo Vectra no se ha cargado, intentar cargarlo
    if (!LocalIndex) {
      LocalIndex = await loadVectraModule();
    }

    // Verificar que el módulo Vectra esté disponible
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al inicializar Vectra:', error);
    vscode.window.showErrorMessage(`Error al inicializar el índice vectorial: ${errorMessage}`);
    return false;
  }
}

/**
 * Asegura que el servicio esté inicializado antes de usarlo
 * @returns Promise que se resuelve a true si el servicio está inicializado
 */
async function ensureInitialized(): Promise<boolean> {
  if (!initialized) {
    return await initialize();
  }
  return true;
}

/**
 * Crea o recrea el índice vectorial para un directorio
 * @param directory - Directorio a indexar
 * @throws Error si el servicio no está inicializado
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error creating Vectra index: ${errorMessage}`);
    throw new Error(`Error creating Vectra index: ${errorMessage}`);
  }
}

/**
 * Divide el código en fragmentos más pequeños para indexar
 * @param code - Código fuente a dividir
 * @param chunkSize - Tamaño aproximado de cada fragmento
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
 * @param code - Código fuente a indexar
 * @param metadata - Metadatos asociados al código
 * @returns Promise que se resuelve a true si la indexación fue exitosa
 * @throws Error si el servicio no está inicializado
 */
export async function indexCode(code: string, metadata: VectraMetadata): Promise<boolean> {
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
      const chunkMetadata: VectraMetadata = {
        ...metadata,
        code: chunk,
        chunkIndex: i,
        totalChunks: chunks.length
      };
      
      // Obtener embeddings para el fragmento
      const vector = await openaiService.generateEmbeddings(chunk);
      
      // Insertar en el índice si existe
      if (index) {
        await index.insertItem({
          vector: vector,
          metadata: chunkMetadata
        });
      } else {
        success = false;
      }
    }
    
    return success;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al indexar código en Vectra:', errorMessage);
    return false;
  }
}

/**
 * Realiza una búsqueda semántica basada en la consulta proporcionada
 * @param query - Texto de consulta para buscar contenido relevante
 * @param limit - Número máximo de resultados a devolver
 * @returns Promise con array de resultados de la búsqueda
 * @throws Error si el servicio no está inicializado
 */
export async function query(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
  if (!await ensureInitialized()) {
    throw new Error('El servicio vectorial no está inicializado');
  }

  try {
    // Si no hay índice, devolver un array vacío
    if (!index) {
      return [];
    }

    // Generar embeddings para la consulta
    const vector = await openaiService.generateEmbeddings(query);
    
    // Realizar búsqueda con Vectra
    const results = await index.similaritySearch(vector, { topK: limit });
    
    // Transformar a nuestro formato de resultados
    return results.map((result: VectraSearchResult) => {
      // Asegurarnos de que los campos obligatorios existen
      const metadata = result.metadata || {};
      const filePath = metadata.filePath || '';
      const fileName = metadata.fileName || '';
      const extension = metadata.extension || '';
      const code = metadata.code || '';
      
      return {
        metadata: {
          filePath,
          fileName,
          extension,
          code,
          ...metadata
        },
        score: result.score
      };
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error en búsqueda vectorial:', errorMessage);
    
    // En modo de desarrollo, generar resultados de ejemplo para pruebas
    if (process.env.NODE_ENV === 'development') {
      console.log('Generando resultados de ejemplo para pruebas...');
      return generateMockResults(query, limit);
    }
    
    throw new Error(`Error en búsqueda vectorial: ${errorMessage}`);
  }
}

/**
 * Genera resultados de ejemplo para pruebas
 * @param query - Consulta para la que generar resultados
 * @param limit - Número de resultados a generar
 * @returns Array de resultados simulados
 */
function generateMockResults(query: string, limit: number): VectorSearchResult[] {
  const results: VectorSearchResult[] = [];
  
  for (let i = 0; i < limit; i++) {
    results.push({
      metadata: {
        filePath: `ejemplo/ruta/archivo${i + 1}.ts`,
        fileName: `archivo${i + 1}.ts`,
        extension: '.ts',
        code: `// Código de ejemplo relacionado con: ${query}\nfunction ejemplo${i + 1}() {\n  console.log("Esto es un ejemplo");\n}`,
      },
      score: 1 - (i * 0.1) // Puntuaciones decrecientes
    });
  }
  
  return results;
}

/**
 * Calcula la similitud entre dos textos
 * @param text1 - Primer texto a comparar
 * @param text2 - Segundo texto a comparar
 * @returns Promise con el valor de similitud (0-1)
 */
export async function calculateSimilarity(text1: string, text2: string): Promise<number> {
  try {
    // Generar embeddings para ambos textos
    const [vector1, vector2] = await Promise.all([
      openaiService.generateEmbeddings(text1),
      openaiService.generateEmbeddings(text2)
    ]);
    
    // Calcular similitud del coseno
    return calculateCosineSimilarity(vector1, vector2);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al calcular similitud:', errorMessage);
    return 0;
  }
}

/**
 * Calcula la similitud del coseno entre dos vectores
 * @param vector1 - Primer vector
 * @param vector2 - Segundo vector
 * @returns Valor de similitud (0-1)
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
 * Genera embeddings para un texto utilizando el servicio de OpenAI
 * @param text - Texto para el que generar embeddings
 * @returns Promise con el vector de embeddings
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  return await openaiService.generateEmbeddings(text);
} 