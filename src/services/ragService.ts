/**
 * Servicio RAG (Retrieval Augmented Generation)
 * Integra la búsqueda vectorial con la generación de texto para mejorar las respuestas
 * basadas en el contexto del código del proyecto.
 */

import * as vscode from 'vscode';
import * as openaiService from './openaiService';
import * as vectraService from './vectraService';
import * as configManager from '../utils/configManager';
import * as path from 'path';

/**
 * Inicializa el servicio RAG
 * @returns true si la inicialización fue exitosa
 */
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

/**
 * Realiza una consulta RAG (búsqueda + generación)
 * @param question Pregunta o consulta del usuario
 * @param contextCount Número de contextos a recuperar
 * @returns Respuesta generada con contexto enriquecido
 */
export async function query(question: string, contextCount: number = 5): Promise<string> {
  try {
    // 1. Recuperar contexto relevante del vector store
    const searchResults = await vectraService.query(question, contextCount);
    
    // 2. Formatear el contexto para incluirlo en el prompt
    let formattedContext = '';
    if (searchResults && searchResults.length > 0) {
      formattedContext = '### CONTEXTO RELEVANTE DEL PROYECTO:\n\n';
      
      searchResults.forEach((result, index) => {
        const filePath = result.metadata.filePath || 'Sin ruta';
        const code = result.metadata.code || 'Sin código disponible';
        const relevance = Math.round((result.score || 0) * 100);
        
        formattedContext += `[${index + 1}] Archivo: ${filePath} (Relevancia: ${relevance}%)\n\`\`\`\n${code}\n\`\`\`\n\n`;
      });
    }
    
    // 3. Construir el prompt enriquecido
    const enrichedPrompt = `${formattedContext}
### PREGUNTA:
${question}

Responde basándote en el contexto proporcionado. Si el contexto no contiene información relevante para responder a la pregunta, indícalo claramente y proporciona la mejor respuesta posible basada en tu conocimiento general.
Si mencionas algún fragmento de código o archivo del contexto, indica específicamente de qué archivo proviene usando su ruta.
`;

    // 4. Seleccionar modelo según configuración o política del proyecto
    const model = determineAppropriateModel(question, searchResults);
    
    // 5. Generar respuesta con OpenAI y el contexto enriquecido
    const systemMessage = {
      role: 'system',
      content: 'Eres un asistente de programación experto especializado en analizar y explicar código. Proporcionas respuestas claras, precisas y útiles basadas en el contexto del proyecto proporcionado. Cuando el contexto contenga código relevante, lo utilizarás para dar respuestas específicas y adaptadas al proyecto del usuario.'
    };
    
    const userMessage = {
      role: 'user',
      content: enrichedPrompt
    };
    
    const completion = await openaiService.chatCompletion(
      [systemMessage, userMessage],
      model
    );
    
    return completion.choices[0].message.content;
  } catch (error: any) {
    console.error('Error en RAG query:', error);
    return `Error al procesar la consulta: ${error.message}. Por favor, intenta de nuevo o reformula tu pregunta.`;
  }
}

/**
 * Determina el modelo más apropiado según la complejidad de la pregunta y el contexto
 */
function determineAppropriateModel(question: string, context: vectraService.VectorSearchResult[]): string {
  // Obtener el modelo configurado o usar uno por defecto
  const configuredModel = configManager.getOpenAIModel();
  if (configuredModel) {
    return configuredModel;
  }
  
  // Lógica para determinar el modelo según complejidad
  const questionLength = question.length;
  const hasContext = context && context.length > 0;
  const contextSize = hasContext ? context.reduce((sum, item) => sum + (item.metadata.code?.length || 0), 0) : 0;
  
  // Heurísticas simples para selección de modelo
  if (questionLength > 200 || contextSize > 5000) {
    return "gpt-4"; // Usar modelo más potente para consultas complejas
  }
  
  // Modelo por defecto para la mayoría de casos
  return "gpt-4.1-mini";
}

/**
 * Genera tests con RAG
 */
