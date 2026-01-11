/**
 * Main App component for Relations Flow Viewer
 */

import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  ConnectionMode,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import { useRelationsData } from './hooks/useRelationsData';
import RelationNodeComponent from './components/RelationNodeComponent';
import Toolbar from './components/Toolbar';
import NodeDetails from './components/NodeDetails';
import { NODE_TYPE_COLORS, FlowNode, FlowEdge, RelationNode, RelationEdge } from './types';

// Custom node types
const nodeTypes = {
  relationNode: RelationNodeComponent,
};

// Node dimensions for layout calculation
const NODE_WIDTH = 220;
const NODE_HEIGHT = 140;

/**
 * Layout algorithm using Dagre for automatic node positioning
 * Minimizes edge crossings and creates a clean hierarchical layout
 */
function layoutNodesWithDagre(
  nodes: RelationNode[], 
  edges: RelationEdge[]
): FlowNode[] {
  // Create a new dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  
  // Set graph configuration for best layout
  dagreGraph.setGraph({
    rankdir: 'TB',           // Top to bottom direction
    nodesep: 60,             // Horizontal separation between nodes
    ranksep: 100,            // Vertical separation between ranks
    marginx: 40,
    marginy: 40,
    ranker: 'network-simplex' // Best algorithm for minimizing edge crossings
  });
  
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Add nodes to dagre graph
  nodes.forEach(node => {
    dagreGraph.setNode(node.id, { 
      width: NODE_WIDTH, 
      height: NODE_HEIGHT,
      label: node.name 
    });
  });

  // Add edges to dagre graph
  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Convert to React Flow nodes with dagre positions
  return nodes.map(node => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      id: node.id,
      type: 'relationNode',
      data: { node },
      position: {
        // Dagre gives center position, adjust to top-left for React Flow
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });
}

/**
 * Fallback layout for when there are no edges (simple grid)
 */
function layoutNodesGrid(nodes: RelationNode[]): FlowNode[] {
  const flowNodes: FlowNode[] = [];
  
  // Group by type
  const groups = new Map<string, RelationNode[]>();
  for (const node of nodes) {
    if (!groups.has(node.type)) {
      groups.set(node.type, []);
    }
    groups.get(node.type)!.push(node);
  }

  let currentY = 50;
  const sortedGroups = Array.from(groups.entries())
    .sort((a, b) => b[1].length - a[1].length);

  for (const [type, typeNodes] of sortedGroups) {
    const columns = Math.min(typeNodes.length, 4);
    const rows = Math.ceil(typeNodes.length / columns);

    typeNodes.forEach((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      flowNodes.push({
        id: node.id,
        type: 'relationNode',
        data: { node },
        position: {
          x: 50 + col * (NODE_WIDTH + 30),
          y: currentY + row * (NODE_HEIGHT + 30),
        },
      });
    });

    currentY += rows * (NODE_HEIGHT + 30) + 80;
  }

  return flowNodes;
}

/**
 * Main layout function - uses Dagre when edges exist, grid otherwise
 */
function layoutNodes(nodes: RelationNode[], edges: RelationEdge[]): FlowNode[] {
  if (nodes.length === 0) return [];
  
  // Use Dagre layout when there are edges for better positioning
  if (edges.length > 0) {
    return layoutNodesWithDagre(nodes, edges);
  }
  
  // Fallback to grid layout when no edges
  return layoutNodesGrid(nodes);
}

// Highlight color for edges
const EDGE_HIGHLIGHT_COLOR = '#c9a227';
const EDGE_DEFAULT_COLOR = 'var(--vscode-textLink-foreground)';

// Convert edges to React Flow format with optional highlighting
function convertEdges(
  edges: { id: string; source: string; target: string; type: string; label?: string }[],
  highlightedEdgeIds: Set<string> = new Set()
): FlowEdge[] {
  return edges.map(edge => {
    const isHighlighted = highlightedEdgeIds.has(edge.id);
    
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: isHighlighted || edge.type === 'calls',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: isHighlighted ? 18 : 15,
        height: isHighlighted ? 18 : 15,
        color: isHighlighted ? EDGE_HIGHLIGHT_COLOR : undefined,
      },
      style: {
        stroke: isHighlighted ? EDGE_HIGHLIGHT_COLOR : EDGE_DEFAULT_COLOR,
        strokeWidth: isHighlighted ? 3 : 1.5,
        opacity: isHighlighted ? 1 : 0.6,
      },
      labelStyle: {
        fontSize: isHighlighted ? 11 : 10,
        fill: isHighlighted ? EDGE_HIGHLIGHT_COLOR : 'var(--vscode-descriptionForeground)',
        fontWeight: isHighlighted ? 'bold' : 'normal',
      },
      labelBgStyle: {
        fill: 'var(--vscode-editor-background)',
      },
      zIndex: isHighlighted ? 1000 : 0,
    };
  });
}

