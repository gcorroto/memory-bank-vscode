import * as vscode from 'vscode';
import * as openaiService from './services/openaiService';
import * as vectraService from './services/vectraService';

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

/**
 * Resuelve un error en el código utilizando RAG
 * @param errorMessage Mensaje de error a resolver
 * @param sourceCode Código fuente con el error
 * @param language Lenguaje de programación
 * @param contextCount Número de ejemplos de contexto a utilizar
 * @param model Modelo de OpenAI a utilizar
 * @returns Solución al error con código corregido
 */
export async function resolveError(
  errorMessage: string,
  sourceCode: string,
  language: string,
  contextCount: number = 4,
  model: string = "gpt-4.1-mini"
): Promise<{explanation: string, solution: string, fixedCode: string}> {
  try {
    // Construir un prompt para resolver el error
    const prompt = `
Resuelve el siguiente error en código ${language}:

ERROR:
${errorMessage}

CÓDIGO FUENTE:
\`\`\`${language}
${sourceCode}
\`\`\`

Proporciona:
1. Una explicación detallada de por qué ocurre el error
2. La solución conceptual al problema
3. El código completo corregido
`;

    // Usar OpenAI para resolver el error
    const response = await openaiService.generateCompletion(prompt, {
      model: model,
      format: 'json',
      temperature: 0.3
    });

    // Si no se pudo obtener una respuesta en JSON, crear una respuesta básica
    if (typeof response === 'string') {
      return {
        explanation: `Error: ${errorMessage}`,
        solution: 'No se pudo generar una solución estructurada.',
        fixedCode: response
      };
    }

    return {
      explanation: response.explanation || `Error: ${errorMessage}`,
      solution: response.solution || 'Solución generada automáticamente',
      fixedCode: response.fixedCode || sourceCode
    };
  } catch (error: any) {
    console.error('Error al resolver error con RAG:', error);
    throw error;
  }
}

/**
 * Analiza código en busca de problemas y oportunidades de mejora
 * @param sourceCode Código fuente a analizar
 * @param language Lenguaje de programación
 * @param contextCount Número de ejemplos de contexto a utilizar
 * @param model Modelo de OpenAI a utilizar
 * @returns Análisis del código con problemas y sugerencias
 */
export async function analyzeCode(
  sourceCode: string,
  language: string,
  contextCount: number = 3,
  model: string = "gpt-4.1-mini"
): Promise<{issues: any[], summary: string}> {
  try {
    // Construir un prompt para analizar el código
    const prompt = `
Analiza este código ${language} en busca de problemas y oportunidades de mejora:

\`\`\`${language}
${sourceCode}
\`\`\`

Busca:
1. Errores y bugs
2. Vulnerabilidades de seguridad
3. Problemas de rendimiento
4. Problemas de estructura y mantenibilidad
5. Violaciones de buenas prácticas

Para cada problema, proporciona:
- Descripción del problema
- Nivel de severidad (Alto/Medio/Bajo)
- Solución recomendada con ejemplo de código

Formatea la respuesta como JSON válido con la siguiente estructura:
{
  "issues": [
    {
      "description": "Descripción del problema",
      "severity": "Alto|Medio|Bajo",
      "solution": "Solución sugerida",
      "code": "Ejemplo de código corregido"
    }
  ],
  "summary": "Evaluación general"
}
`;

    // Usar OpenAI para analizar el código
    const response = await openaiService.generateCompletion(prompt, {
      model: model,
      format: 'json',
      temperature: 0.3
    });

    // Si no se pudo obtener una respuesta en JSON, crear una respuesta básica
    if (typeof response === 'string') {
      return {
        issues: [],
        summary: 'No se pudo generar un análisis estructurado.'
      };
    }

    return {
      issues: response.issues || [],
      summary: response.summary || 'Análisis generado automáticamente'
    };
  } catch (error: any) {
    console.error('Error al analizar código con RAG:', error);
    throw error;
  }
} 