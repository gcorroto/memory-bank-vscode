export interface AgentInfo {
    id: string;
    projectId: string;
    status: string;
    focus: string;
    sessionId?: string;
    lastHeartbeat: string;
    keywords?: string[];
    responsibilities?: string[];
}

export interface OrchestratorLog {
    id: number;
    projectId: string;
    taskDescription: string;
    action: 'proceed' | 'delegate' | 'mixed';
    myResponsibilities: string[];
    delegations: Array<{
        targetProject: string;
        taskTitle: string;
        taskDescription: string;
        reasoning: string;
    }>;
    suggestedImports: string[];
    architectureNotes: string;
    searchesPerformed: string[];
    warning?: string;
    success: boolean;
    modelUsed: string;
    timestamp: string;
}

export interface PendingTask {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    assignedTo: string;
    from: string; // from_source
    status: string;
    createdAt: string;
}

export interface ExternalRequest {
    id: string;
    projectId: string;
    title: string;
    fromProject: string;
    context: string;
    status: string;
    receivedAt: string;
}

export interface FileLock {
    pattern: string;
    projectId: string;
    claimedBy: string;
    since: string;
}

export interface AgentMessage {
    id?: number;
    projectId: string;
    message: string;
    timestamp: string;
}
