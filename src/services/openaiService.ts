import * as vscode from 'vscode';

let OpenAI: any;
try {
  OpenAI = require('openai');
} catch (error) {
  // Handle missing openai module gracefully
  console.error('The "openai" module is missing. Please run "npm install" in the extension directory.');
}

let client: any = null;
let initialized = false;

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
      model: 'gpt-3.5-turbo',
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

export async function generateText(prompt: string, model: string = 'gpt-3.5-turbo', options: any = {}): Promise<string> {
  if (!ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    const completion = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      ...options
    });

    return completion.choices[0].message.content;
  } catch (error: any) {
    console.error('Error al generar texto con OpenAI:', error);
    throw error;
  }
}

export async function chatCompletion(messages: any[], model: string = 'gpt-3.5-turbo', options: any = {}): Promise<any> {
  if (!ensureInitialized()) {
    throw new Error('Cliente OpenAI no inicializado');
  }

  try {
    const completion = await client.chat.completions.create({
      model: model,
      messages: messages,
      ...options
    });

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
  model: string = 'gpt-3.5-turbo',
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

    const completion = await client.chat.completions.create({
      model: model,
      messages: [systemMessage, userMessage],
      ...options
    });

    return completion.choices[0].message.content;
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
    // In a real implementation, this would call the OpenAI embeddings API
    // For now, return a simple mock embedding
    return Array(32).fill(0).map(() => Math.random());
  } catch (error: any) {
    console.error('Error al generar embeddings con OpenAI:', error);
    throw error;
  }
} 