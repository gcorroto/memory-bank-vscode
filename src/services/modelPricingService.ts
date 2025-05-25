/**
 * Servicio para cálculo de precios y costes de uso de modelos LLM
 */

export type Model =
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-4.1-nano'
  | 'o3'
  | 'o4-mini'
  | string; // Para permitir modelos no listados explícitamente

export interface Price {
  input: number;  // Price per million input tokens
  output: number; // Price per million output tokens
}

export interface CostBreakdown {
  inputUSD: number;
  outputUSD: number;
  totalUSD: number;
  totalEUR: number;
  model?: string;         // Nombre del modelo usado
  inputTokens?: number;   // Número de tokens de entrada
  outputTokens?: number;  // Número de tokens de salida
}

// Precios por millón de tokens
const modelPrices: Record<string, Price> = {
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
  'o3': { input: 10.00, output: 40.00 },
  'o4-mini': { input: 1.10, output: 4.40 },
  // Fallback para modelos desconocidos
  'default': { input: 0.10, output: 0.40 }
};

// Tipo de cambio USD -> EUR
const USD_TO_EUR_RATE = 0.88;

/**
 * Calcula el coste en USD para un uso de modelo LLM
 * @param model Nombre del modelo usado
 * @param inputTokens Número de tokens de entrada (prompt)
 * @param outputTokens Número de tokens de salida (completion)
 * @returns Coste total en USD
 */
export function getModelCostUSD(
  model: Model,
  inputTokens: number,
  outputTokens: number
): number {
  const price = modelPrices[model] || modelPrices['default'];
  const inputCost = (inputTokens / 1_000_000) * price.input;
  const outputCost = (outputTokens / 1_000_000) * price.output;
  return parseFloat((inputCost + outputCost).toFixed(6));
}

/**
 * Calcula el coste en EUR para un uso de modelo LLM
 * @param model Nombre del modelo usado
 * @param inputTokens Número de tokens de entrada (prompt)
 * @param outputTokens Número de tokens de salida (completion)
 * @returns Coste total en EUR
 */
export function getModelCostEUR(
  model: Model,
  inputTokens: number,
  outputTokens: number
): number {
  const usd = getModelCostUSD(model, inputTokens, outputTokens);
  return parseFloat((usd * USD_TO_EUR_RATE).toFixed(6));
}

/**
 * Obtiene un desglose completo del coste para un uso de modelo LLM
 * @param model Nombre del modelo usado
 * @param inputTokens Número de tokens de entrada (prompt)
 * @param outputTokens Número de tokens de salida (completion)
 * @returns Objeto con desglose de costes en USD y EUR
 */
export function getModelCostBreakdown(
  model: Model,
  inputTokens: number,
  outputTokens: number
): CostBreakdown {
  const price = modelPrices[model] || modelPrices['default'];
  const inputUSD = (inputTokens / 1_000_000) * price.input;
  const outputUSD = (outputTokens / 1_000_000) * price.output;
  const totalUSD = inputUSD + outputUSD;
  const totalEUR = totalUSD * USD_TO_EUR_RATE;
  
  return {
    inputUSD: parseFloat(inputUSD.toFixed(6)),
    outputUSD: parseFloat(outputUSD.toFixed(6)),
    totalUSD: parseFloat(totalUSD.toFixed(6)),
    totalEUR: parseFloat(totalEUR.toFixed(6)),
    model: model,
    inputTokens: inputTokens,
    outputTokens: outputTokens
  };
}

/**
 * Obtiene el precio por millón de tokens para un modelo específico
 * @param model Nombre del modelo
 * @returns Objeto con precios de entrada y salida por millón de tokens
 */
export function getModelPrice(model: Model): Price {
  return modelPrices[model] || modelPrices['default'];
} 