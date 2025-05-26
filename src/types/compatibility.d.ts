/**
 * Tipos de compatibilidad para la migración de JavaScript a TypeScript
 * Este archivo proporciona interfaces de compatibilidad para facilitar
 * la transición gradual entre el código antiguo y el nuevo.
 */

import { ChatMessage, CompletionResult } from './openai';

/**
 * Interfaz de compatibilidad para representar un mensaje en formatos antiguos
 * Algunas partes del código esperan que role sea un string simple
 */
export interface CompatChatMessage {
  role: string;
  content: string;
  name?: string;
  tool_call_id?: string;
}

/**
 * Función para convertir un CompatChatMessage a un ChatMessage estándar
 * @param message Mensaje en formato antiguo
 * @returns Mensaje en formato nuevo
 */
export function toStandardChatMessage(message: CompatChatMessage): ChatMessage {
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
 * Función para convertir un string simple a un objeto CompletionResult
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
 * Función para extraer solo el contenido de un objeto CompletionResult
 * @param result Objeto CompletionResult
 * @returns Contenido como string
 */
export function extractContent(result: CompletionResult | string): string {
  if (typeof result === 'string') {
    return result;
  }
  return result.content;
} 