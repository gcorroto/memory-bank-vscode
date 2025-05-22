# Plan de Acción: Migración a OpenAI directo + Vectra RAG

## Objetivo
Reemplazar las llamadas a API externa actual por llamadas directas a OpenAI utilizando su SDK oficial (`openai`), e implementar un motor de conocimiento local usando Vectra para RAG (Retrieval-Augmented Generation).

## Fases de Implementación

### Fase 1: Preparación y Auditoría
1. **Instalar dependencias necesarias**
   - OpenAI SDK: `npm install openai`
   - Vectra: `npm install vectra`

2. **Auditar el código actual**
   - Identificar todas las llamadas a la API externa en la extensión
   - Documentar los endpoints utilizados y la información enviada/recibida
   - Evaluar los modelos de datos actuales

### Fase 2: Implementación de Servicios Base

1. **Servicio OpenAI (`openaiService.js`)**
   - Crear clase para gestionar la conexión con OpenAI
   - Implementar métodos para diferentes tipos de operaciones:
     - Generación de texto/código
     - Obtención de embeddings para vectorización
     - Chat completions para diálogos
   - Gestión de la clave API de forma segura

2. **Servicio Vectra (`vectraService.js`)**
   - Crear clase para gestionar el índice vectorial local
   - Implementar métodos para:
     - Crear/inicializar el índice
     - Indexar código fuente (por archivo/función)
     - Realizar consultas semánticas
     - Actualizar el índice cuando el código cambia

3. **Servicio RAG (`ragService.js`)**
   - Crear lógica para combinar Vectra y OpenAI:
     - Consultar Vectra para obtener contexto relevante
     - Enriquecer los prompts a OpenAI con este contexto
     - Procesar y formatear las respuestas

### Fase 3: Refactorización de la Extensión

1. **Refactorizar generación de tests**
   - Reemplazar llamadas a API externa por servicios locales
   - Adaptar la lógica de retroalimentación y mejora continua

2. **Refactorizar análisis de código**
   - Integrar RAG para mejorar las sugerencias de seguridad y calidad
   - Implementar análisis local donde sea posible

3. **Refactorizar resolución de errores**
   - Utilizar RAG para proporcionar soluciones más precisas
   - Mejorar la contextualización de errores

4. **Actualizar UI y comandos**
   - Asegurar que todos los comandos funcionan con la nueva implementación
   - Adaptar mensajes y flujos de usuario

### Fase 4: Testing y Optimización

1. **Pruebas funcionales**
   - Verificar cada funcionalidad de la extensión
   - Comprobar rendimiento y latencia

2. **Optimización**
   - Ajustar prompts y parámetros para mejorar resultados
   - Optimizar indexación de código para reducir uso de memoria

3. **Documentación**
   - Actualizar documentación técnica
   - Actualizar README con nuevas funcionalidades/cambios

## Implementación Detallada

### Estructura de Archivos

```
/src
  /services
    openaiService.js     # Servicios para interactuar con OpenAI
    vectraService.js     # Servicios para gestionar índices vectoriales
    ragService.js        # Servicio para combinar Vectra y OpenAI
  /utils
    promptUtils.js       # Utilidades para gestión de prompts
    configManager.js     # Gestión de configuración (API keys, etc.)
```

### Configuración de la Extensión

Añadir opciones de configuración:
- API Key de OpenAI
- Modelo a utilizar (por defecto: gpt-4o)
- Configuración del índice Vectra (ubicación, metadatos a indexar)
- Umbral de similitud para consultas RAG

### Consideraciones de Seguridad

- La API Key de OpenAI debe almacenarse de forma segura
- Permitir configuración para uso con Azure OpenAI Service como alternativa
- Opciones para limitar uso de tokens/costes

## Implementación Progresiva

Para facilitar la transición, se recomienda un enfoque progresivo:

1. Primero implementar OpenAI directo (sin RAG)
2. Luego añadir Vectra para características específicas
3. Finalmente, integrar RAG completo en todas las funcionalidades

## Métricas de Éxito

- Reducción de latencia en operaciones
- Mejora en la calidad de los tests generados
- Mayor precisión en la resolución de errores
- Funcionamiento offline (parcial) para algunas operaciones 