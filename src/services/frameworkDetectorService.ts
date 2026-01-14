/**
 * @fileoverview Framework Detector Service
 * Detects framework components from indexed code chunks
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
// Pattern Definitions
// ============================================================================

interface DetectionPattern {
  /** Regex pattern to match */
  pattern: RegExp;
  /** Component type this pattern identifies */
  componentType: FrameworkComponentType;
  /** Framework this pattern belongs to */
  framework: FrameworkType;
  /** Extract name from match groups */
  nameExtractor?: (match: RegExpMatchArray, content: string) => string;
  /** Extract additional metadata */
  metadataExtractor?: (match: RegExpMatchArray, content: string) => Record<string, any>;
}

interface EndpointPattern {
  /** Regex pattern for endpoint annotation/decorator */
  pattern: RegExp;
  /** Framework this belongs to */
  framework: FrameworkType;
  /** Extract HTTP method */
  methodExtractor: (match: RegExpMatchArray) => HttpMethod;
  /** Extract path */
  pathExtractor: (match: RegExpMatchArray) => string;
}

// ============================================================================
// Spring Boot Patterns
// ============================================================================

const SPRING_PATTERNS: DetectionPattern[] = [
  // Controllers
  {
    pattern: /@RestController\s*(?:\([^)]*\))?\s*(?:@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\))?\s*(?:public\s+)?class\s+(\w+)/,
    componentType: 'controller',
    framework: 'spring-boot',
    nameExtractor: (match) => match[2],
    metadataExtractor: (match) => ({ basePath: match[1] || '', decorators: ['@RestController'] }),
  },
  {
    pattern: /@Controller\s*(?:\([^)]*\))?\s*(?:@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\))?\s*(?:public\s+)?class\s+(\w+)/,
    componentType: 'controller',
    framework: 'spring-boot',
    nameExtractor: (match) => match[2],
    metadataExtractor: (match) => ({ basePath: match[1] || '', decorators: ['@Controller'] }),
  },
  // Services
  {
    pattern: /@Service\s*(?:\([^)]*\))?\s*(?:public\s+)?class\s+(\w+)/,
    componentType: 'service',
    framework: 'spring-boot',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@Service'] }),
  },
  // Repositories
  {
    pattern: /@Repository\s*(?:\([^)]*\))?\s*(?:public\s+)?(?:interface|class)\s+(\w+)/,
    componentType: 'repository',
    framework: 'spring-boot',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@Repository'] }),
  },
  // Components
  {
    pattern: /@Component\s*(?:\([^)]*\))?\s*(?:public\s+)?class\s+(\w+)/,
    componentType: 'component',
    framework: 'spring-boot',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@Component'] }),
  },
  // Configuration
  {
    pattern: /@Configuration\s*(?:\([^)]*\))?\s*(?:public\s+)?class\s+(\w+)/,
    componentType: 'configuration',
    framework: 'spring-boot',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@Configuration'] }),
  },
  // Entities
  {
    pattern: /@Entity\s*(?:\([^)]*\))?\s*(?:@Table\s*\([^)]*\))?\s*(?:public\s+)?class\s+(\w+)/,
    componentType: 'entity',
    framework: 'spring-boot',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@Entity'] }),
  },
  // Exception Handlers
  {
    pattern: /@ControllerAdvice\s*(?:\([^)]*\))?\s*(?:public\s+)?class\s+(\w+)/,
    componentType: 'exception-handler',
    framework: 'spring-boot',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@ControllerAdvice'] }),
  },
];

