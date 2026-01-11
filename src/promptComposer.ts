/**
 * PromptComposer Module
 *
 * Responsible for dynamically building prompts by combining:
 * 1. User query
 * 2. System prompt (from resources/system_prompt.md)
 * 3. Tools prompt (from resources/tools_prompt.md)
 * 4. Rules (from workspace .cursor/rules if it exists)
 * 5. Dynamic documentation chunks from RAG
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * A chunk of documentation from the RAG engine
 */
export interface DocChunk {
  text: string;
  source: string;
}

/**
 * Rule metadata from frontmatter in .mdc files
 */
export interface RuleMetadata {
  description?: string;
  globs?: string[];
  alwaysApply?: boolean;
}

/**
 * Parsed rule with metadata and content
 */
export interface ParsedRule {
  metadata: RuleMetadata;
  content: string;
}

/**
 * Input parameters for the buildPrompt function
 */
export interface PromptComposerInput {
  userQuery: string; // mensaje del usuario
  workspacePath: string; // raíz del proyecto abierto
  attachedDocs: DocChunk[]; // output del motor RAG (puede ir vacío)
  currentFilePath?: string; // ruta del archivo actual (opcional, para matching de globs)
}

// Static prompt content (cached)
let SYSTEM_PROMPT: string | null = null;
let TOOLS_PROMPT: string | null = null;

/**
 * Logs detailed information about rule processing
 */
function logRuleProcessing(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  console.log(`[PromptComposer ${timestamp}] ${message}`);
  if (data) {
    console.log(`[PromptComposer ${timestamp}] Data:`, JSON.stringify(data, null, 2));
  }
}

/**
 * Parses frontmatter from a markdown-like file content
 * Uses gray-matter library if available, otherwise falls back to custom parsing
 * @param content File content string
 * @returns Parsed rule with metadata and content
 */
