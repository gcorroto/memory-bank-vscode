import * as vscode from 'vscode';
import * as configManager from '../utils/configManager';
import type {
  OpenAIClient,
  ChatMessage,
  ChatCompletionParams,
  ChatCompletionResponse,
  EmbeddingResponse,
  OpenAIClientOptions,
  CompletionResult,
  ModelInfo,
  TokenCount
} from '../types/openai';

// Importar OpenAI de manera dinámica
let OpenAI: any;
let client: OpenAIClient | null = null;
let initialized = false;

// Legacy o-series reasoning models are fully deprecated
// GPT-5.x models have built-in parameterized reasoning via Responses API
const REASONING_MODELS: string[] = []; // Empty - no legacy reasoning models supported

// All GPT-5.x models use the new Responses API with built-in parameterized reasoning
const RESPONSES_API_MODELS = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.2', 'gpt-5.1-codex'];

// Definición de tipos para opciones
interface CompletionOptions {
  taskType?: string;
  temperature?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
  model?: string;
  tools?: any[];
  tool_choice?: 'auto' | 'none' | any;
  instructions?: string;
  [key: string]: any;
}

// Interface para opciones de test
interface TestGeneratorOptions {
  instructions?: string;
  [key: string]: any;
}

/**
 * Carga el módulo OpenAI de manera dinámica
 */
async function loadOpenAIModule(): Promise<any> {
  try {
    const openaiModule = await import('openai');
    return openaiModule.default;
  } catch (error) {
    console.error('The "openai" module is missing. Please run "npm install" in the extension directory.');
    return undefined;
  }
}

/**
 * Inicializa el servicio de OpenAI
 * @returns true si la inicialización fue exitosa
 */
export async function initialize(): Promise<boolean> {
  try {
    // Cargar módulo si aún no se ha cargado
    if (!OpenAI) {
      OpenAI = await loadOpenAIModule();
      // Si no se pudo cargar, mostrar error
      if (!OpenAI) {
        vscode.window.showErrorMessage('El módulo OpenAI no está instalado. Por favor, ejecute "npm install" en el directorio de la extensión.');
        return false;
      }
    }

    // Obtener la clave API de la configuración de VS Code
    const config = vscode.workspace.getConfiguration('memorybank');
    const apiKey = config.get<string>('openai.apiKey');
    
    if (!apiKey) {
      vscode.window.showErrorMessage('La clave API de OpenAI no está configurada. Por favor, configúrela en las preferencias de Memory Bank.');
      return false;
    }

    // Configurar el cliente de OpenAI
    client = new OpenAI({
      apiKey: apiKey
    });
    
    initialized = true;
    console.log('OpenAI service initialized');
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al inicializar OpenAI:', error);
    vscode.window.showErrorMessage(`Error al inicializar OpenAI: ${errorMessage}`);
    return false;
  }
}

/**
 * Asegura que el servicio esté inicializado
 * @returns true si el servicio está inicializado o se inicializó correctamente
 */
async function ensureInitialized(): Promise<boolean> {
  if (!initialized) {
    return await initialize();
  }
  return initialized;
}

/**
 * Llama a OpenAI con un prompt simple
 * @param prompt Texto a enviar a OpenAI
 * @returns Texto generado por OpenAI
 */
export async function callOpenAI(prompt: string): Promise<string> {
  if (!await ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Use generateCompletion which handles Responses API for GPT-5.x models
    const result = await generateCompletion(prompt, {
      taskType: 'general'
    });
    return result.content;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al llamar a OpenAI:', error);
    throw new Error(`Error al llamar a OpenAI: ${errorMessage}`);
  }
}

/**
 * Genera texto utilizando OpenAI
 * @param prompt Texto a enviar a OpenAI
 * @param model Modelo a utilizar (opcional)
 * @param options Opciones adicionales
 * @returns Texto generado por OpenAI
 */
export async function generateText(
  prompt: string, 
  model: string = '', 
  options: CompletionOptions = {}
): Promise<string> {
  if (!await ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Detectar el tipo de tarea según el prompt (análisis simple)
    const taskType = detectTaskType(prompt, options.taskType);
    
    // Usar el método común con el tipo de tarea detectado
    const result = await generateCompletion(prompt, {
      ...options,
      taskType: taskType,
      model: model || undefined
    });
    
    // Devolver solo el contenido
    return result.content;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al generar texto con OpenAI:', error);
    throw new Error(`Error al generar texto con OpenAI: ${errorMessage}`);
  }
}

