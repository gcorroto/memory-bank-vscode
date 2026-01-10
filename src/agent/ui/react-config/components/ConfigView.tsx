/**
 * Config View Component
 * Main container with tabs
 */

import React, { useState } from 'react';
import { Plan, Rule, PromptTemplate, Tool } from '../types';
import { PlanEditor } from './PlanEditor';
import { RulesEditor } from './RulesEditor';
import { PromptsEditor } from './PromptsEditor';

interface ConfigViewProps {
    tools: Tool[];
    plans: Plan[];
    rules: Rule[];
    prompts: PromptTemplate[];
}

export const ConfigView: React.FC<ConfigViewProps> = ({ tools, plans, rules, prompts }) => {
    const [activeTab, setActiveTab] = useState<'plans' | 'rules' | 'prompts'>('plans');

    return (
        <div className="config-container">
            <div className="config-header">
                <h1>Grec0AI: Configurador Visual</h1>
            </div>

            <div className="config-tabs">
                <button
                    className={`config-tab ${activeTab === 'plans' ? 'active' : ''}`}
                    onClick={() => setActiveTab('plans')}
                >
                    📋 Editor de Planes
                </button>
                <button
                    className={`config-tab ${activeTab === 'rules' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rules')}
                >
                    📝 Editor de Reglas
                </button>
                <button
                    className={`config-tab ${activeTab === 'prompts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prompts')}
                >
                    💬 Editor de Prompts
                </button>
            </div>

            <div className="config-content">
                {activeTab === 'plans' && <PlanEditor tools={tools} initialPlans={plans} />}
                {activeTab === 'rules' && <RulesEditor initialRules={rules} />}
                {activeTab === 'prompts' && <PromptsEditor initialPrompts={prompts} />}
            </div>
        </div>
    );
};

