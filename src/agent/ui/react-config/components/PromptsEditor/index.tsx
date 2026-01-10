/**
 * Prompts Editor Component
 * Editor for prompt templates
 */

import React, { useState } from 'react';
import { PromptTemplate } from '../../types';

interface PromptsEditorProps {
    initialPrompts: PromptTemplate[];
}

export const PromptsEditor: React.FC<PromptsEditorProps> = ({ initialPrompts }) => {
    const [prompts] = useState<PromptTemplate[]>(initialPrompts);

    return (
        <div className="prompts-editor">
            <div className="prompts-header">
                <h2>Plantillas de Prompts</h2>
                <button>Nueva Plantilla</button>
            </div>

            <div className="prompts-list">
                {prompts.map(prompt => (
                    <div key={prompt.id} className="prompt-card">
                        <div className="prompt-card-name">{prompt.name}</div>
                        <div className="prompt-card-variables">
                            Variables: {prompt.variables.join(', ')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

