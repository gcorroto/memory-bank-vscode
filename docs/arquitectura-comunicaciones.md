# Arquitectura de Comunicaciones - Autofixer Extension

## 1. Visión General

Este documento detalla la arquitectura de comunicaciones de la extensión Autofixer para VSCode, una plataforma que permite integrar capacidades de IA en el editor para mejorar la productividad de los desarrolladores.

El sistema integra las siguientes tecnologías clave:

- **VSCode API**: Proporciona las interfaces para interactuar con el editor.
- **OpenAI API**: Ofrece los modelos de IA para análisis de código, generación de tests y otras funcionalidades.
- **Sistema de Agentes**: Arquitectura basada en agentes para orquestar las operaciones de IA.
- **Servicios RAG**: Recuperación aumentada por generación para mejorar respuestas con contexto específico.

```mermaid
graph TB
    subgraph "Autofixer Extension"
    BE[Extension Core]
    end
    
    DEV[Desarrollador] --> BE
    BE <--> VSC[VSCode API]
    BE <--> OAI[OpenAI API]
    BE --> RAG[Servicios RAG]
    BE --> FS[Sistema de Archivos]
```

## 2. Componentes Principales

### 2.1. VSCode Extension API

- **Definición**: API que permite a la extensión interactuar con el entorno de VSCode.
- **Características**:
  - Gestión de comandos y eventos
  - Manipulación de documentos y editores
  - Creación de interfaces de usuario (vistas, paneles)
  - Gestión de configuraciones y preferencias

### 2.2. Sistema de Agentes

- **Definición**: Arquitectura que organiza las funcionalidades de IA en componentes modulares.
- **Componentes clave**:
  - **Agent Core**: Coordinador central de operaciones
  - **AgentToolManager**: Gestiona las herramientas disponibles para el agente
  - **ContextManager**: Mantiene el contexto de la conversación y operaciones
  - **WorkspaceManager**: Interactúa con el workspace de VSCode
  - **Tools**: Conjunto de herramientas para análisis y generación de código

### 2.3. Servicios IA

- **Definición**: Componentes que gestionan la comunicación con APIs de IA.
- **Componentes principales**:
  - **OpenAI Service**: Interfaz con la API de OpenAI
  - **Vectra Service**: Servicio para indexación y búsqueda vectorial
  - **RAG Service**: Sistema de recuperación aumentada por generación
  - **ConfigManager**: Gestión de configuraciones de servicios IA

### 2.4. Sistema de Comandos

- **Definición**: Estructura centralizada para registrar y ejecutar comandos.
- **Características**:
  - Organización por categorías funcionales
  - Gestión unificada de registros y disposables
  - Compatibilidad con comandos legacy y nuevos

### 2.5. Proveedores de Vista

- **Definición**: Componentes que proporcionan visualizaciones en la interfaz de VSCode.
- **Tipos**:
  - TreeView para estructura de archivos
  - Vistas de resumen de cobertura
  - Vistas de detalles y logs

## 3. Diagrama de Componentes Detallado

