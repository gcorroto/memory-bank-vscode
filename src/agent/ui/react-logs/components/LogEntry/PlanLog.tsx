/**
 * Plan Log Component
 * Displays generated execution plan
 */

import React, { useState } from 'react';
import { LogEntry } from '../../types';
import { ModelInfo } from '../ModelInfo';

interface PlanLogProps {
    entry: LogEntry;
}

export const PlanLog: React.FC<PlanLogProps> = ({ entry }) => {
    const [expanded, setExpanded] = useState(true); // Expanded by default

    return (
        <div className={`log-entry plan-log ${expanded ? 'expanded' : ''}`}>
            <div className="log-header" onClick={() => setExpanded(!expanded)}>
                <span className="log-timestamp">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="log-icon">📋</span>
                <span className="log-title">Plan generado</span>
                {entry.modelInfo && <span className="log-model">{entry.modelInfo.name}</span>}
            </div>

            <div className="log-content">
                <div className="log-section">
                    <h4>Pasos planeados:</h4>
                    <ol className="steps-list">
                        {(entry.steps || []).map((step: any, index: number) => (
                            <li key={index}>
                                <div className="step-info">
                                    <span className="step-description">
                                        {step.description || ''}
                                    </span>
                                    <span className="step-tool">[{step.tool || ''}]</span>
                                </div>
                                <pre className="step-params">
                                    <code>{JSON.stringify(step.params || {}, null, 2)}</code>
                                </pre>
                            </li>
                        ))}
                    </ol>
                </div>

                {entry.appliedRules && entry.appliedRules.length > 0 && (
                    <div className="log-section">
                        <h4>Reglas aplicadas ({entry.appliedRules.length}):</h4>
                        <ul className="rules-list">
                            {entry.appliedRules.slice(0, 5).map((rule, index) => (
                                <li key={index}>{rule}</li>
                            ))}
                            {entry.appliedRules.length > 5 && (
                                <li>... y {entry.appliedRules.length - 5} reglas más</li>
                            )}
                        </ul>
                    </div>
                )}

                <ModelInfo entry={entry} />
            </div>
        </div>
    );
};