const SPRING_ENDPOINT_PATTERNS: EndpointPattern[] = [
  {
    pattern: /@GetMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
    framework: 'spring-boot',
    methodExtractor: () => 'GET',
    pathExtractor: (match) => match[1],
  },
  {
    pattern: /@PostMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
    framework: 'spring-boot',
    methodExtractor: () => 'POST',
    pathExtractor: (match) => match[1],
  },
  {
    pattern: /@PutMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
    framework: 'spring-boot',
    methodExtractor: () => 'PUT',
    pathExtractor: (match) => match[1],
  },
  {
    pattern: /@DeleteMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
    framework: 'spring-boot',
    methodExtractor: () => 'DELETE',
    pathExtractor: (match) => match[1],
  },
  {
    pattern: /@PatchMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
    framework: 'spring-boot',
    methodExtractor: () => 'PATCH',
    pathExtractor: (match) => match[1],
  },
  {
    pattern: /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*,\s*method\s*=\s*RequestMethod\.(\w+)/g,
    framework: 'spring-boot',
    methodExtractor: (match) => match[2] as HttpMethod,
    pathExtractor: (match) => match[1],
  },
];

// ============================================================================
// NestJS Patterns
// ============================================================================

const NESTJS_PATTERNS: DetectionPattern[] = [
  {
    pattern: /@Controller\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)\s*(?:export\s+)?class\s+(\w+)/,
    componentType: 'controller',
    framework: 'nestjs',
    nameExtractor: (match) => match[2],
    metadataExtractor: (match) => ({ basePath: match[1] || '', decorators: ['@Controller'] }),
  },
  {
    pattern: /@Injectable\s*\(\s*\)\s*(?:export\s+)?class\s+(\w+)(?:Service|Provider)/,
    componentType: 'service',
    framework: 'nestjs',
    nameExtractor: (match) => match[1] + (match[0].includes('Service') ? 'Service' : 'Provider'),
    metadataExtractor: () => ({ decorators: ['@Injectable'] }),
  },
  {
    pattern: /@Module\s*\(\s*\{[^}]*\}\s*\)\s*(?:export\s+)?class\s+(\w+)/,
    componentType: 'module',
    framework: 'nestjs',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@Module'] }),
  },
  {
    pattern: /@Injectable\s*\(\s*\)\s*(?:export\s+)?class\s+(\w+)Guard/,
    componentType: 'guard',
    framework: 'nestjs',
    nameExtractor: (match) => match[1] + 'Guard',
    metadataExtractor: () => ({ decorators: ['@Injectable'] }),
  },
  {
    pattern: /@Injectable\s*\(\s*\)\s*(?:export\s+)?class\s+(\w+)Interceptor/,
    componentType: 'interceptor',
    framework: 'nestjs',
    nameExtractor: (match) => match[1] + 'Interceptor',
    metadataExtractor: () => ({ decorators: ['@Injectable'] }),
  },
  {
    pattern: /@Catch\s*\([^)]*\)\s*(?:export\s+)?class\s+(\w+)/,
    componentType: 'filter',
    framework: 'nestjs',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@Catch'] }),
  },
];

const NESTJS_ENDPOINT_PATTERNS: EndpointPattern[] = [
  {
    pattern: /@Get\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g,
    framework: 'nestjs',
    methodExtractor: () => 'GET',
    pathExtractor: (match) => match[1] || '/',
  },
  {
    pattern: /@Post\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g,
    framework: 'nestjs',
    methodExtractor: () => 'POST',
    pathExtractor: (match) => match[1] || '/',
  },
  {
    pattern: /@Put\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g,
    framework: 'nestjs',
    methodExtractor: () => 'PUT',
    pathExtractor: (match) => match[1] || '/',
  },
  {
    pattern: /@Delete\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g,
    framework: 'nestjs',
    methodExtractor: () => 'DELETE',
    pathExtractor: (match) => match[1] || '/',
  },
  {
    pattern: /@Patch\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/g,
    framework: 'nestjs',
    methodExtractor: () => 'PATCH',
    pathExtractor: (match) => match[1] || '/',
  },
];

// ============================================================================
// Angular Patterns
// ============================================================================

