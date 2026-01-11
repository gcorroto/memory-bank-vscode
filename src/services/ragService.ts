/**
 * @fileoverview RAG Service for Memory Bank
 * Provides semantic search and context enrichment using the Memory Bank vector store
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as openaiService from './openaiService';
import * as configManager from '../utils/configManager';

// LanceDB import - cargado dinámicamente
let lancedb: any = null;

// Estado del servicio
let initialized = false;
let db: any = null;
let table: any = null;
let memoryBankPath: string = '';
let defaultProjectId: string = '';

// Interfaz para resultados de búsqueda
export interface SearchResult {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  chunkType: string;
  name?: string;
  language: string;
  score: number;
  projectId: string;
}

// Interfaz para resultado de análisis/generación
export interface RAGResult {
  content: string;
  modelInfo?: {
    name: string;
    taskType?: string;
  };
  tokenCount?: {
    prompt: number;
    completion: number;
    total: number;
  };
  context?: SearchResult[];
}

/**
 * Carga el módulo LanceDB dinámicamente
 */
async function loadLanceDB(): Promise<boolean> {
  try {
    if (!lancedb) {
      lancedb = await import('@lancedb/lancedb');
    }
    return true;
  } catch (error) {
    console.error('Error loading LanceDB module:', error);
    return false;
  }
}

/**
 * Obtiene la configuración del Memory Bank
 */
function getMemoryBankConfig(): { path: string; defaultProject: string } {
  const config = vscode.workspace.getConfiguration('memorybank');
  const mbPath = config.get<string>('path', '.memorybank');
  const defaultProj = config.get<string>('defaultProject', '');
  
  // Resolver ruta si es relativa
  let resolvedPath = mbPath;
  if (!path.isAbsolute(mbPath)) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      resolvedPath = path.join(workspaceFolders[0].uri.fsPath, mbPath);
    }
  }
  
  return { path: resolvedPath, defaultProject: defaultProj };
}

/**
 * Detecta el primer proyecto disponible si no hay default configurado
 */
async function detectDefaultProject(mbPath: string): Promise<string> {
  const projectsPath = path.join(mbPath, 'projects');
  
  try {
    if (!fs.existsSync(projectsPath)) {
      return '';
    }
    
    const entries = fs.readdirSync(projectsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const docsPath = path.join(projectsPath, entry.name, 'docs');
        if (fs.existsSync(docsPath)) {
          console.log(`RAG Service: Auto-detected project: ${entry.name}`);
          return entry.name;
        }
      }
    }
  } catch (error) {
    console.error('Error detecting default project:', error);
  }
  
  return '';
}

/**
 * Inicializa la conexión con Memory Bank
 * @returns true si la inicialización fue exitosa
 */
export async function initialize(): Promise<boolean> {
  if (initialized && db && table) {
    return true;
  }
  
  try {
    // Cargar LanceDB
    const lanceLoaded = await loadLanceDB();
    if (!lanceLoaded) {
      console.error('RAG Service: Could not load LanceDB module');
      return false;
    }
    
    // Obtener configuración
    const config = getMemoryBankConfig();
    memoryBankPath = config.path;
    
    // Verificar que existe la carpeta del Memory Bank
    if (!fs.existsSync(memoryBankPath)) {
      console.log(`RAG Service: Memory Bank not found at ${memoryBankPath}`);
      return false;
    }
    
    // Conectar a LanceDB
    db = await lancedb.connect(memoryBankPath);
    console.log(`RAG Service: Connected to LanceDB at ${memoryBankPath}`);
    
    // Abrir tabla de chunks
    const tableNames = await db.tableNames();
    const tableName = 'code_chunks';
    
    if (tableNames.includes(tableName)) {
      table = await db.openTable(tableName);
      console.log(`RAG Service: Opened table ${tableName}`);
    } else {
      console.log(`RAG Service: Table ${tableName} not found - Memory Bank may need indexing`);
      return false;
    }
    
    // Detectar proyecto por defecto
    defaultProjectId = config.defaultProject || await detectDefaultProject(memoryBankPath);
    if (defaultProjectId) {
      console.log(`RAG Service: Using project ${defaultProjectId}`);
    } else {
      console.log('RAG Service: No default project configured');
    }
    
    initialized = true;
    return true;
  } catch (error) {
    console.error('RAG Service: Initialization error:', error);
    initialized = false;
    db = null;
    table = null;
    return false;
  }
}

/**
 * Obtiene el projectId configurado
 */
export function getProjectId(): string {
  return defaultProjectId;
}

/**
 * Establece el projectId por defecto
 */
export function setProjectId(projectId: string): void {
  defaultProjectId = projectId;
}

/**
 * Busca código similar usando embeddings
 * @param query Consulta de búsqueda
 * @param options Opciones de búsqueda
 */
