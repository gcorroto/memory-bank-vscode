/**
 * Main App component for Relations Flow Viewer
 * Supports collapsible folder groups for large graphs
 */

import React, { useCallback, useMemo, useState } from 'react';
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
import GroupNodeComponent from './components/GroupNodeComponent';
import Toolbar from './components/Toolbar';
import NodeDetails from './components/NodeDetails';
import { NODE_TYPE_COLORS, FlowNode, FlowEdge, RelationNode, RelationEdge, NodeGroup } from './types';

// Custom node types
const nodeTypes = {
  relationNode: RelationNodeComponent,
  groupNode: GroupNodeComponent,
};

// Threshold for enabling grouped view
const GROUP_VIEW_THRESHOLD = 30;

// Node dimensions for layout calculation
const NODE_WIDTH = 220;
const NODE_HEIGHT = 140;
const GROUP_NODE_WIDTH = 200;
const GROUP_NODE_HEIGHT = 120;

/**
 * Group nodes by their TYPE (same as Code Relations tree)
 * This creates groups like: Component, Service, Class, Model, Config, Utility
 */
function groupNodesByType(nodes: RelationNode[]): NodeGroup[] {
  const groupMap = new Map<string, RelationNode[]>();
  
  for (const node of nodes) {
    const type = node.type || 'unknown';
    if (!groupMap.has(type)) {
      groupMap.set(type, []);
    }
    groupMap.get(type)!.push(node);
  }
  
  return Array.from(groupMap.entries()).map(([type, groupNodes]) => {
    // Capitalize type name for display
    const displayName = type.charAt(0).toUpperCase() + type.slice(1);
    
    return {
      id: `group-${type}`,
      folder: displayName, // Using 'folder' field for display name
      nodes: groupNodes,
      nodeCount: groupNodes.length,
      types: [type],
      primaryType: type,
    };
  }).sort((a, b) => b.nodeCount - a.nodeCount);
}

/**
 * Calculate edges between groups based on node edges
 */
