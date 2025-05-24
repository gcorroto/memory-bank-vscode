# Diagramas de la Arquitectura de Grec0AI

Este documento contiene diagramas explicativos para entender los principales procesos y la arquitectura de la extensión Grec0AI For Developers.

## Arquitectura General de la Extensión

Este diagrama muestra la estructura general de la extensión y cómo se relacionan sus diferentes componentes.

```mermaid
flowchart TD
    A[Grec0AI For Developers] --> B[Núcleo de la Extensión]
    A --> C[Servicios de IA]
    A --> D[Interfaz de Usuario]
    
    B --> B1[Gestor de Configuración]
    B --> B2[Sistema de Archivos]
    B --> B3[Gestor de Comandos]
    
    C --> C1[OpenAI Service]
    C --> C2[RAG Service]
    C --> C3[Vectra Service]
    C --> C4[Agent System]
    
    D --> D1[Panel de Actividad]
    D --> D2[Comandos de Editor]
    D --> D3[Vistas de Cobertura]
    
    D1 --> D11[Árbol de Archivos]
    D1 --> D12[Resumen de Cobertura]
    D1 --> D13[Detalles]
    
    C4 --> C41[Context Manager]
    C4 --> C42[Agent Core]
    C4 --> C43[Tool Manager]
    C4 --> C44[Workspace Manager]
    C4 --> C45[Database Manager]
```

## Flujo de Trabajo de AutoFixer

Este diagrama detalla el proceso de funcionamiento de la característica AutoFixer.

```mermaid
sequenceDiagram
    participant Usuario
    participant VSCode
    participant AutoFixer
    participant Agent
    participant Files

    Usuario->>VSCode: Abre workspace
    VSCode->>AutoFixer: Activa la extensión
    AutoFixer->>AutoFixer: Verifica si está habilitado
    AutoFixer->>Files: Busca autofixer.md
    Files-->>AutoFixer: Devuelve contenido
    
    alt Modo Automático
        AutoFixer->>Agent: Envía instrucciones
        Agent->>Agent: Planifica ejecución
        Agent->>Files: Lee/Modifica archivos
        Agent->>AutoFixer: Reporta resultados
        AutoFixer->>VSCode: Muestra logs
    else Modo No Automático
        Usuario->>VSCode: Ejecuta comando manualmente
        VSCode->>AutoFixer: Solicita ejecución
        AutoFixer->>Agent: Envía instrucciones
        Agent->>Agent: Planifica ejecución
        Agent->>Files: Lee/Modifica archivos
        Agent->>AutoFixer: Reporta resultados
        AutoFixer->>VSCode: Muestra resultados
    end
```

## Proceso de Generación de Tests con IA

Este diagrama muestra el ciclo de generación y mejora de tests unitarios usando IA.

```mermaid
flowchart LR
    A[Selección de Archivo] --> B[Generación Inicial\nde Test]
    B --> C{¿Test compila?}
    C -->|No| D[Retroalimentación\nde Error]
    C -->|Sí| E{¿Test pasa?}
    D --> B
    E -->|No| F[Análisis de\nError]
    E -->|Sí| G{¿Cobertura\nsuficiente?}
    F --> B
    G -->|No| H[Mejora de\nCobertura]
    G -->|Sí| I[Test\nFinalizado]
    H --> B
```

## Arquitectura basada en Agentes (II-Agent)

Este diagrama detalla la arquitectura del sistema de agentes inteligentes.

```mermaid
flowchart TD
    A[II-Agent] --> B[Agent Core]
    A --> C[Context Manager]
    A --> D[Tool Manager]
    A --> E[Workspace Manager]
    A --> F[Database Manager]
    
    B --> B1[Planning System]
    B --> B2[Reasoning System]
    B --> B3[Execution System]
    B --> B4[Reflection System]
    
    D --> D1[File Tools]
    D --> D2[Terminal Tools]
    D --> D3[AI Tools]
    
    D1 --> D11[ReadFileTool]
    D1 --> D12[WriteFileTool]
    
    D2 --> D21[ExecuteCommandTool]
    
    D3 --> D31[GenerateTestTool]
    D3 --> D32[FixErrorTool]
    D3 --> D33[AnalyzeCodeTool]
    
    C --> C1[Token Management]
    C --> C2[History Management]
    
    E --> E1[Isolated Workspaces]
    
    F --> F1[Logs]
    F --> F2[Events]
```

## Proceso de Consulta RAG (Retrieval Augmented Generation)

Este diagrama ilustra cómo funciona el sistema RAG para mejorar las respuestas del asistente MacGyver.

```mermaid
sequenceDiagram
    participant Usuario
    participant PromptComposer
    participant RAGService
    participant VectraService
    participant OpenAIService
    
    Usuario->>PromptComposer: Consulta (userQuery)
    PromptComposer->>RAGService: Solicita contexto relevante
    RAGService->>VectraService: Busca documentos similares
    VectraService-->>RAGService: Devuelve fragmentos relevantes
    RAGService-->>PromptComposer: Envía DocChunks
    
    PromptComposer->>PromptComposer: Construye prompt completo
    PromptComposer->>OpenAIService: Envía prompt enriquecido
    OpenAIService-->>Usuario: Respuesta con contexto
```

## Arquitectura del PromptComposer

Este diagrama muestra cómo se construyen los prompts para MacGyver.

```mermaid
flowchart TD
    A[buildPrompt] --> B[Carga System Prompt]
    A --> C[Carga Tools Prompt]
    A --> D{¿Existen Rules?}
    A --> E{¿Hay DocChunks?}
    
    D -->|Sí| F[Carga Rules]
    D -->|No| G[Skip Rules]
    
    E -->|Sí| H[Formatea DocChunks]
    E -->|No| I[Skip DocChunks]
    
    B & C & F & G & H & I --> J[Concatena Componentes]
    J --> K[Prompt Final]
```