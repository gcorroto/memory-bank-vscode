/**
 * @fileoverview Relations Analyzer Service
 * Analyzes code relationships using hybrid approach: AST parsing + AI enrichment
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Use fs.promises for async file operations
const fsAsync = fs.promises;
import { getMemoryBankService } from './memoryBankService';
import * as openaiService from './openaiService';
import {
  ProjectRelations,
  RelationNode,
  RelationEdge,
  RelationNodeType,
  RelationEdgeType,
  RelationsStats,
  OutdatedCheckResult,
  AnalysisProgress,
  AnalysisOptions,
  NODE_TYPE_PATTERNS,
} from '../types/relations';

// ============================================
// Performance Configuration
// ============================================
/** Number of files to process in parallel */
const PARALLEL_FILE_READS = 20;
/** Progress update frequency (every N files) */
const PROGRESS_UPDATE_INTERVAL = 10;
/** Max AI enrichment calls in parallel */
const PARALLEL_AI_CALLS = 5;

// Current schema version
const RELATIONS_VERSION = '1.0.0';

// Progress callback type
type ProgressCallback = (progress: AnalysisProgress) => void;

/**
 * Get the path to the relations.json file for a project
 */
function getRelationsPath(projectId: string): string | null {
  const mbPath = getMemoryBankService().getMemoryBankPath();
  if (!mbPath) return null;
  return path.join(mbPath, 'projects', projectId, 'relations.json');
}

/**
 * Load existing relations from JSON file
 */
export async function loadRelations(projectId: string): Promise<ProjectRelations | null> {
  const relationsPath = getRelationsPath(projectId);
  if (!relationsPath) return null;

  try {
    if (!fs.existsSync(relationsPath)) {
      return null;
    }
    const content = fs.readFileSync(relationsPath, 'utf-8');
    return JSON.parse(content) as ProjectRelations;
  } catch (error) {
    console.error('Error loading relations:', error);
    return null;
  }
}

/**
 * Save relations to JSON file
 */
