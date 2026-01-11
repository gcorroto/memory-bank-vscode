/**
 * React Dashboard Webview Entry Point
 * This file is the entry point for the webpack build targeting the webview
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Mount React app to DOM
const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Root element not found in DOM');
}
