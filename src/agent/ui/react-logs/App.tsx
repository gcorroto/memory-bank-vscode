/**
 * App Component
 * Root component for React Logs Webview
 */

import React, { useEffect } from 'react';
import { InitialState, VSCodeMessage } from './types';
import { useLogs } from './hooks/useLogs';
import { useVSCodeAPI } from './hooks/useVSCodeAPI';
import { useTheme } from './hooks/useTheme';
import { SessionTabs } from './components/SessionTabs';
import { Toolbar } from './components/Toolbar';
import { LogsView } from './components/LogsView';

interface AppProps {
    initialState: InitialState;
}

export const App: React.FC<AppProps> = ({ initialState }) => {
    const theme = useTheme();
    const {
        sessions,
        activeSessionId,
        activeSession,
        clearLogs,
        createSession,
        switchSession,
        updateSessions
    } = useLogs(initialState.sessions, initialState.activeSessionId);

    const handleMessage = (message: VSCodeMessage) => {
        switch (message.command) {
            case 'updateSessions':
                if (message.sessions) {
                    updateSessions(message.sessions);
                }
                break;
            case 'addLogEntry':
                // This will be handled by the extension sending updateSessions
                break;
        }
    };

    const { postMessage } = useVSCodeAPI(handleMessage);

    const handleClearLogs = () => {
        clearLogs();
        postMessage({ command: 'clearLogs' });
    };

    const handleReloadLogs = () => {
        postMessage({ command: 'reloadHistoricalLogs' });
    };

    const handleNewSession = () => {
        const sessionName = prompt('Nombre de la nueva sesión:', `Session ${sessions.length + 1}`);
        if (sessionName) {
            const newId = createSession(sessionName);
            postMessage({ command: 'createSession', name: sessionName, id: newId });
        }
    };

    const handleSwitchSession = (sessionId: string) => {
        switchSession(sessionId);
        postMessage({ command: 'switchSession', sessionId });
    };

    useEffect(() => {
        // Apply theme class to body
        document.body.className = theme === 'dark' 
            ? 'vscode-dark' 
            : theme === 'high-contrast' 
            ? 'vscode-high-contrast' 
            : 'vscode-light';
    }, [theme]);

    return (
        <>
            <h1 style={{ padding: '20px', paddingBottom: '10px', margin: 0 }}>
                Memory Bank Agent Logs
            </h1>

            <Toolbar
                onClearLogs={handleClearLogs}
                onReloadLogs={handleReloadLogs}
                onNewSession={handleNewSession}
            />

            <SessionTabs
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSwitchSession={handleSwitchSession}
            />

            <LogsView entries={activeSession?.entries || []} />
        </>
    );
};

