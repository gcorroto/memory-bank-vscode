/**
 * Types for React Config Webview
 */

export interface Tool {
    name: string;
    description: string;
    parameters: {
        name: string;
        type: string;
        description: string;
        required: boolean;
    }[];
}

export interface PlanStep {
    description: string;
    tool: string;
    params: Record<string, any>;
    dependsOn?: number[];
}

export interface Plan {
    name: string;
    description: string;
    steps: PlanStep[];
}

export interface Rule {
    id: string;
    name: string;
    content: string;
    category?: string;
}

export interface PromptTemplate {
    id: string;
    name: string;
    template: string;
    variables: string[];
}

export interface InitialState {
    availableTools: Tool[];
    savedPlans: Plan[];
    rules: Rule[];
    promptTemplates: PromptTemplate[];
    theme: 'light' | 'dark';
}

export interface VSCodeMessage {
    command: string;
    [key: string]: any;
}

