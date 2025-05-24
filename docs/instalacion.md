# Guía de Instalación de Grec0AI For Developers

## Métodos de Instalación

Grec0AI For Developers es una extensión para Visual Studio Code que puede instalarse a través de diferentes métodos según tus preferencias y requisitos.

### 1. Instalación desde VS Code Marketplace

La forma más sencilla de instalar la extensión es a través del Marketplace de Visual Studio Code:

1. Abre Visual Studio Code
2. Haz clic en el icono de extensiones en la barra lateral izquierda (o presiona `Ctrl+Shift+X`)
3. En el cuadro de búsqueda, escribe `Grec0AI for Developers`
4. Haz clic en el botón "Instalar" en la extensión de Grec0AI
5. Una vez completada la instalación, haz clic en "Recargar" para activar la extensión

### 2. Instalación Manual desde Archivo VSIX

Si necesitas instalar la extensión manualmente (por ejemplo, en entornos sin acceso directo a internet o para una versión específica), puedes hacerlo a través del archivo VSIX:

1. Descarga el archivo `.vsix` de la extensión desde el [repositorio oficial](https://github.com/gcorroto/autofixer_extension/releases) o el proporcionado por tu equipo
2. En Visual Studio Code, ve a la pestaña de extensiones (presiona `Ctrl+Shift+X`)
3. Haz clic en el icono "..." (más opciones) en la parte superior del panel de extensiones
4. Selecciona "Instalar desde VSIX..."
5. Navega hasta la ubicación donde guardaste el archivo `.vsix` y selecciónalo
6. Una vez completada la instalación, haz clic en "Recargar" para activar la extensión

### 3. Instalación desde la Línea de Comandos

También puedes instalar la extensión utilizando la interfaz de línea de comandos de VS Code:

```bash
# Instalar desde el Marketplace
code --install-extension grec0ai.grec0ai-vscode

# Instalar desde un archivo VSIX local
code --install-extension ruta/a/grec0ai-vscode-3.0.0.vsix
```

### 4. Generación del Paquete VSIX

Si necesitas generar el archivo VSIX por ti mismo (para desarrollo, distribución interna o para personalizar la extensión), puedes hacerlo utilizando la herramienta VSCE (Visual Studio Code Extensions):

1. Asegúrate de tener instalado Node.js y Git en tu sistema

2. Instala la herramienta VSCE globalmente:

```bash
npm install -g @vscode/vsce
```

3. Descarga el código fuente desde GitHub utilizando la línea de comandos:

```bash
# Clonar el repositorio desde la rama principal (main)
git clone -b main https://github.com/gcorroto/autofixer_extension.git

# Navegar al directorio del proyecto
cd autofixer_extension
```

4. Instala las dependencias del proyecto:

```bash
npm install
```

Este paso es **crucial** ya que instala todos los módulos necesarios como 'ws' (WebSocket), 'openai', 'vectra' y otras bibliotecas que son requeridas para el funcionamiento de la extensión. Sin estas dependencias, la extensión mostrará errores "Cannot find module" al activarse.

5. Genera el archivo VSIX:

```bash
vsce package
```

Esto generará un archivo con el formato `grec0ai-vscode-X.X.X.vsix` en el directorio raíz del proyecto.

## Requisitos Previos

Para utilizar todas las funcionalidades de Grec0AI For Developers, necesitarás:

* Visual Studio Code v1.40.0 o superior
* Node.js v12.0.0 o superior (para ejecutar tests generados)
* Una clave API de OpenAI (para las funcionalidades de IA)

## Configuración Inicial

Una vez instalada la extensión, realiza la configuración inicial:

1. Abre la configuración de VS Code (Ctrl+,)
2. Busca "Grec0AI" en la barra de búsqueda para ver todas las opciones disponibles
3. Configura tu clave API de OpenAI en `grec0ai.openai.apiKey` 
4. Selecciona el framework de pruebas que deseas utilizar en `grec0ai.test.framework`
5. Personaliza otras opciones según tus necesidades

### Configuración desde la Línea de Comandos

También puedes configurar la extensión directamente desde la línea de comandos, lo que es especialmente útil para automatizaciones, CI/CD o configuración por lotes:

1. Configurar autofixer para que se ejecute automáticamente al iniciar:

```bash
# En Windows
code --install-extension ruta/a/grec0ai-vscode-3.0.0.vsix --force
code --user-data-dir="%APPDATA%\Code\User" --settings '{"grec0ai.autofixer.enabled": true}'

# En Linux
code --install-extension ruta/a/grec0ai-vscode-3.0.0.vsix --force
code --user-data-dir="~/.config/Code/User" --settings '{"grec0ai.autofixer.enabled": true}'

# En macOS
code --install-extension ruta/a/grec0ai-vscode-3.0.0.vsix --force
code --user-data-dir="~/Library/Application Support/Code/User" --settings '{"grec0ai.autofixer.enabled": true}'
```

2. Usando variables de entorno (útil para entornos CI/CD):

```bash
# Windows (PowerShell)
$env:GREC0AI_AUTOFIXER=1
code .

# Windows (CMD)
set GREC0AI_AUTOFIXER=1
code .

# Linux/macOS
export GREC0AI_AUTOFIXER=1
code .
```

3. Modificando directamente el archivo `settings.json`:

```bash
# En Windows
code --user-data-dir="%APPDATA%\Code\User" --user-settings

# En Linux
code --user-data-dir="~/.config/Code/User" --user-settings

# En macOS
code --user-data-dir="~/Library/Application Support/Code/User" --user-settings

# O manualmente añadir al archivo settings.json
# "grec0ai.autofixer.enabled": true
```

### Ejemplo de Automatización Completa

A continuación se presenta un ejemplo de script que automatiza todo el proceso: generación del VSIX, instalación y configuración de AutoFixer para su ejecución automática.

**Windows (PowerShell):**
```powershell
# Instalar herramientas necesarias
npm install -g @vscode/vsce

# Clonar el repositorio 
git clone https://github.com/gcorroto/autofixer_extension.git
cd autofixer_extension

# Instalar dependencias y generar VSIX
npm install
vsce package

# Instalar la extensión y configurar AutoFixer
$vsixFile = Get-ChildItem -Filter "*.vsix" | Sort-Object -Property LastWriteTime -Descending | Select-Object -First 1
code --install-extension $vsixFile.FullName --force

# Configurar AutoFixer usando variable de entorno
$env:GREC0AI_AUTOFIXER=1
```

**Linux/macOS (Bash):**
```bash
# Instalar herramientas necesarias
npm install -g @vscode/vsce

# Clonar el repositorio
git clone https://github.com/gcorroto/autofixer_extension.git
cd autofixer_extension

# Instalar dependencias y generar VSIX
npm install
vsce package

# Instalar la extensión y configurar AutoFixer
vsix_file=$(ls -t *.vsix | head -1)
code --install-extension "$vsix_file" --force

# Configurar AutoFixer usando variable de entorno
export GREC0AI_AUTOFIXER=1
```

## Verificación de la Instalación

Para verificar que la extensión se ha instalado correctamente:

1. Abre la paleta de comandos (presiona `Ctrl+Shift+P`)
2. Escribe "Grec0AI" y deberías ver la lista de comandos disponibles
3. También deberías ver un nuevo icono en la barra de actividades lateral que corresponde a la extensión Grec0AI

Para verificar la configuración de AutoFixer:

1. Abre el canal de salida de Grec0AI en VS Code (View → Output, luego selecciona "Grec0AI For Developers" del menú desplegable)
2. Al iniciar VS Code, deberías ver un mensaje indicando si AutoFixer está habilitado:
   - `AutoFixer is enabled, checking for autofixer.md file...` (si está habilitado)
   - `AutoFixer is disabled, skipping autofixer.md check` (si está deshabilitado)

## Solución de Problemas

Si encuentras problemas durante la instalación:

1. Asegúrate de que tienes los requisitos mínimos (versión de VS Code)
2. Verifica que no hay conflictos con otras extensiones
3. Revisa los logs de VS Code para identificar posibles errores
4. Intenta reinstalar la extensión

### Error "Cannot find module 'ws'", 'openai', o otros módulos

Si encuentras errores que mencionan "Cannot find module X" (como ws, openai, vectra u otros) al activar la extensión:

1. Este error ocurre cuando las dependencias no se han instalado correctamente
2. Asegúrate de ejecutar `npm install` en el directorio de la extensión antes de empaquetar o usar la extensión
3. Si instalaste la extensión desde un archivo VSIX, es posible que necesites instalar las dependencias manualmente:
   ```bash
   # Para el módulo ws:
   cd ~/.vscode/extensions/grec0ai.grec0ai-vscode-3.0.0
   npm install ws
   
   # Para el módulo openai:
   cd ~/.vscode/extensions/grec0ai.grec0ai-vscode-3.0.0
   npm install openai
   
   # Para el módulo vectra:
   cd ~/.vscode/extensions/grec0ai.grec0ai-vscode-3.0.0
   npm install vectra
   
   # O para instalar todas las dependencias a la vez:
   cd ~/.vscode/extensions/grec0ai.grec0ai-vscode-3.0.0
   npm install
   ```
4. Reinicia VS Code después de instalar las dependencias

## Siguientes Pasos

Una vez instalada y configurada la extensión, consulta la [guía de uso de AutoFixer](uso-autofixer.md) para aprender a utilizar una de las características principales de la extensión.