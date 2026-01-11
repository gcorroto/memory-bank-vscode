/**
 * MCPsTab Component
 * Displays available MCPs, their tools, connections and latency
 */

import React from 'react';
import { DashboardState } from '../../types';

interface Props {
  state: DashboardState;
  dispatch: any;
}

const MCPsTab: React.FC<Props> = ({ state }) => {
  return (
    <div className="tab-mcps">
      <div className="section">
        <h2>Conexiones MCP</h2>
        {state.mcps.connections.length === 0 ? (
          <p className="empty-state">No hay conexiones MCP inicializadas</p>
        ) : (
          <div className="connections-grid">
            {state.mcps.connections.map((conn: any) => (
              <div key={conn.id} className="connection-card">
                <h3>{conn.name}</h3>
                <p>Status: <span className={`status ${conn.status}`}>{conn.status}</span></p>
                <p>Latencia: {state.mcps.latency[conn.id] || '-'} ms</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h2>Herramientas Disponibles</h2>
        {state.mcps.tools.length === 0 ? (
          <p className="empty-state">No hay herramientas disponibles</p>
        ) : (
          <div className="tools-list">
            {state.mcps.tools.map((tool: any) => (
              <div key={tool.id} className="tool-item">
                <div className="tool-header">
                  <span className="tool-name">{tool.name}</span>
                  <span className="tool-source">({tool.source})</span>
                </div>
                <p className="tool-description">{tool.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MCPsTab;