```mermaid
flowchart TB
    subgraph VSCode["Entorno VSCode"]
        API[VSCode API]
        EDITOR[Editor]
        UI[UI Components]
        CONFIG[Configuration]
    end
    
    subgraph Extension["Autofixer Extension"]
        CORE[Extension Core]
        
        subgraph Agent["Sistema de Agentes"]
            AGENT[Agent Core]
            ATM[AgentToolManager]
            CM[ContextManager]
            WM[WorkspaceManager]
            DM[DatabaseManager]
        end
        
        subgraph Services["Servicios"]
            OPENAI[OpenAI Service]
            VECTRA[Vectra Service]
            RAG[RAG Service]
            CONFIGM[Config Manager]
        end
        
        subgraph Views["Vistas"]
            TREE[File Tree Provider]
            SUMMARY[Coverage Summary]
            DETAILS[Coverage Details]
            LOGS[Agent Logs View]
        end
        
        subgraph Commands["Sistema de Comandos"]
            CMD[Command Registry]
            AGENT_CMD[Agent Commands]
            FS_CMD[Filesystem Commands]
            COV_CMD[Coverage Commands]
            RAG_CMD[RAG Commands]
            UI_CMD[UI Commands]
        end
        
        subgraph Tools["Herramientas"]
            READ[Read File Tool]
            WRITE[Write File Tool]
            FIX[Fix Error Tool]
            TEST[Generate Test Tool]
            ANALYZE[Analyze Code Tool]
            EXEC[Execute Command Tool]
        end
    end
    
    subgraph External["Servicios Externos"]
        OPENAICLD[OpenAI Cloud]
        FILESYSTEM[Sistema de Archivos]
    end
    
    %% Conexiones con VSCode
    API <--> CORE
    EDITOR <--> CORE
    UI <--> VIEWS
    CONFIG <--> CONFIGM
    
    %% Conexiones internas
    CORE --> CMD
    CORE --> AGENT
    CORE --> SERVICES
    CORE --> VIEWS
    
    CMD --> AGENT_CMD
    CMD --> FS_CMD
    CMD --> COV_CMD
    CMD --> RAG_CMD
    CMD --> UI_CMD
    
    AGENT <--> ATM
    AGENT <--> CM
    AGENT <--> WM
    AGENT <--> DM
    
    ATM <--> TOOLS
    
    %% Conexiones con servicios
    OPENAI <--> OPENAICLD
    WM <--> FILESYSTEM
    RAG <--> VECTRA
    
    %% Conexiones de comandos a funcionalidad
    AGENT_CMD --> AGENT
    FS_CMD --> WM
    COV_CMD --> SUMMARY
    RAG_CMD --> RAG
    UI_CMD --> LOGS
```

## 4. Flujo de Comunicación

### 4.1. Activación de la Extensión

```mermaid
sequenceDiagram
    participant VSCode
    participant Extension
    participant Services
    participant Agent
    participant Views
    participant Commands

    VSCode->>Extension: activate(context)
    activate Extension
    
    Extension->>Extension: loadDynamicModules()
    
    Extension->>Views: registerTreeDataProvider()
    Views-->>Extension: Providers registered
    
    Extension->>Commands: registerAllCommands()
    activate Commands
    Commands-->>Extension: Command disposables
    deactivate Commands
    
    Extension->>Services: configManager.isConfigComplete()
    Services-->>Extension: Config status
    
    alt Config complete
        Extension->>Services: openaiService.initialize()
        Services-->>Extension: Initialization result
    end
    
    Extension->>Agent: initializeAgentSystem(context)
    activate Agent
    
    Agent->>Agent: createAgent('Grec0AI', context)
    Agent->>Agent: agent.initialize()
    Agent->>Agent: registerAgentCommands()
    
    Agent-->>Extension: Agent initialized
    deactivate Agent
    
    Extension->>Extension: checkAndProcessAutofixerMd()
    
    Extension-->>VSCode: Extension activated
    deactivate Extension
```

### 4.2. Flujo de Comando de Generación de Tests

```mermaid
sequenceDiagram
    actor Usuario
    participant VSCode
    participant Commands
    participant Agent
    participant Services
    participant FileSystem

    Usuario->>VSCode: Ejecuta comando "Generate Test"
    VSCode->>Commands: Invoca handler registrado
    
    Commands->>Agent: handleAutomaticTestWithAgent(reasoning)
    activate Agent
    
    Agent->>VSCode: window.withProgress()
    
    Agent->>Agent: getWorkspaceFolders()
    
    Agent->>Agent: prepareContext()
    
    Agent->>Agent: agent.handleUserInput(request, context)
    activate Agent
    
    Agent->>Services: openaiService.generateCompletion()
    activate Services
    Services->>Services: RAG/OpenAI processing
    Services-->>Agent: Generated content
    deactivate Services
    
    Agent->>FileSystem: Create test file
    FileSystem-->>Agent: File created
    
    Agent-->>Agent: Test generated
    deactivate Agent
    
    Agent-->>Commands: Result with success status
    deactivate Agent
    
    Commands->>VSCode: Show information message
    
    VSCode-->>Usuario: Notificación de éxito
```

