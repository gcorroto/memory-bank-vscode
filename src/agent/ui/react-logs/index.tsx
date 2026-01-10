/**
 * Entry point for React Logs Webview
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

console.log('Logs Webview: Entry point ejecutándose');

// VERSION SIMPLE PARA DEBUG
import { App } from './App-simple';

try {
    console.log('Logs Webview: Buscando container root');
    
    // Mount React app
    const container = document.getElementById('root');
    if (container) {
        console.log('Logs Webview: Container encontrado, creando root');
        const root = createRoot(container);
        
        console.log('Logs Webview: Renderizando App simple');
        root.render(<App />);
        
        console.log('Logs Webview: ✅ React montado exitosamente');
    } else {
        console.error('Logs Webview: ❌ No se encontró el elemento #root');
    }
} catch (error) {
    console.error('Logs Webview: ❌ Error al montar React:', error);
}

