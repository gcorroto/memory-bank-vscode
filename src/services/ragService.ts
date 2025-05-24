import * as vscode from 'vscode';
import * as openaiService from './openaiService';
import * as vectraService from './vectraService';

export async function initialize(): Promise<boolean> {
  try {
    // Inicializar servicios dependientes
    const openaiInitialized = openaiService.initialize();
    const vectraInitialized = await vectraService.initialize();
    
    return openaiInitialized && vectraInitialized;
  } catch (error) {
    console.error('Error al inicializar RAG:', error);
    return false;
  }
}

export async function query(question: string): Promise<string> {
  try {
    // Recuperar contexto relevante
    const contextResults = await vectraService.query(question);
    
    // Formatear el contexto para incluirlo en el prompt
    let formattedContext = '';
    if (contextResults && contextResults.length > 0) {
      formattedContext = '### CONTEXTO RELEVANTE:\n\n';
      contextResults.forEach((result, index) => {
        formattedContext += `[${index + 1}] ${result}\n`;
      });
      formattedContext += '\n';
    }
    
    // Construir el prompt enriquecido
    const enrichedPrompt = `${formattedContext}
### PREGUNTA:
${question}

Responde basándote en el contexto proporcionado.`;

    // Generar respuesta con OpenAI
    const response = await openaiService.callOpenAI(enrichedPrompt);
    return response;
  } catch (error: any) {
    console.error('Error en RAG query:', error);
    return `Error al procesar la consulta: ${error.message}`;
  }
}

export async function generateTests(
  sourceCode: string,
  filePath: string,
  language: string,
  framework: string,
  contextCount: number = 5,
  model: string = "gpt-4.1-mini"
): Promise<string> {
  try {
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

Genera SOLO el código de los tests, sin explicaciones adicionales.
`;

    // Usar OpenAI para generar los tests
    return await openaiService.callOpenAI(prompt);
  } catch (error: any) {
    console.error('Error al generar tests con RAG:', error);
    throw error;
  }
} 