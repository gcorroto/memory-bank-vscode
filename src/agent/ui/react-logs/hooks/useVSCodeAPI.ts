/**
 * Hook for VSCode API communication
 */

import { useEffect, useCallback } from 'react';
import { VSCodeMessage } from '../types';

export const useVSCodeAPI = (onMessage?: (message: VSCodeMessage) => void) => {
    // Post message to VSCode
    const postMessage = useCallback((message: VSCodeMessage) => {
        const vscode = (window as any).vscode;
        if (vscode) {
            vscode.postMessage(message);
        }
    }, []);

    // Listen for messages from VSCode
    useEffect(() => {
        if (!onMessage) return;

        const handleMessage = (event: MessageEvent<VSCodeMessage>) => {
            onMessage(event.data);
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onMessage]);

    return { postMessage };
};

