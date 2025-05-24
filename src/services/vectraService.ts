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

export async function query(queryText: string, topK: number = 5): Promise<string[]> {
  if (!await ensureInitialized()) {
    return ['Error: Vectra service not initialized'];
  }

  try {
    // In a real implementation, we would:
    // 1. Generate embeddings for the query
    // 2. Search the vector index
    // 3. Return the matching results
    
    console.log(`Vectra query for: ${queryText}`);
    
    // For now, return simulated results
    return [
      `Resultado simulado 1 para "${queryText}"`,
      `Resultado simulado 2 para "${queryText}"`,
      `Resultado simulado 3 para "${queryText}"`
    ];
  } catch (error: any) {
    console.error(`Error querying Vectra index: ${error.message}`);
    return [`Error: ${error.message}`];
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