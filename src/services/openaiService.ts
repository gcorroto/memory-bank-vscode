import * as vscode from 'vscode';
import * as configManager from '../utils/configManager';

let OpenAI: any;
try {
  OpenAI = require('openai');
} catch (error) {
  // Handle missing openai module gracefully
  console.error('The "openai" module is missing. Please run "npm install" in the extension directory.');
}

let client: any = null;
let initialized = false;

// Modelos que soportan razonamiento
const REASONING_MODELS = ['o1', 'o1-preview', 'o3-mini', 'o3-mini-high', 'o3-mini-low'];

export function initialize(): boolean {
  try {
    // Check if OpenAI module is available
    if (!OpenAI) {
      vscode.window.showErrorMessage('El módulo OpenAI no está instalado. Por favor, ejecute "npm install" en el directorio de la extensión.');
      return false;
    }

    // Obtener la clave API de la configuración de VS Code
    const config = vscode.workspace.getConfiguration('grec0ai');
    const apiKey = config.get('openai.apiKey');
    
    if (!apiKey) {
      vscode.window.showErrorMessage('La clave API de OpenAI no está configurada. Por favor, configúrela en las preferencias de Grec0AI.');
      return false;
    }

    // Configurar el cliente de OpenAI
    client = new OpenAI({
      apiKey: apiKey
    });
    
    initialized = true;
    console.log('OpenAI service initialized');
    return true;
  } catch (error) {
    console.error('Error al inicializar OpenAI:', error);
    vscode.window.showErrorMessage(`Error al inicializar OpenAI: ${error.message}`);
    return false;
  }
}

function ensureInitialized(): boolean {
  if (!initialized) {
    return initialize();
  }
  return true;
}

export async function callOpenAI(prompt: string): Promise<string> {
  if (!ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Eres un asistente experto en programación que proporciona respuestas precisas y detalladas sobre código. Hablas en español pero conservas los términos técnicos en inglés cuando es apropiado.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ]
    });

    return completion.choices[0].message.content;
  } catch (error: any) {
    console.error('Error al llamar a OpenAI:', error);
    throw error;
  }
}

export async function generateText(prompt: string, model: string = '', options: any = {}): Promise<string> {
  if (!ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Detectar el tipo de tarea según el prompt (análisis simple)
    const taskType = detectTaskType(prompt, options.taskType);
    
    // Usar el método común con el tipo de tarea detectado
    return await generateCompletion(prompt, {
      ...options,
      taskType: taskType,
      model: model || undefined
    });
  } catch (error: any) {
    console.error('Error al generar texto con OpenAI:', error);
    throw error;
  }
}

export async function chatCompletion(messages: any[], model: string = 'gpt-4.1-mini', options: any = {}): Promise<any> {
  if (!ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Verificar si es un modelo de razonamiento
    const isReasoningModel = REASONING_MODELS.some(m => model.startsWith(m));
    
    // Preparar los parámetros según el tipo de modelo
    const requestParams: any = {
      model: model,
      messages: isReasoningModel ? 
        // Para modelos de razonamiento, usar 'developer' en lugar de 'system'
        messages.map(msg => msg.role === 'system' ? {...msg, role: 'developer'} : msg) : 
        messages,
      ...options
    };
    
    // Añadir parámetros específicos para modelos de razonamiento si corresponde
    if (isReasoningModel) {
      // Añadir reasoning_effort si se especifica
      if (options.reasoning_effort) {
        requestParams.reasoning_effort = options.reasoning_effort;
      }
      
      // Añadir herramientas si se especifican
      if (options.tools) {
        requestParams.tools = options.tools;
        
        // Añadir tool_choice si se especifica
        if (options.tool_choice) {
          requestParams.tool_choice = options.tool_choice;
        }
      }
    }

    const completion = await client.chat.completions.create(requestParams);

    return completion;
  } catch (error: any) {
    console.error('Error al generar chat completion con OpenAI:', error);
    throw error;
  }
}

export async function generateTests(
  sourceCode: string,
  language: string,
  framework: string,
  model: string = '',
  options: any = {}
): Promise<string> {
  if (!ensureInitialized()) {
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

    const systemMessage = {
      role: 'system',
      content: 'Eres un experto en testing de software. Tu tarea es generar tests unitarios completos y efectivos que cubran todos los aspectos del código proporcionado.'
    };

    const userMessage = {
      role: 'user',
      content: prompt
    };

    // Configurar como tarea de generación de código
    const completionOptions = {
      ...options,
      taskType: 'codegen',
      model: model || undefined
    };
    
    // Usar generateCompletion para aprovechar la selección de modelo por tipo de tarea
    return await generateCompletion(prompt, completionOptions);
  } catch (error: any) {
    console.error('Error al generar tests con OpenAI:', error);
    throw error;
  }
}

