/**
 * PlannerTab Component
 * Displays agent planning steps and replanning history
 */

import React from 'react';
import { DashboardState } from '../../types';

interface Props {
  state: DashboardState;
  dispatch: any;
}

const PlannerTab: React.FC<Props> = ({ state }) => {
  return (
    <div className="tab-planner">
      <div className="planner-header">
        <h2>Estado del Planificador</h2>
        <div className="phase-badge">
          Fase Actual: <span className={`phase ${state.planner.currentPhase}`}>{state.planner.currentPhase}</span>
        </div>
      </div>

      <div className="steps-section">
        <h3>Pasos del Plan</h3>
        {state.planner.steps.length === 0 ? (
          <p className="empty-state">No hay pasos planificados</p>
        ) : (
          <div className="steps-list">
            {state.planner.steps.map((step: any, idx: number) => (
              <div key={idx} className={`step-item ${step.status}`}>
                <div className="step-number">{idx + 1}</div>
                <div className="step-content">
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                  {step.tools && (
                    <div className="step-tools">
                      {step.tools.map((tool: string, tidx: number) => (
                        <span key={tidx} className="tool-tag">{tool}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="step-status">
                  {step.status === 'completed' && <span className="badge success">✓ Completado</span>}
                  {step.status === 'in-progress' && <span className="badge info">⏳ En Progreso</span>}
                  {step.status === 'pending' && <span className="badge secondary">⏸ Pendiente</span>}
                  {step.status === 'failed' && <span className="badge error">✗ Falló</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="replanning-section">
        <h3>Historial de Replaneamientos</h3>
        {state.planner.replanningHistory.length === 0 ? (
          <p className="empty-state">No hay replaneamientos</p>
        ) : (
          <div className="replanning-list">
            {state.planner.replanningHistory.map((entry: any, idx: number) => (
              <div key={idx} className="replanning-item">
                <div className="replanning-header">
                  <span className="timestamp">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span className="reason">{entry.reason}</span>
                </div>
                <div className="replanning-details">
                  <p>Pasos Anteriores: {entry.previousSteps}</p>
                  <p>Nuevos Pasos: {entry.newSteps}</p>
                  {entry.changes && (
                    <div className="changes">
                      {entry.changes.map((change: string, cidx: number) => (
                        <span key={cidx} className="change">{change}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlannerTab;
