/**
 * Definiciones de tipos para la biblioteca OpenAI
 * Este archivo proporciona tipos para facilitar el uso de la biblioteca OpenAI
 * dentro de un proyecto TypeScript.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'developer' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ChatFunction {
  name: string;
  description?: string;
  parameters: Record<string, any>;
}

export interface ChatTool {
  type: 'function';
  function: ChatFunction;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
  logprobs: any | null;
}

export interface ChatToolChoice {
  type: 'function';
  function?: {
    name: string;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  tool_calls?: ToolCall[];
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: ChatTool[];
  tool_choice?: 'auto' | 'none' | ChatToolChoice;
  reasoning_effort?: 'low' | 'medium' | 'high';
  response_format?: {
    type: 'json_object' | 'text';
  };
}

export interface EmbeddingParams {
  model: string;
  input: string | string[];
  user?: string;
  encoding_format?: 'float' | 'base64';
}

export interface EmbeddingResponse {
  object: string;
  data: {
    object: string;
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIClientOptions {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface OpenAIClient {
  chat: {
    completions: {
      create: (params: ChatCompletionParams) => Promise<ChatCompletionResponse>;
    };
  };
  embeddings: {
    create: (params: EmbeddingParams) => Promise<EmbeddingResponse>;
  };
}

// Clase principal para el cliente de OpenAI
export interface OpenAI {
  new (options: OpenAIClientOptions): OpenAIClient;
}

// Interfaces para resultados de generación
export interface ModelInfo {
  name: string;
  taskType: string;
}

export interface TokenCount {
  prompt: number;
  completion: number;
  total: number;
}

export interface CompletionResult {
  content: string;
  modelInfo: ModelInfo;
  tokenCount: TokenCount;
  tool_calls?: ToolCall[];
} 