export async function generateTests(
  sourceCode: string,
  filePath: string,
  language: string,
  framework: string,
  contextCount: number = 5,
  model: string = ""
): Promise<any> {
  try {
    // 1. Buscar tests similares o relacionados en el vector store
    const fileQuery = `tests para ${path.basename(filePath)} en ${framework}`;
    const similarTests = await vectraService.query(fileQuery, contextCount);
    
    // 2. Formatear el contexto de tests similares
    let testContext = '';
    if (similarTests && similarTests.length > 0) {
      testContext = '### EJEMPLOS DE TESTS SIMILARES EN EL PROYECTO:\n\n';
      
      similarTests.forEach((result, index) => {
        if (result.metadata.filePath && result.metadata.filePath.includes('.test.') || 
            result.metadata.filePath.includes('.spec.')) {
          testContext += `[${index + 1}] Archivo: ${result.metadata.filePath}\n\`\`\`${language}\n${result.metadata.code || ''}\n\`\`\`\n\n`;
        }
      });
    }
    
    // 3. Construir el prompt para generación de tests
    const prompt = `
${testContext}

### CÓDIGO FUENTE A TESTEAR:
\`\`\`${language}
${sourceCode}
\`\`\`

### INSTRUCCIONES:
Genera tests unitarios completos para el código fuente anterior utilizando ${framework}.

Requisitos para los tests:
1. Deben cubrir todos los caminos de ejecución posibles
2. Deben incluir casos de prueba para situaciones normales y de error
3. Utiliza mocks/stubs cuando sea necesario para dependencias externas
4. Asegúrate de que sean tests unitarios puros, no de integración
5. Sigue las convenciones de tests que se ven en los ejemplos del proyecto

Genera SOLO el código de los tests, sin explicaciones adicionales.
`;

    // 4. Usar OpenAI para generar los tests con tipo de tarea 'codegen'
    const result = await openaiService.generateCompletion(prompt, {
      taskType: 'codegen',
      temperature: 0.2,
      systemPrompt: `Eres un experto en testing de software especializado en escribir tests unitarios de alta calidad para ${language} usando ${framework}.`
    });
    
    return result;
  } catch (error: any) {
    console.error('Error al generar tests con RAG:', error);
    throw error;
  }
}

/**
 * Analiza código con RAG para encontrar problemas o sugerir mejoras
 */
export async function analyzeCode(
  sourceCode: string,
  filePath: string,
  language: string
): Promise<any> {
  try {
    // 1. Buscar código similar o patrones relevantes en el vector store
    const fileQuery = `análisis de código similar a ${path.basename(filePath)}`;
    const similarCode = await vectraService.query(fileQuery, 3);
    
    // 2. Formatear el contexto de código similar
    let codeContext = '';
    if (similarCode && similarCode.length > 0) {
      codeContext = '### PATRONES DE CÓDIGO RELEVANTES EN EL PROYECTO:\n\n';
      
      similarCode.forEach((result, index) => {
        codeContext += `[${index + 1}] Archivo: ${result.metadata.filePath}\n\`\`\`${language}\n${result.metadata.code || ''}\n\`\`\`\n\n`;
      });
    }
    
    // 3. Construir el prompt para análisis de código
    const prompt = `
${codeContext}

### CÓDIGO A ANALIZAR:
\`\`\`${language}
${sourceCode}
\`\`\`

### INSTRUCCIONES:
Analiza este código y proporciona:
1. Errores o bugs potenciales
2. Vulnerabilidades de seguridad
3. Problemas de rendimiento
4. Mejoras de legibilidad y mantenibilidad
5. Comparación con los patrones de código del proyecto

Responde en formato JSON con la siguiente estructura:
{
  "issues": [
    {
      "description": "Descripción del problema",
      "severity": "High|Medium|Low",
      "solution": "Solución propuesta",
      "code": "Ejemplo de código corregido"
    }
  ],
  "summary": "Resumen general del análisis"
}
`;

    // Usar OpenAI para análisis con tipo de tarea 'analysis'
    const result = await openaiService.generateCompletion(prompt, {
      format: 'json',
      temperature: 0.3,
      taskType: 'analysis'
    });
    
    return result;
  } catch (error: any) {
    console.error('Error al analizar código con RAG:', error);
    throw error;
  }
}

/**
 * Genera una corrección para un error específico utilizando RAG
 */
export async function fixError(
  sourceCode: string,
  errorMessage: string,
  filePath: string,
  language: string
): Promise<any> {
  try {
    // 1. Buscar soluciones similares en el vector store
    const errorQuery = `solución para error "${errorMessage}" en ${language}`;
    const similarSolutions = await vectraService.query(errorQuery, 3);
    
    // 2. Formatear el contexto de soluciones similares
    let solutionContext = '';
    if (similarSolutions && similarSolutions.length > 0) {
      solutionContext = '### SOLUCIONES SIMILARES EN EL PROYECTO:\n\n';
      
      similarSolutions.forEach((result, index) => {
        solutionContext += `[${index + 1}] Archivo: ${result.metadata.filePath}\n\`\`\`${language}\n${result.metadata.code || ''}\n\`\`\`\n\n`;
      });
    }
    
    // 3. Construir el prompt para corrección de errores
    const prompt = `
${solutionContext}

### CÓDIGO CON ERROR:
\`\`\`${language}
${sourceCode}
\`\`\`

### ERROR:
${errorMessage}

### INSTRUCCIONES:
Proporciona una solución para el error descrito. El código corregido debe:
1. Resolver específicamente el error mencionado
2. Mantener la funcionalidad existente
3. Seguir las convenciones de código visibles en el proyecto
4. Ser mínimamente invasivo (cambiar solo lo necesario)

Proporciona ÚNICAMENTE el código corregido completo, sin explicaciones adicionales.
`;

    // Usar OpenAI para corrección de errores con tipo de tarea 'codegen'
    const result = await openaiService.generateCompletion(prompt, {
      taskType: 'codegen',
      temperature: 0.2,
      systemPrompt: `Eres un experto en programación especializado en corregir errores en código ${language}.`
    });
    
    return result;
  } catch (error: any) {
    console.error('Error al corregir código con RAG:', error);
    throw error;
  }
} 