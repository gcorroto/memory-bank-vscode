/**
 * Hook for managing relations data
 */

import { useState, useEffect, useCallback } from 'react';
import { ProjectRelations, VSCodeMessage } from '../types';

export function useRelationsData() {
  const [relations, setRelations] = useState<ProjectRelations | null>(
    window.__INITIAL_STATE__?.relations || null
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Listen for messages from VS Code
  useEffect(() => {
    const handleMessage = (event: MessageEvent<VSCodeMessage>) => {
      const message = event.data;
      console.log('[useRelationsData] Received message:', message.command);
      
      switch (message.command) {
        case 'updateRelations':
          if (message.relations) {
            console.log('[useRelationsData] Setting relations:', message.relations.nodes?.length, 'nodes');
            setRelations(message.relations);
          }
          break;
        case 'selectNode':
          setSelectedNodeId(message.nodeId || null);
          break;
        case 'clearSelection':
          setSelectedNodeId(null);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request initial data after mount
    console.log('[useRelationsData] Mounted, requesting refresh...');
    if (window.vscode) {
      window.vscode.postMessage({ command: 'refresh' });
    }
    
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Send message to VS Code
  const postMessage = useCallback((message: any) => {
    if (window.vscode) {
      window.vscode.postMessage(message);
    }
  }, []);

  // Request refresh
  const requestRefresh = useCallback(() => {
    postMessage({ command: 'refresh' });
  }, [postMessage]);

  // Request regeneration
  const requestRegenerate = useCallback(() => {
    postMessage({ command: 'regenerate' });
  }, [postMessage]);

  // Open file in editor
  const openFile = useCallback((filePath: string) => {
    postMessage({ command: 'openFile', filePath });
  }, [postMessage]);

  // Get filtered nodes
  const filteredNodes = relations?.nodes.filter(node => 
    !filterType || node.type === filterType
  ) || [];

  // Get filtered edges (only edges where both source and target are in filtered nodes)
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = relations?.edges.filter(edge =>
    filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
  ) || [];

  // Get selected node
  const selectedNode = relations?.nodes.find(n => n.id === selectedNodeId) || null;

  // Get node types for filter
  const nodeTypes = [...new Set(relations?.nodes.map(n => n.type) || [])].sort();

  return {
    relations,
    nodes: filteredNodes,
    edges: filteredEdges,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    filterType,
    setFilterType,
    nodeTypes,
    requestRefresh,
    requestRegenerate,
    openFile,
  };
}
