/**
 * Entry point for Relations Flow Webview
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/relations.css';

console.log('Relations Flow: Mounting React app...');

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('Relations Flow: React app mounted');
} else {
  console.error('Relations Flow: Root element not found');
}
