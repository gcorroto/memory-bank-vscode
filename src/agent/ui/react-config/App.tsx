/**
 * App Component for React Config Webview
 */

import React, { useEffect } from 'react';
import { InitialState } from './types';
import { useTheme } from '../react-logs/hooks/useTheme';
import { ConfigView } from './components/ConfigView';

interface AppProps {
    initialState: InitialState;
}

export const App: React.FC<AppProps> = ({ initialState }) => {
    const theme = useTheme();

    useEffect(() => {
        // Apply theme class to body
        document.body.className = theme === 'dark' 
            ? 'vscode-dark' 
            : theme === 'high-contrast' 
            ? 'vscode-high-contrast' 
            : 'vscode-light';
    }, [theme]);

    return (
        <ConfigView
            tools={initialState.availableTools}
            plans={initialState.savedPlans}
            rules={initialState.rules}
            prompts={initialState.promptTemplates}
        />
    );
};

