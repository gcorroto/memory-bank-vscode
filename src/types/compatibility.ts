/**
 * Implementación de funciones de compatibilidad para la migración a TypeScript
 */

import type { ChatMessage, CompletionResult } from './openai';

/**
 * Convierte un mensaje de chat en formato antiguo a un formato compatible con ChatMessage
 * @param message Mensaje en formato antiguo
 * @returns Mensaje en formato compatible con ChatMessage
 */
export function toStandardChatMessage(message: { role: string; content: string; name?: string; tool_call_id?: string }): ChatMessage {
  // Verificar que el rol sea uno de los permitidos
  const validRoles = ['system', 'user', 'assistant', 'developer', 'tool'];
  
  if (!validRoles.includes(message.role)) {
    // Si no es válido, usar 'system' como predeterminado
    return {
      role: 'system',
      content: message.content,
      name: message.name,
      tool_call_id: message.tool_call_id
    };
  }
  
  // Si es válido, hacer un cast seguro
  return {
    role: message.role as 'system' | 'user' | 'assistant' | 'developer' | 'tool',
    content: message.content,
    name: message.name,
    tool_call_id: message.tool_call_id
  };
}

/**
 * Convierte un string simple a un objeto CompletionResult
 * @param content Contenido de texto simple
 * @param model Nombre del modelo (opcional)
 * @returns Objeto CompletionResult
 */
export function toCompletionResult(content: string, model: string = 'default'): CompletionResult {
  return {
    content: content,
    modelInfo: {
      name: model,
      taskType: 'general'
    },
    tokenCount: {
      prompt: 0,
      completion: 0,
      total: 0
    }
  };
}

/**
 * Extrae solo el contenido de un objeto CompletionResult
 * @param result Objeto CompletionResult o string
 * @returns Contenido como string
 */
export function extractContent(result: CompletionResult | string): string {
  if (typeof result === 'string') {
    return result;
  }
  return result.content;
} 