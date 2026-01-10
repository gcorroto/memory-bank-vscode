/**
 * Reflection Log Component
 * Displays agent's reflection on execution
 */

import React, { useState } from 'react';
import { LogEntry } from '../../types';
import { ModelInfo } from '../ModelInfo';

interface ReflectionLogProps {
    entry: LogEntry;
}

export const ReflectionLog: React.FC<ReflectionLogProps> = ({ entry }) => {
    const [expanded, setExpanded] = useState(false);

    // Determine status styling
    let statusClass = '';
    let statusIcon = '🔍';

    if (entry.status) {
        switch (entry.status) {
            case 'success':
                statusClass = 'reflection-success';
                statusIcon = '✅';
                break;
            case 'partial':
                statusClass = 'reflection-partial';
                statusIcon = '⚠️';
                break;
            case 'failed':
                statusClass = 'reflection-failed';
                statusIcon = '❌';
                break;
        }
    }

    return (
        <div className={`log-entry reflection-log ${statusClass} ${expanded ? 'expanded' : ''}`}>
            <div className="log-header" onClick={() => setExpanded(!expanded)}>
                <span className="log-timestamp">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="log-icon">{statusIcon}</span>
                <span className="log-title">Reflexión del agente</span>
                {entry.modelInfo && <span className="log-model">{entry.modelInfo.name}</span>}
            </div>

            <div className="log-content">
                <div className="log-section">
                    <h4>Reflexión:</h4>
                    <div className="reflection-text">
                        {(entry.reflection || '').split('\n').map((line, index) => (
                            <p key={index}>{line}</p>
                        ))}
                    </div>
                </div>

                {entry.successfulSteps !== undefined && (
                    <div className="reflection-stats">
                        <h4>Estadísticas:</h4>
                        <p>Pasos completados con éxito: <span className="success-count">{entry.successfulSteps}</span></p>
                        <p>Pasos fallidos: <span className="failed-count">{entry.failedSteps}</span></p>
                        {entry.stoppedAtStep && (
                            <>
                                <p>Ejecución detenida en: <span className="stopped-step">{entry.stoppedAtStep}</span></p>
                                <p>Motivo: <span className="stop-reason">{entry.stopReason || ''}</span></p>
                            </>
                        )}
                    </div>
                )}

                {entry.recommendations && entry.recommendations.length > 0 && (
                    <div className="reflection-recommendations">
                        <h4>Recomendaciones:</h4>
                        <ul className="recommendations-list">
                            {entry.recommendations.map((rec, index) => (
                                <li key={index} className="recommendation-item">{rec}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {entry.modelUsage && entry.modelUsage.length > 0 && (
                    <div className="model-usage-container">
                        <h4>Uso de modelos LLM:</h4>
                        <table className="model-usage-table">
                            <thead>
                                <tr>
                                    <th>Modelo</th>
                                    <th>Llamadas</th>
                                    <th>Tokens de entrada</th>
                                    <th>Tokens de salida</th>
                                    <th>Coste USD</th>
                                    <th>Coste EUR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entry.modelUsage.map((model, index) => (
                                    <tr key={index}>
                                        <td>{model.model}</td>
                                        <td>{model.calls}</td>
                                        <td>{model.inputTokens}</td>
                                        <td>{model.outputTokens}</td>
                                        <td>${model.costUSD.toFixed(6)}</td>
                                        <td>€{model.costEUR.toFixed(6)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="total-row">
                                    <td colSpan={4}>Total:</td>
                                    <td>${entry.totalCostUSD ? entry.totalCostUSD.toFixed(6) : '0.000000'}</td>
                                    <td>€{entry.totalCostEUR ? entry.totalCostEUR.toFixed(6) : '0.000000'}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

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

