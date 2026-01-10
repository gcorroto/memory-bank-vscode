/**
 * App Component for React Flow Webview
 */

import React, { useCallback } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { InitialState } from './types';
import { useFlowState } from './hooks/useFlowState';
import { useExecutionUpdates } from './hooks/useExecutionUpdates';
import { useTheme } from '../react-logs/hooks/useTheme';
import { Toolbar } from './components/Toolbar';
import { FlowView } from './components/FlowView';

interface AppProps {
    initialState: InitialState;
}

export const App: React.FC<AppProps> = ({ initialState }) => {
    const theme = useTheme();
    const {
        plan,
        nodes,
        edges,
        stats,
        updatePlan,
        addExecutionUpdate
    } = useFlowState(initialState.plan, initialState.executionUpdates);

    useExecutionUpdates(updatePlan, addExecutionUpdate);

    const handleReset = useCallback(() => {
        const vscode = (window as any).vscode;
        vscode?.postMessage({ command: 'resetView' });
    }, []);

    const handleExport = useCallback(() => {
        const vscode = (window as any).vscode;
        vscode?.postMessage({ command: 'exportFlowImage' });
    }, []);

    React.useEffect(() => {
        // Apply theme class to body
        document.body.className = theme === 'dark' 
            ? 'vscode-dark' 
            : theme === 'high-contrast' 
            ? 'vscode-high-contrast' 
            : 'vscode-light';
    }, [theme]);

    return (
        <ReactFlowProvider>
            <Toolbar onReset={handleReset} onExport={handleExport} />
            <FlowView initialNodes={nodes} initialEdges={edges} stats={stats} />
        </ReactFlowProvider>
    );
};

