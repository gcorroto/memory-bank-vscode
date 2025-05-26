# Plan de Refactorización de Comandos VS Code

## Situación Actual
Los comandos de VS Code están dispersos en múltiples archivos:
- `src/extension.ts`
- `src/services/commands.ts`
- `src/agent/ui/EventsViewer.ts`
- `src/agent/core/Agent.ts`
- `src/agent/examples/logsViewExample.ts`

## Objetivos
1. Centralizar todos los comandos en un único punto
2. Eliminar duplicaciones
3. Mejorar la mantenibilidad
4. Facilitar la documentación y el descubrimiento de comandos

## Plan de Acción

### 1. Crear Nueva Estructura
```
src/
  commands/
    index.ts           # Punto de entrada principal
    categories/
      agent.ts        # Comandos relacionados con el agente
      filesystem.ts   # Comandos del sistema de archivos
      coverage.ts     # Comandos de cobertura
      rag.ts         # Comandos de RAG
      ui.ts          # Comandos de interfaz de usuario
    types.ts          # Tipos compartidos
    utils.ts          # Utilidades comunes
```

### 2. Migración de Comandos

#### Comandos a Migrar por Categoría

##### Agent Commands
- `grec0ai.createAgent`
- `grec0ai.getAgent`
- `grec0ai.ask`
- `grec0ai.agent.showLogs`
- `grec0ai.agent.generateTest`
- `grec0ai.agent.analyzeCode`
- `grec0ai.agent.fixError`
- `grec0ai.agent.explain`
- `grec0ai.agent.testReasoningModel`

##### Filesystem Commands
- `grec0ai.filesystem.refresh`
- `grec0ai.filesystem.showFileDetails`
- `grec0ai.filesystem.openFileAtLine`

##### Coverage Commands
- `grec0ai.coverage.refresh`
- `grec0ai.coverage.details.refresh`

##### RAG Commands
- `grec0ai.rag.initialize`
- `grec0ai.vectra.reindexProject`
- `grec0ai.vectra.indexProject`
- `grec0ai.vectra.search`

##### UI Commands
- `grec0ai.showEventsViewer`
- `grec0ai.clearEvents`
- `grec0ai.showEventDetails`
- `grec0ai.showChanges`
- `grec0ai.toggleTerminal`

##### Configuration Commands
- `grec0ai.openai.configure`

##### Other Commands
- `grec0ai.automaticTest`
- `grec0ai.runAutofixer`
- `grec0ai.ask.macgyver`

### 3. Pasos de Implementación

1. **Fase 1: Preparación**
   - Crear la nueva estructura de directorios
   - Definir interfaces y tipos en `types.ts`
   - Crear utilidades comunes en `utils.ts`

2. **Fase 2: Migración**
   - Migrar comandos por categoría
   - Implementar cada categoría en su archivo correspondiente
   - Actualizar `index.ts` para exportar todos los comandos

3. **Fase 3: Actualización de Referencias**
   - Actualizar `extension.ts` para usar la nueva estructura
   - Eliminar comandos duplicados
   - Actualizar referencias en otros archivos

4. **Fase 4: Limpieza**
   - Eliminar archivos obsoletos
   - Actualizar documentación
   - Añadir comentarios y documentación de comandos

### 4. Beneficios Esperados

1. **Mantenibilidad**
   - Código más organizado y fácil de mantener
   - Mejor separación de responsabilidades
   - Más fácil de encontrar y modificar comandos

2. **Documentación**
   - Mejor documentación de comandos disponibles
   - Más fácil de mantener la documentación actualizada

3. **Rendimiento**
   - Posible mejora en el tiempo de carga de la extensión
   - Mejor gestión de recursos

4. **Desarrollo**
   - Más fácil añadir nuevos comandos
   - Mejor estructura para testing
   - Más fácil de debuggear

### 5. Consideraciones

1. **Compatibilidad**
   - Mantener compatibilidad con versiones existentes
   - No romper funcionalidad existente

2. **Testing**
   - Asegurar que todos los comandos funcionan después de la migración
   - Añadir tests para nuevos comandos

3. **Documentación**
   - Actualizar la documentación de la API
   - Documentar la nueva estructura

## Siguientes Pasos

1. Revisar y aprobar el plan
2. Crear la nueva estructura de directorios
3. Comenzar con la migración por categorías
4. Realizar pruebas exhaustivas
5. Actualizar documentación 