export async function saveRelations(relations: ProjectRelations): Promise<boolean> {
  const relationsPath = getRelationsPath(relations.projectId);
  if (!relationsPath) return false;

  try {
    // Ensure directory exists
    const dir = path.dirname(relationsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(relationsPath, JSON.stringify(relations, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving relations:', error);
    return false;
  }
}

/**
 * Calculate hash of index-metadata to detect changes
 */
async function calculateSourceHash(projectId: string): Promise<string> {
  const mbService = getMemoryBankService();
  const indexMeta = await mbService.loadIndexMetadata();
  
  if (!indexMeta) {
    return '';
  }

  // Hash the files object to detect changes
  const content = JSON.stringify(indexMeta.files);
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Check if the relations analysis is outdated
 */
export async function isOutdated(projectId: string): Promise<OutdatedCheckResult> {
  const relations = await loadRelations(projectId);
  
  if (!relations) {
    return {
      isOutdated: true,
      reason: 'No analysis found'
    };
  }

  const currentHash = await calculateSourceHash(projectId);
  
  if (relations.sourceHash !== currentHash) {
    return {
      isOutdated: true,
      reason: 'Source files have changed since last analysis',
      currentHash,
      storedHash: relations.sourceHash
    };
  }

  return {
    isOutdated: false,
    currentHash,
    storedHash: relations.sourceHash
  };
}

/**
 * Detect node type from file path
 */
function detectNodeType(filePath: string): RelationNodeType {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  
  // Check each path part against known patterns
  for (const part of parts) {
    for (const [pattern, type] of Object.entries(NODE_TYPE_PATTERNS)) {
      if (part === pattern || part.endsWith(pattern)) {
        return type;
      }
    }
  }

  // Check filename patterns
  const filename = path.basename(filePath, path.extname(filePath)).toLowerCase();
  
  if (filename.endsWith('controller')) return 'controller';
  if (filename.endsWith('service')) return 'service';
  if (filename.endsWith('repository') || filename.endsWith('repo')) return 'repository';
  if (filename.endsWith('dao')) return 'dao';
  if (filename.endsWith('util') || filename.endsWith('utils') || filename.endsWith('helper')) return 'util';
  if (filename.endsWith('model') || filename.endsWith('entity') || filename.endsWith('dto')) return 'model';
  if (filename.endsWith('component')) return 'component';
  if (filename.endsWith('config') || filename.endsWith('configuration')) return 'config';
  if (filename.endsWith('middleware')) return 'middleware';
  if (filename.endsWith('handler')) return 'handler';
  if (filename.endsWith('adapter')) return 'adapter';
  if (filename.endsWith('factory')) return 'factory';

  return 'class';
}

/**
 * Parse imports from file content
 */
function parseImports(content: string, language: string): string[] {
  const imports: string[] = [];

  // JavaScript/TypeScript imports
  if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'js', 'ts', 'jsx', 'tsx'].includes(language)) {
    // ES6 imports: import X from 'path'
    const es6Regex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*\s*from\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6Regex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // CommonJS requires: require('path')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  // Python imports - improved detection
  if (['python', 'py'].includes(language)) {
    let match;
    
    // from X import Y, Z (absolute imports)
    // from .X import Y (relative imports)
    // from ..X import Y (parent relative imports)
    const fromImportRegex = /from\s+(\.{0,3}[\w.]*)\s+import\s+([\w,\s*]+)/g;
    while ((match = fromImportRegex.exec(content)) !== null) {
      const modulePath = match[1];
      const importedNames = match[2];
      
      // Add the module path
      if (modulePath && modulePath !== '.') {
        imports.push(modulePath);
      }
      
      // Also track what's being imported (helps with resolution)
      const names = importedNames.split(',').map(n => n.trim().split(' as ')[0].trim());
      for (const name of names) {
        if (name && name !== '*') {
          // Could be importing a submodule
          if (modulePath && modulePath !== '.') {
            imports.push(`${modulePath}.${name}`);
          } else {
            imports.push(name);
          }
        }
      }
    }

    // import X, Y as Z (absolute imports)
    const importRegex = /^import\s+([\w.,\s]+)/gm;
    while ((match = importRegex.exec(content)) !== null) {
      const modules = match[1].split(',');
      for (const mod of modules) {
        const moduleName = mod.trim().split(' as ')[0].trim();
        if (moduleName) {
          imports.push(moduleName);
        }
      }
    }
  }

  // Java imports
  if (['java'].includes(language)) {
    const javaImportRegex = /import\s+([\w.]+);/g;
    let match;
    while ((match = javaImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return [...new Set(imports)]; // Remove duplicates
}

/**
 * Extract class/function names from content
 */
function extractNames(content: string, language: string): { classes: string[]; functions: string[] } {
  const classes: string[] = [];
  const functions: string[] = [];

  if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'js', 'ts', 'jsx', 'tsx'].includes(language)) {
    // Classes
    const classRegex = /class\s+(\w+)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }

    // Functions (named)
    const funcRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*:\s*(?:async\s*)?\([^)]*\)\s*(?:=>|{))/g;
    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      if (name && !['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
        functions.push(name);
      }
    }

    // Methods in class
    const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g;
    while ((match = methodRegex.exec(content)) !== null) {
      const name = match[1];
      if (name && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(name)) {
        functions.push(name);
      }
    }
  }

  if (['python', 'py'].includes(language)) {
    // Classes
    const classRegex = /class\s+(\w+)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }

    // Functions
    const funcRegex = /def\s+(\w+)/g;
    while ((match = funcRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }
  }

  if (['java'].includes(language)) {
    // Classes
    const classRegex = /(?:public|private|protected)?\s*class\s+(\w+)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }

    // Methods
    const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/g;
    while ((match = methodRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }
  }

  return {
    classes: [...new Set(classes)],
    functions: [...new Set(functions)]
  };
}

/** Type names in Spanish for descriptions */
const TYPE_NAMES_ES: Record<string, string> = {
  'component': 'Componente',
  'service': 'Servicio',
  'controller': 'Controlador',
  'model': 'Modelo',
  'util': 'Utilidad',
  'hook': 'Hook',
  'class': 'Clase',
  'config': 'Configuración',
  'test': 'Test',
  'other': 'Módulo'
};

/**
 * Generate simple description for a node (sync, no AI)
 */
function generateSimpleDescription(node: RelationNode): string {
  const typeName = TYPE_NAMES_ES[node.type] || node.type;
  return `${typeName} "${node.name}" con ${node.functions.length} función(es)`;
}

/**
 * Generate AI description for a node
 */
async function generateNodeDescription(node: RelationNode, useAI: boolean): Promise<string> {
  if (!useAI) {
    return generateSimpleDescription(node);
  }

  try {
    const prompt = `Describe brevemente en ESPAÑOL (1-2 oraciones máximo) qué hace este ${node.type} basándote en su nombre y funciones:
Nombre: ${node.name}
Tipo: ${node.type}
Funciones: ${node.functions.slice(0, 10).join(', ')}${node.functions.length > 10 ? '...' : ''}
Archivo: ${path.basename(node.filePath)}

IMPORTANTE: Responde SOLO con la descripción en español, sin prefijos ni explicaciones.`;

    const result = await openaiService.generateCompletion(prompt, {
      temperature: 0.3,
      taskType: 'analysis'
    });

    return result.content.trim().substring(0, 200); // Limit length
  } catch (error) {
    console.error('Error generating AI description:', error);
    return generateSimpleDescription(node);
  }
}

/**
 * Normalize a file path for comparison
 */
function normalizePath(filePath: string): string {
  // Convert to forward slashes, lowercase, remove leading dots/slashes
  return filePath
    .replace(/\\/g, '/')
    .toLowerCase()
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

/**
 * Get the significant part of a path (last N segments)
 */
function getPathSuffix(filePath: string, segments: number = 3): string {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/').filter(p => p);
  return parts.slice(-segments).join('/');
}

/**
 * Resolve import path to actual file node
 */
function resolveImportToNode(
  importPath: string, 
  sourceFilePath: string,
  nodesByFile: Map<string, RelationNode>
): RelationNode | null {
  const sourceLanguage = getLanguageFromPath(sourceFilePath);
  
  // Handle Python imports (use dots as path separators)
  if (sourceLanguage === 'python') {
    return resolvePythonImport(importPath, sourceFilePath, nodesByFile);
  }
  
  // Handle JS/TS imports
  return resolveJSImport(importPath, sourceFilePath, nodesByFile);
}

/**
 * Resolve Python import to node
 * Handles: from adapters.chat.base import X, from .base import X, import adapters.chat
 */
function resolvePythonImport(
  importPath: string,
  sourceFilePath: string,
  nodesByFile: Map<string, RelationNode>
): RelationNode | null {
  // Skip standard library and common external packages
  const externalPackages = ['os', 'sys', 'json', 'typing', 'abc', 'enum', 'dataclasses', 
    'datetime', 'pathlib', 'logging', 'asyncio', 'collections', 're', 'functools',
    'pydantic', 'fastapi', 'sqlalchemy', 'openai', 'langchain', 'langgraph', 'numpy', 'pandas'];
  
  const firstPart = importPath.replace(/^\.+/, '').split('.')[0];
  if (externalPackages.includes(firstPart)) {
    return null;
  }
  
  // Convert Python module path to file path
  // from adapters.chat.base -> adapters/chat/base.py
  // from .base -> ./base.py (relative)
  // from ..utils -> ../utils.py
  
  let modulePath = importPath;
  let isRelative = false;
  let upLevels = 0;
  
  // Handle relative imports
  if (modulePath.startsWith('.')) {
    isRelative = true;
    // Count dots for parent levels
    const dotMatch = modulePath.match(/^(\.+)/);
    if (dotMatch) {
      upLevels = dotMatch[1].length - 1; // . = current, .. = parent, etc.
      modulePath = modulePath.substring(dotMatch[1].length);
    }
  }
  
  // Convert dots to path separators
  const pathParts = modulePath.split('.').filter(p => p);
  
  // Build search patterns
  const searchPatterns: string[] = [];
  
  if (isRelative) {
    // Relative import - resolve from source directory
    const sourceDir = path.dirname(sourceFilePath);
    const sourceParts = normalizePath(sourceDir).split('/');
    
    // Go up levels for .. imports
    const baseParts = sourceParts.slice(0, sourceParts.length - upLevels);
    const basePath = baseParts.join('/');
    
    if (pathParts.length > 0) {
      searchPatterns.push(`${basePath}/${pathParts.join('/')}`);
    }
  } else {
    // Absolute import - search anywhere in project
    if (pathParts.length > 0) {
      searchPatterns.push(pathParts.join('/'));
    }
  }
  
  // Try to find matching node
  for (const pattern of searchPatterns) {
    const normalizedPattern = pattern.toLowerCase();
    
    for (const [nodePath, node] of nodesByFile.entries()) {
      const normalizedNodePath = normalizePath(nodePath).toLowerCase();
      
      // Check if node path contains the import pattern
      // adapters/chat/base matches .../adapters/chat/base_chat_adapter.py
      if (normalizedNodePath.includes(normalizedPattern)) {
        return node;
      }
      
      // Also check by class/module name
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart) {
        // Match node name (class name or file name without extension)
        const nodeBaseName = path.basename(nodePath, path.extname(nodePath)).toLowerCase();
        if (nodeBaseName === lastPart.toLowerCase() || 
            nodeBaseName.includes(lastPart.toLowerCase()) ||
            node.name.toLowerCase() === lastPart.toLowerCase()) {
          return node;
        }
      }
    }
  }
  
  return null;
}

/**
 * Get language from file path
 */
function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.py': 'python',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.java': 'java',
  };
  return langMap[ext] || 'unknown';
}

