/**
 * Custom node component for React Flow
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { RelationNode, NODE_TYPE_COLORS } from '../types';

interface RelationNodeData {
  node: RelationNode;
  isSelected?: boolean;     // This is the selected/origin node
  isHighlighted?: boolean;  // Connected to selected node
  isSource?: boolean;       // Is source of selected (selected imports this)
  isTarget?: boolean;       // Is target of selected (this imports selected)
  onClick?: (node: RelationNode) => void;
}

// Highlight color for related nodes (subtle yellow/gold)
const HIGHLIGHT_COLOR = '#c9a227';
const HIGHLIGHT_GLOW = 'rgba(201, 162, 39, 0.4)';
// Selected/origin node color (stronger)
const SELECTED_COLOR = '#f0c040';
const SELECTED_GLOW = 'rgba(240, 192, 64, 0.5)';

const RelationNodeComponent: React.FC<NodeProps<RelationNodeData>> = ({ data, selected }) => {
  const { node, onClick, isSelected, isHighlighted, isSource, isTarget } = data;
  const color = NODE_TYPE_COLORS[node.type] || NODE_TYPE_COLORS.unknown;
  
  // Use isSelected from data (more reliable than React Flow's selected prop)
  const isOriginNode = isSelected || selected;

  const handleClick = () => {
    if (onClick) {
      onClick(node);
    }
  };

  // Determine border and shadow based on selection state
  let borderColor = 'var(--vscode-panel-border)';
  let boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
  let backgroundColor = 'var(--vscode-editor-background)';

  if (isOriginNode) {
    // Selected/origin node - strongest highlight
    borderColor = SELECTED_COLOR;
    boxShadow = `0 0 20px ${SELECTED_GLOW}, 0 0 8px ${SELECTED_GLOW}`;
    backgroundColor = 'rgba(240, 192, 64, 0.15)';
  } else if (isHighlighted) {
    // Related node - subtle yellow border
    borderColor = HIGHLIGHT_COLOR;
    boxShadow = `0 0 10px ${HIGHLIGHT_GLOW}`;
    backgroundColor = 'rgba(201, 162, 39, 0.08)';
  }

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '10px 15px',
        borderRadius: '8px',
        background: backgroundColor,
        border: `2px solid ${borderColor}`,
        boxShadow: boxShadow,
        minWidth: '150px',
        maxWidth: '250px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: color,
          width: '8px',
          height: '8px',
        }}
      />

      {/* Header with type badge */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '6px'
      }}>
        <span
          style={{
            background: color,
            color: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          {node.type}
        </span>
      </div>

      {/* Name */}
      <div
        style={{
          fontWeight: 'bold',
          fontSize: '13px',
          color: 'var(--vscode-foreground)',
          marginBottom: '4px',
          wordBreak: 'break-word',
        }}
      >
        {node.name}
      </div>

      {/* Description */}
      {node.description && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--vscode-descriptionForeground)',
            lineHeight: '1.3',
            maxHeight: '40px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {node.description}
        </div>
      )}

      {/* Function count */}
      <div
        style={{
          fontSize: '10px',
          color: 'var(--vscode-descriptionForeground)',
          marginTop: '6px',
          opacity: 0.8,
        }}
      >
        {node.functions.length} función{node.functions.length !== 1 ? 'es' : ''}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: color,
          width: '8px',
          height: '8px',
        }}
      />
    </div>
  );
};

export default memo(RelationNodeComponent);
