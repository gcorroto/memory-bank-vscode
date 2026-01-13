/**
 * Types for React Relations Webview
 */

export interface RelationNode {
  id: string;
  type: string;
  name: string;
  filePath: string;
  description: string;
  functions: string[];
  language?: string;
}

export interface RelationEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
}

export interface ProjectRelations {
  version: string;
  projectId: string;
  lastAnalyzed: number;
  sourceHash: string;
  nodes: RelationNode[];
  edges: RelationEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    analyzedFiles: number;
    analysisTimeMs: number;
  };
}

export interface FlowNode {
  id: string;
  type: string;
  data: {
    node: RelationNode;
    selected?: boolean;
  };
  position: { x: number; y: number };
}

// Group node for collapsible folders
export interface NodeGroup {
  id: string;
  folder: string;
  nodes: RelationNode[];
  nodeCount: number;
  // Aggregated types in this group
  types: string[];
  // Primary type (most common)
  primaryType: string;
}

export interface FlowGroupNode {
  id: string;
  type: 'groupNode';
  data: {
    group: NodeGroup;
    isExpanded: boolean;
    onToggle: () => void;
  };
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  markerEnd?: any;
}

export interface InitialState {
  relations: ProjectRelations | null;
  theme: 'light' | 'dark';
}

export interface VSCodeMessage {
  command: string;
  relations?: ProjectRelations;
  [key: string]: any;
}

// Node type colors
export const NODE_TYPE_COLORS: Record<string, string> = {
  controller: '#4CAF50',
  service: '#2196F3',
  repository: '#9C27B0',
  dao: '#9C27B0',
  util: '#FF9800',
  model: '#607D8B',
  component: '#E91E63',
  function: '#00BCD4',
  class: '#795548',
  module: '#3F51B5',
  config: '#FFC107',
  middleware: '#009688',
  handler: '#FF5722',
  adapter: '#8BC34A',
  factory: '#673AB7',
  unknown: '#9E9E9E',
};

// Note: Window interface is already extended in other webview modules
// We use 'any' type for __INITIAL_STATE__ to avoid conflicts
