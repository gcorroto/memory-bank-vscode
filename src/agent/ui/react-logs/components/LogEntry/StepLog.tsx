/**
 * Step Log Component
 * Displays execution of a tool step
 */

import React, { useState } from 'react';
import { LogEntry } from '../../types';
import { ModelInfo } from '../ModelInfo';

interface StepLogProps {
    entry: LogEntry;
}

export const StepLog: React.FC<StepLogProps> = ({ entry }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`log-entry step-log ${entry.success ? 'success' : 'error'} ${expanded ? 'expanded' : ''}`}>
            <div className="log-header" onClick={() => setExpanded(!expanded)}>
                <span className="log-timestamp">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="log-icon">{entry.success ? '✓' : '✗'}</span>
                <span className="log-title">{entry.description || 'Step execution'}</span>
                {entry.tool && <span className="log-tool">{entry.tool}</span>}
            </div>

            <div className="log-content">
                <div className="log-section">
                    <h4>Parameters:</h4>
                    <pre className="code-block">
                        <code>{JSON.stringify(entry.params || {}, null, 2)}</code>
                    </pre>
                </div>

                <div className="log-section">
                    <h4>Result:</h4>
                    <pre className="code-block">
                        <code>{JSON.stringify(entry.result || {}, null, 2)}</code>
                    </pre>
                </div>

                <ModelInfo entry={entry} />
            </div>
        </div>
    );
};

