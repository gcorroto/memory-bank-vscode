/**
 * @fileoverview Types for Memory Bank Explorer
 * Defines interfaces for reading and displaying Memory Bank data
 */

/**
 * Entry for an indexed file in index-metadata.json
 */
export interface FileEntry {
  /** SHA-256 hash of the file content */
  hash: string;
  /** Timestamp of last indexing (milliseconds since epoch) */
  lastIndexed: number;
  /** Number of chunks created from this file */
  chunkCount: number;
}

/**
 * Root structure of index-metadata.json
 */
export interface IndexMetadata {
  /** Version of the index format */
  version: string;
  /** Timestamp of last global indexing */
  lastIndexed: number;
  /** Map of file paths to their metadata */
  files: Record<string, FileEntry>;
}

/**
 * Metadata for a single generated document
 */
export interface DocMetadata {
  /** Document type identifier */
  type: string;
  /** Timestamp of last generation */
  lastGenerated: number;
  /** Hash of input used for generation */
  lastInputHash: string;
  /** Number of reasoning tokens used */
  reasoningTokens: number;
  /** Number of output tokens generated */
  outputTokens: number;
}

/**
 * Structure of metadata.json in project docs folder
 */
export interface ProjectDocsMetadata {
  [docType: string]: DocMetadata;
}

/**
 * Project information for display in tree view
 */
export interface ProjectInfo {
  /** Project identifier */
  id: string;
  /** Path to the project docs folder */
  docsPath: string;
  /** Number of documents in the project */
  docCount: number;
  /** Timestamp of most recent document generation */
  lastUpdated: number;
  /** Document metadata if available */
  metadata?: ProjectDocsMetadata;
}

/**
 * Tree item types for Memory Bank views
 */
export enum MemoryBankItemType {
  Project = 'project',
  Folder = 'folder',
  File = 'file',
  Document = 'document'
}

/**
 * Base interface for tree items in Memory Bank views
 */
export interface MemoryBankTreeItem {
  /** Display label */
  label: string;
  /** Item type for icon/behavior */
  type: MemoryBankItemType;
  /** Full path to the item */
  path: string;
  /** Optional description for tooltip */
  description?: string;
  /** Child items (for folders/projects) */
  children?: MemoryBankTreeItem[];
}

/**
 * Indexed file tree item with metadata
 */
export interface IndexedFileItem extends MemoryBankTreeItem {
  type: MemoryBankItemType.File | MemoryBankItemType.Folder;
  /** File metadata from index */
  fileEntry?: FileEntry;
  /** Project ID this file belongs to */
  projectId?: string;
}

/**
 * Document tree item with generation info
 */
export interface DocumentItem extends MemoryBankTreeItem {
  type: MemoryBankItemType.Document;
  /** Document metadata */
  docMetadata?: DocMetadata;
  /** Parent project ID */
  projectId: string;
  /** Document type (e.g., 'projectBrief', 'techContext') */
  docType: string;
}

/**
 * Known document types in Memory Bank
 */
export const KNOWN_DOC_TYPES = [
  'projectBrief',
  'productContext',
  'systemPatterns',
  'techContext',
  'activeContext',
  'progress',
  'decisionLog',
  'agentBoard'
] as const;

export type KnownDocType = typeof KNOWN_DOC_TYPES[number];

/**
 * Document type display names
 */
export const DOC_TYPE_LABELS: Record<KnownDocType, string> = {
  projectBrief: 'Project Brief',
  productContext: 'Product Context',
  systemPatterns: 'System Patterns',
  techContext: 'Tech Context',
  activeContext: 'Active Context',
  progress: 'Progress',
  decisionLog: 'Decision Log',
  agentBoard: 'Agent Board'
};