/**
 * Realiza una llamada al API de chat completions
 * @param messages Mensajes para la conversación
 * @param model Modelo a utilizar
 * @param options Opciones adicionales
 * @returns Respuesta del API
 */
export async function chatCompletion(
  messages: ChatMessage[], 
  model: string = 'gpt-5-mini', 
  options: CompletionOptions = {}
): Promise<ChatCompletionResponse> {
  if (!await ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  if (!client) {
    throw new Error('Cliente OpenAI no disponible');
  }

  try {
    // GPT-5.x models require Responses API
    if (supportsResponsesAPI(model)) {
      return await chatCompletionViaResponsesAPI(messages, model, options);
    }
    
    // Fallback for non-GPT-5.x models (should not happen in practice)
    const requestParams: ChatCompletionParams = {
      model: model,
      messages: messages,
    };
    
    // Add general options
    if (options.temperature !== undefined) requestParams.temperature = options.temperature;
    if (options.max_tokens !== undefined) requestParams.max_tokens = options.max_tokens;
    if (options.top_p !== undefined) requestParams.top_p = options.top_p;
    if (options.frequency_penalty !== undefined) requestParams.frequency_penalty = options.frequency_penalty;
    if (options.presence_penalty !== undefined) requestParams.presence_penalty = options.presence_penalty;
    if (options.stop !== undefined) requestParams.stop = options.stop;
    if (options.user !== undefined) requestParams.user = options.user;
    
    // Add tools if specified
    if (options.tools) {
      requestParams.tools = options.tools;
      if (options.tool_choice) {
        requestParams.tool_choice = options.tool_choice;
      }
    }

    const completion = await client.chat.completions.create(requestParams);

    return completion;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al generar chat completion con OpenAI:', error);
    throw new Error(`Error al generar chat completion con OpenAI: ${errorMessage}`);
  }
}

/**
 * Adapter: Call Responses API and convert response to ChatCompletionResponse format
 */
async function chatCompletionViaResponsesAPI(
  messages: ChatMessage[],
  model: string,
  options: CompletionOptions
): Promise<ChatCompletionResponse> {
  if (!client) {
    throw new Error('Cliente OpenAI no disponible');
  }

  // Convert ChatMessage[] to Responses API input format
  const input = messages.map(msg => ({
    role: msg.role === 'system' ? 'developer' : msg.role,
    content: msg.content,
  }));

  // Build Responses API request
  const requestParams: any = {
    model: model,
    input: input,
    max_output_tokens: options.max_tokens || 16000,
  };

  // Add reasoning effort if specified
  if (options.reasoning_effort) {
    requestParams.reasoning = {
      effort: options.reasoning_effort,
    };
  }

  // Add tools if specified (Responses API supports tools)
  if (options.tools && options.tools.length > 0) {
    requestParams.tools = options.tools;
    if (options.tool_choice) {
      requestParams.tool_choice = options.tool_choice;
    }
  }

  // Call Responses API
  const response = await (client as any).responses.create(requestParams);

  // Extract content and tool_calls from Responses API format
  let content = '';
  let tool_calls: any[] = [];

  for (const item of response.output || []) {
    if (item.type === 'message' && item.content) {
      for (const contentItem of item.content) {
        if (contentItem.type === 'output_text') {
          content += contentItem.text;
        }
      }
    } else if (item.type === 'function_call') {
      // Convert Responses API function_call to Chat Completions tool_call format
      tool_calls.push({
        id: item.call_id || `call_${Date.now()}`,
        type: 'function',
        function: {
          name: item.name,
          arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments),
        }
      });
    }
  }

  // Build ChatCompletionResponse-compatible structure
  const adaptedResponse: ChatCompletionResponse = {
    id: response.id || `resp_${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content,
        tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
      },
      finish_reason: response.status === 'completed' ? 'stop' : 'stop',
      logprobs: null,
    }],
    usage: {
      prompt_tokens: response.usage?.input_tokens || 0,
      completion_tokens: response.usage?.output_tokens || 0,
      total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    },
    tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
  };

  return adaptedResponse;
}

/**
 * Llama al nuevo Responses API de OpenAI (para modelos GPT-5.x)
 * @param prompt Texto a enviar
 * @param options Opciones de completado
 * @returns Resultado del completado
 */
async function callResponsesAPI(prompt: string, options: CompletionOptions = {}): Promise<CompletionResult> {
  if (!client) {
    throw new Error('Cliente OpenAI no disponible');
  }

  const model = options.model || getOpenAIModel();
  
  try {
    // Usar el nuevo Responses API con soporte de reasoning
    const response = await (client as any).responses.create({
      model: model,
      reasoning: {
        effort: options.reasoning_effort || 'medium',
      },
      input: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_output_tokens: options.max_tokens || 16000,
    });

    // Extraer contenido del nuevo formato de respuesta
    let content = '';
    let reasoningSummary = '';

    for (const item of response.output || []) {
      if (item.type === 'message' && item.content) {
        for (const contentItem of item.content) {
          if (contentItem.type === 'output_text') {
            content += contentItem.text;
          }
        }
      } else if (item.type === 'reasoning' && item.summary) {
        for (const summaryItem of item.summary) {
          if (summaryItem.type === 'summary_text') {
            reasoningSummary += summaryItem.text;
          }
        }
      }
    }

    // Extraer tokens de uso
    const reasoningTokens = response.usage?.output_tokens_details?.reasoning_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const inputTokens = response.usage?.input_tokens || 0;

    return {
      content,
      modelInfo: {
        name: model,
        taskType: options.taskType || 'general',
      },
      tokenCount: {
        prompt: inputTokens,
        completion: outputTokens,
        total: inputTokens + outputTokens,
        reasoning: reasoningTokens,
      },
      reasoningSummary: reasoningSummary || undefined,
    };
  } catch (error: any) {
    // Si el Responses API no está disponible, lanzar error para que el caller use fallback
    if (error?.status === 404 || error?.code === 'model_not_found') {
      console.log(`Responses API not available for model ${model}, falling back to Chat Completions`);
      throw new Error('RESPONSES_API_NOT_AVAILABLE');
    }
    throw error;
  }
}

/**
 * Verifica si un modelo soporta el Responses API
 */
function supportsResponsesAPI(model: string): boolean {
  return RESPONSES_API_MODELS.some(m => model.startsWith(m) || model.includes(m));
}

/**
 * Genera tests para código fuente
 * @param sourceCode Código fuente para el que generar tests
 * @param language Lenguaje de programación
 * @param framework Framework de testing
 * @param model Modelo a utilizar
 * @param options Opciones adicionales
 * @returns Código de tests generado
 */
export async function generateTests(
  sourceCode: string,
  language: string,
  framework: string,
  model: string = '',
  options: TestGeneratorOptions = {}
): Promise<string> {
  if (!await ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Instrucciones adicionales si se proporcionan
    const additionalInstructions = options.instructions || '';

    // Construir un prompt específico para generación de tests
    const prompt = `
Genera tests unitarios completos para el siguiente código ${language} utilizando ${framework}.

CÓDIGO FUENTE:
\`\`\`${language}
${sourceCode}
\`\`\`

Requisitos para los tests:
1. Deben cubrir todos los caminos de ejecución posibles
2. Deben incluir casos de prueba para situaciones normales y de error
3. Utiliza mocks/stubs cuando sea necesario para dependencias externas
4. Asegúrate de que sean tests unitarios puros, no de integración

${additionalInstructions}

Genera SOLO el código de los tests, sin explicaciones adicionales.
`;

    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'Eres un experto en testing de software. Tu tarea es generar tests unitarios completos y efectivos que cubran todos los aspectos del código proporcionado.'
    };

    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt
    };

    // Configurar como tarea de generación de código
    const completionOptions: CompletionOptions = {
      ...options,
      taskType: 'codegen',
      model: model || undefined,
      temperature: 0.2  // Menor temperatura para código más determinista
    };

    // Realizar la llamada al modelo usando generateCompletion
    const result = await generateCompletion(prompt, completionOptions);
    
    // Devolver solo el contenido
    return result.content;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al generar tests con OpenAI:', error);
    throw new Error(`Error al generar tests con OpenAI: ${errorMessage}`);
  }
}

