/**
 * Entry point for React Flow Webview
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

console.log('Flow Webview: Entry point ejecutándose');

// VERSION SIMPLE PARA DEBUG
import { App } from './App-simple';

try {
    console.log('Flow Webview: Buscando container root');
    
    // Mount React app
    const container = document.getElementById('root');
    if (container) {
        console.log('Flow Webview: Container encontrado, creando root');
        const root = createRoot(container);
        
        console.log('Flow Webview: Renderizando App simple');
        root.render(<App />);
        
        console.log('Flow Webview: ✅ React montado exitosamente');
    } else {
        console.error('Flow Webview: ❌ No se encontró el elemento #root');
    }
} catch (error) {
    console.error('Flow Webview: ❌ Error al montar React:', error);
}
