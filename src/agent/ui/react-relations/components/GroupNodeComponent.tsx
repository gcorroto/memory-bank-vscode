/**
 * Group Node Component - Collapsible folder group
 */

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeGroup, NODE_TYPE_COLORS } from '../types';

interface GroupNodeData {
  group: NodeGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

interface GroupNodeProps {
  data: GroupNodeData;
  selected?: boolean;
}

const GroupNodeComponent: React.FC<GroupNodeProps> = memo(({ data, selected }) => {
  const { group, isExpanded, onToggle } = data;
  
  // Get the primary color based on most common type
  const primaryColor = NODE_TYPE_COLORS[group.primaryType] || NODE_TYPE_COLORS.unknown;
  
  // Calculate type distribution for the mini-chart
  const typeCounts = group.nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const sortedTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4); // Top 4 types

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: 'var(--vscode-editor-background)',
        border: `2px solid ${selected ? primaryColor : 'var(--vscode-panel-border)'}`,
        boxShadow: selected 
          ? `0 0 0 2px ${primaryColor}40, 0 4px 12px rgba(0,0,0,0.3)`
          : '0 2px 8px rgba(0,0,0,0.2)',
        minWidth: '180px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: primaryColor,
          width: '10px',
          height: '10px',
          border: '2px solid var(--vscode-editor-background)',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: primaryColor,
          width: '10px',
          height: '10px',
          border: '2px solid var(--vscode-editor-background)',
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>
          {isExpanded ? '📂' : '📁'}
        </span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'var(--vscode-foreground)',
            flex: 1,
          }}
        >
          {group.folder}
        </span>
        <span
          style={{
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '10px',
            backgroundColor: `${primaryColor}30`,
            color: primaryColor,
            fontWeight: 'bold',
          }}
        >
          {group.nodeCount}
        </span>
      </div>

      {/* Type distribution mini-chart */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {sortedTypes.map(([type, count]) => (
          <div
            key={type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: `${NODE_TYPE_COLORS[type] || NODE_TYPE_COLORS.unknown}20`,
              fontSize: '10px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: NODE_TYPE_COLORS[type] || NODE_TYPE_COLORS.unknown,
              }}
            />
            <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
              {type}: {count}
            </span>
          </div>
        ))}
      </div>

      {/* Expand hint */}
      <div
        style={{
          marginTop: '8px',
          fontSize: '10px',
          color: 'var(--vscode-descriptionForeground)',
          textAlign: 'center',
        }}
      >
        {isExpanded ? 'Click to collapse' : 'Click to expand'}
      </div>
    </div>
  );
});

GroupNodeComponent.displayName = 'GroupNodeComponent';

export default GroupNodeComponent;
