/**
 * Plan Node Component
 * Custom node for React Flow showing plan steps
 */

import React from 'react';
import { Handle, Position } from 'reactflow';

interface PlanNodeProps {
    data: {
        step: {
            description: string;
            tool: string;
            params?: any;
        };
        index: number;
        status: 'pending' | 'running' | 'success' | 'error';
    };
}

export const PlanNode: React.FC<PlanNodeProps> = ({ data }) => {
    const { step, index, status } = data;

    const statusEmoji = {
        pending: '⏳',
        running: '▶️',
        success: '✅',
        error: '❌'
    };

    const statusText = {
        pending: 'Pendiente',
        running: 'Ejecutando...',
        success: 'Completado',
        error: 'Error'
    };

    return (
        <div className={`plan-node ${status}`}>
            <Handle type="target" position={Position.Top} />
            
            <div className="plan-node-header">
                <div className="plan-node-index">{index + 1}</div>
                <div className="plan-node-tool">{step.tool}</div>
            </div>

            <div className="plan-node-description">
                {step.description || 'Sin descripción'}
            </div>

            <div className={`plan-node-status ${status}`}>
                {statusEmoji[status]} {statusText[status]}
            </div>

            <Handle type="source" position={Position.Bottom} />
        </div>
    );
};

