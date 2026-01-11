/**
 * TestingTab Component
 * Displays test results and code coverage
 */

import React from 'react';
import { DashboardState } from '../../types';

interface Props {
  state: DashboardState;
  dispatch: any;
}

const TestingTab: React.FC<Props> = ({ state }) => {
  const totalTests = state.testing.passedCount + state.testing.failedCount;
  const passRate = totalTests > 0 ? Math.round((state.testing.passedCount / totalTests) * 100) : 0;

  return (
    <div className="tab-testing">
      <div className="testing-stats">
        <div className="stat-card primary">
          <h3>Tasa de Éxito en Tests</h3>
          <div className="large-stat">
            <span className="percentage">{passRate}%</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${passRate}%` }}></div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <h3>Cobertura de Código</h3>
          <div className="large-stat">
            <span className="percentage">{state.testing.coverage}%</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${state.testing.coverage}%` }}></div>
            </div>
          </div>
        </div>

        <div className="stat-card secondary">
          <h3>Tests Totales</h3>
          <div className="stat-value">{totalTests}</div>
        </div>

        <div className="stat-card success">
          <h3>Pasados</h3>
          <div className="stat-value">{state.testing.passedCount}</div>
        </div>

        <div className="stat-card error">
          <h3>Fallidos</h3>
          <div className="stat-value">{state.testing.failedCount}</div>
        </div>
      </div>

      {state.testing.currentTest && (
        <div className="current-test">
          <h3>Test Actual: {state.testing.currentTest}</h3>
          <div className="running-indicator">
            <span className="spinner"></span>
            Ejecutando...
          </div>
        </div>
      )}

      <div className="results-section">
        <h2>Resultados de Tests</h2>
        {state.testing.testResults.length === 0 ? (
          <p className="empty-state">No hay resultados de tests</p>
        ) : (
          <div className="results-list">
            {state.testing.testResults.map((result: any, idx: number) => (
              <div key={idx} className={`result-item ${result.passed ? 'passed' : 'failed'}`}>
                <div className="result-header">
                  <span className="status-icon">{result.passed ? '✓' : '✗'}</span>
                  <span className="test-name">{result.name}</span>
                  <span className="duration">{result.duration || '0'}ms</span>
                </div>
                {result.error && (
                  <div className="result-error">
                    <pre>{result.error}</pre>
                  </div>
                )}
                {result.output && (
                  <div className="result-output">
                    <details>
                      <summary>Output</summary>
                      <pre>{result.output}</pre>
                    </details>
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

export default TestingTab;