/**
 * Resolve JS/TS import to node
 */
function resolveJSImport(
  importPath: string, 
  sourceFilePath: string,
  nodesByFile: Map<string, RelationNode>
): RelationNode | null {
  // Skip external packages (node_modules, etc)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    // Could be a local module - check by name
    const importName = importPath.split('/').pop()?.replace(/\.(ts|js|tsx|jsx|py|java)$/, '');
    if (importName) {
      for (const node of nodesByFile.values()) {
        if (node.name.toLowerCase() === importName.toLowerCase()) {
          return node;
        }
      }
    }
    return null;
  }

  // Handle relative imports
  const sourceDir = path.dirname(sourceFilePath);
  const resolvedPath = path.resolve(sourceDir, importPath);
  const normalizedResolved = normalizePath(resolvedPath);
  
  // Try with different extensions
  const extensions = ['', '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '/index.ts', '/index.js'];
  
  for (const ext of extensions) {
    const targetPath = normalizedResolved + ext;
    const targetSuffix = getPathSuffix(targetPath, 4);
    
    // Check if we have a node for this file
    for (const [nodePath, node] of nodesByFile.entries()) {
      const nodeSuffix = getPathSuffix(nodePath, 4);
      
      // Match by path suffix (handles different base paths)
      if (targetSuffix.endsWith(nodeSuffix) || nodeSuffix.endsWith(targetSuffix)) {
        return node;
      }
      
      // Also try matching the filename directly
      const targetFile = path.basename(targetPath).replace(/\.(ts|js|tsx|jsx|py|java)$/, '');
      const nodeFile = path.basename(nodePath).replace(/\.(ts|js|tsx|jsx|py|java)$/, '');
      if (targetFile === nodeFile) {
        // Additional check: verify path contains similar folder structure
        const targetDir = path.dirname(targetPath).split('/').pop();
        const nodeDir = path.dirname(normalizePath(nodePath)).split('/').pop();
        if (targetDir === nodeDir) {
          return node;
        }
      }
    }
  }

  return null;
}

