/**
 * Types for React Flow Webview
 */

export interface PlanStep {
    description: string;
    tool: string;
    params?: any;
    dependsOn?: number[];
    status?: 'pending' | 'running' | 'success' | 'error';
    result?: any;
    error?: string;
}

export interface Plan {
    steps: PlanStep[];
    timestamp?: Date;
}

export interface FlowNode {
    id: string;
    type: string;
    data: {
        step: PlanStep;
        index: number;
        status: 'pending' | 'running' | 'success' | 'error';
    };
    position: { x: number; y: number };
}

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
    animated?: boolean;
    style?: React.CSSProperties;
}

export interface ExecutionUpdate {
    stepIndex: number;
    status: 'running' | 'success' | 'error';
    result?: any;
    error?: string;
}

export interface InitialState {
    plan: Plan | null;
    executionUpdates: ExecutionUpdate[];
    theme: 'light' | 'dark';
}

export interface VSCodeMessage {
    command: string;
    plan?: Plan;
    executionUpdate?: ExecutionUpdate;
    [key: string]: any;
}

// Extend global Window interface for this specific webview
declare global {
    interface Window {
        __INITIAL_STATE__?: any; // Use any to avoid conflicts with other webviews
        vscode?: any; // Use any to avoid conflicts with other webviews
    }
}

