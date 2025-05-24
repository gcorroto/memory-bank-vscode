# Vista de Logs para Agentes Grec0AI

Este componente proporciona una interfaz visual para mostrar los logs y el razonamiento de los agentes de Grec0AI en tiempo real. La vista de logs permite seguir el proceso de pensamiento y las acciones de los agentes mientras ejecutan tareas.

## Características

- **Visualización en tiempo real** de logs de los agentes
- **Soporte para múltiples sesiones** (una por cada ejecución de agente)
- **Compatibilidad con tema claro y oscuro** (se adapta automáticamente)
- **Visualización estructurada** de planes, pasos y reflexiones
- **Interfaz colapsable** para detalles extensos

## Tipos de Logs

La vista soporta los siguientes tipos de logs:

1. **Pasos** (Steps): Acciones individuales ejecutadas por el agente, incluyendo:
   - Descripción
   - Herramienta utilizada
   - Parámetros
   - Resultado
   - Estado de éxito/fracaso

2. **Planes** (Plans): Secuencias de pasos planeados por el agente

3. **Reflexiones** (Reflections): Pensamientos y análisis del agente sobre su progreso

## Uso Básico

```typescript
import { AgentLogsView } from './agent/ui/logsView';

// Crear una instancia con el contexto de la extensión
const logsView = new AgentLogsView(context);

// Mostrar la vista
logsView.show();

// Registrar un paso ejecutado
logsView.addStepLog(
    'Descripción del paso',
    'nombreHerramienta',
    { parametro1: 'valor1' },  // Parámetros
    { resultado: 'éxito' },    // Resultado
    true                       // Éxito (true/false)
);

// Registrar un plan
logsView.addPlanLog([
    {
        description: 'Paso 1',
        tool: 'herramienta1',
        params: { param: 'valor' }
    },
    {
        description: 'Paso 2',
        tool: 'herramienta2',
        params: { param: 'valor' }
    }
]);

// Registrar una reflexión
logsView.addReflectionLog('He analizado el código y encontrado posibles mejoras...');
```

## Trabajando con Múltiples Sesiones

La vista de logs permite crear múltiples sesiones para diferentes ejecuciones de agentes:

```typescript
// Crear una nueva sesión y obtener su ID
const sessionId = logsView.createNewSession('Nombre de la Sesión');

// Agregar logs a una sesión específica
logsView.addStepLog(
    'Descripción del paso',
    'nombreHerramienta',
    { parametro1: 'valor1' },
    { resultado: 'éxito' },
    true,
    sessionId  // ID de la sesión
);

// Cambiar a una sesión específica
logsView.setActiveSession(sessionId);
```

## Integración con Agentes

Para integrar la vista de logs con un agente, puedes utilizar un patrón de observador:

```typescript
// Crear una sesión para el agente
const sessionId = logsView.createNewSession(agent.name);

// Configurar los eventos del agente para registrar logs
agent.onPlan((plan) => {
    logsView.addPlanLog(plan, sessionId);
});

agent.onStep((description, tool, params, result, success) => {
    logsView.addStepLog(description, tool, params, result, success, sessionId);
});

agent.onReflection((reflection) => {
    logsView.addReflectionLog(reflection, sessionId);
});
```

## Uso como Singleton Global

En la extensión principal, es recomendable crear una única instancia global:

```typescript
// En extension.ts
const globalLogsView = new AgentLogsView(context);
(global as any).agentLogsView = globalLogsView;

// Registrar comando para mostrar logs
const disposable = vscode.commands.registerCommand('grec0ai.agent.showLogs', () => {
    globalLogsView.show();
});
```

## Personalización

La vista se adapta automáticamente al tema de VS Code (claro u oscuro). Si necesitas personalizar la apariencia, puedes modificar las variables CSS en el método `getHtmlContent()` de la clase `AgentLogsView`.

## Ejemplo Completo

Consulta el archivo `src/agent/examples/logsViewExample.ts` para ver un ejemplo completo de cómo utilizar la vista de logs con múltiples sesiones y agentes. 