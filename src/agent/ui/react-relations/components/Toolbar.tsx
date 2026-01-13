/**
 * Toolbar component for relations flow
 */

import React from 'react';
import { NODE_TYPE_COLORS } from '../types';

interface ToolbarProps {
  nodeTypes: string[];
  filterType: string | null;
  onFilterChange: (type: string | null) => void;
  onRefresh: () => void;
  onRegenerate: () => void;
  onFitView: () => void;
  nodeCount: number;
  edgeCount: number;
  lastAnalyzed?: number;
  // Grouped view
  useGroupedView?: boolean;
  onToggleGroupedView?: () => void;
  groupCount?: number;
  expandedCount?: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  nodeTypes,
  filterType,
  onFilterChange,
  onRefresh,
  onRegenerate,
  onFitView,
  nodeCount,
  edgeCount,
  lastAnalyzed,
  useGroupedView,
  onToggleGroupedView,
  groupCount,
  expandedCount,
}) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: 'var(--vscode-editor-background)',
        borderBottom: '1px solid var(--vscode-panel-border)',
        flexWrap: 'wrap',
      }}
    >
      {/* Stats */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px',
        fontSize: '12px',
        color: 'var(--vscode-descriptionForeground)',
      }}>
        <span>
          <strong style={{ color: 'var(--vscode-foreground)' }}>{nodeCount}</strong> nodos
        </span>
        <span>
          <strong style={{ color: 'var(--vscode-foreground)' }}>{edgeCount}</strong> relaciones
        </span>
        {lastAnalyzed && (
          <span title={formatTime(lastAnalyzed)}>
            Analizado: {formatTime(lastAnalyzed)}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Grouped View Toggle */}
      {onToggleGroupedView && nodeCount > 30 && (
        <button
          onClick={onToggleGroupedView}
          title={useGroupedView ? 'Mostrar todos los nodos' : 'Agrupar por carpetas'}
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            border: useGroupedView 
              ? '2px solid var(--vscode-button-background)' 
              : '1px solid var(--vscode-button-border)',
            background: useGroupedView 
              ? 'var(--vscode-button-background)' 
              : 'var(--vscode-button-secondaryBackground)',
            color: useGroupedView 
              ? 'var(--vscode-button-foreground)' 
              : 'var(--vscode-button-secondaryForeground)',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          📁 {useGroupedView ? `Agrupado (${groupCount} grupos)` : 'Agrupar'}
          {useGroupedView && expandedCount !== undefined && expandedCount > 0 && (
            <span style={{ 
              fontSize: '10px', 
              opacity: 0.8,
              marginLeft: '4px',
            }}>
              ({expandedCount} expandidos)
            </span>
          )}
        </button>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label 
          htmlFor="type-filter"
          style={{ 
            fontSize: '12px', 
            color: 'var(--vscode-descriptionForeground)' 
          }}
        >
          Filtrar:
        </label>
        <select
          id="type-filter"
          value={filterType || ''}
          onChange={(e) => onFilterChange(e.target.value || null)}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid var(--vscode-input-border)',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            fontSize: '12px',
          }}
        >
          <option value="">Todos</option>
          {nodeTypes.map(type => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onFitView}
          title="Ajustar vista"
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            border: '1px solid var(--vscode-button-border)',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ⊞ Ajustar
        </button>
        <button
          onClick={onRefresh}
          title="Refrescar"
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            border: '1px solid var(--vscode-button-border)',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ↻ Refrescar
        </button>
        <button
          onClick={onRegenerate}
          title="Regenerar análisis"
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            border: 'none',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ⟳ Regenerar
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
