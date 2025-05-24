# Arquitectura de Prompts para MacGyver

## 1. Objetivo

Crear dentro de la extensión VS&nbsp;Code un **módulo PromptComposer** que, en cada petición del usuario, arme la *prompt* final que se enviará al LLM.  
Esa *prompt* se forma combinando varias "piezas" (bloques) y respetando prioridades.

```
┌───────────┐
│Bloque-0   │  ←  user_query de turno
└───────────┘
     ↓ concat
┌───────────┐
│Bloque-1   │  ←  system prompt base
└───────────┘
     ↓ concat
┌───────────┐
│Bloque-2   │  ←  catálogo de herramientas
└───────────┘
     ↓ concat
┌───────────┐
│Rules      │  ←  .cursor/rules completas o reglas de @rules.mdc que apliquen
└───────────┘
     ↓ concat
┌───────────┐
│Docs dinám.│  ←  trozos de docs que el RAG considere útiles (opcional)
└───────────┘
```

Prioridad de interpretación dentro del LLM: **Rules > System > Herramientas > Doc dinámica**.

## 2. Fuentes de contenido

| Fuente | Dónde vive | Cuándo incluirla |
|-------|------------|------------------|
| **Bloque‑1** (system) | `/resources/system_prompt.md` | Siempre, al principio. |
| **Bloque‑2** (tools)  | `/resources/tools_prompt.md`  | Siempre, tras el system. |
| **Rules**             | `.cursor/rules` (legacy) o `@rules.mdc` o `.cursor/rules.d/*.mdc` | Reglas que apliquen según su metadata y el archivo actual. |
| **Documentación adjunta** | Archivos que el usuario pegue o suba en la sesión | **Sólo** los fragmentos que el motor RAG devuelva como relevantes pa' la pregunta actual. |

## 3. Especificación del **PromptComposer**

### API interna (TypeScript)

```ts
export interface PromptComposerInput {
  userQuery: string;          // mensaje del usuario
  workspacePath: string;      // raíz del proyecto abierto
  attachedDocs: DocChunk[];   // output del motor RAG (puede ir vacío)
  currentFilePath?: string;   // ruta del archivo actual (opcional, para matching de globs)
}

export function buildPrompt(input: PromptComposerInput): string;
```

### Pasos que hace `buildPrompt`

1. **Cargar caché estática**  
   - Lee `system_prompt.md` y `tools_prompt.md` una sola vez al activar la extensión.

2. **Inyectar Rules (si existen)**  
   ```ts
   const rulesPath = path.join(workspacePath, '.cursor', 'rules');
   const rules = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath,'utf8') : '';
   ```

3. **Añadir docs dinámicas**  
   - El motor RAG (fuera de este módulo) devuelve un array de trozos (`DocChunk {text:string, source:string}`) ordenados por relevancia.  
   - Concatenar cada trozo precedido de un comentario tipo:  
     ```
     ### Fuente: ${chunk.source}
     ${chunk.text}
     ```

4. **Montar todo en orden**  
   ```ts
   return [
     `USER:\n${input.userQuery.trim()}`,
     '---',
     SYSTEM_PROMPT,
     '---',
     TOOLS_PROMPT,
     rules ? '---\n' + rules : '',
     input.attachedDocs.length ? '---\n' + attachedDocsText : ''
   ].filter(Boolean).join('\n\n');
   ```

## 4. Motor RAG (resumen rápido)

*No lo implementes aquí si ya tenéis uno; solo define la interfaz.*  

- **Índice**: FAISS, Milvus o lo que uséis, actualizado cuando el usuario adjunte docs.  
- **Query vectorial**: el `userQuery` crudo.  
- **Post‑filtering**: límite de tokens configurable (p.ej. 2048) pa' no pasarse.

Devuelve `DocChunk[]` que ya vimos.

## 5. Consideraciones especiales

1. **MacGyver habla andalú**  
   - Esa regla ya está hardcodeada dentro del **system prompt**. No hace falta más código.

2. **Separación de concerns**  
   - El módulo de tools, rules y docs **no** debe alterar el flow; solo compone strings.  
   - Cualquier lógica de streaming, rate‑limit, etc., queda en la capa de transporte (p.ej. `OpenAIChatProvider`).

3. **Tests mínimos**  
   - **Snapshots Jest** → comprueba que, dado un `userQuery`, un fichero `.cursor/rules` y X docs, el `buildPrompt` genera la cadena esperada.  
   - Caso sin rules / sin docs debe seguir funcionando.

## 6. Lo que **NO** debe hacer el dev

- **No** interpretar las reglas como instrucciones personales: sólo empaquetarlas.  
- **No** cortar ni reordenar las reglas; van completas.  
- **No** incluir docs completas si son muy largas; usar sólo lo que el RAG mande.

## 7. Checklist de entrega

- [x] `src/promptComposer.ts` implementado y testeado.  
- [x] `resources/system_prompt.md` y `resources/tools_prompt.md` copiados 1‑1 de los Bloques 1 y 2.  
- [x] Hook en el comando "Preguntar a MacGyver" que invoque `buildPrompt()`.  
- [x] Docs de dev en `docs/prompt-architecture.md` (puedes pegar este mismo texto).