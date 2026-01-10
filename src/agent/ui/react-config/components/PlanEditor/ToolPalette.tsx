/**
 * Tool Palette Component
 * Draggable list of available tools
 */

import React from 'react';
import { Tool } from '../../types';

interface ToolPaletteProps {
    tools: Tool[];
    onToolDrop: (tool: Tool) => void;
}

export const ToolPalette: React.FC<ToolPaletteProps> = ({ tools, onToolDrop }) => {
    return (
        <div className="tool-palette">
            <h3>Herramientas Disponibles</h3>
            {tools.map(tool => (
                <div
                    key={tool.name}
                    className="tool-item"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('tool', JSON.stringify(tool));
                    }}
                    onClick={() => onToolDrop(tool)}
                >
                    <div className="tool-item-name">{tool.name}</div>
                    <div className="tool-item-desc">{tool.description}</div>
                </div>
            ))}
        </div>
    );
};