/**
 * Files to skip in analysis (noise files)
 */
const SKIP_FILES = [
  '__init__.py',      // Python package markers - add noise
  '__init__.ts',      // TypeScript barrel files (usually just re-exports)
  'conftest.py',      // Pytest configuration
  '__pycache__',      // Python cache
];

/**
 * Check if a file should be skipped
 */
function shouldSkipFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  return SKIP_FILES.some(skip => fileName === skip || filePath.includes(skip));
}

/**
 * Analyze a single file and create a node (sync version - only regex, no I/O)
 */
function analyzeFileSync(
  filePath: string, 
  content: string, 
  language: string
): RelationNode | null {
  try {
    // Skip noise files
    if (shouldSkipFile(filePath)) {
      return null;
    }
    
    const { classes, functions } = extractNames(content, language);
    
    // Skip files with no classes or functions
    if (classes.length === 0 && functions.length === 0) {
      return null;
    }

    const nodeType = detectNodeType(filePath);
    const name = classes[0] || path.basename(filePath, path.extname(filePath));

    const node: RelationNode = {
      id: crypto.createHash('md5').update(filePath).digest('hex').substring(0, 12),
      type: nodeType,
      name: name,
      filePath: filePath,
      description: '', // Will be enriched later
      functions: functions,
      language: language
    };

    return node;
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
    return null;
  }
}

/**
 * Build edges from imports and calls
 */
