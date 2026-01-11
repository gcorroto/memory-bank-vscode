/**
 * useVSCodeAPI Hook
 * Manages bidirectional communication with VS Code extension
 */

import { useEffect, useCallback } from 'react';
import { VSCodeMessage, VSCodeAPI } from '../types';

export const useVSCodeAPI = (onMessage?: (message: VSCodeMessage) => void) => {
  const vscode = (window as any).vscode as VSCodeAPI | undefined;

  useEffect(() => {
    if (!vscode) {
      console.warn('VS Code API not available');
      return;
    }

    const handleMessage = (event: MessageEvent<VSCodeMessage>) => {
      const message = event.data;
      console.log('Dashboard received message:', message);
      
      if (onMessage) {
        onMessage(message);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onMessage]);

  const postMessage = useCallback((message: VSCodeMessage) => {
    if (vscode) {
      console.log('Dashboard sending message:', message);
      vscode.postMessage(message);
    } else {
      console.warn('VS Code API not available for message:', message);
    }
  }, [vscode]);

  return { postMessage, vscode };
};