function calculateGroupEdges(
  edges: RelationEdge[],
  nodeToGroup: Map<string, string>
): RelationEdge[] {
  const groupEdgeSet = new Set<string>();
  const groupEdges: RelationEdge[] = [];
  
  for (const edge of edges) {
    const sourceGroup = nodeToGroup.get(edge.source);
    const targetGroup = nodeToGroup.get(edge.target);
    
    if (sourceGroup && targetGroup && sourceGroup !== targetGroup) {
      const edgeKey = `${sourceGroup}->${targetGroup}`;
      if (!groupEdgeSet.has(edgeKey)) {
        groupEdgeSet.add(edgeKey);
        groupEdges.push({
          id: `ge-${sourceGroup}-${targetGroup}`,
          source: sourceGroup,
          target: targetGroup,
          type: 'uses',
          label: '',
        });
      }
    }
  }
  
  return groupEdges;
}

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
  highlightedEdgeIds: Set<string> = new Set(),
  hasSelection: boolean = false  // Whether there's an active node selection
): FlowEdge[] {
  return edges.map(edge => {
    const isHighlighted = highlightedEdgeIds.has(edge.id);
    // Dim edges that are not highlighted when there's a selection
    const isDimmed = hasSelection && !isHighlighted;
    
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
        opacity: isDimmed ? 0.1 : (isHighlighted ? 1 : 0.6),
      },
      labelStyle: {
        fontSize: isHighlighted ? 11 : 10,
        fill: isHighlighted ? EDGE_HIGHLIGHT_COLOR : 'var(--vscode-descriptionForeground)',
        fontWeight: isHighlighted ? 'bold' : 'normal',
        opacity: isDimmed ? 0.1 : 1,
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
  
  // State for expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // State for grouped view mode
  const [useGroupedView, setUseGroupedView] = useState<boolean>(true);

  // Toggle group expansion
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Collapse all expanded groups
  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  // Create stable keys for memoization - only based on data, not selection
  const nodesKey = useMemo(() => nodes.map(n => n.id).join(','), [nodes]);
  const edgesKey = useMemo(() => edges.map(e => e.id).join(','), [edges]);
  
  // Group nodes by folder
  // Group by TYPE (same as Code Relations tree: Component, Service, Class, etc.)
  const groups = useMemo(() => groupNodesByType(nodes), [nodesKey]);
  
  // Create node-to-group mapping
  const nodeToGroup = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const node of group.nodes) {
        map.set(node.id, group.id);
      }
    }
    return map;
  }, [groups]);
  
  // Determine if we should use grouped view (only for large graphs)
  const shouldUseGroupedView = useGroupedView && nodes.length > GROUP_VIEW_THRESHOLD;
  
  // Calculate which nodes and edges to show based on expanded state
  const { visibleNodes, visibleEdges } = useMemo(() => {
    if (!shouldUseGroupedView) {
      // No grouping - show all nodes
      return { visibleNodes: nodes, visibleEdges: edges };
    }
    
    const visNodes: RelationNode[] = [];
    const groupsToShow: NodeGroup[] = [];
    
    for (const group of groups) {
      if (expandedGroups.has(group.id)) {
        // Group is expanded - show individual nodes
        visNodes.push(...group.nodes);
      } else {
        // Group is collapsed - show as group node
        groupsToShow.push(group);
      }
    }
    
    // Calculate edges
    // For expanded groups: show edges between individual nodes
    // For collapsed groups: show edges between groups with count
    const visNodeIds = new Set(visNodes.map(n => n.id));
    const visGroupIds = new Set(groupsToShow.map(g => g.id));
    
    const visEdges: RelationEdge[] = [];
    // Map to count aggregated edges: edgeKey -> count
    const groupEdgeCount = new Map<string, number>();
    
    for (const edge of edges) {
      const sourceInVisible = visNodeIds.has(edge.source);
      const targetInVisible = visNodeIds.has(edge.target);
      const sourceGroup = nodeToGroup.get(edge.source);
      const targetGroup = nodeToGroup.get(edge.target);
      
      if (sourceInVisible && targetInVisible) {
        // Both nodes visible - show edge
        visEdges.push(edge);
      } else if (sourceInVisible && targetGroup && visGroupIds.has(targetGroup)) {
        // Source visible, target in collapsed group - edge to group
        const edgeKey = `${edge.source}->${targetGroup}`;
        groupEdgeCount.set(edgeKey, (groupEdgeCount.get(edgeKey) || 0) + 1);
      } else if (targetInVisible && sourceGroup && visGroupIds.has(sourceGroup)) {
        // Target visible, source in collapsed group - edge from group
        const edgeKey = `${sourceGroup}->${edge.target}`;
        groupEdgeCount.set(edgeKey, (groupEdgeCount.get(edgeKey) || 0) + 1);
      } else if (sourceGroup && targetGroup && sourceGroup !== targetGroup &&
                 visGroupIds.has(sourceGroup) && visGroupIds.has(targetGroup)) {
        // Both in collapsed groups - edge between groups
        const edgeKey = `${sourceGroup}->${targetGroup}`;
        groupEdgeCount.set(edgeKey, (groupEdgeCount.get(edgeKey) || 0) + 1);
      }
    }
    
    // Create aggregated edges with counts
    for (const [edgeKey, count] of groupEdgeCount.entries()) {
      const [source, target] = edgeKey.split('->');
      const isGroupToGroup = source.startsWith('group-') && target.startsWith('group-');
      visEdges.push({
        id: isGroupToGroup ? `ge-${source}-${target}` : `e-${source}-${target}`,
        source,
        target,
        type: 'uses',
        label: count > 1 ? `(${count})` : '',
      });
    }
    
    return { 
      visibleNodes: visNodes, 
      visibleEdges: visEdges,
      groupsToShow 
    };
  }, [shouldUseGroupedView, groups, expandedGroups, nodes, edges, nodeToGroup]);
  
  // Get groups to show (collapsed ones)
  const groupsToShow = useMemo(() => {
    if (!shouldUseGroupedView) return [];
    return groups.filter(g => !expandedGroups.has(g.id));
  }, [shouldUseGroupedView, groups, expandedGroups]);
  
  // Layout nodes ONCE when data changes (not on selection change)
  const baseFlowNodes = useMemo(() => {
    // Create combined list of individual nodes + group nodes for layout
    const allNodesForLayout: RelationNode[] = [
      ...visibleNodes,
      // Add pseudo-nodes for groups (for layout calculation)
      ...groupsToShow.map(g => ({
        id: g.id,
        type: g.primaryType,
        name: g.folder,
        filePath: '',
        description: '',
        functions: [],
      })),
    ];
    
    return layoutNodes(allNodesForLayout, visibleEdges);
  }, [visibleNodes, visibleEdges, groupsToShow]);
  
  // Calculate connected nodes and edges when a node is selected
  // Returns stable string keys for comparison
  const highlightInfo = useMemo(() => {
    const connected = new Set<string>();
    const highlighted = new Set<string>();
    const sources = new Set<string>();
    const targets = new Set<string>();
    
    if (selectedNodeId) {
      visibleEdges.forEach(edge => {
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
  }, [selectedNodeId, visibleEdges]);
  
  // Apply highlight information to nodes (cheap operation, no layout recalc)
  const flowNodes = useMemo(() => {
    return baseFlowNodes.map(flowNode => {
      // Check if this is a group node
      const isGroupNode = flowNode.id.startsWith('group-');
      
      if (isGroupNode) {
        const group = groupsToShow.find(g => g.id === flowNode.id);
        if (group) {
          return {
            ...flowNode,
            type: 'groupNode',
            data: {
              group,
              isExpanded: false,
              onToggle: () => toggleGroup(group.id),
            },
          };
        }
      }
      
      // Regular relation node
      const isThisSelected = flowNode.id === selectedNodeId;
      const isConnected = highlightInfo.connectedNodeIds.has(flowNode.id);
      // Dim nodes that are not selected and not connected when there's a selection
      const shouldDim = selectedNodeId !== null && !isThisSelected && !isConnected;
      
      return {
        ...flowNode,
        type: 'relationNode',
        selected: isThisSelected,
        data: {
          ...flowNode.data,
          isSelected: isThisSelected,
          isHighlighted: isConnected,
          isSource: highlightInfo.sourceNodeIds.has(flowNode.id),
          isTarget: highlightInfo.targetNodeIds.has(flowNode.id),
          isDimmed: shouldDim,
        }
      };
    });
  }, [baseFlowNodes, selectedNodeId, groupsToShow, toggleGroup, highlightInfo]);
  
  const flowEdges = useMemo(() => {
    return convertEdges(visibleEdges, highlightInfo.highlightedEdgeIds, selectedNodeId !== null);
  }, [visibleEdges, highlightInfo.highlightedEdgeIds, selectedNodeId]);

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
        useGroupedView={useGroupedView}
        onToggleGroupedView={() => setUseGroupedView(!useGroupedView)}
        onCollapseAll={collapseAll}
        groupCount={groups.length}
        expandedCount={expandedGroups.size}
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
