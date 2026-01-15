/**
 * @fileoverview Framework Detector Service
 * Detects project framework first, then extracts components
 * 
 * Uses the same approach as relationsAnalyzerService:
 * 1. Load index-metadata.json to get file list
 * 2. Read files directly from disk
 * 3. Analyze content with framework-specific patterns
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { getMemoryBankService } from './memoryBankService';
import {
  FrameworkType,
  FrameworkComponentType,
  FrameworkComponent,
  FrameworkAnalysis,
  EndpointInfo,
  HttpMethod,
  FRAMEWORK_INFO,
} from '../types/framework';

// ============================================================================
// Framework Detection Rules (by config files)
// ============================================================================

interface FrameworkDetectionRule {
  framework: FrameworkType;
  configFiles: string[];
  contentPatterns: RegExp[];
  priority: number;
}

const FRAMEWORK_DETECTION_RULES: FrameworkDetectionRule[] = [
  // Spring Boot (Java/Kotlin)
  {
    framework: 'spring-boot',
    configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    contentPatterns: [/spring-boot-starter/, /org\.springframework\.boot/, /springBootVersion/],
    priority: 100,
  },
  // NestJS
  {
    framework: 'nestjs',
    configFiles: ['package.json'],
    contentPatterns: [/@nestjs\/core/, /@nestjs\/common/],
    priority: 90,
  },
  // Angular
  {
    framework: 'angular',
    configFiles: ['angular.json', 'package.json'],
    contentPatterns: [/@angular\/core/, /@angular\/common/],
    priority: 90,
  },
  // Next.js
  {
    framework: 'nextjs',
    configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts', 'package.json'],
    contentPatterns: [/"next":/, /from ['"]next/],
    priority: 85,
  },
  // Nuxt
  {
    framework: 'nuxt',
    configFiles: ['nuxt.config.js', 'nuxt.config.ts', 'package.json'],
    contentPatterns: [/"nuxt":/, /from ['"]nuxt/],
    priority: 85,
  },
  // React
  {
    framework: 'react',
    configFiles: ['package.json'],
    contentPatterns: [/"react":/, /"react-dom":/],
    priority: 80,
  },
  // Vue
  {
    framework: 'vue',
    configFiles: ['vue.config.js', 'vite.config.ts', 'package.json'],
    contentPatterns: [/"vue":/, /@vue\/cli/],
    priority: 80,
  },
  // Django
  {
    framework: 'django',
    configFiles: ['manage.py', 'requirements.txt', 'setup.py', 'pyproject.toml'],
    contentPatterns: [/django/i, /DJANGO_SETTINGS_MODULE/],
    priority: 90,
  },
  // FastAPI
  {
    framework: 'fastapi',
    configFiles: ['requirements.txt', 'setup.py', 'pyproject.toml', 'main.py'],
    contentPatterns: [/fastapi/i, /from fastapi import/],
    priority: 85,
  },
  // Flask
  {
    framework: 'flask',
    configFiles: ['requirements.txt', 'setup.py', 'pyproject.toml', 'app.py'],
    contentPatterns: [/flask/i, /from flask import/],
    priority: 80,
  },
  // Express
  {
    framework: 'express',
    configFiles: ['package.json'],
    contentPatterns: [/"express":/],
    priority: 70,
  },
  // Svelte
  {
    framework: 'svelte',
    configFiles: ['svelte.config.js', 'package.json'],
    contentPatterns: [/"svelte":/, /@sveltejs/],
    priority: 80,
  },
];

// ============================================================================
// Component Extraction Patterns (per framework)
// ============================================================================

interface ComponentPattern {
  pattern: RegExp;
  type: FrameworkComponentType;
  nameExtractor: (match: RegExpMatchArray, content: string, filePath: string) => string;
  metadataExtractor?: (match: RegExpMatchArray, content: string) => Record<string, any>;
}

interface EndpointPattern {
  pattern: RegExp;
  methodExtractor: (match: RegExpMatchArray) => HttpMethod;
  pathExtractor: (match: RegExpMatchArray) => string;
}

interface FrameworkPatterns {
  components: ComponentPattern[];
  endpoints: EndpointPattern[];
}

// Spring Boot patterns
const SPRING_BOOT_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /@RestController[\s\S]*?(?:public\s+)?class\s+(\w+)/,
      type: 'controller',
      nameExtractor: (m) => m[1],
      metadataExtractor: (_, content) => {
        const basePath = content.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/);
        return { basePath: basePath?.[1] || '', decorators: ['@RestController'] };
      },
    },
    {
      pattern: /@Controller[\s\S]*?(?:public\s+)?class\s+(\w+)/,
      type: 'controller',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Controller'] }),
    },
    {
      pattern: /@Service[\s\S]*?(?:public\s+)?class\s+(\w+)/,
      type: 'service',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Service'] }),
    },
    {
      pattern: /@Repository[\s\S]*?(?:public\s+)?(?:interface|class)\s+(\w+)/,
      type: 'repository',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Repository'] }),
    },
    {
      pattern: /@Component[\s\S]*?(?:public\s+)?class\s+(\w+)/,
      type: 'component',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Component'] }),
    },
    {
      pattern: /@Configuration[\s\S]*?(?:public\s+)?class\s+(\w+)/,
      type: 'configuration',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Configuration'] }),
    },
    {
      pattern: /@Entity[\s\S]*?(?:public\s+)?class\s+(\w+)/,
      type: 'entity',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Entity'] }),
    },
    {
      pattern: /@ControllerAdvice[\s\S]*?(?:public\s+)?class\s+(\w+)/,
      type: 'exception-handler',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@ControllerAdvice'] }),
    },
  ],
  endpoints: [
    { pattern: /@GetMapping\s*(?:\(\s*["']?([^"')]*)?["']?\s*\))?/g, methodExtractor: () => 'GET', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@PostMapping\s*(?:\(\s*["']?([^"')]*)?["']?\s*\))?/g, methodExtractor: () => 'POST', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@PutMapping\s*(?:\(\s*["']?([^"')]*)?["']?\s*\))?/g, methodExtractor: () => 'PUT', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@DeleteMapping\s*(?:\(\s*["']?([^"')]*)?["']?\s*\))?/g, methodExtractor: () => 'DELETE', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@PatchMapping\s*(?:\(\s*["']?([^"')]*)?["']?\s*\))?/g, methodExtractor: () => 'PATCH', pathExtractor: (m) => m[1] || '/' },
  ],
};

// NestJS patterns
const NESTJS_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /@Controller\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'controller',
      nameExtractor: (m) => m[2],
      metadataExtractor: (m) => ({ basePath: m[1] || '', decorators: ['@Controller'] }),
    },
    {
      pattern: /@Injectable\s*\(\s*\)[\s\S]*?(?:export\s+)?class\s+(\w+Service)/,
      type: 'service',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Injectable'] }),
    },
    {
      pattern: /@Module\s*\([\s\S]*?\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'module',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Module'] }),
    },
  ],
  endpoints: [
    { pattern: /@Get\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g, methodExtractor: () => 'GET', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@Post\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g, methodExtractor: () => 'POST', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@Put\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g, methodExtractor: () => 'PUT', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@Delete\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g, methodExtractor: () => 'DELETE', pathExtractor: (m) => m[1] || '/' },
  ],
};

// Angular patterns
const ANGULAR_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /@Component\s*\(\s*\{[\s\S]*?\}\s*\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'component',
      nameExtractor: (m) => m[1],
    },
    {
      pattern: /@Injectable\s*\([\s\S]*?\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'service',
      nameExtractor: (m) => m[1],
    },
    {
      pattern: /@NgModule\s*\([\s\S]*?\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'module',
      nameExtractor: (m) => m[1],
    },
    {
      pattern: /@Directive\s*\([\s\S]*?\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'directive',
      nameExtractor: (m) => m[1],
    },
    {
      pattern: /@Pipe\s*\([\s\S]*?\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'pipe',
      nameExtractor: (m) => m[1],
    },
  ],
  endpoints: [],
};

// React patterns
const REACT_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /(?:export\s+)?(?:const|function)\s+(use[A-Z]\w+)\s*[=:]/,
      type: 'hook',
      nameExtractor: (m) => m[1],
    },
    {
      pattern: /(?:export\s+)?const\s+(\w+Context)\s*=\s*(?:React\.)?createContext/,
      type: 'context',
      nameExtractor: (m) => m[1],
    },
    {
      pattern: /(?:export\s+)?(?:const|function)\s+(\w+Provider)\s*[=:]/,
      type: 'provider',
      nameExtractor: (m) => m[1],
    },
  ],
  endpoints: [],
};

// Vue patterns
const VUE_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /<script\s+setup[^>]*>/,
      type: 'component',
      nameExtractor: (_, __, filePath) => path.basename(filePath, '.vue'),
    },
    {
      pattern: /defineComponent\s*\(\s*\{/,
      type: 'component',
      nameExtractor: (_, content, filePath) => {
        const nameMatch = content.match(/name\s*:\s*['"](\w+)['"]/);
        return nameMatch?.[1] || path.basename(filePath, '.vue');
      },
    },
    {
      pattern: /(?:export\s+)?const\s+(\w+)\s*=\s*defineStore\s*\(/,
      type: 'store',
      nameExtractor: (m) => m[1],
    },
  ],
  endpoints: [],
};

// Django patterns
const DJANGO_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /class\s+(\w+)\s*\(\s*(?:APIView|ViewSet|ModelViewSet|GenericAPIView|View|TemplateView|ListView|DetailView|CreateView|UpdateView|DeleteView)/,
      type: 'view',
      nameExtractor: (m) => m[1],
    },
    {
      pattern: /class\s+(\w+)\s*\(\s*models\.Model\s*\)/,
      type: 'model',
      nameExtractor: (m) => m[1],
    },
    {
      pattern: /class\s+(\w+)\s*\(\s*serializers\.(?:Serializer|ModelSerializer)/,
      type: 'serializer',
      nameExtractor: (m) => m[1],
    },
  ],
  endpoints: [],
};

// FastAPI patterns
const FASTAPI_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /class\s+(\w+)\s*\(\s*BaseModel\s*\)/,
      type: 'model',
      nameExtractor: (m) => m[1],
    },
  ],
  endpoints: [
    { pattern: /@(?:app|router)\.get\s*\(\s*["']([^"']+)["']/g, methodExtractor: () => 'GET', pathExtractor: (m) => m[1] },
    { pattern: /@(?:app|router)\.post\s*\(\s*["']([^"']+)["']/g, methodExtractor: () => 'POST', pathExtractor: (m) => m[1] },
    { pattern: /@(?:app|router)\.put\s*\(\s*["']([^"']+)["']/g, methodExtractor: () => 'PUT', pathExtractor: (m) => m[1] },
    { pattern: /@(?:app|router)\.delete\s*\(\s*["']([^"']+)["']/g, methodExtractor: () => 'DELETE', pathExtractor: (m) => m[1] },
  ],
};

// Flask patterns
const FLASK_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /(\w+)\s*=\s*Blueprint\s*\(\s*['"](\w+)['"]/,
      type: 'blueprint',
      nameExtractor: (m) => m[2],
    },
  ],
  endpoints: [
    { pattern: /@(?:\w+\.)?route\s*\(\s*["']([^"']+)["']/g, methodExtractor: () => 'GET', pathExtractor: (m) => m[1] },
  ],
};

// Express patterns
const EXPRESS_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.)?Router\s*\(\s*\)/,
      type: 'route',
      nameExtractor: (m) => m[1],
    },
    {
      pattern: /(?:export\s+)?(?:const|function)\s+(\w+[Mm]iddleware)\s*[=:]/,
      type: 'middleware',
      nameExtractor: (m) => m[1],
    },
  ],
  endpoints: [],
};

// Pattern registry
const FRAMEWORK_PATTERNS: Record<FrameworkType, FrameworkPatterns> = {
  'spring-boot': SPRING_BOOT_PATTERNS,
  'nestjs': NESTJS_PATTERNS,
  'angular': ANGULAR_PATTERNS,
  'react': REACT_PATTERNS,
  'nextjs': REACT_PATTERNS,
  'vue': VUE_PATTERNS,
  'nuxt': VUE_PATTERNS,
  'django': DJANGO_PATTERNS,
  'fastapi': FASTAPI_PATTERNS,
  'flask': FLASK_PATTERNS,
  'express': EXPRESS_PATTERNS,
  'svelte': { components: [], endpoints: [] },
};

// ============================================================================
// Detection Service
// ============================================================================

const analysisCache = new Map<string, FrameworkAnalysis>();

function generateComponentId(filePath: string, name: string, type: string): string {
  const data = `${filePath}:${name}:${type}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 12);
}

/**
 * Detect framework from file contents
 */
