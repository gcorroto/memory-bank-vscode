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
  const [cliCommand, setCliCommand] = useState('codex');
  const [isLaunching, setIsLaunching] = useState(false);
  
  // Codex specific options
  const [approvalMode, setApprovalMode] = useState('on-request');
  const [sandboxMode, setSandboxMode] = useState('workspace-write');
  const [workDir, setWorkDir] = useState('${workspaceFolder}');

  // New CLI Options State
  const [fullAuto, setFullAuto] = useState(true); // Default true per user request
  const [oss, setOss] = useState(false);
  const [noAltScreen, setNoAltScreen] = useState(false);
  const [skipGitCheck, setSkipGitCheck] = useState(true); // Default true per user request
  const [bypassSafety, setBypassSafety] = useState(false); // dangerously-bypass...
  const [addDirs, setAddDirs] = useState(''); // Text input for paths

  // Track expanded MCP details
  const [expandedMCPs, setExpandedMCPs] = useState<string[]>([]);
  
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
        setTask(state.launcherData.task);
    }
    
    // Check for configured MCPs from extension
    if (state.launcherData?.configuredMCPs) {
        setConfiguredMCPs(state.launcherData.configuredMCPs);
    } else {
        // Default MCPs setup (fallback)
        const standardMCPs = {
            "filesystem": { 
                description: "Access local files",
                command: "npx", 
                args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
            },
            "memory-bank": { 
                description: "RAG & Knowledge Graph",
                command: "npx",
                args: ["@grec0/memory-bank-mcp"],
                env: {
                    "OPENAI_API_KEY": "api-key-here",
                    "MEMORYBANK_REASONING_MODEL": "gpt-5-mini",
                    "MEMORYBANK_REASONING_EFFORT": "medium",
                    "MEMORYBANK_AUTO_UPDATE_DOCS": false,
                    "MEMORYBANK_MAX_TOKENS": 7500,
                    "MEMORYBANK_CHUNK_OVERLAP_TOKENS": 200
			    }
            }
        };
        setConfiguredMCPs(standardMCPs);
    }
    
    // Request config AND delegation state on mount
    postMessage({ type: 'REQUEST_AGENT_CONFIG', command: 'REQUEST_AGENT_CONFIG' });
    postMessage({ type: 'REQUEST_DELEGATION_STATE', command: 'REQUEST_DELEGATION_STATE' });
    
    // Preselect memory-bank
    if (selectedMCPs.length === 0) {
        setSelectedMCPs(['memory-bank']);
    }
  }, [state.launcherData]);

  // Build the CLI command dynamically
  React.useEffect(() => {
      if (agentType === 'cli') {
          const buildCommand = () => {
              let cmd = 'codex';
              
              // Base args
              if (model !== 'default') cmd += ` --model ${model}`;
              if (approvalMode !== 'on-request') cmd += ` --ask-for-approval ${approvalMode}`;
              if (sandboxMode !== 'workspace-write') cmd += ` --sandbox ${sandboxMode}`;
              if (workDir && workDir !== '${workspaceFolder}') cmd += ` --cd "${workDir}"`;
              
              // New flags
              if (fullAuto) cmd += ` --full-auto`;
              if (oss) cmd += ` --oss`;
              if (noAltScreen) cmd += ` --no-alt-screen`;
              if (skipGitCheck) cmd += ` --skip-git-repo-check`;
              if (bypassSafety) cmd += ` --dangerously-bypass-approvals-and-sandbox`;
              
              if (addDirs.trim()) {
                  const dirs = addDirs.split(',').map(d => d.trim()).filter(d => d.length > 0);
                  dirs.forEach(d => {
                      cmd += ` --add-dir "${d}"`;
                  });
              }
              
              // Full auto shortcut check (optional, but keep explicit flags for clarity)
              // if (approvalMode === 'on-request' && sandboxMode === 'workspace-write') ... 

              // MCP configuration via -c
              selectedMCPs.forEach(id => {
                  const config = configuredMCPs[id];
                  if (config) {
                      // Construct JSON structure for this server
                      let serverConfig: any = {};
                      
                      if (config.command) serverConfig.command = config.command;
                      if (config.args) serverConfig.args = config.args;
                      if (config.env) serverConfig.env = config.env;
                      if (config.url) serverConfig.url = config.url; // Http support
                      
                      // Pass as -c mcp_servers.id={...}
                      // Use single quotes for the JSON string to avoid shell issues, 
                      // but keys need double quotes in JSON.
                      const jsonStr = JSON.stringify(serverConfig);
                      // Escape double quotes inside the JSON string for the shell if needed, 
                      // but simpler to rely on Node/Python parsing the string if wrapped in quotes.
                      // For Windows PowerShell/CMD, quoting is tricky. 
                      // Let's assume standard bash/unix style for now or generic.
                      // A safer way might be separating keys if the JSON parser is strict or shell is weird.
                      // -c mcp_servers.id.command="..." -c mcp_servers.id.args=[...]
                      
                      if (serverConfig.command) {
                          cmd += ` -c mcp_servers.${id}.command="${serverConfig.command}"`;
                      }
                      if (serverConfig.args) {
                          // Array needs to be passed carefully. JSON string might work better for complex types.
                           cmd += ` -c mcp_servers.${id}.args='${JSON.stringify(serverConfig.args)}'`;
                      }
                      if (serverConfig.env) {
                           // Env map
                           Object.entries(serverConfig.env).forEach(([k, v]) => {
                               cmd += ` -c mcp_servers.${id}.env.${k}="${v}"`;
                           });
                      }
                  }
              });

              // Add the prompt at the end (quoted)
              // We construct the prompt but don't add it to the visible CLI command state 
              // because it makes it too long. The user launches it, we pass the command + task.
              // But here we set 'cliCommand' which IS what is executed.
              // So we should append the task here? Or assume the 'task' state is passed as the PROMPT arg?
              
              // If we put the task in the input box, we might want to append it.
              // But for the visualization, we just show the flags.
              
              return cmd;
          };
          setCliCommand(buildCommand());
      }
  }, [agentType, model, approvalMode, sandboxMode, workDir, selectedMCPs, configuredMCPs, fullAuto, oss, noAltScreen, skipGitCheck, bypassSafety, addDirs]);

  const copyToClipboard = (text: string) => {
      postMessage({
          type: 'COPY_TO_CLIPBOARD', // Assuming this message type is handled or I can use navigator.clipboard if allowed
          command: 'vscode.env.clipboard.writeText', // Fallback or direct usage
          text: text
      });
      // Try web API too
      navigator.clipboard.writeText(text).catch(() => {});
  };

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
    
    // Final command construction for CLI
    let finalCliCommand = cliCommand;
    if (agentType === 'cli') {
        // Escape the prompt for shell
        const safePrompt = compositeTask.replace(/"/g, '\\"');
        finalCliCommand += ` "${safePrompt}"`;
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
        cliCommand: agentType === 'cli' ? finalCliCommand : undefined,
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

  const toggleMCP = (id: string, e?: React.MouseEvent) => {
      // If clicking the checkbox or container (not the expand button)
      if (selectedMCPs.includes(id)) {
          setSelectedMCPs(selectedMCPs.filter(k => k !== id));
      } else {
          setSelectedMCPs([...selectedMCPs, id]);
      }
  };

  const toggleMCPDetails = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (expandedMCPs.includes(id)) {
          setExpandedMCPs(expandedMCPs.filter(k => k !== id));
      } else {
          setExpandedMCPs([...expandedMCPs, id]);
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
            Agent Launchpad
        </h2>
        <p style={{ marginBottom: '25px', color: 'var(--vscode-descriptionForeground)' }}>
            Configure and launch AI agents to automate your development tasks.
        </p>
        
        <div className="launcher-grid">
            {/* Left Column: Configuration */}
            <div className="launch-card">
                <h3>Configuration</h3>

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
                            onClick={() => { setAgentType('cli'); setModel('gpt-5.1-codex'); setCliCommand('codex'); }}
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
                            <strong>Codex (OpenAI)</strong>
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
                                <option value="gpt-5.2-codex">GPT-5.2-codex</option>
                                <option value="gpt-5.1-codex-mini">GPT-5.1-codex-mini</option>
                            </>
                        )}
                    </select>
                </div>

                {agentType === 'cli' && (
                    <div className="form-group">
                        <label className="section-label">MCP Servers</label>
                        <p style={{fontSize:'0.85em', color:'var(--vscode-descriptionForeground)', marginTop:'-5px', marginBottom:'10px'}}>
                            Select available MCP servers to include in the session.
                        </p>
                        <div className="mcp-list">
                            {Object.entries(configuredMCPs).map(([id, config]) => (
                                <div key={id} style={{marginBottom: '5px'}}>
                                    <div 
                                        className="mcp-item" 
                                        onClick={() => toggleMCP(id)}
                                        style={{
                                            borderLeft: selectedMCPs.includes(id) ? '3px solid var(--vscode-button-background)' : '3px solid transparent',
                                            display: 'flex',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <div style={{display:'flex', alignItems:'center'}}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedMCPs.includes(id)}
                                                onChange={() => {}} 
                                                style={{cursor:'pointer', marginRight:'10px'}}
                                            />
                                            <div>
                                                <div style={{fontWeight:'bold', display:'flex', alignItems:'center', gap:'8px'}}>
                                                    {id}
                                                    {selectedMCPs.includes(id) ? 
                                                        <span style={{fontSize:'0.7em', background:'var(--vscode-button-background)', color:'var(--vscode-button-foreground)', padding:'1px 5px', borderRadius:'3px'}}>Active</span> :
                                                        <span style={{fontSize:'0.7em', background:'var(--vscode-badge-background)', color:'var(--vscode-badge-foreground)', padding:'1px 5px', borderRadius:'3px', opacity: 0.7}}>Disabled</span>
                                                    }
                                                </div>
                                                <div style={{fontSize:'0.8em', opacity:0.8}}>{config.description || "No description"}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => toggleMCPDetails(id, e)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--vscode-textLink-foreground)',
                                                cursor: 'pointer',
                                                fontSize: '0.9em',
                                                padding: '5px'
                                            }}
                                        >
                                            {expandedMCPs.includes(id) ? 'Hide Config ▲' : 'Show Config ▼'}
                                        </button>
                                    </div>
                                    
                                    {/* Configuration Details Panel */}
                                    {expandedMCPs.includes(id) && (
                                        <div style={{
                                            padding: '10px',
                                            background: 'var(--vscode-editor-background)',
                                            border: '1px solid var(--vscode-widget-border)',
                                            borderTop: 'none',
                                            borderRadius: '0 0 4px 4px',
                                            fontSize: '0.85em',
                                            fontFamily: 'monospace'
                                        }}>
                                            {config.command ? (
                                                <>
                                                    <div style={{fontWeight:'bold', color:'var(--vscode-textPreformat-foreground)', marginBottom:'5px'}}>STDIO Config:</div>
                                                    <div style={{marginBottom:'5px'}}>
                                                        <span style={{color:'var(--vscode-symbolIcon-functionForeground)'}}>command:</span> <span style={{color:'var(--vscode-textPreformat-foreground)'}}>{config.command}</span>
                                                    </div>
                                                    {config.args && (
                                                        <div style={{marginBottom:'5px'}}>
                                                            <span style={{color:'var(--vscode-symbolIcon-variableForeground)'}}>args:</span> <span style={{color:'var(--vscode-textPreformat-foreground)'}}>{JSON.stringify(config.args)}</span>
                                                        </div>
                                                    )}
                                                    {config.env && (
                                                        <div>
                                                            <span style={{color:'var(--vscode-symbolIcon-constantForeground)'}}>env:</span>
                                                            <div style={{paddingLeft:'15px', color:'var(--vscode-textPreformat-foreground)'}}>
                                                                {Object.entries(config.env).map(([k, v]) => (
                                                                    <div key={k}>{k}={String(v)}</div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            ) : config.url ? (
                                                <>
                                                    <div style={{fontWeight:'bold', color:'var(--vscode-textPreformat-foreground)', marginBottom:'5px'}}>SSE/HTTP Config:</div>
                                                    <div>
                                                        <span style={{color:'var(--vscode-symbolIcon-eventForeground)'}}>url:</span> <span style={{color:'var(--vscode-textLink-foreground)'}}>{config.url}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{fontStyle:'italic', opacity:0.7}}>No detailed configuration available</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <div style={{marginTop: '15px'}}>
                           <div className="Advanced Settings" style={{marginBottom: '10px', fontWeight: 'bold'}}>Opciones CLI (Avanzado)</div>
                           
                           {/* Safety & Permissions Group */}
                           <div style={{marginBottom:'15px', border:'1px solid var(--vscode-widget-border)', padding:'10px', borderRadius:'4px'}}>
                               <div style={{fontWeight:'bold', marginBottom:'8px', borderBottom:'1px solid var(--vscode-widget-border)', paddingBottom:'4px'}}>Seguridad y Permisos</div>
                               
                               <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
                                    <div>
                                        <label className="section-label" style={{marginTop:'0'}}>Modo de Aprobación</label>
                                        <select 
                                            value={approvalMode}
                                            onChange={(e) => setApprovalMode(e.target.value)}
                                            disabled={fullAuto} // full-auto overrides this
                                            style={{width:'100%', padding:'6px', background:'var(--vscode-dropdown-background)', color:'var(--vscode-dropdown-foreground)', border:'1px solid var(--vscode-dropdown-border)', opacity: fullAuto?0.6:1}}
                                        >
                                            <option value="on-request">Preguntar (Por defecto)</option>
                                            <option value="never">Nunca (Confiar)</option>
                                            <option value="untrusted">Desconfiado</option>
                                            <option value="on-failure">Solo en fallos</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="section-label" style={{marginTop:'0'}}>Modo Sandbox</label>
                                        <select 
                                            value={sandboxMode}
                                            onChange={(e) => setSandboxMode(e.target.value)}
                                            disabled={fullAuto} // full-auto overrides this
                                            style={{width:'100%', padding:'6px', background:'var(--vscode-dropdown-background)', color:'var(--vscode-dropdown-foreground)', border:'1px solid var(--vscode-dropdown-border)', opacity: fullAuto?0.6:1}}
                                        >
                                            <option value="workspace-write">Escritura en Workspace (Default)</option>
                                            <option value="read-only">Solo Lectura</option>
                                            <option value="danger-full-access">Acceso Total (Peligroso)</option>
                                        </select>
                                    </div>
                               </div>

                               <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                    <div style={{display:'flex', alignItems:'center'}}>
                                        <input type="checkbox" checked={fullAuto} onChange={(e) => setFullAuto(e.target.checked)} id="opt-fullauto" />
                                        <label htmlFor="opt-fullauto" style={{marginLeft:'8px', cursor:'pointer'}}>
                                            <strong>Modo Automático (--full-auto)</strong> <span style={{opacity:0.7, fontSize:'0.9em'}}>(Recomendado: Menos interrupciones)</span>
                                        </label>
                                    </div>
                                    <div style={{display:'flex', alignItems:'center'}}>
                                        <input type="checkbox" checked={bypassSafety} onChange={(e) => setBypassSafety(e.target.checked)} id="opt-bypass" />
                                        <label htmlFor="opt-bypass" style={{marginLeft:'8px', cursor:'pointer', color: bypassSafety ? 'var(--vscode-errorForeground)' : 'inherit'}}>
                                            <strong>Desactivar Seguridad (--dangerously-bypass...)</strong> <span style={{opacity:0.7, fontSize:'0.9em'}}>(¡Cuidado!)</span>
                                        </label>
                                    </div>
                               </div>
                           </div>

                           {/* Environment Group */}
                           <div style={{marginBottom:'15px', border:'1px solid var(--vscode-widget-border)', padding:'10px', borderRadius:'4px'}}>
                               <div style={{fontWeight:'bold', marginBottom:'8px', borderBottom:'1px solid var(--vscode-widget-border)', paddingBottom:'4px'}}>Entorno y Sistema</div>
                               
                               <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginBottom:'10px'}}>
                                   <div style={{display:'flex', alignItems:'center'}}>
                                        <input type="checkbox" checked={oss} onChange={(e) => setOss(e.target.checked)} id="opt-oss" />
                                        <label htmlFor="opt-oss" style={{marginLeft:'8px', cursor:'pointer'}}>
                                            <strong>Modelo Local/OSS (--oss)</strong>
                                        </label>
                                    </div>
                                    <div style={{display:'flex', alignItems:'center'}}>
                                        <input type="checkbox" checked={skipGitCheck} onChange={(e) => setSkipGitCheck(e.target.checked)} id="opt-git" />
                                        <label htmlFor="opt-git" style={{marginLeft:'8px', cursor:'pointer'}}>
                                            <strong>Ignorar Git Check (--skip-git-repo-check)</strong>
                                        </label>
                                    </div>
                                    <div style={{display:'flex', alignItems:'center'}}>
                                        <input type="checkbox" checked={noAltScreen} onChange={(e) => setNoAltScreen(e.target.checked)} id="opt-altscreen" />
                                        <label htmlFor="opt-altscreen" style={{marginLeft:'8px', cursor:'pointer'}}>
                                            <strong>Terminal Simple (--no-alt-screen)</strong>
                                        </label>
                                    </div>
                               </div>

                                <div style={{marginTop:'10px'}}>
                                    <label className="section-label">Directorio de Trabajo (--cd)</label>
                                    <input 
                                        type="text" 
                                        value={workDir}
                                        onChange={(e) => setWorkDir(e.target.value)}
                                        placeholder="${workspaceFolder}"
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            background: 'var(--vscode-input-background)',
                                            border: '1px solid var(--vscode-input-border)',
                                            color: 'var(--vscode-input-foreground)'
                                        }}
                                    />
                                </div>
                                <div style={{marginTop:'10px'}}>
                                    <label className="section-label">Directorios Extra (--add-dir)</label>
                                    <input 
                                        type="text" 
                                        value={addDirs}
                                        onChange={(e) => setAddDirs(e.target.value)}
                                        placeholder="C:/libs, D:/assets (separados por coma)"
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            background: 'var(--vscode-input-background)',
                                            border: '1px solid var(--vscode-input-border)',
                                            color: 'var(--vscode-input-foreground)'
                                        }}
                                    />
                                </div>
                           </div>

                            <div style={{marginTop:'15px'}}>
                                <label className="section-label">Vista Previa del Comando (Copiar si es necesario)</label>
                                <textarea 
                                    readOnly
                                    value={cliCommand + (task ? ' "..."' : '')}
                                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                                    style={{
                                        width: '100%',
                                        height: '100px',
                                        background: 'var(--vscode-editor-background)',
                                        color: 'var(--vscode-editor-foreground)',
                                        border: '1px solid var(--vscode-widget-border)',
                                        fontFamily: 'monospace',
                                        fontSize: '0.9em',
                                        padding: '10px',
                                        resize: 'vertical',
                                        cursor: 'text'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: Task Selection */}
            <div className="launch-card">
                <h3>Task Selection</h3>

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
                    {isLaunching ? 'Launching...' : `Launch ${agentType === 'vscode' ? 'VS Code Agent' : 'Codex Agent'}`}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LauncherTab;
