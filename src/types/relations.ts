/**
 * @fileoverview Types for Code Relations Dataflow
 * Defines structures for analyzing and visualizing code relationships
 */

/**
 * Types of relation nodes based on architectural role
 */
export type RelationNodeType = 
  | 'controller' 
  | 'service' 
  | 'repository' 
  | 'dao' 
  | 'util' 
  | 'model' 
  | 'component' 
  | 'function' 
  | 'class'
  | 'module'
  | 'config'
  | 'middleware'
  | 'handler'
  | 'adapter'
  | 'factory'
  | 'unknown';

/**
 * Types of relationships between nodes
 */
export type RelationEdgeType = 
  | 'calls' 
  | 'imports' 
  | 'extends' 
  | 'implements' 
  | 'uses'
  | 'injects'
  | 'creates';

/**
 * A node in the relations graph representing a code unit (class, module, function)
 */
export interface RelationNode {
  /** Unique identifier for the node */
  id: string;
  /** Architectural type of this node */
  type: RelationNodeType;
  /** Display name (class name, function name, etc.) */
  name: string;
  /** Full file path */
  filePath: string;
  /** AI-generated description of what this node does */
  description: string;
  /** List of functions/methods in this node */
  functions: string[];
  /** Start line in the file */
  startLine?: number;
  /** End line in the file */
  endLine?: number;
  /** Language of the code */
  language?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * An edge in the relations graph representing a relationship between nodes
 */
export interface RelationEdge {
  /** Unique identifier for the edge */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Type of relationship */
  type: RelationEdgeType;
  /** Optional label describing the relationship */
  label?: string;
  /** Functions involved in this relationship */
  sourceFunctions?: string[];
  /** Target functions being called */
  targetFunctions?: string[];
}

/**
 * Complete project relations data structure
 */
export interface ProjectRelations {
  /** Schema version */
  version: string;
  /** Project identifier */
  projectId: string;
  /** Timestamp of last analysis */
  lastAnalyzed: number;
  /** Hash of index-metadata.json to detect changes */
  sourceHash: string;
  /** All nodes in the graph */
  nodes: RelationNode[];
  /** All edges connecting nodes */
  edges: RelationEdge[];
  /** Analysis statistics */
  stats?: RelationsStats;
}

/**
 * Statistics about the relations analysis
 */
export interface RelationsStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<RelationNodeType, number>;
  analyzedFiles: number;
  analysisTimeMs: number;
}

/**
 * Status of the relations analysis
 */
export type RelationsStatus = 'none' | 'analyzing' | 'ready' | 'outdated' | 'error';

/**
 * Result of checking if relations are outdated
 */
export interface OutdatedCheckResult {
  isOutdated: boolean;
  reason?: string;
  currentHash?: string;
  storedHash?: string;
}

/**
 * Analysis progress information
 */
export interface AnalysisProgress {
  phase: 'parsing' | 'detecting' | 'enriching' | 'saving';
  currentFile?: string;
  processedFiles: number;
  totalFiles: number;
  processedNodes: number;
  totalNodes?: number;
}

/**
 * Options for the analysis process
 */
export interface AnalysisOptions {
  /** Whether to use AI for enriching descriptions */
  useAI?: boolean;
  /** Maximum number of files to analyze */
  maxFiles?: number;
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Whether to force re-analysis even if not outdated */
  force?: boolean;
}

/**
 * Mapping of file path patterns to node types
 */
export const NODE_TYPE_PATTERNS: Record<string, RelationNodeType> = {
  'controller': 'controller',
  'controllers': 'controller',
  'service': 'service',
  'services': 'service',
  'repository': 'repository',
  'repositories': 'repository',
  'repo': 'repository',
  'dao': 'dao',
  'daos': 'dao',
  'util': 'util',
  'utils': 'util',
  'helper': 'util',
  'helpers': 'util',
  'model': 'model',
  'models': 'model',
  'entity': 'model',
  'entities': 'model',
  'dto': 'model',
  'component': 'component',
  'components': 'component',
  'config': 'config',
  'configuration': 'config',
  'middleware': 'middleware',
  'middlewares': 'middleware',
  'handler': 'handler',
  'handlers': 'handler',
  'adapter': 'adapter',
  'adapters': 'adapter',
  'factory': 'factory',
  'factories': 'factory',
};

/**
 * Icons for each node type (VS Code ThemeIcon names)
 */
export const NODE_TYPE_ICONS: Record<RelationNodeType, string> = {
  'controller': 'symbol-interface',
  'service': 'symbol-method',
  'repository': 'database',
  'dao': 'database',
  'util': 'tools',
  'model': 'symbol-class',
  'component': 'symbol-misc',
  'function': 'symbol-function',
  'class': 'symbol-class',
  'module': 'symbol-module',
  'config': 'gear',
  'middleware': 'symbol-event',
  'handler': 'symbol-event',
  'adapter': 'plug',
  'factory': 'symbol-constructor',
  'unknown': 'symbol-file',
};

/**
 * Labels for each node type (for display)
 */
export const NODE_TYPE_LABELS: Record<RelationNodeType, string> = {
  'controller': 'Controller',
  'service': 'Service',
  'repository': 'Repository',
  'dao': 'DAO',
  'util': 'Utility',
  'model': 'Model',
  'component': 'Component',
  'function': 'Function',
  'class': 'Class',
  'module': 'Module',
  'config': 'Config',
  'middleware': 'Middleware',
  'handler': 'Handler',
  'adapter': 'Adapter',
  'factory': 'Factory',
  'unknown': 'Unknown',
};
