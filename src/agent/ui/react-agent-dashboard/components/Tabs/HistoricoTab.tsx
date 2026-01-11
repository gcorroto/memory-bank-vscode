/**
 * HistoricoTab Component
 * Displays agent execution history and token usage
 */

import React from 'react';
import { DashboardState } from '../../types';

interface Props {
  state: DashboardState;
  dispatch: any;
}

const HistoricoTab: React.FC<Props> = ({ state }) => {
  const messageCount = state.historico.messages.length;
  const avgTokensPerMessage = messageCount > 0 
    ? Math.round(state.historico.totalTokens / messageCount)
    : 0;

  return (
    <div className="tab-historico">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total de Mensajes</h3>
          <div className="stat-value">{messageCount}</div>
        </div>
        <div className="stat-card">
          <h3>Tokens Usados</h3>
          <div className="stat-value">{state.historico.totalTokens.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <h3>Promedio por Mensaje</h3>
          <div className="stat-value">{avgTokensPerMessage}</div>
        </div>
        <div className="stat-card">
          <h3>Session ID</h3>
          <div className="stat-value small">{state.historico.sessionId || 'N/A'}</div>
        </div>
      </div>

      <div className="messages-section">
        <h2>Historial de Mensajes</h2>
        {state.historico.messages.length === 0 ? (
          <p className="empty-state">No hay mensajes en el histórico</p>
        ) : (
          <div className="messages-list">
            {state.historico.messages.map((msg: any, idx: number) => (
              <div key={idx} className="message-item">
                <div className="message-header">
                  <span className="role">{msg.role}</span>
                  <span className="tokens">{msg.tokens || 0} tokens</span>
                  <span className="timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="message-content">
                  {msg.content.substring(0, 200)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricoTab;
