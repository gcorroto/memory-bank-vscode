/**
 * @fileoverview Framework Detector Service
 * Detects project framework first, then extracts components
 * 
 * Approach:
 * 1. Detect project framework by examining config files (pom.xml, package.json, etc.)
 * 2. Once framework is known, extract components using framework-specific patterns
 */

import * as vscode from 'vscode';
import * as path from 'path';
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
  /** File patterns to look for */
  configFiles: string[];
  /** Content patterns that confirm the framework */
  contentPatterns: RegExp[];
  /** Priority (higher = checked first) */
  priority: number;
}

const FRAMEWORK_DETECTION_RULES: FrameworkDetectionRule[] = [
  // Spring Boot (Java/Kotlin)
  {
    framework: 'spring-boot',
    configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    contentPatterns: [
      /spring-boot-starter/,
      /org\.springframework\.boot/,
      /springBootVersion/,
    ],
    priority: 100,
  },
  // NestJS
  {
    framework: 'nestjs',
    configFiles: ['package.json'],
    contentPatterns: [
      /@nestjs\/core/,
      /@nestjs\/common/,
    ],
    priority: 90,
  },
  // Angular
  {
    framework: 'angular',
    configFiles: ['angular.json', 'package.json'],
    contentPatterns: [
      /@angular\/core/,
      /@angular\/common/,
    ],
    priority: 90,
  },
  // Next.js (check before React)
  {
    framework: 'nextjs',
    configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts', 'package.json'],
    contentPatterns: [
      /"next":/,
      /from ['"]next/,
    ],
    priority: 85,
  },
  // Nuxt (check before Vue)
  {
    framework: 'nuxt',
    configFiles: ['nuxt.config.js', 'nuxt.config.ts', 'package.json'],
    contentPatterns: [
      /"nuxt":/,
      /from ['"]nuxt/,
    ],
    priority: 85,
  },
  // React
  {
    framework: 'react',
    configFiles: ['package.json'],
    contentPatterns: [
      /"react":/,
      /"react-dom":/,
    ],
    priority: 80,
  },
  // Vue
  {
    framework: 'vue',
    configFiles: ['vue.config.js', 'vite.config.ts', 'package.json'],
    contentPatterns: [
      /"vue":/,
      /@vue\/cli/,
    ],
    priority: 80,
  },
  // Django
  {
    framework: 'django',
    configFiles: ['manage.py', 'requirements.txt', 'setup.py', 'pyproject.toml'],
    contentPatterns: [
      /django/i,
      /DJANGO_SETTINGS_MODULE/,
    ],
    priority: 90,
  },
  // FastAPI
  {
    framework: 'fastapi',
    configFiles: ['requirements.txt', 'setup.py', 'pyproject.toml', 'main.py'],
    contentPatterns: [
      /fastapi/i,
      /from fastapi import/,
    ],
    priority: 85,
  },
  // Flask
  {
    framework: 'flask',
    configFiles: ['requirements.txt', 'setup.py', 'pyproject.toml', 'app.py'],
    contentPatterns: [
      /flask/i,
      /from flask import/,
    ],
    priority: 80,
  },
  // Express
  {
    framework: 'express',
    configFiles: ['package.json'],
    contentPatterns: [
      /"express":/,
    ],
    priority: 70,
  },
  // Svelte
  {
    framework: 'svelte',
    configFiles: ['svelte.config.js', 'package.json'],
    contentPatterns: [
      /"svelte":/,
      /@sveltejs/,
    ],
    priority: 80,
  },
];

// ============================================================================
// Component Extraction Patterns (per framework)
// ============================================================================

interface ComponentPattern {
  /** Regex to match the component */
  pattern: RegExp;
  /** Component type */
  type: FrameworkComponentType;
  /** Extract component name from match */
  nameExtractor: (match: RegExpMatchArray, content: string, filePath: string) => string;
  /** Optional metadata extractor */
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
    {
      pattern: /@Injectable\s*\(\s*\)[\s\S]*?(?:export\s+)?class\s+(\w+Guard)/,
      type: 'guard',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Injectable'] }),
    },
    {
      pattern: /@Injectable\s*\(\s*\)[\s\S]*?(?:export\s+)?class\s+(\w+Interceptor)/,
      type: 'interceptor',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Injectable'] }),
    },
  ],
  endpoints: [
    { pattern: /@Get\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g, methodExtractor: () => 'GET', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@Post\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g, methodExtractor: () => 'POST', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@Put\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g, methodExtractor: () => 'PUT', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@Delete\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g, methodExtractor: () => 'DELETE', pathExtractor: (m) => m[1] || '/' },
    { pattern: /@Patch\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g, methodExtractor: () => 'PATCH', pathExtractor: (m) => m[1] || '/' },
  ],
};

// Angular patterns
const ANGULAR_PATTERNS: FrameworkPatterns = {
  components: [
    {
      pattern: /@Component\s*\(\s*\{[\s\S]*?\}\s*\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'component',
      nameExtractor: (m) => m[1],
      metadataExtractor: (_, content) => {
        const selector = content.match(/selector\s*:\s*['"]([^'"]+)['"]/);
        return { selector: selector?.[1], decorators: ['@Component'] };
      },
    },
    {
      pattern: /@Injectable\s*\([\s\S]*?\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'service',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Injectable'] }),
    },
    {
      pattern: /@NgModule\s*\([\s\S]*?\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'module',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@NgModule'] }),
    },
    {
      pattern: /@Directive\s*\([\s\S]*?\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'directive',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Directive'] }),
    },
    {
      pattern: /@Pipe\s*\([\s\S]*?\)[\s\S]*?(?:export\s+)?class\s+(\w+)/,
      type: 'pipe',
      nameExtractor: (m) => m[1],
      metadataExtractor: () => ({ decorators: ['@Pipe'] }),
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

// Next.js patterns (extends React)
const NEXTJS_PATTERNS: FrameworkPatterns = {
  components: [
    ...REACT_PATTERNS.components,
    // Pages detected by file path
    {
      pattern: /(?:export\s+default|module\.exports\s*=)/,
      type: 'page',
      nameExtractor: (_, __, filePath) => {
        if (filePath.includes('/pages/') || filePath.includes('\\pages\\')) {
          const name = path.basename(filePath, path.extname(filePath));
          return name === 'index' ? 'Home' : name.charAt(0).toUpperCase() + name.slice(1);
        }
        return '';
      },
    },
    // API routes
    {
      pattern: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/,
      type: 'api-route',
      nameExtractor: (m, _, filePath) => {
        const routeName = path.basename(path.dirname(filePath));
        return `${m[1]} /${routeName}`;
      },
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
    {
      pattern: /(?:export\s+)?(?:const|function)\s+(use[A-Z]\w+)\s*[=:]/,
      type: 'composable',
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
    {
      pattern: /@api_view\s*\(\s*\[[^\]]*\]\s*\)\s*def\s+(\w+)/,
      type: 'view',
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
    { pattern: /@(?:\w+\.)?route\s*\(\s*["']([^"']+)["'](?:.*?methods\s*=\s*\[["'](\w+)["']\])?/g, methodExtractor: (m) => (m[2] as HttpMethod) || 'GET', pathExtractor: (m) => m[1] },
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
  endpoints: [
    { pattern: /\.get\s*\(\s*["']([^"']+)["']/g, methodExtractor: () => 'GET', pathExtractor: (m) => m[1] },
    { pattern: /\.post\s*\(\s*["']([^"']+)["']/g, methodExtractor: () => 'POST', pathExtractor: (m) => m[1] },
    { pattern: /\.put\s*\(\s*["']([^"']+)["']/g, methodExtractor: () => 'PUT', pathExtractor: (m) => m[1] },
    { pattern: /\.delete\s*\(\s*["']([^"']+)["']/g, methodExtractor: () => 'DELETE', pathExtractor: (m) => m[1] },
  ],
};

// Pattern registry
const FRAMEWORK_PATTERNS: Record<FrameworkType, FrameworkPatterns> = {
  'spring-boot': SPRING_BOOT_PATTERNS,
  'nestjs': NESTJS_PATTERNS,
  'angular': ANGULAR_PATTERNS,
  'react': REACT_PATTERNS,
  'nextjs': NEXTJS_PATTERNS,
  'vue': VUE_PATTERNS,
  'nuxt': VUE_PATTERNS, // Nuxt uses Vue patterns
  'django': DJANGO_PATTERNS,
  'fastapi': FASTAPI_PATTERNS,
  'flask': FLASK_PATTERNS,
  'express': EXPRESS_PATTERNS,
  'svelte': { components: [], endpoints: [] }, // TODO: Add Svelte patterns
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
 * Step 1: Detect project framework by examining config files
 */
async function detectProjectFramework(chunks: any[], projectFiles: string[]): Promise<FrameworkType[]> {
  console.log(`[FrameworkDetector] Detecting framework from ${chunks.length} chunks...`);
  
  const detectedFrameworks: FrameworkType[] = [];
  
  // Sort rules by priority
  const sortedRules = [...FRAMEWORK_DETECTION_RULES].sort((a, b) => b.priority - a.priority);
  
  // Build a map of filename -> content for quick lookup
  const fileContents = new Map<string, string>();
  for (const chunk of chunks) {
    const fp = chunk.file_path || '';
    const fileName = path.basename(fp).toLowerCase();
    const existing = fileContents.get(fileName) || '';
    fileContents.set(fileName, existing + '\n' + (chunk.content || ''));
  }
  
  console.log(`[FrameworkDetector] Config files found: ${Array.from(fileContents.keys()).filter(f => 
    ['pom.xml', 'package.json', 'build.gradle', 'angular.json', 'requirements.txt', 'manage.py'].includes(f)
  ).join(', ')}`);
  
  // Check each rule
  for (const rule of sortedRules) {
    // Check if any config file exists
    for (const configFile of rule.configFiles) {
      const configFileName = configFile.toLowerCase();
      const content = fileContents.get(configFileName);
      
      if (content) {
        // Check if content matches any pattern
        for (const pattern of rule.contentPatterns) {
          if (pattern.test(content)) {
            console.log(`[FrameworkDetector] Detected ${rule.framework} via ${configFile}`);
            if (!detectedFrameworks.includes(rule.framework)) {
              detectedFrameworks.push(rule.framework);
            }
            break;
          }
        }
      }
    }
  }
  
  // If no framework detected by config files, try to infer from code patterns
  if (detectedFrameworks.length === 0) {
    console.log(`[FrameworkDetector] No framework detected from config, inferring from code...`);
    
    // Check for Spring annotations in Java files
    for (const chunk of chunks) {
      const content = chunk.content || '';
      if (/@RestController|@Service|@Repository|@Entity/.test(content)) {
        if (!detectedFrameworks.includes('spring-boot')) {
          detectedFrameworks.push('spring-boot');
          console.log(`[FrameworkDetector] Inferred spring-boot from annotations`);
        }
      }
      if (/@Component\s*\(\s*\{/.test(content) && /@angular\/core/.test(content)) {
        if (!detectedFrameworks.includes('angular')) {
          detectedFrameworks.push('angular');
        }
      }
    }
  }
  
  return detectedFrameworks;
}

/**
 * Step 2: Extract components using framework-specific patterns
 */
function extractComponents(
  chunks: any[],
  framework: FrameworkType
): { components: FrameworkComponent[]; endpoints: EndpointInfo[] } {
  const patterns = FRAMEWORK_PATTERNS[framework];
  if (!patterns) {
    console.log(`[FrameworkDetector] No patterns defined for ${framework}`);
    return { components: [], endpoints: [] };
  }
  
  const components: FrameworkComponent[] = [];
  const endpoints: EndpointInfo[] = [];
  const processedKeys = new Set<string>();
  
  console.log(`[FrameworkDetector] Extracting ${framework} components from ${chunks.length} chunks...`);
  
  for (const chunk of chunks) {
    const content = chunk.content || '';
    const filePath = chunk.file_path || '';
    const startLine = chunk.start_line || 1;
    
    // Extract components
    for (const pattern of patterns.components) {
      const match = content.match(pattern.pattern);
      if (match) {
        const name = pattern.nameExtractor(match, content, filePath);
        if (!name) continue; // Skip if name extraction failed
        
        const key = `${filePath}:${name}:${pattern.type}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);
        
        const metadata = pattern.metadataExtractor?.(match, content) || {};
        
        components.push({
          id: generateComponentId(filePath, name, pattern.type),
          name,
          type: pattern.type,
          framework,
          filePath,
          startLine,
          endLine: chunk.end_line || startLine,
          metadata,
        });
        
        console.log(`[FrameworkDetector] Found ${pattern.type}: ${name}`);
      }
    }
    
    // Extract endpoints
    for (const endpointPattern of patterns.endpoints) {
      const regex = new RegExp(endpointPattern.pattern.source, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const method = endpointPattern.methodExtractor(match);
        const endpointPath = endpointPattern.pathExtractor(match);
        
        // Find handler name
        const afterMatch = content.substring(match.index + match[0].length);
        const handlerMatch = afterMatch.match(/(?:public\s+)?(?:\w+\s+)?(\w+)\s*\(/);
        const handlerName = handlerMatch?.[1] || 'handler';
        
        const key = `${method}:${endpointPath}:${filePath}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);
        
        endpoints.push({
          method,
          path: endpointPath,
          handlerName,
          filePath,
          line: startLine,
        });
      }
    }
  }
  
  return { components, endpoints };
}

/**
 * Main analysis function
 */
export async function analyzeFrameworks(projectId: string): Promise<FrameworkAnalysis> {
  console.log(`[FrameworkDetector] ========================================`);
  console.log(`[FrameworkDetector] Analyzing project: ${projectId}`);
  
  const mbService = getMemoryBankService();
  const mbPath = mbService.getMemoryBankPath();
  
  if (!mbPath) {
    throw new Error('Memory Bank path not configured');
  }

  // Load index metadata
  const indexMeta = await mbService.loadIndexMetadata();
  if (!indexMeta?.files) {
    throw new Error('No indexed files found');
  }

  // Get files for this project
  const projectFiles = Object.keys(indexMeta.files).filter((filePath) => {
    const normalizedPath = filePath.toLowerCase();
    const normalizedProjectId = projectId.toLowerCase();
    return normalizedPath.includes(normalizedProjectId) ||
           normalizedPath.includes(normalizedProjectId.replace(/_/g, '-')) ||
           normalizedPath.includes(normalizedProjectId.replace(/-/g, '_'));
  });

  console.log(`[FrameworkDetector] Found ${projectFiles.length} project files in index`);

  // Connect to LanceDB
  let chunks: any[] = [];
  
  try {
    const lancedb = await import('@lancedb/lancedb');
    const db = await lancedb.connect(mbPath);
    const tableNames = await db.tableNames();
    
    if (!tableNames.includes('code_chunks')) {
      throw new Error('No code_chunks table found');
    }
    
    const table = await db.openTable('code_chunks');
    
    // Get all chunks
    const allChunks = await table.query().toArray();
    console.log(`[FrameworkDetector] Total chunks in DB: ${allChunks.length}`);
    
    // Get unique project_ids for debugging
    const uniqueProjectIds = new Set<string>();
    for (const c of allChunks as any[]) {
      if (c.project_id) uniqueProjectIds.add(c.project_id);
    }
    console.log(`[FrameworkDetector] Unique project_ids: ${Array.from(uniqueProjectIds).join(', ')}`);
    
    // Try to find chunks by project_id or file_path
    const normalizedProjectId = projectId.toLowerCase();
    
    // First try exact project_id match
    chunks = (allChunks as any[]).filter((c: any) => 
      c.project_id === projectId
    );
    
    // If no exact match, try case-insensitive
    if (chunks.length === 0) {
      chunks = (allChunks as any[]).filter((c: any) =>
        c.project_id?.toLowerCase() === normalizedProjectId
      );
    }
    
    // If still no match, filter by file_path
    if (chunks.length === 0) {
      console.log(`[FrameworkDetector] No project_id match, filtering by file_path...`);
      chunks = (allChunks as any[]).filter((c: any) => {
        const fp = (c.file_path || '').toLowerCase();
        return fp.includes(normalizedProjectId) ||
               fp.includes(normalizedProjectId.replace(/_/g, '-')) ||
               fp.includes(normalizedProjectId.replace(/-/g, '_'));
      });
    }
    
  } catch (error) {
    console.error(`[FrameworkDetector] Error connecting to LanceDB:`, error);
    throw error;
  }

  console.log(`[FrameworkDetector] Retrieved ${chunks.length} chunks for analysis`);
  
  if (chunks.length === 0) {
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
  const detectedFrameworks = await detectProjectFramework(chunks, projectFiles);
  console.log(`[FrameworkDetector] Detected frameworks: ${detectedFrameworks.join(', ') || 'None'}`);
  
  // Step 2: Extract components for each detected framework
  const allComponents: FrameworkComponent[] = [];
  const allEndpoints: EndpointInfo[] = [];
  
  for (const framework of detectedFrameworks) {
    const { components, endpoints } = extractComponents(chunks, framework);
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
  console.log(`[FrameworkDetector]   Frameworks: ${analysis.frameworks.join(', ') || 'None'}`);
  console.log(`[FrameworkDetector]   Components: ${allComponents.length}`);
  console.log(`[FrameworkDetector]   Endpoints: ${allEndpoints.length}`);
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