### 4.3. Flujo de Procesamiento de Autofixer.md

```mermaid
sequenceDiagram
    participant Extension
    participant Agent
    participant FileSystem
    participant Services
    participant LogsView

    Extension->>Extension: checkAndProcessAutofixerMd()
    activate Extension
    
    Extension->>FileSystem: Check for autofixer.md
    FileSystem-->>Extension: File exists
    
    Extension->>FileSystem: Read file content
    FileSystem-->>Extension: File content
    
    Extension->>Agent: getGlobalAgent(true)
    Agent-->>Extension: Agent instance
    
    Extension->>LogsView: createNewSession('AutoFixer')
    LogsView-->>Extension: Session ID
    
    Extension->>LogsView: show()
    Extension->>LogsView: setActiveSession(sessionId)
    Extension->>LogsView: addReflectionLog()
    
    Extension->>Agent: handleUserInput(request, context)
    activate Agent
    
    Agent->>Services: Process with AI
    Services-->>Agent: AI response
    
    Agent->>FileSystem: Apply changes
    FileSystem-->>Agent: Changes applied
    
    Agent-->>Extension: Task result
    deactivate Agent
    
    Extension->>LogsView: addStepLog()
    
    Extension-->>Extension: Processed successfully
    deactivate Extension
```

## 5. Interfaces y Protocolos

### 5.1. Interfaz Extension <-> VSCode API

- **Commands API**:
  - Registro de comandos a través de `vscode.commands.registerCommand`
  - Ejecución mediante `vscode.commands.executeCommand`
  - Disposables para gestión de ciclo de vida

- **View API**:
  - TreeDataProviders para vistas personalizadas
  - WebView para interfaces complejas
  - OutputChannel para logs y mensajes

- **Workspace API**:
  - Acceso a archivos mediante `vscode.workspace.fs`
  - Manejo de configuraciones con `vscode.workspace.getConfiguration`
  - Eventos de cambio en archivos y configuración

### 5.2. Interfaz Extension <-> OpenAI

- **REST API**:
  - Autenticación mediante API key
  - Solicitudes HTTP para completions y embeddings
  - Gestión de modelos y parámetros

- **Formato de mensajes**:
  - Sistema de roles (system, user, assistant)
  - Soporte para herramientas y funciones
  - Manejo de contexto y tokens

### 5.3. Interfaz de Sistema de Agentes

- **Agent Core API**:
  - Método principal `handleUserInput` para procesar solicitudes
  - Gestión de herramientas mediante AgentToolManager
  - Sistema de pasos con reflection y planning

- **Tool Interface**:
  - Método `execute` estandarizado
  - Sistema de tipos para parámetros y resultados
  - Documentación para uso por IA

## 6. Consideraciones Técnicas

### 6.1. Gestión de Configuración

- **Almacenamiento seguro**: Las claves API se guardan en el almacenamiento seguro de VSCode
- **Configuración por workspace**: Opciones específicas por proyecto
- **Configuración global**: Preferencias a nivel de usuario

### 6.2. Manejo de Errores

- **Sistema de retry**: Para fallos de comunicación con OpenAI
- **Degradación graceful**: Alternativas cuando servicios avanzados no están disponibles
- **Mensajes descriptivos**: Información clara sobre errores para el usuario

### 6.3. Optimización de Rendimiento

- **Lazy loading**: Carga diferida de módulos pesados
- **Caché de respuestas**: Para reducir llamadas a OpenAI
- **Procesamiento asíncrono**: Para mantener la responsividad de la UI