function buildEdges(
  nodes: RelationNode[],
  fileContents: Map<string, { content: string; language: string }>
): RelationEdge[] {
  const edges: RelationEdge[] = [];
  const nodesByFile = new Map<string, RelationNode>();
  
  // Build lookup map - use normalized paths
  for (const node of nodes) {
    nodesByFile.set(node.filePath, node);
    // Also add with normalized path for better matching
    const normalized = normalizePath(node.filePath);
    nodesByFile.set(normalized, node);
  }

  console.log(`[Relations] Building edges for ${nodes.length} nodes`);
  let totalImports = 0;
  let resolvedImports = 0;

  // Analyze each file for imports
  for (const node of nodes) {
    const fileData = fileContents.get(node.filePath);
    if (!fileData) continue;

    const imports = parseImports(fileData.content, fileData.language);
    totalImports += imports.length;
    
    for (const importPath of imports) {
      const targetNode = resolveImportToNode(importPath, node.filePath, nodesByFile);
      
      if (targetNode && targetNode.id !== node.id) {
        resolvedImports++;
        const edgeId = `${node.id}-${targetNode.id}`;
        
        // Check if edge already exists
        if (!edges.find(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: node.id,
            target: targetNode.id,
            type: 'imports',
            label: `imports ${targetNode.name}`
          });
        }
      }
    }
  }

  console.log(`[Relations] Found ${totalImports} imports, resolved ${resolvedImports}, created ${edges.length} edges`);
  return edges;
}

/**
 * Extract keywords from a project ID
 * Example: MY_PROJECT_API -> ['my', 'project', 'api']
 */
function extractKeywords(projectId: string): string[] {
  return projectId
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter(k => k.length > 2); // Ignore very short words
}

/**
 * Find the most likely project folder from indexed files using keyword matching
 */
function findProjectFolder(
  files: [string, any][],
  projectId: string
): string | null {
  const keywords = extractKeywords(projectId);
  if (keywords.length === 0) return null;
  
  // Score each unique folder by how many keywords it contains
  const folderScores = new Map<string, number>();
  
  for (const [filePath] of files) {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    const parts = normalizedPath.split('/');
    
    // Find folder names (skip files and special dirs like ../, node_modules, etc.)
    for (const part of parts) {
      if (part === '..' || part === '.' || part === 'node_modules' || 
          part === 'dist' || part === 'build' || part.includes('.')) {
        continue;
      }
      
      // Count matching keywords
      let score = 0;
      for (const keyword of keywords) {
        if (part.includes(keyword)) {
          score++;
        }
      }
      
      if (score > 0) {
        const currentScore = folderScores.get(part) || 0;
        folderScores.set(part, Math.max(currentScore, score));
      }
    }
  }
  
  // Find the folder with the highest score
  let bestFolder = null;
  let bestScore = 0;
  
  for (const [folder, score] of folderScores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestFolder = folder;
    }
  }
  
  console.log(`[Relations] Project "${projectId}" keywords: [${keywords.join(', ')}]`);
  if (bestFolder) {
    console.log(`[Relations] Best matching folder: "${bestFolder}" (score: ${bestScore})`);
  }
  
  return bestFolder;
}

/**
 * Filter files that belong to a specific project
 * Uses intelligent keyword matching to find the right folder
 */
function filterFilesByProject(
  files: [string, any][],
  projectId: string
): [string, any][] {
  // First, try exact patterns
  const normalizedId = projectId.toLowerCase();
  const exactPatterns = [
    normalizedId,
    normalizedId.replace(/_/g, '-'),
    normalizedId.replace(/-/g, '_'),
    normalizedId.replace(/[_-]/g, ''),
  ];

  // Try exact pattern match first
  let filtered = files.filter(([filePath]) => {
    const lowerPath = filePath.toLowerCase();
    return exactPatterns.some(pattern => {
      const regex = new RegExp(`[/\\\\]${pattern}[/\\\\]`, 'i');
      return regex.test(lowerPath);
    });
  });

  // If no exact matches, use keyword-based folder detection
  if (filtered.length === 0) {
    console.log(`[Relations] No exact match for "${projectId}", trying keyword detection...`);
    
    const projectFolder = findProjectFolder(files, projectId);
    
    if (projectFolder) {
      filtered = files.filter(([filePath]) => {
        const lowerPath = filePath.replace(/\\/g, '/').toLowerCase();
        // Match the folder anywhere in the path
        const regex = new RegExp(`[/]${projectFolder}[/]`, 'i');
        return regex.test(lowerPath);
      });
      
      console.log(`[Relations] Found ${filtered.length} files in folder "${projectFolder}"`);
    }
  }

  return filtered;
}

/**
 * Load project config from metadata.json (contains sourcePath)
 */
