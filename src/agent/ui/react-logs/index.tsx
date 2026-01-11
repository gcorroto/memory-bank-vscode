/**
 * Entry point for React Logs Webview
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

try {
    // Mount React app
    const container = document.getElementById('root');
    if (container) {
        // Get initial state from webview
        const initialState = (window as any).initialState || {
            sessions: [],
            activeSessionId: '',
            theme: 'dark'
        };
        
        const root = createRoot(container);
        root.render(<App initialState={initialState} />);
    } else {
        console.error('Logs Webview: No se encontró el elemento #root');
    }
} catch (error) {
    console.error('Logs Webview: Error al montar React:', error);
}