## 7. Flujos de Integración

### 7.1. Flujo de Análisis de Código

```mermaid
graph TD
    A[Editor de Código] -->|Selección de código| B[Comando Analyze]
    B --> C{Tipo de análisis}
    C -->|Análisis completo| D[Llamada al agente]
    C -->|Diagnóstico rápido| E[Llamada directa a OpenAI]
    C -->|Explicación simple| F[Llamada con RAG]
    
    D --> G[Planning de análisis]
    G --> H[Ejecución de herramientas]
    H --> I[Generación de informe]
    
    E --> J[Procesamiento simplificado]
    
    F --> K[Búsqueda de contexto]
    K --> L[Generación con contexto]
    
    I --> M[Vista de resultados]
    J --> M
    L --> M
```

### 7.2. Flujo de Generación de Tests

```mermaid
graph TD
    A[Archivo de código] -->|Comando Generate Test| B[Preparación]
    B --> C[Obtener path de test]
    C --> D{Test existe?}
    
    D -->|No| E[Crear archivo test]
    D -->|Sí| F[Leer test existente]
    
    E --> G[Solicitar nivel de razonamiento]
    F --> G
    
    G --> H{Método?}
    
    H -->|RAG| I[RAG Service]
    H -->|Directo| J[OpenAI Service]
    
    I --> K[Escribir archivo test]
    J --> K
    
    K --> L[Actualizar vista de detalles]
    L --> M[Ejecutar tests]
    
    M --> N{Resultado}
    N -->|Éxito| O[Mostrar cobertura]
    N -->|Fallo| P[Ofrecer regeneración]
    
    P -->|Regenerar| B
```

## 8. Conclusiones

La arquitectura de comunicaciones de la extensión Autofixer representa una solución compleja y robusta para integrar capacidades de IA en el entorno de desarrollo VSCode. El diseño modular permite:

- **Extensibilidad**: Fácil adición de nuevas funcionalidades y herramientas
- **Mantenibilidad**: Separación clara de responsabilidades
- **Rendimiento**: Optimización de recursos y carga diferida
- **Experiencia de usuario**: Interfaz fluida y responsive

La extensión aprovecha las capacidades de la API de VSCode y las combina con tecnologías avanzadas de IA para crear una herramienta potente que mejora significativamente la productividad de los desarrolladores.

## 9. Casos de Uso Principales

Los siguientes diagramas muestran los principales casos de uso de la extensión Autofixer:

### 9.1. Flujo de Trabajo de Desarrollo con Autofixer

```mermaid
graph LR
    subgraph "Ciclo de Desarrollo"
        A[Escribir Código] --> B[Ejecutar Autofixer]
        B --> C[Revisar Sugerencias]
        C --> D[Aplicar Cambios]
        D --> A
    end
    
    subgraph "Interacciones Autofixer"
        B --> E[Análisis de Código]
        B --> F[Generación de Tests]
        B --> G[Documentación]
        B --> H[Corrección de Errores]
    end
    
    E --> I[Sugerencias de Mejora]
    F --> J[Tests Unitarios]
    G --> K[Comentarios y Docs]
    H --> L[Código Corregido]
    
    I --> C
    J --> C
    K --> C
    L --> C
```

### 9.2. Integración con Flujo de Trabajo en Equipo

```mermaid
graph TD
    A[Repositorio Git] -->|Pull| B[Workspace Local]
    B -->|Edición| C[Código Modificado]
    
    C -->|Ejecutar Autofixer| D[Autofixer Extension]
    D -->|Analizar| E[Análisis de Calidad]
    D -->|Generar Tests| F[Tests Unitarios]
    
    E -->|Aplicar Sugerencias| G[Código Mejorado]
    F -->|Ejecutar Tests| H[Verificación]
    
    G -->|Commit| I[Cambios Listos]
    H -->|Tests Pasan| I
    
    I -->|Push| A
``` 