async function loadProjectConfig(projectId: string): Promise<{ sourcePath?: string } | null> {
  try {
    const mbService = getMemoryBankService();
    const mbPath = mbService.getMemoryBankPath();
    if (!mbPath) return null;
    
    const metadataPath = path.join(
      path.dirname(mbPath), 
      'projects', 
      projectId, 
      'docs', 
      'metadata.json'
    );
    
    if (!fs.existsSync(metadataPath)) {
      console.log(`[Relations] No metadata.json found for project ${projectId}`);
      return null;
    }
    
    const content = fs.readFileSync(metadataPath, 'utf-8');
    const data = JSON.parse(content);
    
    if (data._projectConfig?.sourcePath) {
      console.log(`[Relations] Found sourcePath in config: ${data._projectConfig.sourcePath}`);
      return data._projectConfig;
    }
    
    return null;
  } catch (error) {
    console.error(`[Relations] Error loading project config:`, error);
    return null;
  }
}

/**
 * Main analysis function
 */
export async function analyzeProject(
  projectId: string,
  options: AnalysisOptions = {},
  onProgress?: ProgressCallback
): Promise<ProjectRelations> {
  const startTime = Date.now();
  const mbService = getMemoryBankService();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Relations] Starting analysis for project: ${projectId}`);
  console.log(`[Relations] Options: useAI=${options.useAI ?? true}, maxFiles=${options.maxFiles ?? 'unlimited'}`);
  console.log(`${'='.repeat(60)}`);
  
  // Load index metadata
  const mbPath = mbService.getMemoryBankPath();
  console.log(`[Relations] MemoryBank path: ${mbPath || 'NOT CONFIGURED'}`);
  
  const indexMeta = await mbService.loadIndexMetadata();
  if (!indexMeta) {
    console.error(`[Relations] ERROR: No index-metadata.json found in ${mbPath}`);
    throw new Error('No index metadata found. Ensure the project has been indexed with Memory Bank MCP.');
  }
  
  console.log(`[Relations] Index metadata loaded:`);
  console.log(`[Relations]   - Total indexed files: ${Object.keys(indexMeta.files || {}).length}`);
  console.log(`[Relations]   - Total chunks: ${(indexMeta as any).stats?.totalChunks || 'unknown'}`);
  console.log(`[Relations]   - Last updated: ${(indexMeta as any).stats?.lastUpdated || 'unknown'}`);

  // First, try to get sourcePath from project config
  const projectConfig = await loadProjectConfig(projectId);
  const allFiles = Object.entries(indexMeta.files || {});
  
  if (allFiles.length === 0) {
    console.error(`[Relations] ERROR: index-metadata.json has 0 files`);
    throw new Error('Index metadata contains no files. Re-index the project with Memory Bank MCP.');
  }
  
  // Log sample of indexed files for debugging
  console.log(`[Relations] Sample of indexed files (first 5):`);
  allFiles.slice(0, 5).forEach(([f]) => console.log(`[Relations]   - ${f}`));
  
  let projectFiles: [string, any][];
  
  if (projectConfig?.sourcePath) {
    // Use sourcePath from config - filter files that start with this path
    const sourcePath = projectConfig.sourcePath.toLowerCase();
    console.log(`[Relations] Using sourcePath from config: "${projectConfig.sourcePath}"`);
    projectFiles = allFiles.filter(([filePath]) => {
      const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
      return normalizedPath.includes(sourcePath);
    });
    console.log(`[Relations] Files matching sourcePath: ${projectFiles.length}`);
  } else {
    // Fallback to heuristic detection
    console.log(`[Relations] No sourcePath in config, using heuristic detection for "${projectId}"...`);
    projectFiles = filterFilesByProject(allFiles, projectId);
  }
  
  console.log(`[Relations] Project ${projectId}: Found ${projectFiles.length} files out of ${allFiles.length} total`);
  
  if (projectFiles.length === 0) {
    console.error(`[Relations] ERROR: No files matched project filter`);
    console.error(`[Relations] Tried patterns: ${projectId.toLowerCase()}, ${projectId.replace(/_/g, '-').toLowerCase()}`);
    throw new Error(`No files found for project "${projectId}". Check that the project folder name matches or re-index the project to update sourcePath.`);
  }
  
  // Log languages distribution
  const langCounts: Record<string, number> = {};
  projectFiles.forEach(([f]) => {
    const ext = path.extname(f).toLowerCase();
    langCounts[ext] = (langCounts[ext] || 0) + 1;
  });
  console.log(`[Relations] File types: ${JSON.stringify(langCounts)}`);
  
  // Supported extensions
  const supportedExts = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java'];
  const supportedFiles = projectFiles.filter(([f]) => supportedExts.includes(path.extname(f).toLowerCase()));
  console.log(`[Relations] Supported language files: ${supportedFiles.length} (${supportedExts.join(', ')})`);
  
  if (supportedFiles.length === 0) {
    console.warn(`[Relations] WARNING: No files with supported extensions found`);
  }

  const files = projectFiles;
  const totalFiles = Math.min(files.length, options.maxFiles || Infinity);
  const filesToProcess = files.slice(0, totalFiles);
  
  console.log(`[Relations] Phase 1: Parsing ${totalFiles} files (parallel: ${PARALLEL_FILE_READS})...`);
  
  const nodes: RelationNode[] = [];
  const fileContents = new Map<string, { content: string; language: string }>();
  
  // Stats for debugging
  let skippedNotExists = 0;
  let skippedUnknownLang = 0;
  let skippedNoContent = 0;
  
  // Get base directory (mbPath already declared above)
  if (!mbPath) {
    throw new Error('MemoryBank path not configured');
  }
  const baseDir = path.dirname(mbPath);
  
  // Language map
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.js': 'javascript',
    '.tsx': 'typescriptreact',
    '.jsx': 'javascriptreact',
    '.py': 'python',
    '.java': 'java',
  };
  
  // Phase 1: Parse files in parallel batches
  let processedFiles = 0;
  
  // Process files in parallel batches
  for (let i = 0; i < filesToProcess.length; i += PARALLEL_FILE_READS) {
    const batch = filesToProcess.slice(i, i + PARALLEL_FILE_READS);
    
    // Update progress at batch start
    onProgress?.({
      phase: 'parsing',
      currentFile: `Batch ${Math.floor(i / PARALLEL_FILE_READS) + 1}/${Math.ceil(filesToProcess.length / PARALLEL_FILE_READS)}`,
      processedFiles,
      totalFiles,
      processedNodes: nodes.length
    });
    
    // Process batch in parallel
    const batchPromises = batch.map(async ([filePath, entry]) => {
      try {
        const ext = path.extname(filePath).toLowerCase();
        const language = langMap[ext];
        
        // Skip unknown languages early (no I/O needed)
        if (!language) {
          return { skipped: 'unknown_lang' as const };
        }
        
        const resolvedPath = path.resolve(baseDir, filePath);
        
        // Check if file exists (async)
        try {
          await fsAsync.access(resolvedPath, fs.constants.R_OK);
        } catch {
          return { skipped: 'not_exists' as const };
        }
        
        // Read file content (async)
        const content = await fsAsync.readFile(resolvedPath, 'utf-8') as string;
        
        // Analyze file (sync but fast - just regex)
        const node = analyzeFileSync(filePath, content, language);
        
        if (node) {
          return { node, filePath, content: content as string, language };
        } else {
          return { skipped: 'no_content' as const };
        }
      } catch (error) {
        console.error(`[Relations] Error processing ${filePath}:`, error);
        return { skipped: 'error' as const };
      }
    });
    
    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Collect results
    for (const result of batchResults) {
      if ('node' in result && result.node) {
        nodes.push(result.node);
        fileContents.set(result.filePath!, { content: result.content!, language: result.language! });
      } else if (result.skipped === 'not_exists') {
        skippedNotExists++;
      } else if (result.skipped === 'unknown_lang') {
        skippedUnknownLang++;
      } else if (result.skipped === 'no_content') {
        skippedNoContent++;
      }
      processedFiles++;
    }
    
    // Yield to event loop between batches (prevents UI freeze)
    await new Promise(resolve => setImmediate(resolve));
  }

  // Log parsing results
  console.log(`[Relations] Phase 1 complete:`);
  console.log(`[Relations]   - Processed: ${processedFiles} files`);
  console.log(`[Relations]   - Created nodes: ${nodes.length}`);
  console.log(`[Relations]   - Skipped (file not found): ${skippedNotExists}`);
  console.log(`[Relations]   - Skipped (unknown language): ${skippedUnknownLang}`);
  console.log(`[Relations]   - Skipped (no classes/functions): ${skippedNoContent}`);
  
  if (nodes.length === 0) {
    console.warn(`[Relations] WARNING: No nodes created! Check if files exist on disk and contain analyzable code.`);
    if (skippedNotExists > 0) {
      console.warn(`[Relations] HINT: ${skippedNotExists} files not found. BaseDir: ${baseDir}`);
      console.warn(`[Relations] Sample file paths in index:`);
      files.slice(0, 3).forEach(([f]) => console.warn(`[Relations]   - ${f}`));
    }
  }

  // Phase 2: Build edges (sync but fast)
  console.log(`[Relations] Phase 2: Building edges from imports...`);
  onProgress?.({
    phase: 'detecting',
    processedFiles: totalFiles,
    totalFiles,
    processedNodes: nodes.length
  });

  const edges = buildEdges(nodes, fileContents);
  console.log(`[Relations] Phase 2 complete: ${edges.length} edges created`);

  // Phase 3: Enrich with AI descriptions
  if (options.useAI !== false && nodes.length > 0) {
    console.log(`[Relations] Phase 3: Enriching ${nodes.length} nodes with AI (parallel: ${PARALLEL_AI_CALLS})...`);
    let enrichedCount = 0;
    const totalNodesToEnrich = nodes.length;
    
    // Process AI enrichment in parallel batches
    for (let i = 0; i < nodes.length; i += PARALLEL_AI_CALLS) {
      const batch = nodes.slice(i, i + PARALLEL_AI_CALLS);
      
      onProgress?.({
        phase: 'enriching',
        currentFile: `Batch ${Math.floor(i / PARALLEL_AI_CALLS) + 1}/${Math.ceil(nodes.length / PARALLEL_AI_CALLS)}`,
        processedFiles: totalFiles,
        totalFiles,
        processedNodes: enrichedCount,
        totalNodes: totalNodesToEnrich
      });
      
      // Process batch in parallel
      const descriptions = await Promise.all(
        batch.map(node => generateNodeDescription(node, true))
      );
      
      // Apply descriptions
      batch.forEach((node, idx) => {
        node.description = descriptions[idx];
      });
      
      enrichedCount += batch.length;
      
      // Yield to event loop between batches
      await new Promise(resolve => setImmediate(resolve));
    }
    
    console.log(`[Relations] Phase 3 complete: ${enrichedCount} nodes enriched`);
    
    // Final progress for enriching phase
    onProgress?.({
      phase: 'enriching',
      processedFiles: totalFiles,
      totalFiles,
      processedNodes: totalNodesToEnrich,
      totalNodes: totalNodesToEnrich
    });
  } else {
    // Generate simple descriptions without AI (sync, fast)
    console.log(`[Relations] Phase 3: Generating simple descriptions (no AI)...`);
    for (const node of nodes) {
      node.description = generateSimpleDescription(node);
    }
    console.log(`[Relations] Phase 3 complete`);
  }

  // Calculate stats
  const nodesByType: Record<RelationNodeType, number> = {} as Record<RelationNodeType, number>;
  for (const node of nodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  const stats: RelationsStats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodesByType,
    analyzedFiles: processedFiles,
    analysisTimeMs: Date.now() - startTime
  };

  // Build final relations object
  const sourceHash = await calculateSourceHash(projectId);
  
  const relations: ProjectRelations = {
    version: RELATIONS_VERSION,
    projectId,
    lastAnalyzed: Date.now(),
    sourceHash,
    nodes,
    edges,
    stats
  };

  // Phase 4: Save
  console.log(`[Relations] Phase 4: Saving relations...`);
  onProgress?.({
    phase: 'saving',
    processedFiles: totalFiles,
    totalFiles,
    processedNodes: nodes.length
  });

  await saveRelations(relations);
  
  // Final summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Relations] ANALYSIS COMPLETE for "${projectId}"`);
  console.log(`${'='.repeat(60)}`);
  console.log(`[Relations] Results:`);
  console.log(`[Relations]   - Nodes: ${nodes.length}`);
  console.log(`[Relations]   - Edges: ${edges.length}`);
  console.log(`[Relations]   - Files analyzed: ${processedFiles}`);
  console.log(`[Relations]   - Time: ${elapsed}s`);
  console.log(`[Relations] Node types: ${JSON.stringify(nodesByType)}`);
  console.log(`${'='.repeat(60)}\n`);

  return relations;
}

/**
 * Get relations status for a project
 */
export async function getRelationsStatus(projectId: string): Promise<{
  status: 'none' | 'ready' | 'outdated';
  relations: ProjectRelations | null;
  outdatedInfo?: OutdatedCheckResult;
}> {
  const relations = await loadRelations(projectId);
  
  if (!relations) {
    return { status: 'none', relations: null };
  }

  const outdatedInfo = await isOutdated(projectId);
  
  return {
    status: outdatedInfo.isOutdated ? 'outdated' : 'ready',
    relations,
    outdatedInfo
  };
}
