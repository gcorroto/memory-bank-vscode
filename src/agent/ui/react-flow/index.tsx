/**
 * Entry point for React Flow Webview
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { InitialState } from './types';

console.log('Flow Webview: Entry point ejecutándose');

try {
    console.log('Flow Webview: Buscando container root');
    
    // Mount React app
    const container = document.getElementById('root');
    if (container) {
        console.log('Flow Webview: Container encontrado, creando root');
        const root = createRoot(container);

        // Leer estado inicial del HTML
        const initialState: InitialState = (window as any).__INITIAL_STATE__ || {
            plan: null,
            executionUpdates: [],
            theme: 'dark'
        };
        console.log('Flow Webview: Estado inicial leído:', initialState);

        console.log('Flow Webview: Renderizando App real');
        root.render(<App initialState={initialState} />);
        console.log('Flow Webview: ✅ React montado exitosamente');
    } else {
        console.error('Flow Webview: ❌ No se encontró el elemento #root');
    }
} catch (error) {
    console.error('Flow Webview: ❌ Error al montar React:', error);
}
