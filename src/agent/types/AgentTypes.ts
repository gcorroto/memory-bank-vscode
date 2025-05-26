/**
 * Tipos utilizados por el sistema Agent
 * Este archivo centraliza los tipos utilizados en el núcleo del agente
 */

// Importar tipos desde interfaces.ts para compatibilidad
export { PlanStep, Plan } from '../core/interfaces';

// Promesas tipadas para funciones asíncronas
export type AsyncResult<T> = Promise<T>;

// Tipos para el sistema de eventos
export interface AgentEvent {
  type: string;
  timestamp: Date;
  data?: any;
}

// Tipo para el resultado de un paso
export interface StepResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Tipo para herramientas
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
} 