# Grec0AI For Developers (K4D)

## Visión General

Grec0AI For Developers (K4D) es una extensión avanzada para Visual Studio Code que integra capacidades de inteligencia artificial para automatizar y mejorar el desarrollo de software, enfocándose en:

* **Generación automática de tests unitarios**
* **Resolución inteligente de errores**
* **Análisis de seguridad y calidad de código**
* **Mejora de cobertura de código**

La extensión se conecta con los servicios de Kiuwan y Jenkins para proporcionar un flujo completo de desarrollo seguro y de alta calidad.

![Screenshot de la extensión](https://github.com/Grec0AI/k4d-vscode/raw/master/resources/k4d-vscode-screenshot.png)

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

## Requisitos

* Una cuenta válida de Grec0AI/Kiuwan con permisos adecuados.
* Visual Studio Code v1.40.0 o superior.
* Nodejs v12.0.0 o superior para ejecutar tests generados.
* Acceso a internet para comunicación con la API de Grec0AI.

## Configuración Rápida

### 1. Configuración de Conexión

Abre la configuración de VS Code (`Ctrl+,`) y navega a `Extensiones > Grec0AI`:

* Completa tu nombre de usuario y contraseña.
* Para instalaciones on-premise, marca la casilla `Customize Grec0AI server` y modifica la URL.

> **Consejo**: Usa el comando `K4D: Enter and Encrypt Password` para almacenar tu contraseña de manera segura.

### 2. Configuración de la Aplicación

Vincula tu carpeta/workspace local con una aplicación de Grec0AI:

* Completa el campo `Remote Application Name` o usa el comando `K4D: Pick Remote Application`.
* Configura la fuente de análisis de defectos (análisis de línea base, plan de acción, entrega de auditoría, etc.).

### 3. Configuración de Jenkins y Tests

Para aprovechar la generación automática de tests, configura:

* Ubicación del proyecto (`PROJECT_FOLDER`)
* Lenguaje de programación (`LANG_CODE`)
* Framework principal (`FRAMEWORK_NAME` y `FRAMEWORK_VER`)
* Framework de tests (`FRAMEWORK_TEST`)
* URL y JWT para la API de Grec0AI

## Uso de Generación de Tests con IA

### Método 1: Generación Individual

1. Abre un archivo fuente (por ejemplo, un archivo .ts).
2. Haz clic derecho y selecciona "Inicializar tests con Grec0AI" o usa el atajo de teclado.
3. Selecciona el modo (Rápido o Razonamiento).
4. Si eliges Razonamiento, selecciona el nivel de computación (bajo, medio, alto).
5. Opcionalmente, añade instrucciones específicas para la IA.
6. ¡Listo! La IA generará un archivo de test correspondiente (.spec.ts).

### Método 2: Automatización Masiva

1. Ejecuta el comando `K4D: Automatic Test`.
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

### Análisis de Código

Muestra una visión general de la configuración de tu aplicación y estadísticas globales de defectos.

### Lista de Defectos

Estructura jerárquica de defectos detectados, organizados por regla, defecto y ruta de propagación.

### Detalles

Información detallada sobre el elemento seleccionado y opciones para resolverlo automáticamente.

## Comandos Útiles

* `K4D: Automatic Test`: Inicia la generación automática de tests para una carpeta.
* `K4D: Check Connection`: Verifica la conexión con el servidor de Grec0AI.
* `K4D: Refresh Grec0AI Defects`: Actualiza la lista de defectos.
* `K4D: Enter and Encrypt Password`: Configura tu contraseña de forma segura.
* `K4D: Fix with Grec0AI`: Solicita a la IA que corrija un defecto seleccionado.

## Soporte y Licencia

Si encuentras problemas al utilizar la extensión, utiliza los canales oficiales de soporte de Grec0AI.

Para términos de uso, consulta [Términos de Uso de Grec0AI](https://www.grecoai.com/terms-of-use).
