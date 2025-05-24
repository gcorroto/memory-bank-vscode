# Documentación de la Funcionalidad AutoFixer

## Descripción General

La funcionalidad **AutoFixer** proporciona la ejecución automatizada de instrucciones desde un archivo especial llamado `autofixer.md` en la raíz de tu proyecto. Está diseñado para flujos de trabajo CI/CD, entornos Cloud IDE y despliegues automatizados donde necesitas realizar correcciones de código, refactorizaciones o tareas de configuración sin intervención manual.

## Cómo Habilitar AutoFixer

Hay dos formas de habilitar la funcionalidad AutoFixer:

1. **Configuración de la Extensión**:
   - Establece `grec0ai.autofixer.enabled` como `true` en la configuración de VSCode

2. **Variable de Entorno**:
   - Configura `GREC0AI_AUTOFIXER=1` en tu entorno

## Cómo Funciona

Cuando está habilitado:

1. La extensión busca un archivo `autofixer.md` en el directorio raíz de tu workspace
2. Si lo encuentra, el contenido es leído y procesado por el agente Grec0AI
3. El agente ejecuta las instrucciones como si hubieran sido introducidas por un usuario
4. Los resultados y logs están disponibles en el panel de salida de Grec0AI

## Creación de un Archivo autofixer.md

El archivo `autofixer.md` debe escribirse en formato Markdown y contener instrucciones en lenguaje natural para el agente. Por ejemplo:

```markdown
# Correcciones Automáticas de Código

Por favor, realiza las siguientes tareas:

1. Corrige el error en la función `calcularTotal()` en `src/utils/calculadora.js` 
2. Añade manejo de errores adecuado a las llamadas API en `src/servicios/api.js`
3. Aumenta la cobertura de pruebas para el componente `ServicioUsuario` al menos al 80%
```

## Casos de Uso

- **Configuración automatizada del entorno**: Solucionar problemas comunes cuando nuevos desarrolladores clonan el repositorio
- **Pipelines CI/CD**: Generar o actualizar código como parte de flujos de trabajo automatizados
- **Entornos en contenedores**: Aplicar correcciones al desplegar en entornos VSCode containerizados como Code Server

## Notas

- AutoFixer está desactivado por defecto por motivos de seguridad
- No se muestran solicitudes de confirmación cuando AutoFixer está en ejecución
- Si no se encuentra el archivo `autofixer.md`, la extensión continuará con la operación normal sin errores
- Todas las acciones realizadas por AutoFixer se registran en el canal de salida de Grec0AI