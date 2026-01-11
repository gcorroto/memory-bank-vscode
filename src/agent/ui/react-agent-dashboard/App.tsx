/**
 * App Component
 * Root dashboard component with tab navigation
 */

import React, { useState, useEffect } from 'react';
import { useDashboard, useVSCodeAPI } from './hooks';
import { TabType, VSCodeMessage } from './types';
import './styles/global.css';

// Tab components (will be created next)
import MCPsTab from './components/Tabs/MCPsTab';
import HistoricoTab from './components/Tabs/HistoricoTab';
import ExecutionTab from './components/Tabs/ExecutionTab';
import ValidatorTab from './components/Tabs/ValidatorTab';
import PlannerTab from './components/Tabs/PlannerTab';
import TestingTab from './components/Tabs/TestingTab';

const TabComponents: Record<TabType, React.ComponentType<any>> = {
  mcps: MCPsTab,
  historico: HistoricoTab,
  execution: ExecutionTab,
  validator: ValidatorTab,
  planner: PlannerTab,
  testing: TestingTab,
};

const TabLabels: Record<TabType, string> = {
  mcps: 'MCPs',
  historico: 'Histórico',
  execution: 'Ejecución',
  validator: 'Validador',
  planner: 'Planificador',
  testing: 'Testing',
};

export const App: React.FC = () => {
  const dashboard = useDashboard();
  const { postMessage, vscode } = useVSCodeAPI((message) => {
    // Handle messages from extension
    console.log('App received message:', message);
    
    switch (message.type) {
      case 'SET_DASHBOARD_STATE':
        // Reset and update state from extension
        dashboard.resetState();
        break;
      case 'UPDATE_MCPS':
        if (message.data.connections) dashboard.updateMCPsConnections(message.data.connections);
        if (message.data.tools) dashboard.updateMCPsTools(message.data.tools);
        if (message.data.latency) dashboard.updateMCPsLatency(message.data.latency);
        break;
      case 'UPDATE_HISTORICO':
        if (message.data.messages) {
          message.data.messages.forEach((msg: any) => dashboard.addHistoricoMessage(msg));
        }
        if (message.data.totalTokens) dashboard.updateHistoricoTokens(message.data.totalTokens);
        break;
      case 'UPDATE_EXECUTION':
        if (message.data.executing) {
          message.data.executing.forEach((tool: any) => dashboard.addExecutionTool(tool));
        }
        break;
      case 'EXECUTION_TOOL_COMPLETED':
        if (message.data) {
          dashboard.completeExecutionTool(message.data);
        }
        break;
      case 'EXECUTION_TOOL_FAILED':
        if (message.data) {
          dashboard.failExecutionTool(message.data);
        }
        break;
      case 'UPDATE_VALIDATOR':
        if (message.data.checks) {
          message.data.checks.forEach((check: any) => dashboard.addValidatorCheck(check));
        }
        break;
      case 'UPDATE_PLANNER':
        if (message.data.steps) dashboard.updatePlannerSteps(message.data.steps);
        if (message.data.phase) dashboard.setPlannerPhase(message.data.phase);
        break;
      case 'UPDATE_TESTING':
        if (message.data.results) {
          message.data.results.forEach((result: any) => dashboard.addTestResult(result));
        }
        if (message.data.coverage) dashboard.updateTestCoverage(message.data.coverage);
        break;
    }
  });

  // Request initial state from extension on mount
  useEffect(() => {
    if (vscode) {
      dashboard.setLoading(true);
      postMessage({ command: 'REQUEST_INITIAL_STATE', type: 'REQUEST_INITIAL_STATE' });
      
      // Simulate data loading delay
      const timer = setTimeout(() => {
        dashboard.setLoading(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [vscode]);

  const CurrentTab = TabComponents[dashboard.state.activeTab];

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <h1>Autofixer Agent Dashboard</h1>
        <div className="theme-selector">
          <label htmlFor="theme">Tema: </label>
          <select
            id="theme"
            value={dashboard.state.theme}
            onChange={(e) => dashboard.setTheme(e.target.value as 'light' | 'dark' | 'high-contrast')}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="high-contrast">Alto Contraste</option>
          </select>
        </div>
      </header>

      {/* Status Badges */}
      {!dashboard.state.isLoading && (
        <div className="status-badges">
          <div className="badge badge-executing">
            <span className="badge-icon">▶</span>
            <span className="badge-label">Ejecutando</span>
            <span className="badge-count">{dashboard.state.execution.executing.length}</span>
          </div>
          <div className="badge badge-completed">
            <span className="badge-icon">✓</span>
            <span className="badge-label">Completadas</span>
            <span className="badge-count">{dashboard.state.execution.completed.length}</span>
          </div>
          <div className="badge badge-failed">
            <span className="badge-icon">✗</span>
            <span className="badge-label">Fallidas</span>
            <span className="badge-count">{dashboard.state.execution.failed.length}</span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <nav className="tab-navigation">
        {(Object.keys(TabLabels) as TabType[]).map((tabKey) => (
          <button
            key={tabKey}
            className={`tab-button ${dashboard.state.activeTab === tabKey ? 'active' : ''}`}
            onClick={() => dashboard.setActiveTab(tabKey)}
          >
            {TabLabels[tabKey]}
          </button>
        ))}
      </nav>

      {/* Loading Indicator */}
      {dashboard.state.isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Cargando datos del agente...</p>
        </div>
      )}

      {/* Tab Content */}
      {!dashboard.state.isLoading && (
        <main className="tab-content">
          <CurrentTab state={dashboard.state} dispatch={dashboard} />
        </main>
      )}

      {/* Footer */}
      <footer className="dashboard-footer">
        <span className="session-id">Session: {dashboard.state.historico.sessionId || 'N/A'}</span>
        <span className="uptime">Uptime: {formatUptime(Date.now() - dashboard.state.historico.startTime)}</span>
      </footer>
    </div>
  );
};

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default App;
