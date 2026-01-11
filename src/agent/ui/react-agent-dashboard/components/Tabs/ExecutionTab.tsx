/**
 * ExecutionTab Component
 * Displays real-time tool execution status
 */

import React from 'react';
import { DashboardState } from '../../types';

// Helper to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Helper to calculate elapsed time
function calculateElapsed(startTime?: number, endTime?: number): string {
  if (!startTime) return 'N/A';
  const end = endTime || Date.now();
  const elapsed = end - startTime;
  return formatDuration(elapsed);
}

// Helper to format timestamp
function formatTimestamp(time?: number): string {
  if (!time) return '';
  const date = new Date(time);
  return date.toLocaleTimeString();
}

interface Props {
  state: DashboardState;
  dispatch: any;
}

const ExecutionTab: React.FC<Props> = ({ state }) => {
  return (
    <div className="tab-execution">
      <div className="execution-stats">
        <div className="stat-box executing">
          <h3>En Ejecución</h3>
          <div className="count">{state.execution.executing.length}</div>
        </div>
        <div className="stat-box completed">
          <h3>Completadas</h3>
          <div className="count">{state.execution.completed.length}</div>
        </div>
        <div className="stat-box failed">
          <h3>Fallidas</h3>
          <div className="count">{state.execution.failed.length}</div>
        </div>
      </div>

      {/* Executing Tools */}
      <div className="section">
        <h2>Herramientas en Ejecución</h2>
        {state.execution.executing.length === 0 ? (
          <p className="empty-state">Ninguna herramienta en ejecución</p>
        ) : (
          <div className="execution-list">
            {state.execution.executing.map((tool: any) => (
              <div key={tool.id} className="execution-item executing">
                <div className="tool-status">
                  <span className="spinner"></span>
                  <span className="tool-name">{tool.name || tool.tool || 'Unknown'}</span>
                </div>
                <div className="execution-bar">
                  <div className="progress"></div>
                </div>
                <span className="duration">{calculateElapsed(tool.startTime)}</span>
                <span className="timestamp">{formatTimestamp(tool.startTime)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Tools */}
      <div className="section">
        <h2>Herramientas Completadas</h2>
        {state.execution.completed.length === 0 ? (
          <p className="empty-state">No hay herramientas completadas</p>
        ) : (
          <div className="execution-list">
            {state.execution.completed.map((tool: any) => (
              <div key={tool.id} className="execution-item completed">
                <span className="status-icon">✓</span>
                <span className="tool-name">{tool.name || tool.tool || 'Unknown'}</span>
                <span className="duration">{calculateElapsed(tool.startTime, tool.endTime)}</span>
                <span className="timestamp">{formatTimestamp(tool.endTime)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Failed Tools */}
      <div className="section">
        <h2>Herramientas Fallidas</h2>
        {state.execution.failed.length === 0 ? (
          <p className="empty-state">No hay herramientas fallidas</p>
        ) : (
          <div className="execution-list">
            {state.execution.failed.map((tool: any) => (
              <div key={tool.id} className="execution-item failed">
                <span className="status-icon">✗</span>
                <span className="tool-name">{tool.name || tool.tool || 'Unknown'}</span>
                <span className="duration">{calculateElapsed(tool.startTime, tool.endTime)}</span>
                <span className="error">{tool.error || 'Error desconocido'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionTab;
