/**
 * Utilidades para gestionar y optimizar prompts para OpenAI
 */

/**
 * Plantilla para generar tests unitarios
 * @type {Object}
 */
const TEST_GENERATION_TEMPLATE = {
    systemMessage: 'Eres un experto en testing de software. Tu tarea es generar tests unitarios completos y efectivos que cubran todos los aspectos del código proporcionado.',
    promptTemplate: `
Genera tests unitarios completos para el siguiente código {{language}} utilizando {{framework}}.

CÓDIGO FUENTE:
\`\`\`{{language}}
{{sourceCode}}
\`\`\`

Requisitos para los tests:
1. Deben cubrir todos los caminos de ejecución posibles
2. Deben incluir casos de prueba para situaciones normales y de error
3. Utilizar mocks/stubs cuando sea necesario para dependencias externas
4. Asegurarse de que sean tests unitarios puros, no de integración

Genera SOLO el código de los tests, sin explicaciones adicionales.`
};

/**
 * Plantilla para análisis de código
 * @type {Object}
 */
const CODE_ANALYSIS_TEMPLATE = {
    systemMessage: 'Eres un experto en análisis de código y revisión de calidad. Tu tarea es identificar problemas en el código proporcionado y sugerir soluciones concretas.',
    promptTemplate: `
Analiza el siguiente código {{language}} en busca de problemas o mejoras:

\`\`\`{{language}}
{{sourceCode}}
\`\`\`

Analiza específicamente:
1. Errores de sintaxis o lógica
2. Vulnerabilidades de seguridad
3. Problemas de rendimiento
4. Estilo de código y mejores prácticas
5. Mantenibilidad y legibilidad

Para cada problema encontrado, proporciona:
- Una descripción clara del problema
- El nivel de gravedad (Alto/Medio/Bajo)
- Una solución recomendada con código de ejemplo`
};

/**
 * Plantilla para resolución de errores
 * @type {Object}
 */
const ERROR_RESOLUTION_TEMPLATE = {
    systemMessage: 'Eres un experto en depuración y resolución de errores de programación. Tu tarea es explicar de manera clara la causa de un error y proporcionar una solución precisa y funcional.',
    promptTemplate: `
Analiza el siguiente error en código {{language}}:

CÓDIGO CON ERROR:
\`\`\`{{language}}
{{sourceCode}}
\`\`\`

MENSAJE DE ERROR:
{{errorMessage}}

Por favor:
1. Explica la causa raíz del error
2. Proporciona una solución paso a paso
3. Muestra el código corregido completo`
};

/**
 * Procesa una plantilla de prompt reemplazando las variables
 * @param {string} template - Plantilla con variables en formato {{variable}}
 * @param {Object} variables - Objeto con las variables a reemplazar
 * @returns {string} - Prompt procesado
 */
function processTemplate(template, variables) {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value);
    }
    
    return result;
}

/**
 * Optimiza un prompt para minimizar el uso de tokens
 * @param {string} prompt - Prompt original
 * @returns {string} - Prompt optimizado
 */
function optimizePrompt(prompt) {
    // Eliminar líneas vacías múltiples
    let optimized = prompt.replace(/\n{3,}/g, '\n\n');
    
    // Eliminar espacios en blanco al inicio y final
    optimized = optimized.trim();
    
    return optimized;
}

/**
 * Genera un prompt para generación de tests
 * @param {string} sourceCode - Código fuente
 * @param {string} language - Lenguaje de programación
 * @param {string} framework - Framework de testing
 * @returns {Object} - Objeto con systemMessage y userMessage
 */
function createTestGenerationPrompt(sourceCode, language, framework) {
    const variables = {
        sourceCode,
        language,
        framework
    };
    
    const prompt = processTemplate(TEST_GENERATION_TEMPLATE.promptTemplate, variables);
    
    return {
        systemMessage: {
            role: 'system',
            content: TEST_GENERATION_TEMPLATE.systemMessage
        },
        userMessage: {
            role: 'user',
            content: optimizePrompt(prompt)
        }
    };
}

/**
 * Genera un prompt para análisis de código
 * @param {string} sourceCode - Código fuente
 * @param {string} language - Lenguaje de programación
 * @returns {Object} - Objeto con systemMessage y userMessage
 */
function createCodeAnalysisPrompt(sourceCode, language) {
    const variables = {
        sourceCode,
        language
    };
    
    const prompt = processTemplate(CODE_ANALYSIS_TEMPLATE.promptTemplate, variables);
    
    return {
        systemMessage: {
            role: 'system',
            content: CODE_ANALYSIS_TEMPLATE.systemMessage
        },
        userMessage: {
            role: 'user',
            content: optimizePrompt(prompt)
        }
    };
}

/**
 * Genera un prompt para resolución de errores
 * @param {string} sourceCode - Código fuente con error
 * @param {string} errorMessage - Mensaje de error
 * @param {string} language - Lenguaje de programación
 * @returns {Object} - Objeto con systemMessage y userMessage
 */
function createErrorResolutionPrompt(sourceCode, errorMessage, language) {
    const variables = {
        sourceCode,
        errorMessage,
        language
    };
    
    const prompt = processTemplate(ERROR_RESOLUTION_TEMPLATE.promptTemplate, variables);
    
    return {
        systemMessage: {
            role: 'system',
            content: ERROR_RESOLUTION_TEMPLATE.systemMessage
        },
        userMessage: {
            role: 'user',
            content: optimizePrompt(prompt)
        }
    };
}

/**
 * Enriquece un prompt con contexto del código
 * @param {Object} promptObj - Objeto con systemMessage y userMessage
 * @param {Array<Object>} contextResults - Resultados de consulta de contexto
 * @returns {Object} - Objeto con systemMessage y userMessage enriquecidos
 */
function enrichPromptWithContext(promptObj, contextResults) {
    if (!contextResults || contextResults.length === 0) {
        return promptObj;
    }
    
    let contextText = '### CONTEXTO RELEVANTE DEL CÓDIGO:\n\n';
    
    for (let i = 0; i < contextResults.length; i++) {
        const result = contextResults[i];
        const relevanceScore = (result.score * 100).toFixed(2);
        const filePath = result.metadata.filePath || 'Desconocido';
        const language = result.metadata.language || '';
        
        contextText += `[${i + 1}] Relevancia: ${relevanceScore}% - Archivo: ${filePath}\n`;
        contextText += '```' + language + '\n';
        contextText += result.code + '\n';
        contextText += '```\n\n';
    }
    
    // Añadir el contexto al principio del prompt
    const enrichedPrompt = contextText + promptObj.userMessage.content;
    
    return {
        systemMessage: promptObj.systemMessage,
        userMessage: {
            role: 'user',
            content: optimizePrompt(enrichedPrompt)
        }
    };
}

module.exports = {
    processTemplate,
    optimizePrompt,
    createTestGenerationPrompt,
    createCodeAnalysisPrompt,
    createErrorResolutionPrompt,
    enrichPromptWithContext,
    TEST_GENERATION_TEMPLATE,
    CODE_ANALYSIS_TEMPLATE,
    ERROR_RESOLUTION_TEMPLATE
}; 