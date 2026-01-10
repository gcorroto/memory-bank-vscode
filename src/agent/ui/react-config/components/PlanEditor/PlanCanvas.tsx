/**
 * Plan Canvas Component
 * Drop zone for building plans
 */

import React, { useState } from 'react';
import { Plan, PlanStep } from '../../types';

interface PlanCanvasProps {
    plan: Plan;
    onPlanChange: (plan: Plan) => void;
}

export const PlanCanvas: React.FC<PlanCanvasProps> = ({ plan, onPlanChange }) => {
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        try {
            const toolData = JSON.parse(e.dataTransfer.getData('tool'));
            const newStep: PlanStep = {
                description: `Usar ${toolData.name}`,
                tool: toolData.name,
                params: {}
            };

            onPlanChange({
                ...plan,
                steps: [...plan.steps, newStep]
            });
        } catch (error) {
            console.error('Error parsing tool data:', error);
        }
    };

    const handleRemoveStep = (index: number) => {
        const newSteps = plan.steps.filter((_, i) => i !== index);
        onPlanChange({ ...plan, steps: newSteps });
    };

    const handleUpdateStep = (index: number, updates: Partial<PlanStep>) => {
        const newSteps = plan.steps.map((step, i) =>
            i === index ? { ...step, ...updates } : step
        );
        onPlanChange({ ...plan, steps: newSteps });
    };

    return (
        <div
            className={`plan-canvas ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
        >
            {plan.steps.length === 0 ? (
                <div className="plan-canvas-empty">
                    Arrastra herramientas aquí para construir tu plan
                </div>
            ) : (
                <div className="plan-steps-list">
                    {plan.steps.map((step, index) => (
                        <div key={index} className="plan-step-card">
                            <div className="plan-step-header">
                                <div className="plan-step-number">{index + 1}</div>
                                <span style={{ flex: 1 }}>{step.tool}</span>
                                <div className="plan-step-tool">{step.tool}</div>
                            </div>

                            <div className="plan-step-description">
                                <input
                                    type="text"
                                    value={step.description}
                                    onChange={(e) => handleUpdateStep(index, { description: e.target.value })}
                                    placeholder="Descripción del paso"
                                />
                            </div>

                            <div className="plan-step-params">
                                <pre>{JSON.stringify(step.params, null, 2)}</pre>
                            </div>

                            <div className="plan-step-actions">
                                <button onClick={() => handleRemoveStep(index)} className="delete">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

