/**
 * DelegationTab Component
 * Displays external requests and delegation controls
 */

import React, { useEffect } from 'react';
import { DashboardState, ExternalRequest } from '../../types';

interface Props {
  state: DashboardState;
  dispatch: any;
  postMessage: (message: any) => void;
}

const DelegationTab: React.FC<Props> = ({ state, postMessage }) => {
  
  useEffect(() => {
    postMessage({ type: 'REQUEST_DELEGATION_STATE' });
  }, [postMessage]);

  const handleAccept = (request: ExternalRequest) => {
    postMessage({
      type: 'ACCEPT_TASK',
      data: {
        requestId: request.id
      }
    });
  };

  const handleReject = (request: ExternalRequest) => {
    postMessage({
      type: 'REJECT_TASK',
      data: {
        requestId: request.id
      }
    });
  };

  const handleCreateDelegation = () => {
    postMessage({
      type: 'CREATE_DELEGATION'
    });
  };

  return (
    <div className="tab-delegation">
      <div className="planner-header">
        <h2>Delegación de Tareas (A2A)</h2>
        <button className="primary-button" onClick={handleCreateDelegation}>
          + Delegar Tarea
        </button>
      </div>

      <div className="section">
        <h3>Peticiones Externas (Recibidas)</h3>
        {(!state.delegation.externalRequests || state.delegation.externalRequests.length === 0) ? (
          <p className="empty-state">No hay peticiones externas pendientes</p>
        ) : (
          <div className="requests-list">
            {state.delegation.externalRequests.map((req) => (
              <div key={req.id} className={`request-item ${req.status.toLowerCase()}`}>
                 <div className="request-header">
                    <span className="request-id">{req.id}</span>
                    <span className={`status-badge ${req.status}`}>{req.status}</span>
                    <span className="request-date">{new Date(req.receivedAt).toLocaleString()}</span>
                 </div>
                 <div className="request-content">
                    <h4>{req.title}</h4>
                    <div className="request-origin">
                        <strong>De:</strong> {req.fromProject}
                    </div>
                    <div className="request-context">
                        {req.context}
                    </div>
                 </div>
                 {req.status === 'PENDING' && (
                    <div className="request-actions">
                        <button className="action-button approve" onClick={() => handleAccept(req)}>✓ Aceptar</button>
                        <button className="action-button reject" onClick={() => handleReject(req)}>✗ Rechazar</button>
                    </div>
                 )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .tab-delegation {
            padding: 20px;
        }
        .planner-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .primary-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
        }
        .primary-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .request-item {
            border: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            margin-bottom: 12px;
            padding: 12px;
            border-radius: 4px;
        }
        .request-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
        }
        .request-id {
            font-family: monospace;
            font-weight: bold;
        }
        .status-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.85em;
        }
        .status-badge.PENDING { background-color: #d1d100; color: black; }
        .status-badge.ACCEPTED { background-color: var(--vscode-testing-iconPassed); color: white; }
        .status-badge.REJECTED { background-color: var(--vscode-testing-iconFailed); color: white; }
        
        .request-content h4 {
            margin: 0 0 8px 0;
            font-size: 1.1em;
        }
        .request-origin {
            margin-bottom: 8px;
            font-size: 0.9em;
        }
        .request-context {
            color: var(--vscode-foreground);
            white-space: pre-wrap;
            background: var(--vscode-textBlockQuote-background);
            padding: 8px;
            border-left: 3px solid var(--vscode-textBlockQuote-border);
        }
        .request-actions {
            margin-top: 12px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .action-button {
            padding: 4px 12px;
            cursor: pointer;
            border: 1px solid var(--vscode-button-border);
            background: transparent;
            color: var(--vscode-button-foreground);
        }
        .action-button.approve {
            border-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-testing-iconPassed);
        }
        .action-button.approve:hover {
            background-color: var(--vscode-testing-iconPassed);
            color: white;
        }
        .action-button.reject {
            border-color: var(--vscode-testing-iconFailed);
            color: var(--vscode-testing-iconFailed);
        }
        .action-button.reject:hover {
            background-color: var(--vscode-testing-iconFailed);
            color: white;
        }
      `}</style>
    </div>
  );
};

export default DelegationTab;
