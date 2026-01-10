/**
 * Plan Editor Component
 * Visual drag & drop editor for execution plans
 */

import React, { useState } from 'react';
import { Plan, Tool, PlanStep } from '../../types';
import { ToolPalette } from './ToolPalette';
import { PlanCanvas } from './PlanCanvas';

interface PlanEditorProps {
    tools: Tool[];
    initialPlans: Plan[];
}

export const PlanEditor: React.FC<PlanEditorProps> = ({ tools, initialPlans }) => {
    const [currentPlan, setCurrentPlan] = useState<Plan>({
        name: 'Nuevo Plan',
        description: '',
        steps: []
    });

    const handleAddStep = (tool: Tool) => {
        const newStep: PlanStep = {
            description: `Paso con ${tool.name}`,
            tool: tool.name,
            params: {}
        };

        setCurrentPlan(prev => ({
            ...prev,
            steps: [...prev.steps, newStep]
        }));
    };

    const handleSavePlan = () => {
        const vscode = (window as any).vscode;
        vscode?.postMessage({
            command: 'savePlan',
            plan: currentPlan
        });
    };

    return (
        <div className="plan-editor">
            <div className="plan-editor-header">
                <input
                    type="text"
                    value={currentPlan.name}
                    onChange={(e) => setCurrentPlan({ ...currentPlan, name: e.target.value })}
                    placeholder="Nombre del plan"
                />
                <button onClick={handleSavePlan}>Guardar Plan</button>
            </div>

            <div className="plan-editor-layout">
                <ToolPalette tools={tools} onToolDrop={handleAddStep} />
                <PlanCanvas plan={currentPlan} onPlanChange={setCurrentPlan} />
            </div>
        </div>
    );
};