const ANGULAR_PATTERNS: DetectionPattern[] = [
  {
    pattern: /@Component\s*\(\s*\{[\s\S]*?selector\s*:\s*['"]([^'"]+)['"][\s\S]*?\}\s*\)\s*(?:export\s+)?class\s+(\w+)/,
    componentType: 'component',
    framework: 'angular',
    nameExtractor: (match) => match[2],
    metadataExtractor: (match) => ({ decorators: ['@Component'], selector: match[1] }),
  },
  {
    pattern: /@Injectable\s*\(\s*\{[\s\S]*?\}\s*\)\s*(?:export\s+)?class\s+(\w+)/,
    componentType: 'service',
    framework: 'angular',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@Injectable'] }),
  },
  {
    pattern: /@NgModule\s*\(\s*\{[\s\S]*?\}\s*\)\s*(?:export\s+)?class\s+(\w+)/,
    componentType: 'module',
    framework: 'angular',
    nameExtractor: (match) => match[1],
    metadataExtractor: () => ({ decorators: ['@NgModule'] }),
  },
  {
    pattern: /@Directive\s*\(\s*\{[\s\S]*?selector\s*:\s*['"]([^'"]+)['"][\s\S]*?\}\s*\)\s*(?:export\s+)?class\s+(\w+)/,
    componentType: 'directive',
    framework: 'angular',
    nameExtractor: (match) => match[2],
    metadataExtractor: (match) => ({ decorators: ['@Directive'], selector: match[1] }),
  },
  {
    pattern: /@Pipe\s*\(\s*\{[\s\S]*?name\s*:\s*['"]([^'"]+)['"][\s\S]*?\}\s*\)\s*(?:export\s+)?class\s+(\w+)/,
    componentType: 'pipe',
    framework: 'angular',
    nameExtractor: (match) => match[2],
    metadataExtractor: (match) => ({ decorators: ['@Pipe'], pipeName: match[1] }),
  },
  {
    pattern: /@Injectable\s*\(\s*\{[\s\S]*?\}\s*\)\s*(?:export\s+)?class\s+(\w+)Guard/,
    componentType: 'guard',
    framework: 'angular',
    nameExtractor: (match) => match[1] + 'Guard',
    metadataExtractor: () => ({ decorators: ['@Injectable'] }),
  },
];

// ============================================================================
// React/Next.js Patterns
// ============================================================================

const REACT_PATTERNS: DetectionPattern[] = [
  // Hooks
  {
    pattern: /(?:export\s+)?(?:const|function)\s+(use[A-Z]\w+)\s*[=:]/,
    componentType: 'hook',
    framework: 'react',
    nameExtractor: (match) => match[1],
  },
  // Context
  {
    pattern: /(?:export\s+)?const\s+(\w+Context)\s*=\s*(?:React\.)?createContext/,
    componentType: 'context',
    framework: 'react',
    nameExtractor: (match) => match[1],
  },
  // Provider
  {
    pattern: /(?:export\s+)?(?:const|function)\s+(\w+Provider)\s*[=:]/,
    componentType: 'provider',
    framework: 'react',
    nameExtractor: (match) => match[1],
  },
];

const NEXTJS_PATTERNS: DetectionPattern[] = [
  // API Routes - detect by file path pattern in pages/api or app/api
  {
    pattern: /(?:export\s+default\s+(?:async\s+)?function\s+(\w+)|export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH))/,
    componentType: 'api-route',
    framework: 'nextjs',
    nameExtractor: (match) => match[1] || match[2] || 'handler',
  },
];

// ============================================================================
// Vue.js Patterns
// ============================================================================

