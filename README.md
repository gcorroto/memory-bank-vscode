# Memory Bank Inspector — VS Code Extension

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=grec0.memory-bank-vscode)
[![Version](https://img.shields.io/badge/Version-3.0.0-green)](https://github.com/gcorroto/autofixer_extension)
[![License](https://img.shields.io/badge/License-MIT-yellow)](#licencia)
[![TypeScript](https://img.shields.io/badge/Made%20with-TypeScript-3178C6)]()

<div align="center">

**Extensión de VS Code para explorar y visualizar proyectos indexados en Memory Bank**

[📦 Instalar](#instalación) • [🚀 Inicio Rápido](#inicio-rápido) • [📚 Características](#características) • [⚙️ Configuración](#configuración)

</div>

---

## Visión General

**Memory Bank Inspector** es una extensión para Visual Studio Code que permite explorar y visualizar los proyectos indexados por el MCP Memory Bank. Proporciona:

- 📁 **Exploración de proyectos** indexados en el Memory Bank
- 📄 **Visualización de documentación** generada automáticamente
- 🔗 **Análisis de relaciones de código** con visualización de dataflows
- 🔍 **Navegación por archivos indexados** organizados por carpetas
- 🤖 **Integración con IA** para enriquecer análisis de relaciones

---

## Características

### 📁 Vista de Proyectos

Explora todos los proyectos indexados en tu Memory Bank:

- Lista de proyectos con número de documentos y fecha de última actualización
- Selección de proyecto activo
- Eliminación de proyectos (incluye limpieza de embeddings)

### 📄 Documentación del Proyecto

Visualiza la documentación generada automáticamente por el MCP:

- **activeContext.md** - Contexto actual del proyecto
- **productContext.md** - Contexto del producto
- **techContext.md** - Contexto técnico
- **systemPatterns.md** - Patrones del sistema
- **progress.md** - Progreso del proyecto
- **decisionLog.md** - Log de decisiones

Los documentos se abren con el previsualizador de Markdown de VS Code.

### 📂 Archivos Indexados

Navega por todos los archivos indexados del proyecto:

- Vista en árbol organizada por carpetas
- Información de cada archivo (hash, chunks, fecha)
- Apertura directa del archivo fuente

### 🔗 Code Relations (Dataflow)

Visualiza las relaciones entre componentes del código:

- **Análisis automático** de imports y dependencias
- **Enriquecimiento con IA** para descripciones en español
- **Visualización React Flow** con layout automático (dagre)
- **Highlighting de nodos** al seleccionar para seguir dependencias
- **Persistencia** en `relations.json` para evitar re-análisis

---

## Instalación

### Desde VS Code Marketplace

1. Abre Visual Studio Code
2. Accede a **Extensiones** (`Ctrl+Shift+X`)
3. Busca **"Memory Bank Inspector"**
4. Haz clic en **Instalar**

### Instalación Manual

```bash
code --install-extension memory-bank-vscode-3.0.0.vsix
```

### Instalación desde Fuente

```bash
git clone https://github.com/gcorroto/autofixer_extension.git
cd autofixer_extension
npm install
npm run build
npm run package
```

---

## Inicio Rápido

### 1️⃣ Configurar la ruta del Memory Bank

1. Abre la configuración de VS Code (`Ctrl+,`)
2. Busca "Memory Bank"
3. Configura `memorybank.path` con la ruta a tu carpeta `.memorybank`

```json
{
  "memorybank.path": "C:\\Users\\tu-usuario\\.memorybank"
}
```

### 2️⃣ Configurar API Key de OpenAI (opcional, para Code Relations)

```json
{
  "memorybank.openai.apiKey": "sk-..."
}
```

### 3️⃣ Explorar el Memory Bank

1. Abre el panel **Memory Bank** en la barra lateral izquierda
2. Selecciona un proyecto de la lista
3. Explora documentación, archivos indexados y relaciones

---

## Configuración

| Configuración | Tipo | Default | Descripción |
|---------------|------|---------|-------------|
| `memorybank.path` | string | `.memorybank` | Ruta a la carpeta del Memory Bank |
| `memorybank.defaultProject` | string | `""` | ID del proyecto por defecto |
| `memorybank.openai.apiKey` | string | `""` | API Key de OpenAI para análisis con IA |
| `memorybank.openai.model` | enum | `gpt-5-mini` | Modelo de OpenAI para consultas |

### Modelos disponibles

- `gpt-5-mini` - Modelo general rápido
- `gpt-5.2` - Modelo para planning y análisis
- `gpt-5.1-codex` - Modelo para generación de código
- `o4-mini` - Modelo de razonamiento

---

## Vistas del Panel

### Proyectos

```
Memory Bank
├── 📁 PROYECTOS
│   ├── mi-proyecto (7 docs, hace 2 horas)
│   ├── otro-proyecto (5 docs, hace 1 día)
│   └── ...
```

**Acciones:**
- Clic para seleccionar proyecto
- Clic derecho → "Eliminar Proyecto"

### Archivos Indexados

```
├── 📄 ARCHIVOS INDEXADOS
│   ├── 📁 src/
│   │   ├── 📁 services/
│   │   │   ├── authService.ts (3 chunks)
│   │   │   └── userService.ts (5 chunks)
│   │   └── 📁 controllers/
│   └── 📁 tests/
```

### Documentación

```
├── 📚 DOCUMENTACIÓN
│   ├── 📄 activeContext
│   ├── 📄 productContext
│   ├── 📄 techContext
│   ├── 📄 systemPatterns
│   ├── 📄 progress
│   └── 📄 decisionLog
```

### Code Relations

```
├── 🔗 CODE RELATIONS
│   ├── ▶️ Analizar (genera/actualiza relaciones)
│   ├── 📊 Ver Dataflow (visualización React Flow)
│   └── 🔄 Actualizar
```

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `memorybank.refresh` | Refrescar todas las vistas |
| `memorybank.configure` | Configurar ruta del Memory Bank |
| `memorybank.selectProject` | Seleccionar proyecto |
| `memorybank.deleteProject` | Eliminar proyecto y embeddings |
| `memorybank.relations.analyze` | Analizar relaciones del proyecto |
| `memorybank.relations.showFlow` | Ver visualización de dataflow |

---

## Requisitos

- **Visual Studio Code**: v1.26.0 o superior
- **Node.js**: v12.0.0 o superior
- **Memory Bank MCP**: Tener proyectos indexados en `.memorybank`

---

## Integración con Memory Bank MCP

Esta extensión es el complemento visual del [Memory Bank MCP](https://github.com/gcorroto/memory-bank-mcp), que proporciona:

- Indexación de código con embeddings (LanceDB)
- Generación automática de documentación
- Búsqueda semántica (RAG)

---

## Licencia

Este proyecto está bajo licencia **MIT**.

---

<div align="center">

**Hecho con ❤️ por grec0**

</div>
