/**
 * ValidatorTab Component
 * Displays code validation results and pass rates
 */

import React from 'react';
import { DashboardState } from '../../types';

interface Props {
  state: DashboardState;
  dispatch: any;
}

const ValidatorTab: React.FC<Props> = ({ state }) => {
  const totalChecks = state.validator.passedCount + state.validator.failedCount;
  const passRate = totalChecks > 0 ? Math.round((state.validator.passedCount / totalChecks) * 100) : 0;

  return (
    <div className="tab-validator">
      <div className="validator-stats">
        <div className="stat-card primary">
          <h3>Tasa de Éxito</h3>
          <div className="large-stat">
            <span className="percentage">{passRate}%</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${passRate}%` }}></div>
            </div>
          </div>
        </div>

        <div className="stat-card secondary">
          <h3>Chequeos Totales</h3>
          <div className="stat-value">{totalChecks}</div>
        </div>

        <div className="stat-card success">
          <h3>Pasados</h3>
          <div className="stat-value">{state.validator.passedCount}</div>
        </div>

        <div className="stat-card error">
          <h3>Fallidos</h3>
          <div className="stat-value">{state.validator.failedCount}</div>
        </div>
      </div>

      <div className="checks-section">
        <h2>Detalles de Chequeos</h2>
        {state.validator.checks.length === 0 ? (
          <p className="empty-state">No hay chequeos de validación</p>
        ) : (
          <div className="checks-list">
            {state.validator.checks.map((check: any, idx: number) => (
              <div key={idx} className={`check-item ${check.passed ? 'passed' : 'failed'}`}>
                <div className="check-header">
                  <span className="status-icon">{check.passed ? '✓' : '✗'}</span>
                  <span className="check-name">{check.name}</span>
                  <span className="timestamp">{new Date(check.timestamp).toLocaleTimeString()}</span>
                </div>
                {check.message && (
                  <div className="check-message">{check.message}</div>
                )}
                {check.details && (
                  <div className="check-details">
                    <pre>{JSON.stringify(check.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidatorTab;
