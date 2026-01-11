/**
 * Node details panel component
 */

import React from 'react';
import { RelationNode, NODE_TYPE_COLORS } from '../types';

interface NodeDetailsProps {
  node: RelationNode | null;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
}

export const NodeDetails: React.FC<NodeDetailsProps> = ({ node, onClose, onOpenFile }) => {
  if (!node) return null;

  const color = NODE_TYPE_COLORS[node.type] || NODE_TYPE_COLORS.unknown;

  return (
    <div
      style={{
        position: 'absolute',
        right: '16px',
        top: '70px',
        width: '300px',
        background: 'var(--vscode-editor-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          background: `${color}15`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{node.name}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            color: 'var(--vscode-foreground)',
            opacity: 0.7,
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--vscode-descriptionForeground)',
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}
          >
            Descripción
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
            {node.description || 'Sin descripción'}
          </div>
        </div>

        {/* File path */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--vscode-descriptionForeground)',
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}
          >
            Archivo
          </div>
          <button
            onClick={() => onOpenFile(node.filePath)}
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              border: '1px solid var(--vscode-button-border)',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--vscode-button-secondaryForeground)',
              textAlign: 'left',
              width: '100%',
              wordBreak: 'break-all',
            }}
          >
            📄 {node.filePath.split('/').pop()}
          </button>
        </div>

        {/* Functions */}
        {node.functions.length > 0 && (
          <div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--vscode-descriptionForeground)',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              Funciones ({node.functions.length})
            </div>
            <div
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {node.functions.map((func, index) => (
                <div
                  key={index}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--vscode-input-background)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                >
                  {func}()
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeDetails;