export async function searchSimilarCode(
  query: string,
  options: { topK?: number; projectId?: string; minScore?: number } = {}
): Promise<SearchResult[]> {
  if (!initialized || !table) {
    const initOk = await initialize();
    if (!initOk) {
      console.log('RAG Service: Not initialized, returning empty results');
      return [];
    }
  }
  
  try {
    // Generar embedding para la query
    const queryVector = await openaiService.generateEmbeddings(query, 'text-embedding-3-small');
    
    // Configurar búsqueda
    const topK = options.topK || 10;
    const projectId = options.projectId || defaultProjectId;
    const minScore = options.minScore || 0.4;
    
    // Buscar en LanceDB
    let searchQuery = table.search(queryVector).limit(topK * 2); // Pedir más para filtrar después
    
    // Filtrar por proyecto si está especificado
    if (projectId) {
      searchQuery = searchQuery.where(`project_id = '${projectId}'`);
    }
    
    const results = await searchQuery.toArray();
    
    // Convertir y filtrar resultados
    const searchResults: SearchResult[] = [];
    
    for (const result of results) {
      // Calcular score (LanceDB devuelve distancia, convertir a similaridad)
      const distance = result._distance || 0;
      const score = 1 / (1 + distance); // Convertir distancia a score [0,1]
      
      if (score >= minScore) {
        searchResults.push({
          filePath: result.file_path,
          content: result.content,
          startLine: result.start_line,
          endLine: result.end_line,
          chunkType: result.chunk_type,
          name: result.name,
          language: result.language,
          score: score,
          projectId: result.project_id
        });
      }
      
      // Limitar a topK resultados
      if (searchResults.length >= topK) {
        break;
      }
    }
    
    return searchResults;
  } catch (error) {
    console.error('RAG Service: Search error:', error);
    return [];
  }
}

/**
 * Construye el contexto de búsqueda para el prompt
 */
function buildContextFromResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return '';
  }
  
  let context = '\n\n### Contexto relevante del proyecto:\n\n';
  
  for (const result of results) {
    context += `#### ${result.filePath} (${result.language}, líneas ${result.startLine}-${result.endLine})\n`;
    if (result.name) {
      context += `**${result.chunkType}**: ${result.name}\n`;
    }
    context += '```' + result.language + '\n';
    context += result.content;
    context += '\n```\n\n';
  }
  
  return context;
}

/**
 * Analiza código con contexto RAG
 */
export async function analyzeCode(
  code: string,
  filePath: string,
  language: string
): Promise<RAGResult> {
  // Buscar código similar para contexto
  const contextQuery = `Analizar código ${language}: ${code.substring(0, 500)}`;
  const similarCode = await searchSimilarCode(contextQuery, { topK: 5 });
  const context = buildContextFromResults(similarCode);
  
  // Construir prompt con contexto
  const prompt = `Eres un experto analizador de código. Analiza el siguiente código ${language} y proporciona:
1. Un resumen de lo que hace el código
2. Posibles problemas o mejoras
3. Buenas prácticas que se siguen o que faltan
4. Sugerencias de refactoring si aplican

${context}

### Código a analizar (${filePath}):
\`\`\`${language}
${code}
\`\`\`

Proporciona un análisis detallado y constructivo.`;

  try {
    const result = await openaiService.generateCompletion(prompt, {
      taskType: 'analysis',
      temperature: 0.2
    });
    
    return {
      content: result.content,
      modelInfo: result.modelInfo ? {
        name: result.modelInfo.name,
        taskType: result.modelInfo.taskType
      } : undefined,
      tokenCount: result.tokenCount ? {
        prompt: result.tokenCount.prompt,
        completion: result.tokenCount.completion,
        total: result.tokenCount.total
      } : undefined,
      context: similarCode
    };
  } catch (error) {
    console.error('RAG Service: analyzeCode error:', error);
    throw error;
  }
}

/**
 * Corrige un error con contexto RAG
 */
