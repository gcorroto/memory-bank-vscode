/**
 * PromptComposer
 * Sistema para componer prompts con contexto del workspace y reglas del proyecto
 */

interface PromptOptions {
  userQuery: string;
  workspacePath?: string;
  attachedDocs?: any[];
  currentFilePath?: string;
}

/**
 * Construye un prompt enriquecido con contexto del workspace
 * @param options Opciones para construir el prompt
 * @returns Prompt enriquecido con contexto
 */
export function buildPrompt(options: PromptOptions): string {
  // Obtener opciones
  const { userQuery, workspacePath, attachedDocs, currentFilePath } = options;
  
  // Construir secciones del prompt
  let prompt = '';
  
  // 1. Añadir la query del usuario
  prompt += `## Consulta del Usuario\n\n${userQuery}\n\n`;
  
  // 2. Añadir información del workspace si está disponible
  if (workspacePath) {
    prompt += `## Workspace\n\nRuta: ${workspacePath}\n\n`;
  }
  
  // 3. Añadir información del archivo actual si está disponible
  if (currentFilePath) {
    prompt += `## Archivo Actual\n\nRuta: ${currentFilePath}\n\n`;
  }
  
  // 4. Añadir documentos adjuntos si hay
  if (attachedDocs && attachedDocs.length > 0) {
    prompt += '## Documentos Relevantes\n\n';
    
    attachedDocs.forEach((doc, index) => {
      prompt += `[${index + 1}] ${doc.title || 'Documento sin título'}\n`;
      prompt += `${doc.content || ''}\n\n`;
    });
  }
  
  // 5. Añadir sección de reglas (stub básico)
  prompt += '---\n## Rules\n\n';
  prompt += '- Seguir el estilo de código existente\n';
  prompt += '- Mantener compatibilidad con TypeScript\n';
  prompt += '- Documentar cualquier cambio importante\n';
  prompt += '---\n';
  
  return prompt;
}

// Exportar el objeto promptComposer para compatibilidad
const promptComposer = {
  buildPrompt
};

export default promptComposer; 