const VUE_PATTERNS: DetectionPattern[] = [
  // Composition API components
  {
    pattern: /<script\s+setup[^>]*>/,
    componentType: 'component',
    framework: 'vue',
    nameExtractor: (_, content) => {
      // Extract name from filename or name option
      const nameMatch = content.match(/name\s*:\s*['"](\w+)['"]/);
      return nameMatch ? nameMatch[1] : 'Component';
    },
  },
  // Options API components
  {
    pattern: /(?:export\s+default\s+)?defineComponent\s*\(\s*\{/,
    componentType: 'component',
    framework: 'vue',
    nameExtractor: (_, content) => {
      const nameMatch = content.match(/name\s*:\s*['"](\w+)['"]/);
      return nameMatch ? nameMatch[1] : 'Component';
    },
  },
  // Pinia stores
  {
    pattern: /(?:export\s+)?const\s+(\w+)\s*=\s*defineStore\s*\(/,
    componentType: 'store',
    framework: 'vue',
    nameExtractor: (match) => match[1],
  },
  // Composables
  {
    pattern: /(?:export\s+)?(?:const|function)\s+(use[A-Z]\w+)\s*[=:]/,
    componentType: 'composable',
    framework: 'vue',
    nameExtractor: (match) => match[1],
  },
];

// ============================================================================
// Django Patterns
// ============================================================================

const DJANGO_PATTERNS: DetectionPattern[] = [
  // Class-based views
  {
    pattern: /class\s+(\w+)\s*\(\s*(?:APIView|ViewSet|ModelViewSet|GenericAPIView|View|TemplateView|ListView|DetailView|CreateView|UpdateView|DeleteView)/,
    componentType: 'view',
    framework: 'django',
    nameExtractor: (match) => match[1],
  },
  // Models
  {
    pattern: /class\s+(\w+)\s*\(\s*models\.Model\s*\)/,
    componentType: 'model',
    framework: 'django',
    nameExtractor: (match) => match[1],
  },
  // Serializers
  {
    pattern: /class\s+(\w+)\s*\(\s*(?:serializers\.(?:Serializer|ModelSerializer|HyperlinkedModelSerializer))/,
    componentType: 'serializer',
    framework: 'django',
    nameExtractor: (match) => match[1],
  },
  // Function-based views with decorators
  {
    pattern: /@api_view\s*\(\s*\[[^\]]*\]\s*\)\s*def\s+(\w+)/,
    componentType: 'view',
    framework: 'django',
    nameExtractor: (match) => match[1],
  },
];

// ============================================================================
// Flask Patterns
// ============================================================================

const FLASK_PATTERNS: DetectionPattern[] = [
  // Blueprints
  {
    pattern: /(\w+)\s*=\s*Blueprint\s*\(\s*['"](\w+)['"]/,
    componentType: 'blueprint',
    framework: 'flask',
    nameExtractor: (match) => match[2],
  },
  // Routes
  {
    pattern: /@(?:\w+\.)?route\s*\(\s*['"]([^'"]+)['"]/,
    componentType: 'route',
    framework: 'flask',
    nameExtractor: (match) => match[1],
  },
];

// ============================================================================
// Express Patterns
// ============================================================================

const EXPRESS_PATTERNS: DetectionPattern[] = [
  // Router
  {
    pattern: /(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.)?Router\s*\(\s*\)/,
    componentType: 'route',
    framework: 'express',
    nameExtractor: (match) => match[1],
  },
  // Middleware
  {
    pattern: /(?:export\s+)?(?:const|function)\s+(\w+Middleware|\w+middleware)\s*[=:]/,
    componentType: 'middleware',
    framework: 'express',
    nameExtractor: (match) => match[1],
  },
];

// ============================================================================
// All Patterns Combined
// ============================================================================

const ALL_PATTERNS: DetectionPattern[] = [
  ...SPRING_PATTERNS,
  ...NESTJS_PATTERNS,
  ...ANGULAR_PATTERNS,
  ...REACT_PATTERNS,
  ...NEXTJS_PATTERNS,
  ...VUE_PATTERNS,
  ...DJANGO_PATTERNS,
  ...FLASK_PATTERNS,
  ...EXPRESS_PATTERNS,
];

const ALL_ENDPOINT_PATTERNS: EndpointPattern[] = [
  ...SPRING_ENDPOINT_PATTERNS,
  ...NESTJS_ENDPOINT_PATTERNS,
];

// ============================================================================
// Detection Service
// ============================================================================

/**
 * Cache for framework analysis results
 */
const analysisCache = new Map<string, FrameworkAnalysis>();

/**
 * Generates a unique ID for a component
 */
function generateComponentId(filePath: string, name: string, type: string): string {
  const data = `${filePath}:${name}:${type}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 12);
}

/**
 * Detects frameworks and components from indexed chunks
 */
export async function analyzeFrameworks(projectId: string): Promise<FrameworkAnalysis> {
  console.log(`[FrameworkDetector] Analyzing frameworks for project: ${projectId}`);
  
  const mbService = getMemoryBankService();
  const mbPath = mbService.getMemoryBankPath();
  
  if (!mbPath) {
    throw new Error('Memory Bank path not configured');
  }

  // Load index metadata to get file list
  const indexMeta = await mbService.loadIndexMetadata();
  if (!indexMeta || !indexMeta.files) {
    throw new Error('No indexed files found');
  }

  // Get files for this project
  const projectFiles = Object.entries(indexMeta.files).filter(([filePath]) => {
    const normalizedPath = filePath.toLowerCase();
    const normalizedProjectId = projectId.toLowerCase();
    return normalizedPath.includes(normalizedProjectId) ||
           normalizedPath.includes(normalizedProjectId.replace(/_/g, '-')) ||
           normalizedPath.includes(normalizedProjectId.replace(/-/g, '_'));
  });

  console.log(`[FrameworkDetector] Found ${projectFiles.length} files for project ${projectId}`);

  // Connect to LanceDB to get chunk contents
  let lancedb: any;
  let db: any;
  let table: any;
  
  try {
    lancedb = await import('@lancedb/lancedb');
    db = await lancedb.connect(mbPath);
    const tableNames = await db.tableNames();
    
    if (!tableNames.includes('code_chunks')) {
      throw new Error('No code_chunks table found');
    }
    
    table = await db.openTable('code_chunks');
  } catch (error) {
    console.error(`[FrameworkDetector] Error connecting to LanceDB:`, error);
    throw error;
  }

  // Get all chunks for the project
  const chunks = await table.query()
    .where(`project_id = '${projectId}'`)
    .toArray();

  console.log(`[FrameworkDetector] Retrieved ${chunks.length} chunks`);

  // Detect components
  const detectedFrameworks = new Set<FrameworkType>();
  const components: FrameworkComponent[] = [];
  const endpoints: EndpointInfo[] = [];
  const processedFiles = new Set<string>();

  for (const chunk of chunks) {
    const content = chunk.content || '';
    const filePath = chunk.file_path || '';
    const startLine = chunk.start_line || 1;

    // Skip if already processed this file for the same component
    const fileKey = filePath;
    
    // Try all patterns
    for (const pattern of ALL_PATTERNS) {
      const match = content.match(pattern.pattern);
      if (match) {
        const name = pattern.nameExtractor ? pattern.nameExtractor(match, content) : match[1];
        const componentKey = `${filePath}:${name}:${pattern.componentType}`;
        
        if (!processedFiles.has(componentKey)) {
          processedFiles.add(componentKey);
          detectedFrameworks.add(pattern.framework);
          
          const metadata = pattern.metadataExtractor ? pattern.metadataExtractor(match, content) : {};
          
          components.push({
            id: generateComponentId(filePath, name, pattern.componentType),
            name,
            type: pattern.componentType,
            framework: pattern.framework,
            filePath,
            startLine,
            endLine: chunk.end_line || startLine,
            metadata,
          });

          console.log(`[FrameworkDetector] Found ${pattern.componentType}: ${name} (${pattern.framework})`);
        }
      }
    }

    // Detect endpoints
    for (const endpointPattern of ALL_ENDPOINT_PATTERNS) {
      const regex = new RegExp(endpointPattern.pattern.source, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const method = endpointPattern.methodExtractor(match);
        const path = endpointPattern.pathExtractor(match);
        
        // Find the handler name (next function/method after the annotation)
        const afterMatch = content.substring(match.index + match[0].length);
        const handlerMatch = afterMatch.match(/(?:public\s+)?(?:\w+\s+)?(\w+)\s*\(/);
        const handlerName = handlerMatch ? handlerMatch[1] : 'handler';

        const endpointKey = `${method}:${path}:${filePath}`;
        if (!processedFiles.has(endpointKey)) {
          processedFiles.add(endpointKey);
          
          endpoints.push({
            method,
            path,
            handlerName,
            filePath,
            line: startLine,
          });

          console.log(`[FrameworkDetector] Found endpoint: ${method} ${path}`);
        }
      }
    }
  }

  // Additional path-based detection for Next.js
  for (const [filePath] of projectFiles) {
    // Next.js pages
    if (filePath.match(/pages\/(?!api\/|_)[^/]+\.(tsx?|jsx?)$/)) {
      const pageName = path.basename(filePath, path.extname(filePath));
      const componentKey = `${filePath}:${pageName}:page`;
      
      if (!processedFiles.has(componentKey)) {
        processedFiles.add(componentKey);
        detectedFrameworks.add('nextjs');
        
        components.push({
          id: generateComponentId(filePath, pageName, 'page'),
          name: pageName === 'index' ? 'Home' : pageName,
          type: 'page',
          framework: 'nextjs',
          filePath,
          startLine: 1,
          endLine: 1,
        });
      }
    }
    
    // Next.js API routes
    if (filePath.match(/pages\/api\/[^/]+\.(tsx?|jsx?)$/) || filePath.match(/app\/api\/[^/]+\/route\.(tsx?|jsx?)$/)) {
      const routeName = path.basename(path.dirname(filePath));
      const componentKey = `${filePath}:${routeName}:api-route`;
      
      if (!processedFiles.has(componentKey)) {
        processedFiles.add(componentKey);
        detectedFrameworks.add('nextjs');
        
        components.push({
          id: generateComponentId(filePath, routeName, 'api-route'),
          name: routeName,
          type: 'api-route',
          framework: 'nextjs',
          filePath,
          startLine: 1,
          endLine: 1,
        });
      }
    }

    // Vue components by file extension
    if (filePath.endsWith('.vue')) {
      const componentName = path.basename(filePath, '.vue');
      const componentKey = `${filePath}:${componentName}:component`;
      
      if (!processedFiles.has(componentKey)) {
        processedFiles.add(componentKey);
        detectedFrameworks.add('vue');
        
        components.push({
          id: generateComponentId(filePath, componentName, 'component'),
          name: componentName,
          type: 'component',
          framework: 'vue',
          filePath,
          startLine: 1,
          endLine: 1,
        });
      }
    }
  }

  // Group components by type
  const componentsByType = new Map<FrameworkComponentType, FrameworkComponent[]>();
  for (const component of components) {
    if (!componentsByType.has(component.type)) {
      componentsByType.set(component.type, []);
    }
    componentsByType.get(component.type)!.push(component);
  }

  const analysis: FrameworkAnalysis = {
    projectId,
    frameworks: Array.from(detectedFrameworks),
    components,
    componentsByType,
    endpoints,
    analyzedAt: Date.now(),
    fileCount: projectFiles.length,
  };

  // Cache the result
  analysisCache.set(projectId, analysis);

  console.log(`[FrameworkDetector] Analysis complete:`);
  console.log(`  Frameworks: ${analysis.frameworks.join(', ') || 'None'}`);
  console.log(`  Components: ${components.length}`);
  console.log(`  Endpoints: ${endpoints.length}`);

  return analysis;
}

/**
 * Gets cached analysis or performs new analysis
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
 * Clears the analysis cache for a project
 */
export function clearAnalysisCache(projectId?: string): void {
  if (projectId) {
    analysisCache.delete(projectId);
  } else {
    analysisCache.clear();
  }
}

/**
 * Checks if a project has any framework detected
 */
export async function hasFrameworkDetected(projectId: string): Promise<boolean> {
  const analysis = await getFrameworkAnalysis(projectId);
  return analysis !== null && analysis.frameworks.length > 0;
}

/**
 * Gets the primary framework for a project
 */
export function getPrimaryFramework(analysis: FrameworkAnalysis): FrameworkType | null {
  if (analysis.frameworks.length === 0) return null;
  
  // Count components per framework
  const counts = new Map<FrameworkType, number>();
  for (const component of analysis.components) {
    counts.set(component.framework, (counts.get(component.framework) || 0) + 1);
  }

  // Return the one with most components
  let maxCount = 0;
  let primary: FrameworkType | null = null;
  
  for (const [framework, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      primary = framework;
    }
  }

  return primary;
}