export async function generateEmbeddings(text: string, model: string = 'text-embedding-ada-002'): Promise<number[]> {
  if (!ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Los embeddings siempre usan un modelo específico, no dependen del tipo de tarea
    // In a real implementation, this would call the OpenAI embeddings API
    // For now, return a simple mock embedding
    return Array(32).fill(0).map(() => Math.random());
  } catch (error: any) {
    console.error('Error al generar embeddings con OpenAI:', error);
    throw error;
  }
}

/**
 * Generate a completion from a prompt
 * @param prompt - The prompt to complete
 * @param options - Additional options for the completion
 * @returns The generated completion text or JSON object with metadata
 */
export async function generateCompletion(prompt: string, options: any = {}): Promise<any> {
  if (!ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Seleccionar modelo según el tipo de tarea
    const taskType = options.taskType || 'analysis'; // Default to analysis if not specified
    const model = options.model || configManager.getModelForTask(taskType);
    
    // Verificar si es un modelo de razonamiento
    const isReasoningModel = REASONING_MODELS.some(m => model.startsWith(m));
    
    const maxTokens = options.maxTokens || 1024;
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const format = options.format || 'text';
    
    // Log del modelo seleccionado (útil para debugging)
    console.log(`Using ${model} model for task type: ${taskType}`);
    
    // Crear mensajes según el tipo de modelo
    const systemRole = isReasoningModel ? 'developer' : 'system';
    
    const systemMessage = {
      role: systemRole,
      content: format === 'json' 
        ? 'You are a helpful assistant that always responds in valid JSON format.'
        : 'You are a helpful assistant that provides clear and concise responses.'
    };

    // Personalizar el mensaje del sistema según el tipo de tarea
    if (taskType === 'planning') {
      systemMessage.content = 'You are a strategic planner that breaks down tasks into logical, actionable steps. ' + 
        (format === 'json' ? 'Always respond in valid JSON format.' : '');
    } else if (taskType === 'codegen') {
      systemMessage.content = 'You are an expert software engineer that writes clean, well-structured, and efficient code. ' +
        'Focus on producing high-quality code that follows best practices and project conventions. ' +
        (format === 'json' ? 'Always respond in valid JSON format.' : '');
    } else if (taskType === 'analysis') {
      systemMessage.content = 'You are an analytical assistant that helps understand code, identifies patterns, and explains concepts clearly. ' +
        (format === 'json' ? 'Always respond in valid JSON format.' : '');
    }

    const userMessage = {
      role: 'user',
      content: prompt
    };

    // Construir los parámetros de la solicitud
    const requestParams: any = {
      model: model,
      messages: [systemMessage, userMessage],
      max_tokens: maxTokens,
      temperature: temperature,
    };
    
    // Añadir response_format según el formato
    if (format === 'json') {
      requestParams.response_format = { type: 'json_object' };
    }
    
    // Añadir parámetros específicos para modelos de razonamiento
    if (isReasoningModel) {
      // Añadir reasoning_effort si se especifica (low, medium, high)
      if (options.reasoning_effort) {
        requestParams.reasoning_effort = options.reasoning_effort;
      }
      
      // Añadir herramientas si se especifican
      if (options.tools) {
        requestParams.tools = options.tools;
        
        // Añadir tool_choice si se especifica (auto, required, o objeto específico)
        if (options.tool_choice) {
          requestParams.tool_choice = options.tool_choice;
        }
      }
      
      // Añadir response_format con json_schema si se proporciona
      if (options.json_schema) {
        requestParams.response_format = {
          type: 'json_schema',
          json_schema: options.json_schema
        };
      }
    }

    const completion = await client.chat.completions.create(requestParams);

    const responseContent = completion.choices[0].message.content;
    const tokenUsage = completion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    // Preparar resultado con metadatos
    const result: {
      content: any;
      modelInfo: {
        name: any;
        taskType: any;
      };
      tokenCount: {
        prompt: any;
        completion: any;
        total: any;
      };
      tool_calls?: any[];
    } = {
      content: responseContent,
      modelInfo: {
        name: model,
        taskType: taskType
      },
      tokenCount: {
        prompt: tokenUsage.prompt_tokens,
        completion: tokenUsage.completion_tokens,
        total: tokenUsage.total_tokens
      }
    };
    
    // Verificar si hay llamadas a herramientas en la respuesta
    if (completion.choices[0].message.tool_calls) {
      result.tool_calls = completion.choices[0].message.tool_calls;
    }
    
    // Si se solicita JSON, analizar el contenido
    if (format === 'json' || options.json_schema) {
      try {
        result.content = JSON.parse(responseContent);
      } catch (error) {
        console.warn('Error parsing JSON response, returning raw text', error);
      }
    }
    
    return result;
  } catch (error: any) {
    console.error('Error generating completion with OpenAI:', error);
    
    // Si hay un error específico con el modelo, intentar con el modelo de fallback
    if (error.message && (error.message.includes('model') || error.message.includes('not found') || error.message.includes('unavailable'))) {
      console.log('Error with specified model, trying with fallback model');
      
      // Eliminar modelo de las opciones y forzar el uso del modelo por defecto
      const fallbackOptions = { ...options };
      delete fallbackOptions.model;
      delete fallbackOptions.taskType;
      
      // Reintentar con el modelo de fallback
      return generateCompletion(prompt, fallbackOptions);
    }
    
    throw error;
  }
}

