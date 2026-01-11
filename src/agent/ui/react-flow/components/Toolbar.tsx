/**
 * Toolbar Component for Flow View
 */

import React from 'react';

interface ToolbarProps {
    onReset: () => void;
    onExport: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onReset, onExport }) => {
    return (
        <div className="flow-toolbar">
            <h2>Memory Bank: Visualización de Flujo de Decisiones</h2>
            <button onClick={onReset}>Reiniciar Vista</button>
            <button onClick={onExport}>Exportar Imagen</button>
        </div>
    );
};

