/**
 * Model Info Component
 * Displays model information, token usage and cost
 */

import React from 'react';
import { LogEntry } from '../types';
import { CollapsibleSection } from './CollapsibleSection';

interface ModelInfoProps {
    entry: LogEntry;
}

export const ModelInfo: React.FC<ModelInfoProps> = ({ entry }) => {
    if (!entry.modelInfo) {
        return null;
    }

    return (
        <CollapsibleSection title="Modelo LLM" defaultExpanded={true}>
            <div className="model-details">
                <p><strong>Nombre:</strong> {entry.modelInfo.name || 'Desconocido'}</p>
                <p><strong>Tipo de tarea:</strong> {entry.modelInfo.taskType || 'Sin especificar'}</p>
            </div>

            {entry.tokenCount && (
                <div className="token-usage">
                    <h5>Uso de tokens</h5>
                    <p><span className="token-label">Prompt:</span> {entry.tokenCount.prompt || 0}</p>
                    <p><span className="token-label">Completion:</span> {entry.tokenCount.completion || 0}</p>
                    <p><span className="token-label">Total:</span> {entry.tokenCount.total || (entry.tokenCount.prompt + entry.tokenCount.completion)}</p>
                </div>
            )}

            {entry.modelCost && (
                <div className="cost-info">
                    <h5>Coste de modelo</h5>
                    <p><span className="cost-label">Coste USD:</span> ${entry.modelCost.totalUSD.toFixed(6)}</p>
                    <p><span className="cost-label">Coste EUR:</span> €{entry.modelCost.totalEUR.toFixed(6)}</p>
                    <p className="desglose-label">
                        Desglose: Input: ${entry.modelCost.inputUSD.toFixed(6)}, Output: ${entry.modelCost.outputUSD.toFixed(6)}
                    </p>
                </div>
            )}
        </CollapsibleSection>
    );
};

