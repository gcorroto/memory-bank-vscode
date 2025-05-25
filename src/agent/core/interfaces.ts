/**
 * Interfaz para los pasos del plan generado por el agente
 */
export interface PlanStep {
    description: string;
    tool: string;
    params: any;
    isCritical?: boolean; // Indica si el paso es crítico para el plan (por defecto true)
    dependsOn?: string[]; // Identifica pasos previos de los que depende este paso
}

/**
 * Interfaz para el plan generado por el agente
 */
export interface Plan {
    steps: PlanStep[];
    goal?: string;
    reasoning?: string;
} 