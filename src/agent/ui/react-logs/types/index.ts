/**
 * Types for React Logs Webview
 */

export interface LogEntry {
    type: string;  // 'step', 'plan', 'reflection', 'build_rules'
    description?: string;
    tool?: string;
    params?: any;
    result?: any;
    success?: boolean;
    steps?: any[];
    reflection?: string;
    rules?: string[];
    timestamp: Date;
    modelInfo?: {
        name: string;
        taskType?: string;
    };
    appliedRules?: string[];
    tokenCount?: {
        prompt: number;
        completion: number;
        total: number;
    };
    modelCost?: {
        inputUSD: number;
        outputUSD: number;
        totalUSD: number;
        totalEUR: number;
        model?: string;
        inputTokens?: number;
        outputTokens?: number;
    };
    status?: string;
    successfulSteps?: number;
    failedSteps?: number;
    stoppedAtStep?: string;
    stopReason?: string;
    modelUsage?: {
        model: string;
        calls: number;
        inputTokens: number;
        outputTokens: number;
        costUSD: number;
        costEUR: number;
    }[];
    totalCostUSD?: number;
    totalCostEUR?: number;
    recommendations?: string[];
}

export interface LogSession {
    id: string;
    name: string;
    entries: LogEntry[];
    createdAt: Date;
}

export interface InitialState {
    sessions: LogSession[];
    activeSessionId: string;
    theme: 'light' | 'dark';
}

export interface VSCodeMessage {
    command: string;
    [key: string]: any;
}

