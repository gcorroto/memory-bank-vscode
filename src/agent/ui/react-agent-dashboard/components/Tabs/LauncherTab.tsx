/**
 * LauncherTab Component
 * Launch agents (Internal/CLI) from Dashboard
 */

import React, { useState } from 'react';
import { DashboardState } from '../../types';
import { useVSCodeAPI } from '../../hooks';

interface Props {
  state: DashboardState;
  dispatch: any;
}

const LauncherTab: React.FC<Props> = ({ state }) => {
  const { postMessage } = useVSCodeAPI();
  const [task, setTask] = useState('');
  const [agentType, setAgentType] = useState('vscode');
  const [cliCommand, setCliCommand] = useState('npx @grec0/memory-bank-mcp');
  const [isLaunching, setIsLaunching] = useState(false);
  
  // Advanced settings (mockup for now, could be real in future)
  const [model, setModel] = useState('gpt-4');
  const [autoApprove, setAutoApprove] = useState(false);
  const [maxSteps, setMaxSteps] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recentTasks, setRecentTasks] = useState<string[]>(() => {
    try {
        const saved = localStorage.getItem('memorybank_recent_tasks');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
  });

  const COMMON_TASKS = [
    "Analyze project structure and create documentation",
    "Find and fix all linting errors in current file",
    "Generate unit tests for the selected class",
    "Refactor this component to use functional patterns",
    "Explain how the authentication flow works"
  ];

  const handleLaunch = () => {
    if (!task && agentType === 'vscode') {
      return; 
    }
    
    // Save to recent tasks
    if (task && agentType === 'vscode') {
        const updatedRecents = [task, ...recentTasks.filter(t => t !== task)].slice(0, 5);
        setRecentTasks(updatedRecents);
        localStorage.setItem('memorybank_recent_tasks', JSON.stringify(updatedRecents));
    }

    setIsLaunching(true);
    
    postMessage({
      type: 'LAUNCH_AGENT',
      command: 'LAUNCH_AGENT',
      payload: {
        agentType,
        task,
        cliCommand: agentType === 'cli' ? cliCommand : undefined,
        config: {
            model,
            autoApprove,
            maxSteps
        }
      }
    });

    // Reset status after a delay
    setTimeout(() => setIsLaunching(false), 2000);
  };

  const selectTask = (t: string) => {
      setTask(t);
  };

  return (
    <div className="tab-launcher">
        <style dangerouslySetInnerHTML={{__html: `
            .launcher-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }
            .launch-card {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-widget-border);
                padding: 20px;
                border-radius: 6px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .launch-header {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 1px solid var(--vscode-widget-border);
                padding-bottom: 15px;
            }
            .launch-icon {
                font-size: 24px;
                margin-right: 10px;
            }
            .form-section {
                margin-bottom: 20px;
            }
            .toggle-advanced {
                color: var(--vscode-textLink-foreground);
                cursor: pointer;
                font-size: 0.9em;
                display: flex;
                align-items: center;
                margin-top: 10px;
                user-select: none;
            }
            .toggle-advanced:hover {
                text-decoration: underline;
            }
            .advanced-panel {
                margin-top: 15px;
                padding: 15px;
                background: var(--vscode-textBlockQuote-background);
                border-left: 3px solid var(--vscode-textBlockQuote-border);
                animation: slideDown 0.3s ease-out;
            }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .checkbox-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            .task-chip {
                display: inline-block;
                padding: 2px 8px;
                margin: 2px 4px 2px 0;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: 12px;
                font-size: 0.85em;
                cursor: pointer;
                border: 1px solid transparent;
            }
            .task-chip:hover {
                border-color: var(--vscode-focusBorder);
                opacity: 0.9;
            }
            .quick-actions {
                margin-bottom: 15px;
            }
            .quick-actions h4 {
                margin: 0 0 5px 0;
                font-size: 0.85em;
                color: var(--vscode-descriptionForeground);
                text-transform: uppercase;
            }
        `}} />

      <div className="section">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2em' }}>🚀</span> 
            Agent Launchpad
        </h2>
        <p style={{ marginBottom: '25px', color: 'var(--vscode-descriptionForeground)' }}>
            Configure and launch AI agents to automate your development tasks.
        </p>
        
        <div className="launcher-grid">
            {/* Left Column: Configuration */}
            <div className="launch-card">
                <div className="launch-header">
                    <span className="launch-icon">⚙️</span>
                    <h3 style={{ margin: 0 }}>Configuration</h3>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Agent Runtime</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div 
                            onClick={() => setAgentType('vscode')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: `1px solid ${agentType === 'vscode' ? 'var(--vscode-focusBorder)' : 'var(--vscode-input-border)'}`,
                                backgroundColor: agentType === 'vscode' ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-input-background)',
                                color: agentType === 'vscode' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-input-foreground)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <strong>VS Code</strong>
                            <div style={{ fontSize: '0.8em', opacity: 0.8 }}>Internal</div>
                        </div>
                        <div 
                            onClick={() => setAgentType('cli')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: `1px solid ${agentType === 'cli' ? 'var(--vscode-focusBorder)' : 'var(--vscode-input-border)'}`,
                                backgroundColor: agentType === 'cli' ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-input-background)',
                                color: agentType === 'cli' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-input-foreground)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <strong>CLI / Codex</strong>
                            <div style={{ fontSize: '0.8em', opacity: 0.8 }}>External Process</div>
                        </div>
                    </div>
                </div>

                {agentType === 'vscode' && (
                <div className="form-group slide-in">
                    <div className="quick-actions">
                        {recentTasks.length > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                                <h4>History</h4>
                                <div>
                                    {recentTasks.map((t, i) => (
                                        <span key={`recent-${i}`} className="task-chip" onClick={() => selectTask(t)} title={t}>
                                            {t.length > 40 ? t.substring(0, 40) + '...' : t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div>
                            <h4>Templates</h4>
                            <div>
                                {COMMON_TASKS.map((t, i) => (
                                    <span key={`common-${i}`} className="task-chip" onClick={() => selectTask(t)} title={t}>
                                        {t.length > 50 ? t.substring(0, 50) + '...' : t}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Task Description</label>
                    <textarea
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder="Describe specific task requirements, context, and expected outcome..."
                    rows={6}
                    style={{ 
                        width: '100%', 
                        padding: '10px', 
                        borderRadius: '4px',
                        border: '1px solid var(--vscode-input-border)',
                        backgroundColor: 'var(--vscode-input-background)',
                        color: 'var(--vscode-input-foreground)',
                        fontFamily: 'var(--vscode-editor-font-family)',
                        resize: 'vertical'
                    }}
                    />
                </div>
                )}

                {agentType === 'cli' && (
                <div className="form-group slide-in">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>CLI Command</label>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '9px', opacity: 0.7 }}>$</span>
                        <input
                        type="text"
                        value={cliCommand}
                        onChange={(e) => setCliCommand(e.target.value)}
                        placeholder="npm run agent:start"
                        style={{ 
                            width: '100%', 
                            padding: '8px 8px 8px 25px', 
                            borderRadius: '4px',
                            border: '1px solid var(--vscode-input-border)',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            fontFamily: 'monospace'
                        }}
                        />
                    </div>
                </div>
                )}

                <div className="toggle-advanced" onClick={() => setShowAdvanced(!showAdvanced)}>
                    <span style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginRight: '5px' }}>▶</span>
                    {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                </div>

                {showAdvanced && (
                    <div className="advanced-panel">
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>Model</label>
                            <select 
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '5px',
                                    borderRadius: '3px',
                                    backgroundColor: 'var(--vscode-dropdown-background)',
                                    color: 'var(--vscode-dropdown-foreground)',
                                    border: '1px solid var(--vscode-dropdown-border)'
                                }}
                            >
                                <option value="gpt-4">GPT-4 (Recommended)</option>
                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</option>
                                <option value="claude-3-opus">Claude 3 Opus</option>
                            </select>
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                             <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>Max Steps</label>
                             <input 
                                type="number" 
                                value={maxSteps}
                                onChange={(e) => setMaxSteps(parseInt(e.target.value))}
                                min="1" max="50"
                                style={{
                                    width: '100%',
                                    padding: '5px',
                                    borderRadius: '3px',
                                    backgroundColor: 'var(--vscode-input-background)',
                                    color: 'var(--vscode-input-foreground)',
                                    border: '1px solid var(--vscode-input-border)'
                                }}
                             />
                        </div>

                        <label className="checkbox-wrapper">
                            <input 
                                type="checkbox" 
                                checked={autoApprove}
                                onChange={(e) => setAutoApprove(e.target.checked)}
                            />
                            <span>Auto-approve tool execution</span>
                        </label>
                    </div>
                )}
            </div>

            {/* Right Column: Preview & Action */}
            <div className="launch-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="launch-header">
                    <span className="launch-icon">🎯</span>
                    <h3 style={{ margin: 0 }}>Execution Plan</h3>
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.9em', color: 'var(--vscode-descriptionForeground)', marginBottom: '5px' }}>Target Environment</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ 
                                display: 'inline-block', 
                                width: '10px', 
                                height: '10px', 
                                borderRadius: '50%', 
                                backgroundColor: 'var(--vscode-testing-iconPassed)' 
                            }}></span>
                            <strong>{agentType === 'vscode' ? 'VS Code Extension Host' : 'Integrated Terminal'}</strong>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                         <div style={{ fontSize: '0.9em', color: 'var(--vscode-descriptionForeground)', marginBottom: '5px' }}>Capabilities</div>
                         <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {['File System', 'Search', 'Terminal', 'Memory Bank'].map(cap => (
                                <span key={cap} style={{ 
                                    fontSize: '0.85em', 
                                    padding: '2px 8px', 
                                    borderRadius: '10px', 
                                    backgroundColor: 'var(--vscode-badge-background)', 
                                    color: 'var(--vscode-badge-foreground)' 
                                }}>
                                    {cap}
                                </span>
                            ))}
                         </div>
                    </div>

                    <div style={{ padding: '15px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px', marginBottom: '20px' }}>
                        <strong>Ready to Launch</strong>
                        <p style={{ margin: '5px 0 0 0', fontSize: '0.9em', opacity: 0.8 }}>
                            The agent will satisfy all constraints and context defined in the configuration.
                        </p>
                    </div>
                </div>

                <button 
                onClick={handleLaunch}
                disabled={isLaunching || (agentType === 'vscode' && !task)}
                style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (isLaunching || (agentType === 'vscode' && !task)) ? 'not-allowed' : 'pointer',
                    opacity: (isLaunching || (agentType === 'vscode' && !task)) ? 0.6 : 1,
                    fontSize: '1.1em',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
                >
                    {isLaunching ? (
                        <>
                            <span className="spinner" style={{ 
                                width: '16px', 
                                height: '16px', 
                                border: '2px solid rgba(255,255,255,0.3)', 
                                borderTop: '2px solid white', 
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></span>
                            Initializing...
                        </>
                    ) : (
                        <>
                            <span>🚀</span> Launch Agent
                        </>
                    )}
                </button>
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}} />
            </div>
        </div>
      </div>
    </div>
  );
};

export default LauncherTab;