/**
 * Crea y procesa llamadas a herramientas a través de un modelo de OpenAI con razonamiento
 * @param messages - Mensajes iniciales de la conversación
 * @param tools - Definición de herramientas disponibles
 * @param toolCallHandler - Función para manejar las llamadas a herramientas
 * @param model - Modelo a utilizar (debe ser un modelo de razonamiento)
 * @param options - Opciones adicionales para la solicitud
 * @returns El resultado final de la conversación
 */
export async function callWithTools(
  messages: any[],
  tools: any[],
  toolCallHandler: (toolCall: any) => Promise<any>,
  model: string = 'o3-mini',
  options: any = {}
): Promise<any> {
  if (!ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    // Verificar si es un modelo de razonamiento
    const isReasoningModel = REASONING_MODELS.some(m => model.startsWith(m));
    if (!isReasoningModel) {
      throw new Error(`El modelo ${model} no soporta herramientas. Debe usar un modelo de razonamiento.`);
    }

    // Clonar mensajes para no modificar el original
    let currentMessages = [...messages];
    
    // Convertir mensajes 'system' a 'developer' para modelos de razonamiento
    currentMessages = currentMessages.map(msg => 
      msg.role === 'system' ? {...msg, role: 'developer'} : msg
    );

    // Configurar los parámetros para la solicitud
    const requestParams: any = {
      model: model,
      messages: currentMessages,
      tools: tools,
      tool_choice: options.tool_choice || 'auto',
    };
    
    // Añadir reasoning_effort si se especifica
    if (options.reasoning_effort) {
      requestParams.reasoning_effort = options.reasoning_effort;
    }
    
    // Añadir otros parámetros opcionales
    if (options.temperature !== undefined) {
      requestParams.temperature = options.temperature;
    }
    
    if (options.max_tokens) {
      requestParams.max_tokens = options.max_tokens;
    }
    
    // Realizar la primera solicitud
    let response = await client.chat.completions.create(requestParams);
    let assistantMessage = response.choices[0].message;
    
    // Añadir la respuesta del asistente a los mensajes
    currentMessages.push(assistantMessage);
    
    // Procesar llamadas a herramientas si existen
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Procesar cada llamada a herramienta
      for (const toolCall of assistantMessage.tool_calls) {
        try {
          // Llamar al manejador de herramientas proporcionado
          const result = await toolCallHandler(toolCall);
          
          // Añadir el resultado de la herramienta a los mensajes
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: typeof result === 'string' ? result : JSON.stringify(result)
          });
        } catch (error: any) {
          // Si hay un error al llamar a la herramienta, añadirlo como mensaje de error
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error: ${error.message}`
          });
        }
      }
      
      // Realizar una solicitud final sin herramientas para obtener la respuesta final
      const finalResponse = await client.chat.completions.create({
        model: model,
        messages: currentMessages,
      });
      
      // Construir un objeto de resultado final con la historia completa
      return {
        message: finalResponse.choices[0].message,
        conversation: currentMessages,
        tool_calls: assistantMessage.tool_calls
      };
    }
    
    // Si no hay llamadas a herramientas, devolver la respuesta directamente
    return {
      message: assistantMessage,
      conversation: currentMessages,
      tool_calls: []
    };
  } catch (error: any) {
    console.error('Error al utilizar herramientas con OpenAI:', error);
    throw error;
  }
}

/**
 * Detecta el tipo de tarea basado en el contenido del prompt
 * @param prompt - El prompt a analizar
 * @param specifiedTaskType - Tipo de tarea especificado explícitamente
 * @returns El tipo de tarea detectado o especificado
 */
function detectTaskType(prompt: string, specifiedTaskType?: string): string {
  // Si se especifica explícitamente, usar ese valor
  if (specifiedTaskType) {
    return specifiedTaskType;
  }
  
  // Detectar según palabras clave en el prompt
  const lowerPrompt = prompt.toLowerCase();
  
  // Detectar si es planificación
  if (
    lowerPrompt.includes('plan ') || 
    lowerPrompt.includes('steps ') ||
    lowerPrompt.includes('breakdown') ||
    lowerPrompt.includes('divide') ||
    lowerPrompt.includes('strategy')
  ) {
    return 'planning';
  }
  
  // Detectar si es generación de código
  if (
    lowerPrompt.includes('generate code') ||
    lowerPrompt.includes('write code') ||
    lowerPrompt.includes('implement') ||
    lowerPrompt.includes('function') ||
    lowerPrompt.includes('class') ||
    lowerPrompt.includes('fix error') ||
    lowerPrompt.includes('debug')
  ) {
    return 'codegen';
  }
  
  // Por defecto, considerarlo análisis
  return 'analysis';
} 