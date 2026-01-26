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
  
  // Multi-task selection
  const [selectedInternalTasks, setSelectedInternalTasks] = useState<string[]>([]);
  const [selectedExternalRequests, setSelectedExternalRequests] = useState<string[]>([]);
  
  // MCP selection
  const [selectedMCPs, setSelectedMCPs] = useState<string[]>([]);
  const [configuredMCPs, setConfiguredMCPs] = useState<Record<string, any>>({});

  // Advanced settings
  const [model, setModel] = useState('gpt-5.1-codex'); // Default for Codex
  const [autoApprove, setAutoApprove] = useState(false); // Default false for checks
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

  // Effect to handle pre-launch data
  React.useEffect(() => {
    if (state.launcherData && state.launcherData.task) {
        // If it looks like ID, preselect. Otherwise text.
        // For simplicity, we just put it in text for now as user might want to edit
        setTask(state.launcherData.task);
    }
    
    // Request config on mount
    postMessage({ type: 'REQUEST_AGENT_CONFIG', command: 'REQUEST_AGENT_CONFIG' });
    
    // Default MCPs setup
    const standardMCPs = {
        "filesystem": { description: "Access local files" },
        "git": { description: "Git repository control" },
        "memory-bank": { description: "RAG & Knowledge Graph" }
    };
    setConfiguredMCPs(standardMCPs);
    // Preselect memory-bank
    setSelectedMCPs(['memory-bank']);
  }, [state.launcherData]);

  const handleLaunch = () => {
    // Validation
    const hasTask = task.trim().length > 0;
    const hasSelection = selectedInternalTasks.length > 0 || selectedExternalRequests.length > 0;
    
    if (!hasTask && !hasSelection) {
      return; 
    }
    
    setIsLaunching(true);

    // Build composite prompt
    let compositeTask = task;
    
    const internalTitles = state.delegation.pendingTasks
        .filter(t => selectedInternalTasks.includes(t.id))
        .map(t => `${t.title} (ID: ${t.id})`);
        
    const externalTitles = state.delegation.externalRequests
        .filter(t => selectedExternalRequests.includes(t.id))
        .map(t => `${t.title} (ID: ${t.id})`);

    const allSelectedTitles = [...internalTitles, ...externalTitles];
    
    if (allSelectedTitles.length > 0) {
        const prefix = "Realiza las siguientes tareas pendientes:\n- " + allSelectedTitles.join("\n- ");
        if (compositeTask) {
            compositeTask = prefix + "\n\nInstrucciones adicionales:\n" + compositeTask;
        } else {
            compositeTask = prefix;
        }
        compositeTask += "\n\nUna vez completado, reindexa los cambios.";
    }
    
    // Save to recents if text provided
    if (task && agentType === 'vscode') {
        const updatedRecents = [task, ...recentTasks.filter(t => t !== task)].slice(0, 5);
        setRecentTasks(updatedRecents);
        localStorage.setItem('memorybank_recent_tasks', JSON.stringify(updatedRecents));
    }

    postMessage({
      type: 'LAUNCH_AGENT',
      command: 'LAUNCH_AGENT',
      payload: {
        agentType,
        task: compositeTask,
        cliCommand: agentType === 'cli' ? cliCommand : undefined,
        config: {
            model: agentType === 'vscode' ? 'default' : model,
            autoApprove,
            maxSteps,
            selectedMCPs: agentType === 'cli' ? selectedMCPs : undefined
        }
      }
    });

    // Reset status after a delay
    setTimeout(() => setIsLaunching(false), 2000);
  };
  
  const toggleInternalTask = (id: string) => {
      if (selectedInternalTasks.includes(id)) {
          setSelectedInternalTasks(selectedInternalTasks.filter(k => k !== id));
      } else {
          setSelectedInternalTasks([...selectedInternalTasks, id]);
      }
  };

  const toggleExternalRequest = (id: string) => {
      if (selectedExternalRequests.includes(id)) {
          setSelectedExternalRequests(selectedExternalRequests.filter(k => k !== id));
      } else {
          setSelectedExternalRequests([...selectedExternalRequests, id]);
      }
  };

  const toggleMCP = (id: string) => {
      if (selectedMCPs.includes(id)) {
          setSelectedMCPs(selectedMCPs.filter(k => k !== id));
      } else {
          setSelectedMCPs([...selectedMCPs, id]);
      }
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
            .launch-card h3 {
                margin-top: 0;
                margin-bottom: 15px;
                border-bottom: 1px solid var(--vscode-settings-dropdownBorder);
                padding-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .section-label {
                font-weight: bold;
                margin-top: 15px;
                margin-bottom: 5px;
                display: block;
                color: var(--vscode-foreground);
            }
            .task-list {
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid var(--vscode-input-border);
                background: var(--vscode-input-background);
                border-radius: 4px;
                padding: 5px;
            }
            .task-item {
                display: flex;
                align-items: center;
                padding: 6px;
                border-bottom: 1px solid var(--vscode-tree-tableOddRowsBackground); 
            }
            .task-item:last-child {
                border-bottom: none;
            }
            .task-item label {
                margin-left: 8px;
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                user-select: none;
            }
            .mcp-list {
                display: grid;
                grid-template-columns: 1fr; 
                gap: 5px;
                margin-top: 5px;
            }
            .mcp-item {
                display: flex;
                align-items: center;
                background: var(--vscode-textBlockQuote-background);
                padding: 8px 10px;
                border-radius: 4px;
                cursor: pointer;
            }
            .launch-btn {
                width: 100%;
                padding: 12px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 1.1em;
                margin-top: 20px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justifyContent: center;
                gap: 8px;
            }
            .launch-btn:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            .launch-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .agent-type-btn {
                transition: all 0.2s;
            }
            .agent-type-btn:hover {
                background: var(--vscode-list-hoverBackground) !important;
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
                <h3>⚙️ Configuration</h3>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label className="section-label">Agent Environment</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div 
                            className="agent-type-btn"
                            onClick={() => { setAgentType('vscode'); setModel('default'); }}
                            style={{
                                flex: 1,
                                padding: '12px',
                                border: `2px solid ${agentType === 'vscode' ? 'var(--vscode-focusBorder)' : 'var(--vscode-widget-border)'}`,
                                backgroundColor: agentType === 'vscode' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                                color: agentType === 'vscode' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                textAlign: 'center'
                            }}
                        >
                            <strong>VS Code</strong>
                            <div style={{ fontSize: '0.85em', opacity: 0.8 }}>Internal Extension</div>
                        </div>
                        <div 
                            className="agent-type-btn"
                            onClick={() => { setAgentType('cli'); setModel('gpt-5.1-codex'); }}
                            style={{
                                flex: 1,
                                padding: '12px',
                                border: `2px solid ${agentType === 'cli' ? 'var(--vscode-focusBorder)' : 'var(--vscode-widget-border)'}`,
                                backgroundColor: agentType === 'cli' ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                                color: agentType === 'cli' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                textAlign: 'center'
                            }}
                        >
                            <strong>Codex / CLI</strong>
                            <div style={{ fontSize: '0.85em', opacity: 0.8 }}>External Process</div>
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label className="section-label">Model</label>
                    <select 
                        value={model} 
                        onChange={(e) => setModel(e.target.value)}
                        disabled={agentType === 'vscode'}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: 'var(--vscode-dropdown-background)',
                            color: 'var(--vscode-dropdown-foreground)',
                            border: '1px solid var(--vscode-dropdown-border)',
                            opacity: agentType === 'vscode' ? 0.7 : 1
                        }}
                    >
                        {agentType === 'vscode' ? (
                            <option value="default">Default Copilot Model (VS Code)</option>
                        ) : (
                            <>
                                <option value="gpt-5.1-codex">GPT-5.1 Codex (Preview)</option>
                                <option value="gpt-5-mini">GPT-5 Mini</option>
                                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                            </>
                        )}
                    </select>
                </div>

                {agentType === 'cli' && (
                    <div className="form-group">
                        <label className="section-label">Included MCP Servers (stdio)</label>
                        <div className="mcp-list">
                            {Object.entries(configuredMCPs).map(([id, config]) => (
                                <div key={id} className="mcp-item" onClick={() => toggleMCP(id)}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedMCPs.includes(id)}
                                        onChange={() => {}} // Handle click on div
                                        style={{cursor:'pointer'}}
                                    />
                                    <div style={{marginLeft:'10px'}}>
                                        <div style={{fontWeight:'bold'}}>{id}</div>
                                        <div style={{fontSize:'0.8em', opacity:0.8}}>{config.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: Task Selection */}
            <div className="launch-card">
                <h3>🎯 Task Selection</h3>

                <div className="form-group">
                    <label className="section-label">Pending Internal Tasks</label>
                    <div className="task-list">
                        {state.delegation.pendingTasks.length === 0 && (
                            <div style={{padding:'10px', color:'var(--vscode-descriptionForeground)', fontStyle:'italic'}}>No pending internal tasks</div>
                        )}
                        {state.delegation.pendingTasks.map(t => (
                            <div key={t.id} className="task-item" onClick={() => toggleInternalTask(t.id)}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedInternalTasks.includes(t.id)}
                                    onChange={() => {}}
                                />
                                <label title={t.title}>{t.title}</label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label className="section-label">External Requests</label>
                    <div className="task-list">
                        {state.delegation.externalRequests.length === 0 && (
                            <div style={{padding:'10px', color:'var(--vscode-descriptionForeground)', fontStyle:'italic'}}>No external requests</div>
                        )}
                        {state.delegation.externalRequests.map(t => (
                            <div key={t.id} className="task-item" onClick={() => toggleExternalRequest(t.id)}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedExternalRequests.includes(t.id)}
                                    onChange={() => {}}
                                />
                                <label title={t.title}>{t.title} <span style={{opacity:0.6}}>(from {t.fromProject})</span></label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label className="section-label">Additional Instructions</label>
                    <textarea
                        value={task}
                        onChange={(e) => setTask(e.target.value)}
                        placeholder="Add custom instructions or context..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            resize: 'vertical'
                        }}
                    />
                </div>

                <button 
                    className="launch-btn"
                    onClick={handleLaunch}
                    disabled={isLaunching || (!task && selectedInternalTasks.length === 0 && selectedExternalRequests.length === 0)}
                >
                    {isLaunching ? '🚀 Launching...' : `🚀 Launch ${agentType === 'vscode' ? 'VS Code Agent' : 'Codex Agent'}`}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LauncherTab;
