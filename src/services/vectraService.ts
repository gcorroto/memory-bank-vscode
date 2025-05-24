/**
 * Servicio de búsqueda vectorial para RAG (Retrieval Augmented Generation)
 * Este servicio proporciona funcionalidades para buscar contenido relevante
 * en una base de conocimiento vectorial.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as openaiService from './openaiService';

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

async function ensureInitialized(): Promise<boolean> {
  if (!initialized) {
    return await initialize();
  }
  return true;
}

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
    
    // We would scan the directory and index files in a real implementation
    // For now, just log the operation
    console.log(`Index created for ${directory}`);
  } catch (error: any) {
    console.error(`Error creating Vectra index: ${error.message}`);
    throw error;
  }
}

export async function indexCode(code: string, metadata: any): Promise<boolean> {
  if (!await ensureInitialized()) {
    throw new Error('Servicio Vectra no inicializado');
  }

  try {
    // Obtener embeddings para el código
    const vector = await openaiService.generateEmbeddings(code);
    
    // Insertar en el índice
    await index.insertItem({
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
 * Realiza una búsqueda semántica basada en la consulta proporcionada
 * @param query Texto de consulta para buscar contenido relevante
 * @param limit Número máximo de resultados a devolver
 * @returns Array de resultados de la búsqueda
 */
export async function query(query: string, limit: number = 5): Promise<string[]> {
  if (!initialized) {
    throw new Error('El servicio vectorial no está inicializado');
  }
  
  try {
    // En una implementación real, aquí se realizaría la búsqueda vectorial
    // basada en la similitud semántica con la consulta
    
    // Por ahora, devolvemos resultados simulados
    return [
      "La función solicitada está en el módulo utils/helpers.ts",
      "Para manejar errores, use try/catch y registre excepciones con logger.error()",
      "Las mejores prácticas de TypeScript incluyen usar tipos explícitos",
      "La configuración de la extensión se maneja en src/utils/configManager.ts",
      "Para pruebas unitarias, se recomienda usar Jest con ts-jest"
    ].slice(0, limit);
  } catch (error) {
    console.error('Error en la búsqueda vectorial:', error);
    return [];
  }
}

/**
 * Calcula la similitud semántica entre dos textos
 * @param text1 Primer texto para comparar
 * @param text2 Segundo texto para comparar
 * @returns Puntuación de similitud entre 0 y 1
 */
export async function calculateSimilarity(text1: string, text2: string): Promise<number> {
  if (!initialized) {
    throw new Error('El servicio vectorial no está inicializado');
  }
  
  try {
    // En una implementación real, aquí se calcularían embeddings y similitud coseno
    
    // Por ahora, devolvemos un valor simulado
    return Math.random();
  } catch (error) {
    console.error('Error al calcular similitud:', error);
    return 0;
  }
}

export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    // In a real implementation, this would call OpenAI's embedding API
    // For now, return a simple mock embedding (32-dimensional vector of random values)
    return Array(32).fill(0).map(() => Math.random());
  } catch (error: any) {
    console.error(`Error generating embeddings: ${error.message}`);
    throw error;
  }
} 