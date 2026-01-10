/**
 * Build Rules Log Component
 * Displays rules that will be applied
 */

import React, { useState } from 'react';
import { LogEntry } from '../../types';

interface BuildRulesLogProps {
    entry: LogEntry;
}

export const BuildRulesLog: React.FC<BuildRulesLogProps> = ({ entry }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`log-entry build-rules-log ${expanded ? 'expanded' : ''}`}>
            <div className="log-header" onClick={() => setExpanded(!expanded)}>
                <span className="log-timestamp">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="log-icon">📝</span>
                <span className="log-title">
                    {entry.description || 'Reglas aplicables'}
                </span>
            </div>

            <div className="log-content">
                <div className="log-section">
                    <h4>Reglas ({(entry.rules || []).length}):</h4>
                    <div className="rules-container">
                        {entry.rules && entry.rules.length > 0 ? (
                            <ul className="rules-list">
                                {entry.rules.map((rule, index) => (
                                    <li key={index}>{rule}</li>
                                ))}
                            </ul>
                        ) : (
                            <div className="no-rules">No hay reglas definidas</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

