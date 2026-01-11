/**
 * Simple App Component - Version mínima para debug
 */

import React from 'react';

export const App: React.FC = () => {
    return (
        <div style={{
            padding: '20px',
            color: 'var(--vscode-foreground)',
            fontFamily: 'var(--vscode-font-family)'
        }}>
            <h1>✅ React funcionando correctamente</h1>
            <p>Memory Bank Agent Logs - Vista React Cargada</p>
            <div style={{
                marginTop: '20px',
                padding: '10px',
                backgroundColor: 'var(--vscode-editor-background)',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: '4px'
            }}>
                <p>Si ves esto, React se está ejecutando correctamente.</p>
                <p>Próximo paso: Cargar componentes completos.</p>
            </div>
        </div>
    );
};