const FlowContent: React.FC = () => {
  const {
    relations,
    nodes,
    edges,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    filterType,
    setFilterType,
    nodeTypes: availableTypes,
    requestRefresh,
    requestRegenerate,
    openFile,
  } = useRelationsData();

  const { fitView } = useReactFlow();

  // Create stable keys for memoization - only based on data, not selection
  const nodesKey = useMemo(() => nodes.map(n => n.id).join(','), [nodes]);
  const edgesKey = useMemo(() => edges.map(e => e.id).join(','), [edges]);
  
  // Layout nodes ONCE when data changes (not on selection change)
  const baseFlowNodes = useMemo(() => {
    return layoutNodes(nodes, edges);
  }, [nodesKey, edgesKey]);
  
  // Calculate connected nodes and edges when a node is selected
  // Returns stable string keys for comparison
  const highlightInfo = useMemo(() => {
    const connected = new Set<string>();
    const highlighted = new Set<string>();
    const sources = new Set<string>();
    const targets = new Set<string>();
    
    if (selectedNodeId) {
      edges.forEach(edge => {
        if (edge.source === selectedNodeId) {
          connected.add(edge.target);
          targets.add(edge.target);
          highlighted.add(edge.id);
        }
        if (edge.target === selectedNodeId) {
          connected.add(edge.source);
          sources.add(edge.source);
          highlighted.add(edge.id);
        }
      });
    }
    
    return { 
      connectedNodeIds: connected, 
      highlightedEdgeIds: highlighted,
      sourceNodeIds: sources,
      targetNodeIds: targets
    };
  }, [selectedNodeId, edgesKey]);
  
  // Apply highlight information to nodes (cheap operation, no layout recalc)
  const flowNodes = useMemo(() => {
    return baseFlowNodes.map(flowNode => ({
      ...flowNode,
      selected: flowNode.id === selectedNodeId, // Mark selected node
      data: {
        ...flowNode.data,
        isSelected: flowNode.id === selectedNodeId, // Also pass in data
        isHighlighted: highlightInfo.connectedNodeIds.has(flowNode.id),
        isSource: highlightInfo.sourceNodeIds.has(flowNode.id),
        isTarget: highlightInfo.targetNodeIds.has(flowNode.id),
      }
    }));
  }, [baseFlowNodes, selectedNodeId]);
  
  const flowEdges = useMemo(() => {
    return convertEdges(edges, highlightInfo.highlightedEdgeIds);
  }, [edgesKey, selectedNodeId]);

  // Callbacks for node changes (for dragging support)
  const onNodesChange = useCallback(() => {}, []);
  const onEdgesChange = useCallback(() => {}, []);

  // Track if we need to fit view (only on first load or data change)
  const prevNodesLengthRef = React.useRef(0);
  
  React.useEffect(() => {
    if (flowNodes.length > 0 && flowNodes.length !== prevNodesLengthRef.current) {
      prevNodesLengthRef.current = flowNodes.length;
      setTimeout(() => {
        fitView({ padding: 0.2 });
      }, 100);
    }
  }, [flowNodes.length, fitView]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2 });
  }, [fitView]);

  if (!relations) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--vscode-foreground)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
        <div style={{ fontSize: '16px', marginBottom: '8px' }}>Sin datos de relaciones</div>
        <div style={{ fontSize: '13px', color: 'var(--vscode-descriptionForeground)' }}>
          Ejecuta el análisis desde la vista de Memory Bank
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        nodeTypes={availableTypes}
        filterType={filterType}
        onFilterChange={setFilterType}
        onRefresh={requestRefresh}
        onRegenerate={requestRegenerate}
        onFitView={handleFitView}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        lastAnalyzed={relations.lastAnalyzed}
      />
      
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        >
          <Background color="var(--vscode-panel-border)" gap={20} />
          <Controls />
        </ReactFlow>

        <NodeDetails
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onOpenFile={openFile}
        />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
};

export default App;