function parseFrontmatter(content: string): ParsedRule {
  logRuleProcessing("🔍 Parsing frontmatter from rule content", {
    contentLength: content.length,
    hasFrontmatter: content.trimStart().startsWith("---")
  });

  const defaultResult: ParsedRule = {
    metadata: {},
    content: content,
  };

  // Check if content starts with frontmatter delimiter
  if (!content.trimStart().startsWith("---")) {
    logRuleProcessing("⚠️ No frontmatter found, using content as-is");
    return defaultResult;
  }

  try {
    // Try to use gray-matter if available
    // Using require instead of import for dynamic loading
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const matter = require("gray-matter");
    const parsed = matter(content);

    logRuleProcessing("✅ Successfully parsed frontmatter with gray-matter", {
      frontmatterData: parsed.data,
      contentLength: parsed.content?.length || 0
    });

    // Extract relevant metadata fields
    const metadata: RuleMetadata = {};

    if (parsed.data.description) {
      metadata.description = parsed.data.description;
      logRuleProcessing("📝 Found description in metadata", { description: metadata.description });
    }

    if (parsed.data.alwaysApply !== undefined) {
      metadata.alwaysApply = !!parsed.data.alwaysApply;
      logRuleProcessing("🔧 Found alwaysApply in metadata", { alwaysApply: metadata.alwaysApply });
    }

    if (parsed.data.globs) {
      // Handle both string and array formats
      if (typeof parsed.data.globs === "string") {
        metadata.globs = parsed.data.globs
          .split(",")
          .map((item: string) => item.trim());
        logRuleProcessing("🎯 Found globs as string in metadata", { 
          originalGlobs: parsed.data.globs,
          parsedGlobs: metadata.globs 
        });
      } else if (Array.isArray(parsed.data.globs)) {
        metadata.globs = parsed.data.globs;
        logRuleProcessing("🎯 Found globs as array in metadata", { globs: metadata.globs });
      }
    }

    const result = {
      metadata,
      content: parsed.content,
    };

    logRuleProcessing("✅ Frontmatter parsing completed successfully", {
      finalMetadata: metadata,
      contentLength: parsed.content?.length || 0
    });

    return result;
  } catch (error) {
    logRuleProcessing("⚠️ gray-matter not available, using fallback parser", { error: error.message });

    // Fallback to manual parsing if gray-matter is not available
    // Find the second delimiter
    const startPos = content.indexOf("---");
    const endPos = content.indexOf("---", startPos + 3);
    if (endPos === -1) {
      logRuleProcessing("❌ Fallback parser: Could not find closing frontmatter delimiter");
      return defaultResult;
    }

    // Extract frontmatter and content
    const frontmatter = content.substring(startPos + 3, endPos).trim();
    const cleanContent = content.substring(endPos + 3).trim();

    logRuleProcessing("🔧 Fallback parser: Extracted frontmatter", {
      frontmatterLength: frontmatter.length,
      contentLength: cleanContent.length
    });

    // Parse frontmatter into key-value pairs
    const metadata: RuleMetadata = {};
    const lines = frontmatter.split("\n");

    logRuleProcessing("🔧 Fallback parser: Processing frontmatter lines", { lineCount: lines.length });

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue; // Skip empty lines and comments
      }

      const colonIndex = trimmedLine.indexOf(":");
      if (colonIndex !== -1) {
        const key = trimmedLine.substring(0, colonIndex).trim();
        const value = trimmedLine.substring(colonIndex + 1).trim();

        logRuleProcessing("🔧 Fallback parser: Processing key-value pair", { key, value });

        // Parse specific types
        if (key === "globs") {
          // Parse array value
          if (value) {
            metadata.globs = value.split(",").map((item) => item.trim());
            logRuleProcessing("🎯 Fallback parser: Parsed globs", { 
              originalValue: value,
              parsedGlobs: metadata.globs 
            });
          }
        } else if (key === "alwaysApply") {
          // Parse boolean value
          metadata.alwaysApply = value.toLowerCase() === "true";
          logRuleProcessing("🔧 Fallback parser: Parsed alwaysApply", { 
            originalValue: value,
            parsedValue: metadata.alwaysApply 
          });
        } else if (key === "description") {
          metadata.description = value;
          logRuleProcessing("📝 Fallback parser: Parsed description", { description: value });
        }
      }
    }

    const result = {
      metadata,
      content: cleanContent,
    };

    logRuleProcessing("✅ Fallback frontmatter parsing completed", {
      finalMetadata: metadata,
      contentLength: cleanContent.length
    });

    return result;
  }
}

/**
 * Checks if a file path matches a glob pattern
 * @param filePath Path to check
 * @param pattern Glob pattern
 * @returns true if the path matches the pattern
 */
function matchGlobPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  let regexPattern = pattern
    .replace(/\./g, "\\.") // Escape dots
    .replace(/\*\*/g, ".*") // ** matches any character (including /)
    .replace(/\*/g, "[^/]*"); // * matches any character except /

  // Make sure it's a full match
  regexPattern = `^${regexPattern}$`;

  // Create regex and test
  const regex = new RegExp(regexPattern);
  const matches = regex.test(filePath);

  logRuleProcessing("🎯 Glob pattern matching", {
    filePath,
    pattern,
    regexPattern,
    matches
  });

  return matches;
}

/**
 * Checks if a rule applies to a specific file based on its metadata
 * @param rule Parsed rule with metadata
 * @param filePath Current file path (optional)
 * @returns true if the rule applies
 */
