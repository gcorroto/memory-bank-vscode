/**
 * Entry point for React Config Webview
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { InitialState } from './types';

// Import styles
import '../react-logs/styles/theme.css';
import '../react-logs/styles/global.css';
import './styles/config.css';

// Get initial state from window
const initialState: InitialState = (window as any).__INITIAL_STATE__ || {
    availableTools: [],
    savedPlans: [],
    rules: [],
    promptTemplates: [],
    theme: 'dark'
};

// Mount React app
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App initialState={initialState} />);
}

