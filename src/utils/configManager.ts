/**
 * Config Manager
 * Handles configuration settings for the extension.
 */

import * as vscode from 'vscode';

/**
 * Get the OpenAI API key from configuration
 */
export function getOpenAIApiKey(): string | undefined {
    const config = vscode.workspace.getConfiguration('grec0ai');
    return config.get('openai.apiKey');
}

/**
 * Set a configuration value
 * @param key Configuration key
 * @param value Configuration value
 */
export async function setConfig(key: string, value: any): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('grec0ai');
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    } catch (error) {
        console.error(`Error setting config ${key}:`, error);
        throw error;
    }
}

/**
 * Get the configured OpenAI model
 */
export function getOpenAIModel(): string | undefined {
    const config = vscode.workspace.getConfiguration('grec0ai');
    return config.get('openai.model');
}

/**
 * Get the appropriate LLM model based on task type
 * @param taskType - Type of task: 'planning', 'analysis', 'codegen'
 * @returns The model name to use for the specified task
 */
export function getModelForTask(taskType?: string): string {
    const config = vscode.workspace.getConfiguration('grec0ai');
    const defaultModel = config.get<string>('openai.model') || 'gpt-4.1-mini';
    
    // Si no se especifica tipo de tarea, usar el modelo por defecto
    if (!taskType) {
        return defaultModel;
    }
    
    // Obtener el modelo configurado para cada tipo de tarea
    const planningModel = config.get<string>('openai.planningModel') || config.get<string>('openai.models.planning') || defaultModel;
    const analysisModel = config.get<string>('openai.analysisModel') || config.get<string>('openai.models.analysis') || defaultModel;
    const codegenModel = config.get<string>('openai.codegenModel') || config.get<string>('openai.models.codegen') || defaultModel;
    
    // Devolver el modelo según el tipo de tarea
    switch (taskType) {
        case 'planning':
            return planningModel;
        case 'analysis':
            return analysisModel;
        case 'codegen':
            return codegenModel;
        default:
            return defaultModel;
    }
}

/**
 * Get Vectra configurations
 */
export function getVectraConfig(): any {
    const config = vscode.workspace.getConfiguration('grec0ai');
    return {
        enabled: config.get('vectra.enabled', true),
        indexPath: config.get('vectra.indexPath', ''),
        autoIndex: config.get('vectra.autoIndex', false),
        includePatterns: config.get('vectra.includePatterns', ['*.ts', '*.js', '*.tsx', '*.jsx', '*.md', '*.txt']),
        excludePatterns: config.get('vectra.excludePatterns', ['node_modules/**', 'dist/**', '.git/**']),
        chunkSize: config.get('vectra.chunkSize', 1000),
        showRagInfo: config.get('vectra.showRagInfo', true)
    };
}

/**
 * Get RAG configurations
 */
export function getRAGConfig(): any {
    const config = vscode.workspace.getConfiguration('grec0ai');
    return {
        enabled: config.get('rag.enabled', true),
        defaultContextCount: config.get('rag.defaultContextCount', 5),
        preprocessText: config.get('rag.preprocessText', true),
        enhanceWithCodeContext: config.get('rag.enhanceWithCodeContext', true),
        model: config.get('rag.model', '') || getOpenAIModel() || 'gpt-4.1-mini',
        temperature: config.get('rag.temperature', 0.3)
    };
}

/**
 * Register extension configuration schema
 */
export function registerConfigurationSchema(): void {
    // The actual schema is defined in package.json, but we can validate here
    // This function can be expanded in the future to handle complex validations
}

/**
 * Initialize all configuration defaults
 */
export async function initializeDefaults(): Promise<void> {
    const configDefaults: Record<string, any> = {
        // Basic configs
        'agent.debug': false,
        'agent.maxSteps': 20,
        
        // OpenAI configs
        'openai.model': 'gpt-4.1-mini',
        'openai.models.planning': 'o4-mini',
        'openai.models.analysis': 'gpt-4.1-mini',
        'openai.models.codegen': 'gpt-4.1-mini',
        
        // Vectra configs
        'vectra.enabled': true,
        'vectra.autoIndex': false,
        'vectra.includePatterns': ['*.ts', '*.js', '*.tsx', '*.jsx', '*.md', '*.txt'],
        'vectra.excludePatterns': ['node_modules/**', 'dist/**', '.git/**'],
        'vectra.chunkSize': 1000,
        'vectra.showRagInfo': true,
        
        // RAG configs
        'rag.enabled': true,
        'rag.defaultContextCount': 5,
        'rag.preprocessText': true,
        'rag.enhanceWithCodeContext': true,
        'rag.temperature': 0.3
    };
    
    // Set defaults for any undefined configs
    const config = vscode.workspace.getConfiguration('grec0ai');
    for (const [key, defaultValue] of Object.entries(configDefaults)) {
        if (config.get(key) === undefined) {
            await setConfig(key, defaultValue);
        }
    }
}

export function isConfigComplete(): boolean {
  const config = vscode.workspace.getConfiguration('grec0ai');
  const apiKey = config.get('openai.apiKey', '');
  return apiKey !== '';
}

export function getConfig(key: string, defaultValue: any = undefined): any {
  const config = vscode.workspace.getConfiguration('grec0ai');
  return config.get(key, defaultValue);
}

/**
 * Set OpenAI API key in configuration
 * @param apiKey API key to set
 */
export async function setApiKey(apiKey: string): Promise<void> {
  await setConfig('openai.apiKey', apiKey);
} 