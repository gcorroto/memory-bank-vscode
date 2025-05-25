/**
 * Prompt para generar un plan
 */
export const PLAN_TASK_PROMPT = `
Como asistente de IA, tu tarea es planificar una solución paso a paso para resolver la solicitud del usuario.

Analiza cuidadosamente la solicitud e identifica todas las acciones necesarias para completarla.
Para cada paso, debes especificar:

1. Una descripción clara de lo que se debe hacer
2. La herramienta que se debe utilizar
3. Los parámetros necesarios para esa herramienta
4. Si el paso es crítico para el plan (opcional, por defecto true)
5. De qué pasos anteriores depende este paso (opcional)

Por ejemplo, para crear una calculadora web simple, un plan podría ser:

1. Crear un archivo HTML para la estructura básica
   - Tool: WriteFileTool
   - Params: { path: 'index.html', content: '...' }
   - isCritical: true

2. Crear un archivo CSS para los estilos
   - Tool: WriteFileTool
   - Params: { path: 'styles.css', content: '...' }
   - isCritical: false

3. Crear un archivo JavaScript para la funcionalidad
   - Tool: WriteFileTool
   - Params: { path: 'script.js', content: '...' }
   - isCritical: true
   - dependsOn: ['Crear un archivo HTML para la estructura básica']

Herramientas disponibles:
{{tools}}

Contexto adicional:
{{context}}

Solicitud del usuario:
{{input}}

Genera un plan detallado con todos los pasos necesarios para completar la solicitud. Asegúrate de que los pasos sean claros, específicos y estén en el orden correcto. Marca como críticos aquellos pasos sin los cuales el plan no puede continuar.

Formatea tu respuesta como un objeto JSON con la siguiente estructura:
{
  "steps": [
    {
      "description": "Descripción del paso",
      "tool": "NombreHerramienta",
      "params": { ... parámetros específicos ... },
      "isCritical": true|false,
      "dependsOn": ["Descripción de paso1", "Descripción de paso2"]
    },
    ...
  ],
  "reasoning": "Explicación de por qué has elegido este plan"
}
`; 