export async function fixError(
  code: string,
  errorMessage: string,
  filePath: string,
  language: string
): Promise<RAGResult> {
  // Buscar código similar que pueda ayudar a resolver el error
  const contextQuery = `Error ${language} ${errorMessage}: solución corrección`;
  const similarCode = await searchSimilarCode(contextQuery, { topK: 5 });
  const context = buildContextFromResults(similarCode);
  
  // Construir prompt con contexto
  const prompt = `Eres un experto en ${language}. Corrige el siguiente error en el código.

### Error:
${errorMessage}

${context}

### Código con error (${filePath}):
\`\`\`${language}
${code}
\`\`\`

### Instrucciones:
1. Identifica la causa raíz del error
2. Proporciona el código corregido completo
3. Explica brevemente qué cambios realizaste y por qué

Responde con el código corregido en un bloque de código.`;

  try {
    const result = await openaiService.generateCompletion(prompt, {
      taskType: 'fix',
      temperature: 0.1
    });
    
    return {
      content: result.content,
      modelInfo: result.modelInfo ? {
        name: result.modelInfo.name,
        taskType: result.modelInfo.taskType
      } : undefined,
      tokenCount: result.tokenCount ? {
        prompt: result.tokenCount.prompt,
        completion: result.tokenCount.completion,
        total: result.tokenCount.total
      } : undefined,
      context: similarCode
    };
  } catch (error) {
    console.error('RAG Service: fixError error:', error);
    throw error;
  }
}

/**
 * Genera tests con contexto RAG
 */
export async function generateTests(
  code: string,
  filePath: string,
  language: string,
  framework: string = 'jest'
): Promise<RAGResult> {
  // Buscar tests similares en el proyecto para consistencia de estilo
  const contextQuery = `test spec ${framework} ${language} ejemplo`;
  const similarCode = await searchSimilarCode(contextQuery, { topK: 5 });
  const context = buildContextFromResults(similarCode);
  
  // Construir prompt con contexto
  const prompt = `Eres un experto en testing de ${language}. Genera tests completos para el siguiente código usando ${framework}.

${context}

### Código a testear (${filePath}):
\`\`\`${language}
${code}
\`\`\`

### Instrucciones:
1. Genera tests unitarios completos
2. Cubre casos positivos, negativos y edge cases
3. Usa mocks cuando sea necesario para dependencias externas
4. Sigue las convenciones de ${framework}
5. Incluye comentarios explicativos

Responde con los tests en un bloque de código.`;

  try {
    const result = await openaiService.generateCompletion(prompt, {
      taskType: 'test',
      temperature: 0.2
    });
    
    return {
      content: result.content,
      modelInfo: result.modelInfo ? {
        name: result.modelInfo.name,
        taskType: result.modelInfo.taskType
      } : undefined,
      tokenCount: result.tokenCount ? {
        prompt: result.tokenCount.prompt,
        completion: result.tokenCount.completion,
        total: result.tokenCount.total
      } : undefined,
      context: similarCode
    };
  } catch (error) {
    console.error('RAG Service: generateTests error:', error);
    throw error;
  }
}

/**
 * Obtiene documentación del proyecto desde el Memory Bank
 */
export async function getProjectDocs(
  projectId?: string
): Promise<{ type: string; content: string }[]> {
  const pid = projectId || defaultProjectId;
  if (!pid) {
    return [];
  }
  
  const docsPath = path.join(memoryBankPath, 'projects', pid, 'docs');
  const docs: { type: string; content: string }[] = [];
  
  try {
    if (!fs.existsSync(docsPath)) {
      return [];
    }
    
    const files = fs.readdirSync(docsPath);
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const docType = file.replace('.md', '');
        const content = fs.readFileSync(path.join(docsPath, file), 'utf-8');
        docs.push({ type: docType, content });
      }
    }
  } catch (error) {
    console.error('RAG Service: Error reading project docs:', error);
  }
  
  return docs;
}

/**
 * Enriquece el contexto con información del Memory Bank
 */
export async function enrichContext(
  query: string,
  options: { includeProjectDocs?: boolean; topK?: number; projectId?: string } = {}
): Promise<{
  codeContext: SearchResult[];
  projectDocs: { type: string; content: string }[];
}> {
  const codeContext = await searchSimilarCode(query, {
    topK: options.topK || 5,
    projectId: options.projectId
  });
  
  let projectDocs: { type: string; content: string }[] = [];
  if (options.includeProjectDocs !== false) {
    projectDocs = await getProjectDocs(options.projectId);
  }
  
  return { codeContext, projectDocs };
}

/**
 * Limpia los recursos del servicio
 */
export function dispose(): void {
  initialized = false;
  db = null;
  table = null;
  memoryBankPath = '';
  defaultProjectId = '';
}

/**
 * Verifica si el servicio está inicializado
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Obtiene estadísticas del índice
 */
export async function getIndexStats(): Promise<{
  totalChunks: number;
  projects: string[];
  languages: string[];
} | null> {
  if (!initialized || !table) {
    return null;
  }
  
  try {
    // Obtener todos los registros para estadísticas
    const allRecords = await table.search([0]).limit(1).toArray();
    
    // Por ahora retornar info básica
    return {
      totalChunks: 0, // TODO: Implementar count real
      projects: defaultProjectId ? [defaultProjectId] : [],
      languages: []
    };
  } catch (error) {
    console.error('RAG Service: Error getting stats:', error);
    return null;
  }
}