function ruleAppliesToFile(rule: ParsedRule, filePath?: string): boolean {
  logRuleProcessing("🔍 Checking if rule applies to file", {
    filePath,
    ruleMetadata: rule.metadata,
    contentLength: rule.content.length
  });

  // If alwaysApply is true, the rule always applies
  if (rule.metadata.alwaysApply) {
    logRuleProcessing("✅ Rule applies: alwaysApply is true");
    return true;
  }

  // If no globs or no file path, don't apply pattern matching
  if (!rule.metadata.globs || !filePath) {
    const reason = !rule.metadata.globs ? "no globs defined" : "no file path provided";
    logRuleProcessing(`✅ Rule applies: ${reason} (default behavior)`, { reason });
    return true; // Default behavior: include if no constraints
  }

  // Get relative path for matching
  const fileName = path.basename(filePath);
  logRuleProcessing("🔍 Testing glob patterns", {
    filePath,
    fileName,
    globs: rule.metadata.globs
  });

  // Check if any glob pattern matches
  for (const pattern of rule.metadata.globs) {
    if (
      pattern &&
      (matchGlobPattern(filePath, pattern) ||
        matchGlobPattern(fileName, pattern))
    ) {
      logRuleProcessing("✅ Rule applies: glob pattern matched", { 
        matchedPattern: pattern,
        filePath,
        fileName
      });
      return true;
    }
  }

  logRuleProcessing("❌ Rule does not apply: no glob patterns matched", {
    filePath,
    fileName,
    testedGlobs: rule.metadata.globs
  });

  return false;
}

/**
 * Loads the static prompt files from resources directory
 */
function loadStaticPrompts(): void {
  if (SYSTEM_PROMPT !== null && TOOLS_PROMPT !== null) {
    // Already loaded
    return;
  }

  try {
    // Try multiple ways to find the extension path
    let extensionPath: string | undefined;
    
    // Method 1: Try by extension ID (works when installed from marketplace)
    const extension = vscode.extensions.getExtension("grec0.memory-bank-vscode");
    if (extension) {
      extensionPath = extension.extensionPath;
    }
    
    // Method 2: Use __dirname to find the extension root (works in development)
    if (!extensionPath) {
      // __dirname will be in dist/ folder, so we go up one level
      extensionPath = path.resolve(__dirname, '..');
    }

    if (!extensionPath || !fs.existsSync(path.join(extensionPath, 'resources'))) {
      throw new Error("Extension path not found or resources folder missing");
    }

    const systemPromptPath = path.join(
      extensionPath,
      "resources",
      "system_prompt.md",
    );
    const toolsPromptPath = path.join(
      extensionPath,
      "resources",
      "tools_prompt.md",
    );

    SYSTEM_PROMPT = fs.readFileSync(systemPromptPath, "utf8");
    TOOLS_PROMPT = fs.readFileSync(toolsPromptPath, "utf8");
  } catch (error) {
    console.error("Error loading static prompts:", error);
    // Fallback to default values
    SYSTEM_PROMPT =
      "Eres un asistente de código avanzao llamao MacGyver, que ayuda a los dev con su código. Hablas con acentillo andalú.";
    TOOLS_PROMPT =
      "## Herramientas pa' código\n\nAquí tienes algunas herramientas que podemos usa' pa' ayudarte con tu código.";
  }
}

/**
 * Formats document chunks into a string
 * @param docs Array of document chunks
 * @returns Formatted documentation text
 */
function formatDocChunks(docs: DocChunk[]): string {
  if (!docs || docs.length === 0) {
    return "";
  }

  let result = "";

  for (const doc of docs) {
    result += `### Fuente: ${doc.source}\n${doc.text}\n\n`;
  }

  return result.trim();
}

/**
 * Main function to build the complete prompt
 * @param input PromptComposerInput object containing user query, workspace path and docs
 * @returns Assembled prompt string
 */
