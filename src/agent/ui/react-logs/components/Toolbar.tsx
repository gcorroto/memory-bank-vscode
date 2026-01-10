/**
 * Toolbar Component
 * Action buttons for logs view
 */

import React from 'react';

interface ToolbarProps {
    onClearLogs: () => void;
    onReloadLogs: () => void;
    onNewSession: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    onClearLogs,
    onReloadLogs,
    onNewSession
}) => {
    return (
        <div style={{
            display: 'flex',
            gap: '10px',
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-color)'
        }}>
            <button
                onClick={onNewSession}
                style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '4px'
                }}
            >
                Nueva Sesión
            </button>
            <button
                onClick={onReloadLogs}
                style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '4px'
                }}
            >
                Cargar Logs Históricos
            </button>
            <button
                onClick={onClearLogs}
                style={{
                    backgroundColor: 'var(--failure-color)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '4px'
                }}
            >
                Limpiar Logs
            </button>
        </div>
    );
};

