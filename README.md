# Grec0AI For Developers

## Visión General

Grec0AI For Developers es una extensión avanzada para Visual Studio Code que integra capacidades de inteligencia artificial para automatizar y mejorar el desarrollo de software, enfocándose en:

* **Generación automática de tests unitarios**
* **Resolución inteligente de errores**
* **Análisis de calidad de código**
* **Mejora de cobertura de código**
* **Arquitectura basada en agentes inteligentes**

La extensión trabaja directamente con el sistema de archivos local para proporcionar un flujo completo de desarrollo de alta calidad, utilizando una arquitectura avanzada de agentes IA para descomponer y resolver tareas complejas.

![Screenshot de la extensión](https://github.com/Grec0AI/grec0ai-vscode/raw/master/resources/grec0ai-vscode-screenshot.png)

## Características Principales

### 🤖 Generación de Tests con IA

La característica más potente de Grec0AI For Developers es la capacidad de **generar automáticamente tests unitarios** utilizando inteligencia artificial:

* **Generación con un clic**: Crea tests unitarios completos y funcionales para tus archivos de código.
* **Análisis contextual**: La IA analiza tu código fuente para entender su funcionalidad y generar tests relevantes.
* **Modos de generación**:
  * **Modo Rápido**: Generación veloz de tests básicos.
  * **Modo Razonamiento**: Generación avanzada con diferentes niveles de computación (bajo, medio, alto).
* **Ciclo de retroalimentación**: Si los tests generados fallan o no alcanzan la cobertura deseada, la IA los mejora automáticamente.

### 🛠️ Resolución Automática de Errores

La extensión puede analizar errores en tu código y sugerir soluciones:

* **Análisis de stacktraces**: Identifica la raíz de los errores en la ejecución de tests.
* **Sugerencias contextuales**: Propone soluciones específicas para tus errores.
* **Corrección automática**: Implementa las correcciones con tu aprobación.

### 📊 Análisis de Cobertura de Código

* **Visualización de cobertura**: Interfaz gráfica para revisar la cobertura de código.
* **Mejora automática**: Identifica áreas con baja cobertura y genera tests adicionales.
* **Estándares de calidad**: Asegura que tu código cumple con el mínimo de cobertura requerido (70%).

### 🔒 Seguridad y Calidad de Código

* **Detección de vulnerabilidades**: Identifica problemas de seguridad (Inyección SQL, XSS, CSRF, etc.).
* **Cumplimiento de estándares**: Verifica la conformidad con CWE, OWASP, CERT, SANS-Top25, PCI-DSS, NIST, MISRA, etc.
* **Prevención automática de errores**: Detecta problemas de código antes de que lleguen a producción.

### 🚀 AutoFixer - Ejecución Automática

AutoFixer permite ejecutar instrucciones de forma automática al abrir el workspace:

* **Desatendido**: Ejecuta instrucciones sin intervención del usuario al iniciar VSCode/Code Server.
* **Basado en archivos**: Lee instrucciones desde un archivo `autofixer.md` en la raíz del proyecto.
* **CI/CD integrado**: Ideal para entornos de integración continua, contenedores y despliegues automáticos.

[Documentación completa de AutoFixer](docs/autofixer.md)

## Requisitos

* Visual Studio Code v1.40.0 o superior.
* Nodejs v12.0.0 o superior para ejecutar tests generados.

## Configuración Rápida

### 1. Configuración del Proyecto

Abre la configuración de VS Code (`Ctrl+,`) y navega a `Extensiones > Grec0AI`:

* Configura la carpeta raíz del proyecto si es diferente de la raíz del workspace.
* Personaliza los patrones de exclusión si necesitas ignorar carpetas adicionales.

### 2. Configuración de Tests

Para aprovechar la generación automática de tests, configura:

* Framework de tests (`grec0ai.test.framework`): jasmine, jest o mocha
* Umbral mínimo de cobertura (`grec0ai.test.coverage.minimumThreshold`)

## Uso de Generación de Tests con IA

### Método 1: Generación Individual

1. Abre un archivo fuente (por ejemplo, un archivo .ts).
2. Haz clic derecho y selecciona "Automatic Test" en el menú contextual.
3. Selecciona el modo (Rápido o Razonamiento).
4. Si eliges Razonamiento, selecciona el nivel de computación (bajo, medio, alto).
5. Opcionalmente, añade instrucciones específicas para la IA.
6. ¡Listo! La IA generará un archivo de test correspondiente (.spec.ts).

### Método 2: Automatización Masiva

1. Ejecuta el comando `Grec0AI: Automatic Test`.
2. Selecciona el modelo (Rápido o Razonamiento).
3. Elige la carpeta raíz del proyecto.
4. La extensión identificará todos los archivos que necesitan tests y los generará automáticamente.
5. Verifica los resultados en el panel de salida.

## Ciclo de Mejora Continua con IA

La extensión implementa un ciclo de retroalimentación para mejorar constantemente los tests:

1. **Generación**: La IA crea un test inicial basado en tu código fuente.
2. **Ejecución**: El test se ejecuta automáticamente.
3. **Evaluación**: Se verifica si hay errores de compilación, ejecución o cobertura insuficiente.
4. **Retroalimentación**: Si hay problemas, se informa a la IA con detalles específicos.
5. **Regeneración**: La IA mejora el test basándose en la retroalimentación.
6. **Verificación**: El ciclo continúa hasta que el test funcione correctamente y alcance la cobertura mínima.

## Panel de Actividad Grec0AI

La extensión añade un nuevo icono en la barra de actividades con tres secciones:

### Archivos del Proyecto

Muestra una estructura jerárquica de los archivos en tu proyecto, permitiéndote navegar fácilmente y seleccionar archivos para análisis o generación de tests.

### Resumen de Cobertura

Muestra información detallada sobre la cobertura de código de los archivos seleccionados, incluyendo líneas cubiertas/no cubiertas y funciones testeadas.

### Detalles

Información detallada sobre el elemento seleccionado y opciones para resolverlo automáticamente.

## Arquitectura Basada en Agentes (II-Agent)

Grec0AI For Developers implementa una arquitectura avanzada basada en agentes siguiendo los principios de II-Agent, que permite al sistema planificar, razonar y descomponer tareas complejas manteniendo conciencia del contexto.

### Componentes Principales

#### Núcleo del Agente
* **Agent Core**: Orquesta la planificación, razonamiento y ejecución de herramientas
* **Context Manager**: Gestiona tokens y mantiene el historial de conversaciones
* **Tool Manager**: Selecciona y ejecuta herramientas basadas en la tarea
* **Workspace Manager**: Proporciona espacios de trabajo aislados para cada sesión
* **Database Manager**: Persiste eventos e historiales para trazabilidad

#### Sistema de Herramientas Modulares
* **Herramientas de Sistema de Archivos**: `ReadFileTool` y `WriteFileTool` para operaciones de archivos
* **Herramientas de Terminal**: `ExecuteCommandTool` para ejecución de comandos
* **Herramientas de IA**: `GenerateTestTool`, `FixErrorTool`, `AnalyzeCodeTool`

#### Observabilidad
* **AgentLogsView**: Visualización del razonamiento del agente
* **Logs del Agente**: Comando `grec0ai.agent.showLogs` para ver los logs detallados
* **Registro de Planes**: Documentación de pasos de planificación, ejecución y reflexión

### Cómo Funciona
1. El usuario emite una solicitud a través de un comando
2. El agente planifica la ejecución dividiéndola en pasos
3. Cada paso selecciona la herramienta apropiada con los parámetros necesarios
4. Las herramientas se ejecutan y los resultados se añaden al contexto
5. El agente reflexiona sobre la ejecución y proporciona retroalimentación
6. Los logs y el estado se mantienen para su inspección

## Comandos Útiles

* `Grec0AI: Automatic Test`: Inicia la generación automática de tests para una carpeta.
* `Grec0AI: Refresh File Tree`: Actualiza el árbol de archivos del proyecto.
* `Grec0AI: Fix with Grec0AI`: Solicita a la IA que corrija un defecto o mejore el código seleccionado.
* `Grec0AI: Explain Code`: Solicita a la IA que explique el código seleccionado.
* `Grec0AI: Preguntar a MacGyver`: Realiza consultas al asistente "MacGyver" con estilo andaluz para resolver dudas de programación.
* `Grec0AI: Agent Show Logs`: Muestra los logs detallados del agente y su razonamiento.
* `Grec0AI: Agent Execute Task`: Ejecuta una tarea compleja a través del agente inteligente.

## Soporte y Licencia

Si encuentras problemas al utilizar la extensión, visita nuestro repositorio en GitHub para reportar issues o contribuir al proyecto.

Esta extensión está licenciada bajo los términos de licencia MIT.