export function buildPrompt(input: PromptComposerInput): string {
  logRuleProcessing("🚀 Starting prompt composition", {
    workspacePath: input.workspacePath,
    currentFilePath: input.currentFilePath,
    userQueryLength: input.userQuery.length,
    attachedDocsCount: input.attachedDocs.length
  });

  // 1. Load static prompts if not loaded
  loadStaticPrompts();

  // 2. Process rules files
  let rulesContent = "";

  logRuleProcessing("📂 Processing rules files...");

  // Check for traditional rules file first (backward compatibility)
  const rulesPath = path.join(input.workspacePath, ".cursor", "rules");
  if (fs.existsSync(rulesPath)) {
    rulesContent = fs.readFileSync(rulesPath, "utf8");
    logRuleProcessing("✅ Found traditional rules file", {
      path: rulesPath,
      contentLength: rulesContent.length
    });
  } else {
    logRuleProcessing("📂 Traditional rules file not found, checking for .mdc rule files");

    // Check for .mdc rule files
    const altRulesPath = path.join(input.workspacePath, "@rules.mdc");
    const rulesDir = path.join(input.workspacePath, ".cursor", "rules.d");

    // Rules content from all applicable files
    const applicableRules: string[] = [];

    logRuleProcessing("🔍 Checking rule file locations", {
      altRulesPath,
      rulesDir,
      altRulesExists: fs.existsSync(altRulesPath),
      rulesDirExists: fs.existsSync(rulesDir)
    });

    // Process individual @rules.mdc file if it exists
    if (fs.existsSync(altRulesPath)) {
      logRuleProcessing("📄 Processing @rules.mdc file", { path: altRulesPath });
      
      const content = fs.readFileSync(altRulesPath, "utf8");
      const parsedRule = parseFrontmatter(content);

      if (ruleAppliesToFile(parsedRule, input.currentFilePath)) {
        applicableRules.push(parsedRule.content);
        logRuleProcessing("✅ @rules.mdc file added to applicable rules", {
          contentLength: parsedRule.content.length
        });
      } else {
        logRuleProcessing("❌ @rules.mdc file not applicable for current context");
      }
    }

    // Process rules directory if it exists
    if (fs.existsSync(rulesDir) && fs.statSync(rulesDir).isDirectory()) {
      logRuleProcessing("📁 Processing rules directory", { path: rulesDir });
      
      try {
        const files = fs.readdirSync(rulesDir);
        logRuleProcessing("📄 Found files in rules directory", { 
          files,
          mdcFiles: files.filter(f => f.endsWith(".mdc"))
        });

        for (const file of files) {
          if (file.endsWith(".mdc")) {
            const filePath = path.join(rulesDir, file);
            logRuleProcessing("📄 Processing rule file", { file, path: filePath });
            
            const content = fs.readFileSync(filePath, "utf8");
            const parsedRule = parseFrontmatter(content);

            if (ruleAppliesToFile(parsedRule, input.currentFilePath)) {
              applicableRules.push(parsedRule.content);
              logRuleProcessing("✅ Rule file added to applicable rules", {
                file,
                contentLength: parsedRule.content.length
              });
            } else {
              logRuleProcessing("❌ Rule file not applicable for current context", { file });
            }
          }
        }
      } catch (error) {
        logRuleProcessing("❌ Error reading rules directory", { 
          error: error.message,
          path: rulesDir 
        });
        console.error("Error reading rules directory:", error);
      }
    }

    // Combine applicable rules
    rulesContent = applicableRules.join("\n\n");
    logRuleProcessing("📋 Rules processing completed", {
      applicableRulesCount: applicableRules.length,
      totalRulesContentLength: rulesContent.length,
      individualRuleLengths: applicableRules.map(rule => rule.length)
    });
  }

  // 3. Format attached docs
  const attachedDocsText = formatDocChunks(input.attachedDocs);
  logRuleProcessing("📚 Formatted attached documentation", {
    docsCount: input.attachedDocs.length,
    formattedLength: attachedDocsText.length
  });

  // 4. Assemble the prompt
  const promptParts = [
    `USER:\n${input.userQuery.trim()}`,
    "---",
    SYSTEM_PROMPT,
    "---",
    TOOLS_PROMPT,
    rulesContent ? "---\n" + rulesContent : "",
    input.attachedDocs.length ? "---\n" + attachedDocsText : "",
  ].filter(Boolean);

  const finalPrompt = promptParts.join("\n\n");

  logRuleProcessing("🎯 Prompt composition completed", {
    totalParts: promptParts.length,
    finalPromptLength: finalPrompt.length,
    partsLengths: promptParts.map(part => part.length),
    hasRules: !!rulesContent,
    rulesContentLength: rulesContent.length,
    hasDocs: input.attachedDocs.length > 0,
    docsContentLength: attachedDocsText.length
  });

  return finalPrompt;
}