/**
 * Genera embeddings para un texto
 * @param text Texto para el que generar embeddings
 * @param model Modelo a utilizar
 * @returns Vector de embeddings
 */
export async function generateEmbeddings(text: string, model: string = 'text-embedding-ada-002'): Promise<number[]> {
  if (!await ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  if (!client) {
    throw new Error('Cliente OpenAI no disponible');
  }

  try {
    const response = await client.embeddings.create({
      model: model,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al generar embeddings con OpenAI:', error);
    throw new Error(`Error al generar embeddings con OpenAI: ${errorMessage}`);
  }
}

/**
 * Genera texto con OpenAI
 * @param prompt Texto a enviar a OpenAI
 * @param options Opciones de generación
 * @returns Objeto con el texto generado y metadatos
 */
export async function generateCompletion(prompt: string, options: CompletionOptions = {}): Promise<CompletionResult> {
  if (!await ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Determinar modelo a usar
    const model = options.model || getOpenAIModel();
    
    // Intentar usar Responses API si el modelo lo soporta
    if (supportsResponsesAPI(model)) {
      try {
        console.log(`[OpenAI] Using Responses API for model: ${model}`);
        return await callResponsesAPI(prompt, { ...options, model });
      } catch (error: any) {
        // Si el Responses API no está disponible, usar fallback
        if (error.message === 'RESPONSES_API_NOT_AVAILABLE') {
          console.log(`[OpenAI] Responses API not available, falling back to Chat Completions`);
        } else {
          throw error;
        }
      }
    }
    
    // Fallback: usar Chat Completions API
    return await generateCompletionWithChatAPI(prompt, model, options);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al generar completion con OpenAI:', error);
    throw new Error(`Error al generar completion con OpenAI: ${errorMessage}`);
  }
}

/**
 * Genera texto usando Chat Completions API (fallback para modelos sin Responses API)
 */
async function generateCompletionWithChatAPI(
  prompt: string, 
  model: string, 
  options: CompletionOptions
): Promise<CompletionResult> {
  // Determinar la temperatura según el tipo de tarea
  let temperature = options.temperature;
  if (temperature === undefined) {
    const taskType = options.taskType || detectTaskType(prompt);
    
    switch (taskType) {
      case 'codegen':
        temperature = 0.2; // Código más determinista
        break;
      case 'creative':
        temperature = 0.8; // Más creatividad
        break;
      case 'analysis':
        temperature = 0.3; // Menos variabilidad para análisis
        break;
      default:
        temperature = 0.7; // Valor predeterminado equilibrado
    }
  }
  
  // Construir los mensajes
  const messages: ChatMessage[] = [];
  
  // Añadir mensaje del sistema según el tipo de tarea
  let systemContent = '';
  
  switch (options.taskType) {
    case 'codegen':
      systemContent = 'Eres un experto programador que genera código de alta calidad, limpio y eficiente. Tu código debe ser completo, bien comentado y seguir las mejores prácticas.';
      break;
    case 'creative':
      systemContent = 'Eres un asistente creativo que genera contenido original, interesante y variado. Piensas fuera de lo convencional y ofreces ideas innovadoras.';
      break;
    case 'analysis':
      systemContent = 'Eres un analista experto que proporciona análisis detallados, precisos y objetivos. Evalúas la información de manera imparcial y ofreces conclusiones basadas en datos.';
      break;
    default:
      systemContent = 'Eres un asistente experto que proporciona respuestas precisas, detalladas y útiles. Hablas en español pero conservas los términos técnicos en inglés cuando es apropiado.';
  }
  
  messages.push({
    role: 'system',
    content: systemContent
  });
  
  // Añadir el prompt como mensaje del usuario
  messages.push({
    role: 'user',
    content: prompt
  });
  
  // Realizar la llamada al modelo
  const response = await chatCompletion(messages, model, {
    temperature,
    ...options
  });
  
  // Extraer y devolver el texto generado con metadatos
  const content = response.choices[0].message.content || '';
  
  // Crear objeto de respuesta con metadatos
  const result: CompletionResult = {
    content: content,
    modelInfo: {
      name: model,
      taskType: options.taskType || detectTaskType(prompt)
    },
    tokenCount: {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0
    }
  };
  
  // Agregar tool_calls si existen
  if (response.tool_calls && response.tool_calls.length > 0) {
    result.tool_calls = response.tool_calls;
  }
  
  return result;
}

/**
 * Llama a OpenAI con herramientas
 * @param messages Mensajes para la conversación
 * @param tools Herramientas disponibles
 * @param toolCallHandler Manejador de llamadas a herramientas
 * @param model Modelo a utilizar
 * @param options Opciones adicionales
 * @returns Respuesta completa con posibles llamadas a herramientas
 */
export async function callWithTools(
  messages: ChatMessage[],
  tools: any[],
  toolCallHandler: (toolCall: any) => Promise<any>,
  model: string = 'gpt-5-mini',
  options: CompletionOptions = {}
): Promise<ChatCompletionResponse> {
  if (!await ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Comprobar si hay mensajes
    if (!messages || messages.length === 0) {
      throw new Error('Se requieren mensajes para la conversación');
    }

    // Comprobar si hay herramientas
    if (!tools || tools.length === 0) {
      throw new Error('Se requieren herramientas para esta función');
    }

    // Comprobar si existe el manejador de herramientas
    if (!toolCallHandler || typeof toolCallHandler !== 'function') {
      throw new Error('Se requiere un manejador de llamadas a herramientas válido');
    }
    
    // Realizar llamada inicial
    const initialResponse = await chatCompletion(messages, model, {
      tools: tools,
      tool_choice: 'auto',
      ...options
    });
    
    // Verificar si hay llamadas a herramientas
    const toolCalls = initialResponse.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      // No hay llamadas a herramientas, devolver respuesta directamente
      return initialResponse;
    }
    
    // Procesar llamadas a herramientas
    const toolResults = await Promise.all(toolCalls.map(async (toolCall) => {
      try {
        // Llamar al manejador de herramientas
        const result = await toolCallHandler(toolCall);
        
        // Crear mensaje con el resultado
        return {
          role: 'tool' as const,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          tool_call_id: toolCall.id
        };
      } catch (error: unknown) {
        // En caso de error, devolver mensaje de error
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          role: 'tool' as const,
          content: `Error: ${errorMessage}`,
          tool_call_id: toolCall.id
        };
      }
    }));
    
    // Agregar resultados de herramientas a los mensajes
    const updatedMessages = [
      ...messages,
      initialResponse.choices[0].message,
      ...toolResults
    ];
    
    // Hacer llamada final sin herramientas (para obtener respuesta final)
    return await chatCompletion(updatedMessages, model, {
      ...options,
      // No permitir más llamadas a herramientas en esta ronda
      tools: undefined,
      tool_choice: undefined
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error al llamar a OpenAI con herramientas:', error);
    throw new Error(`Error al llamar a OpenAI con herramientas: ${errorMessage}`);
  }
}

/**
 * Obtiene el modelo de OpenAI configurado
 * @returns Nombre del modelo
 */
export function getOpenAIModel(): string {
  const config = vscode.workspace.getConfiguration('memorybank');
  return config.get<string>('openai.model') || 'gpt-5-mini';
}

/**
 * Detecta el tipo de tarea basado en el prompt
 * @param prompt Texto del prompt
 * @param specifiedTaskType Tipo de tarea especificado (opcional)
 * @returns Tipo de tarea detectado
 */
function detectTaskType(prompt: string, specifiedTaskType?: string): string {
  // Si se especifica un tipo de tarea, usarlo
  if (specifiedTaskType) {
    return specifiedTaskType;
  }
  
  // Normalizar el prompt para la detección
  const normalizedPrompt = prompt.toLowerCase();
  
  // Detectar tipo de tarea basado en el contenido del prompt
  if (
    normalizedPrompt.includes('codigo') ||
    normalizedPrompt.includes('código') ||
    normalizedPrompt.includes('function') ||
    normalizedPrompt.includes('code') ||
    normalizedPrompt.includes('programa') ||
    normalizedPrompt.includes('implementa') ||
    normalizedPrompt.includes('implementar') ||
    normalizedPrompt.includes('escribe una clase') ||
    normalizedPrompt.includes('escribe un método')
  ) {
    return 'codegen';
  } else if (
    normalizedPrompt.includes('analiza') ||
    normalizedPrompt.includes('analizar') ||
    normalizedPrompt.includes('evalúa') ||
    normalizedPrompt.includes('evaluar') ||
    normalizedPrompt.includes('explica') ||
    normalizedPrompt.includes('explicar') ||
    normalizedPrompt.includes('revisa') ||
    normalizedPrompt.includes('revisar')
  ) {
    return 'analysis';
  } else if (
    normalizedPrompt.includes('crea') ||
    normalizedPrompt.includes('crear') ||
    normalizedPrompt.includes('inventa') ||
    normalizedPrompt.includes('inventar') ||
    normalizedPrompt.includes('genera ideas') ||
    normalizedPrompt.includes('genera conceptos') ||
    normalizedPrompt.includes('escribe una historia')
  ) {
    return 'creative';
  }
  
  // Por defecto, tipo general
  return 'general';
} 