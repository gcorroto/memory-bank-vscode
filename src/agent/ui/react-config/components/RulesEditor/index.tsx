/**
 * Rules Editor Component
 * CRUD interface for agent rules
 */

import React, { useState } from 'react';
import { Rule } from '../../types';

interface RulesEditorProps {
    initialRules: Rule[];
}

export const RulesEditor: React.FC<RulesEditorProps> = ({ initialRules }) => {
    const [rules, setRules] = useState<Rule[]>(initialRules);
    const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateNew = () => {
        const newRule: Rule = {
            id: `rule_${Date.now()}`,
            name: 'Nueva Regla',
            content: '',
            category: 'General'
        };
        setSelectedRule(newRule);
        setIsCreating(true);
    };

    const handleSave = () => {
        if (!selectedRule) return;

        if (isCreating) {
            setRules([...rules, selectedRule]);
            setIsCreating(false);
        } else {
            setRules(rules.map(r => r.id === selectedRule.id ? selectedRule : r));
        }

        const vscode = (window as any).vscode;
        vscode?.postMessage({
            command: 'saveRule',
            rule: selectedRule
        });

        setSelectedRule(null);
    };

    const handleCancel = () => {
        setSelectedRule(null);
        setIsCreating(false);
    };

    return (
        <div className="rules-editor">
            <div className="rules-header">
                <h2>Reglas del Agente</h2>
                <button onClick={handleCreateNew}>Nueva Regla</button>
            </div>

            {selectedRule ? (
                <div className="rule-editor">
                    <input
                        type="text"
                        value={selectedRule.name}
                        onChange={(e) => setSelectedRule({ ...selectedRule, name: e.target.value })}
                        placeholder="Nombre de la regla"
                    />
                    <textarea
                        value={selectedRule.content}
                        onChange={(e) => setSelectedRule({ ...selectedRule, content: e.target.value })}
                        placeholder="Contenido de la regla..."
                    />
                    <div className="rule-editor-actions">
                        <button className="save" onClick={handleSave}>Guardar</button>
                        <button className="cancel" onClick={handleCancel}>Cancelar</button>
                    </div>
                </div>
            ) : (
                <div className="rules-list">
                    {rules.map(rule => (
                        <div
                            key={rule.id}
                            className="rule-card"
                            onClick={() => setSelectedRule(rule)}
                        >
                            <div className="rule-card-name">{rule.name}</div>
                            <div className="rule-card-preview">
                                {rule.content.substring(0, 100)}...
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