function detectFrameworkFromFiles(fileContents: Map<string, string>): FrameworkType[] {
  const detectedFrameworks: FrameworkType[] = [];
  const sortedRules = [...FRAMEWORK_DETECTION_RULES].sort((a, b) => b.priority - a.priority);
  
  // Check config files first
  for (const rule of sortedRules) {
    for (const configFile of rule.configFiles) {
      const content = fileContents.get(configFile.toLowerCase());
      if (content) {
        for (const pattern of rule.contentPatterns) {
          if (pattern.test(content)) {
            if (!detectedFrameworks.includes(rule.framework)) {
              detectedFrameworks.push(rule.framework);
              console.log(`[FrameworkDetector] Detected ${rule.framework} via ${configFile}`);
            }
            break;
          }
        }
      }
    }
  }
  
  // Also detect from code patterns
  for (const [filePath, content] of fileContents) {
    // Spring Boot from annotations
    if (/@RestController|@Service|@Repository|@Entity|@Component|@Configuration/.test(content)) {
      if (!detectedFrameworks.includes('spring-boot')) {
        detectedFrameworks.push('spring-boot');
        console.log(`[FrameworkDetector] Detected spring-boot from annotations in ${filePath}`);
      }
    }
    
    // Angular from decorators
    if (/@Component\s*\(\s*\{[\s\S]*?selector/.test(content) || /@NgModule\s*\(/.test(content)) {
      if (!detectedFrameworks.includes('angular')) {
        detectedFrameworks.push('angular');
        console.log(`[FrameworkDetector] Detected angular from decorators in ${filePath}`);
      }
    }
    
    // NestJS from decorators
    if (/@Controller\s*\(/.test(content) && (/@Injectable\s*\(/.test(content) || /@Module\s*\(/.test(content))) {
      if (!detectedFrameworks.includes('nestjs')) {
        detectedFrameworks.push('nestjs');
        console.log(`[FrameworkDetector] Detected nestjs from decorators in ${filePath}`);
      }
    }
    
    // Vue from SFC or composition API
    if (/<script\s+setup|defineComponent|defineStore/.test(content) || filePath.endsWith('.vue')) {
      if (!detectedFrameworks.includes('vue') && !detectedFrameworks.includes('nuxt')) {
        detectedFrameworks.push('vue');
        console.log(`[FrameworkDetector] Detected vue from patterns in ${filePath}`);
      }
    }
    
    // Django from Python patterns
    if (/class\s+\w+\s*\(\s*(?:models\.Model|APIView|ViewSet)/.test(content)) {
      if (!detectedFrameworks.includes('django')) {
        detectedFrameworks.push('django');
        console.log(`[FrameworkDetector] Detected django from patterns in ${filePath}`);
      }
    }
  }
  
  return detectedFrameworks;
}

/**
 * Extract components using framework-specific patterns
 */
function extractComponents(
  fileContents: Map<string, string>,
  framework: FrameworkType
): { components: FrameworkComponent[]; endpoints: EndpointInfo[] } {
  const patterns = FRAMEWORK_PATTERNS[framework];
  if (!patterns) {
    return { components: [], endpoints: [] };
  }
  
  const components: FrameworkComponent[] = [];
  const endpoints: EndpointInfo[] = [];
  const processedKeys = new Set<string>();
  
  for (const [filePath, content] of fileContents) {
    // Extract components
    for (const pattern of patterns.components) {
      const match = content.match(pattern.pattern);
      if (match) {
        const name = pattern.nameExtractor(match, content, filePath);
        if (!name) continue;
        
        const key = `${filePath}:${name}:${pattern.type}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);
        
        const metadata = pattern.metadataExtractor?.(match, content) || {};
        
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const startLine = (beforeMatch.match(/\n/g) || []).length + 1;
        
        components.push({
          id: generateComponentId(filePath, name, pattern.type),
          name,
          type: pattern.type,
          framework,
          filePath,
          startLine,
          endLine: startLine,
          metadata,
        });
        
        console.log(`[FrameworkDetector] Found ${pattern.type}: ${name} in ${path.basename(filePath)}`);
      }
    }
    
    // Extract endpoints
    for (const endpointPattern of patterns.endpoints) {
      const regex = new RegExp(endpointPattern.pattern.source, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const method = endpointPattern.methodExtractor(match);
        const endpointPath = endpointPattern.pathExtractor(match);
        
        const afterMatch = content.substring(match.index + match[0].length);
        const handlerMatch = afterMatch.match(/(?:public\s+)?(?:\w+\s+)?(\w+)\s*\(/);
        const handlerName = handlerMatch?.[1] || 'handler';
        
        const key = `${method}:${endpointPath}:${filePath}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);
        
        const beforeMatch = content.substring(0, match.index);
        const line = (beforeMatch.match(/\n/g) || []).length + 1;
        
        endpoints.push({
          method,
          path: endpointPath,
          handlerName,
          filePath,
          line,
        });
      }
    }
  }
  
  return { components, endpoints };
}

/**
 * Filter files that belong to a project
 */
function filterFilesByProject(files: [string, any][], projectId: string): [string, any][] {
  const normalizedProjectId = projectId.toLowerCase();
  
  return files.filter(([filePath]) => {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    return normalizedPath.includes(normalizedProjectId) ||
           normalizedPath.includes(normalizedProjectId.replace(/_/g, '-')) ||
           normalizedPath.includes(normalizedProjectId.replace(/-/g, '_'));
  });
}

/**
 * Main analysis function - follows same pattern as relationsAnalyzerService
 */
export async function analyzeFrameworks(projectId: string): Promise<FrameworkAnalysis> {
  console.log(`[FrameworkDetector] ========================================`);
  console.log(`[FrameworkDetector] Analyzing project: ${projectId}`);
  
  const mbService = getMemoryBankService();
  const mbPath = mbService.getMemoryBankPath();
  
  console.log(`[FrameworkDetector] Memory Bank path: ${mbPath || 'NOT CONFIGURED'}`);
  
  if (!mbPath) {
    throw new Error('Memory Bank path not configured');
  }
  
  // Load index metadata (same as relationsAnalyzerService)
  const indexMeta = await mbService.loadIndexMetadata();
  if (!indexMeta) {
    throw new Error('No index metadata found. Ensure the project has been indexed.');
  }
  
  const allFiles = Object.entries(indexMeta.files || {});
  console.log(`[FrameworkDetector] Total indexed files: ${allFiles.length}`);
  
  if (allFiles.length === 0) {
    throw new Error('Index metadata contains no files.');
  }
  
  // Filter files for this project
  const projectFiles = filterFilesByProject(allFiles, projectId);
  console.log(`[FrameworkDetector] Project files: ${projectFiles.length}`);
  
  if (projectFiles.length === 0) {
    console.log(`[FrameworkDetector] No files found for project "${projectId}"`);
    return {
      projectId,
      frameworks: [],
      components: [],
      componentsByType: new Map(),
      endpoints: [],
      analyzedAt: Date.now(),
      fileCount: 0,
    };
  }
  
  // Determine base directory for resolving file paths (same as relationsAnalyzerService)
  const sampleFilePath = projectFiles[0]?.[0] || '';
  const isRelativePath = sampleFilePath.startsWith('.') || !path.isAbsolute(sampleFilePath);
  const baseDir = isRelativePath ? mbPath : '';
  
  console.log(`[FrameworkDetector] File paths are ${isRelativePath ? 'relative' : 'absolute'}`);
  console.log(`[FrameworkDetector] Base directory: ${baseDir || '(absolute paths)'}`);
  
  // Read file contents from disk
  const fileContents = new Map<string, string>();
  let filesRead = 0;
  let filesSkipped = 0;
  
  for (const [filePath] of projectFiles) {
    try {
      const resolvedPath = path.resolve(baseDir, filePath);
      
      if (fs.existsSync(resolvedPath)) {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        fileContents.set(filePath, content);
        
        // Also store by filename for config file detection
        const fileName = path.basename(filePath).toLowerCase();
        if (!fileContents.has(fileName)) {
          fileContents.set(fileName, content);
        }
        
        filesRead++;
      } else {
        filesSkipped++;
      }
    } catch (error) {
      filesSkipped++;
    }
  }
  
  console.log(`[FrameworkDetector] Files read: ${filesRead}, skipped: ${filesSkipped}`);
  
  if (filesRead === 0) {
    console.log(`[FrameworkDetector] No files could be read from disk`);
    return {
      projectId,
      frameworks: [],
      components: [],
      componentsByType: new Map(),
      endpoints: [],
      analyzedAt: Date.now(),
      fileCount: projectFiles.length,
    };
  }
  
  // Step 1: Detect framework(s)
  const detectedFrameworks = detectFrameworkFromFiles(fileContents);
  console.log(`[FrameworkDetector] Detected frameworks: ${detectedFrameworks.join(', ') || 'None'}`);
  
  // Step 2: Extract components for each detected framework
  const allComponents: FrameworkComponent[] = [];
  const allEndpoints: EndpointInfo[] = [];
  
  for (const framework of detectedFrameworks) {
    const { components, endpoints } = extractComponents(fileContents, framework);
    allComponents.push(...components);
    allEndpoints.push(...endpoints);
  }
  
  // Group by type
  const componentsByType = new Map<FrameworkComponentType, FrameworkComponent[]>();
  for (const comp of allComponents) {
    if (!componentsByType.has(comp.type)) {
      componentsByType.set(comp.type, []);
    }
    componentsByType.get(comp.type)!.push(comp);
  }
  
  const analysis: FrameworkAnalysis = {
    projectId,
    frameworks: detectedFrameworks,
    components: allComponents,
    componentsByType,
    endpoints: allEndpoints,
    analyzedAt: Date.now(),
    fileCount: projectFiles.length,
  };
  
  analysisCache.set(projectId, analysis);
  
  console.log(`[FrameworkDetector] Analysis complete:`);
  console.log(`[FrameworkDetector]   - Frameworks: ${analysis.frameworks.join(', ') || 'None'}`);
  console.log(`[FrameworkDetector]   - Components: ${allComponents.length}`);
  console.log(`[FrameworkDetector]   - Endpoints: ${allEndpoints.length}`);
  console.log(`[FrameworkDetector] ========================================`);
  
  return analysis;
}

/**
 * Get cached analysis or perform new analysis
 */
export async function getFrameworkAnalysis(projectId: string, forceRefresh: boolean = false): Promise<FrameworkAnalysis | null> {
  if (!forceRefresh && analysisCache.has(projectId)) {
    return analysisCache.get(projectId)!;
  }

  try {
    return await analyzeFrameworks(projectId);
  } catch (error) {
    console.error(`[FrameworkDetector] Error analyzing project ${projectId}:`, error);
    return null;
  }
}

/**
 * Clear analysis cache
 */
export function clearAnalysisCache(projectId?: string): void {
  if (projectId) {
    analysisCache.delete(projectId);
  } else {
    analysisCache.clear();
  }
}

/**
 * Check if project has detected frameworks
 */
export async function hasFrameworkDetected(projectId: string): Promise<boolean> {
  const analysis = await getFrameworkAnalysis(projectId);
  return analysis !== null && analysis.frameworks.length > 0;
}

/**
 * Get primary framework
 */
export function getPrimaryFramework(analysis: FrameworkAnalysis): FrameworkType | null {
  if (analysis.frameworks.length === 0) return null;
  
  const counts = new Map<FrameworkType, number>();
  for (const comp of analysis.components) {
    counts.set(comp.framework, (counts.get(comp.framework) || 0) + 1);
  }

  let maxCount = 0;
  let primary: FrameworkType | null = null;
  
  for (const [framework, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      primary = framework;
    }
  }

  return primary || analysis.frameworks[0];
}
