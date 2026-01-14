/**
 * @fileoverview Framework detection types
 * Types and interfaces for framework component detection and display
 */

/**
 * Supported framework types
 */
export type FrameworkType =
  // Backend frameworks
  | 'spring-boot'
  | 'nestjs'
  | 'django'
  | 'flask'
  | 'express'
  | 'fastapi'
  // Frontend frameworks
  | 'angular'
  | 'react'
  | 'nextjs'
  | 'vue'
  | 'nuxt'
  | 'svelte';

/**
 * Component types across all frameworks
 */
export type FrameworkComponentType =
  // Backend - Common
  | 'controller'
  | 'service'
  | 'repository'
  | 'component'
  | 'configuration'
  | 'entity'
  | 'endpoint'
  | 'middleware'
  | 'model'
  | 'serializer'
  | 'view'
  | 'route'
  | 'blueprint'
  | 'interceptor'
  | 'filter'
  | 'exception-handler'
  // Frontend - Common
  | 'page'
  | 'hook'
  | 'context'
  | 'store'
  | 'composable'
  | 'directive'
  | 'pipe'
  | 'guard'
  | 'module'
  | 'provider'
  | 'layout'
  | 'api-route';

/**
 * HTTP methods for endpoints
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Endpoint information extracted from code
 */
export interface EndpointInfo {
  method: HttpMethod;
  path: string;
  handlerName: string;
  filePath: string;
  line: number;
}

/**
 * A detected framework component
 */
export interface FrameworkComponent {
  /** Unique identifier */
  id: string;
  /** Display name (e.g., "UserController") */
  name: string;
  /** Component type */
  type: FrameworkComponentType;
  /** Framework this belongs to */
  framework: FrameworkType;
  /** File path */
  filePath: string;
  /** Start line in file */
  startLine: number;
  /** End line in file */
  endLine: number;
  /** Additional metadata */
  metadata?: {
    /** Endpoints for controllers */
    endpoints?: EndpointInfo[];
    /** Decorators/annotations found */
    decorators?: string[];
    /** Dependencies/injections */
    dependencies?: string[];
    /** Base path for controllers */
    basePath?: string;
    /** Description from comments */
    description?: string;
  };
}

/**
 * Result of framework detection for a project
 */
export interface FrameworkAnalysis {
  /** Project ID */
  projectId: string;
  /** Detected frameworks */
  frameworks: FrameworkType[];
  /** All detected components */
  components: FrameworkComponent[];
  /** Grouped by type */
  componentsByType: Map<FrameworkComponentType, FrameworkComponent[]>;
  /** All endpoints */
  endpoints: EndpointInfo[];
  /** Analysis timestamp */
  analyzedAt: number;
  /** Source file count */
  fileCount: number;
}

/**
 * Framework metadata for display
 */
export interface FrameworkInfo {
  type: FrameworkType;
  name: string;
  icon: string;
  color: string;
  languages: string[];
}

/**
 * Framework info registry
 */
export const FRAMEWORK_INFO: Record<FrameworkType, FrameworkInfo> = {
  'spring-boot': {
    type: 'spring-boot',
    name: 'Spring Boot',
    icon: 'spring',
    color: '#6DB33F',
    languages: ['java', 'kotlin'],
  },
  'nestjs': {
    type: 'nestjs',
    name: 'NestJS',
    icon: 'nestjs',
    color: '#E0234E',
    languages: ['typescript'],
  },
  'django': {
    type: 'django',
    name: 'Django',
    icon: 'django',
    color: '#092E20',
    languages: ['python'],
  },
  'flask': {
    type: 'flask',
    name: 'Flask',
    icon: 'flask',
    color: '#000000',
    languages: ['python'],
  },
  'fastapi': {
    type: 'fastapi',
    name: 'FastAPI',
    icon: 'fastapi',
    color: '#009688',
    languages: ['python'],
  },
  'express': {
    type: 'express',
    name: 'Express',
    icon: 'express',
    color: '#000000',
    languages: ['javascript', 'typescript'],
  },
  'angular': {
    type: 'angular',
    name: 'Angular',
    icon: 'angular',
    color: '#DD0031',
    languages: ['typescript'],
  },
  'react': {
    type: 'react',
    name: 'React',
    icon: 'react',
    color: '#61DAFB',
    languages: ['javascript', 'typescript'],
  },
  'nextjs': {
    type: 'nextjs',
    name: 'Next.js',
    icon: 'nextjs',
    color: '#000000',
    languages: ['javascript', 'typescript'],
  },
  'vue': {
    type: 'vue',
    name: 'Vue.js',
    icon: 'vue',
    color: '#4FC08D',
    languages: ['javascript', 'typescript', 'vue'],
  },
  'nuxt': {
    type: 'nuxt',
    name: 'Nuxt',
    icon: 'nuxt',
    color: '#00DC82',
    languages: ['javascript', 'typescript', 'vue'],
  },
  'svelte': {
    type: 'svelte',
    name: 'Svelte',
    icon: 'svelte',
    color: '#FF3E00',
    languages: ['javascript', 'typescript'],
  },
};

/**
 * Component type display info
 */
export interface ComponentTypeInfo {
  type: FrameworkComponentType;
  label: string;
  labelPlural: string;
  icon: string;
  description: string;
}

/**
 * Component type info registry
 */
export const COMPONENT_TYPE_INFO: Record<FrameworkComponentType, ComponentTypeInfo> = {
  // Backend
  'controller': { type: 'controller', label: 'Controller', labelPlural: 'Controllers', icon: 'symbol-class', description: 'HTTP request handlers' },
  'service': { type: 'service', label: 'Service', labelPlural: 'Services', icon: 'symbol-method', description: 'Business logic services' },
  'repository': { type: 'repository', label: 'Repository', labelPlural: 'Repositories', icon: 'database', description: 'Data access layer' },
  'component': { type: 'component', label: 'Component', labelPlural: 'Components', icon: 'symbol-class', description: 'Generic components' },
  'configuration': { type: 'configuration', label: 'Configuration', labelPlural: 'Configurations', icon: 'settings-gear', description: 'Configuration classes' },
  'entity': { type: 'entity', label: 'Entity', labelPlural: 'Entities', icon: 'symbol-structure', description: 'Data entities/models' },
  'endpoint': { type: 'endpoint', label: 'Endpoint', labelPlural: 'Endpoints', icon: 'link', description: 'API endpoints' },
  'middleware': { type: 'middleware', label: 'Middleware', labelPlural: 'Middlewares', icon: 'filter', description: 'Request middleware' },
  'model': { type: 'model', label: 'Model', labelPlural: 'Models', icon: 'symbol-structure', description: 'Data models' },
  'serializer': { type: 'serializer', label: 'Serializer', labelPlural: 'Serializers', icon: 'json', description: 'Data serializers' },
  'view': { type: 'view', label: 'View', labelPlural: 'Views', icon: 'browser', description: 'View handlers' },
  'route': { type: 'route', label: 'Route', labelPlural: 'Routes', icon: 'git-compare', description: 'Route definitions' },
  'blueprint': { type: 'blueprint', label: 'Blueprint', labelPlural: 'Blueprints', icon: 'symbol-namespace', description: 'Flask blueprints' },
  'interceptor': { type: 'interceptor', label: 'Interceptor', labelPlural: 'Interceptors', icon: 'arrow-swap', description: 'Request/response interceptors' },
  'filter': { type: 'filter', label: 'Filter', labelPlural: 'Filters', icon: 'filter', description: 'Exception filters' },
  'exception-handler': { type: 'exception-handler', label: 'Exception Handler', labelPlural: 'Exception Handlers', icon: 'warning', description: 'Exception handlers' },
  // Frontend
  'page': { type: 'page', label: 'Page', labelPlural: 'Pages', icon: 'file', description: 'Page components' },
  'hook': { type: 'hook', label: 'Hook', labelPlural: 'Hooks', icon: 'symbol-event', description: 'Custom hooks' },
  'context': { type: 'context', label: 'Context', labelPlural: 'Contexts', icon: 'symbol-interface', description: 'React contexts' },
  'store': { type: 'store', label: 'Store', labelPlural: 'Stores', icon: 'archive', description: 'State stores' },
  'composable': { type: 'composable', label: 'Composable', labelPlural: 'Composables', icon: 'symbol-function', description: 'Vue composables' },
  'directive': { type: 'directive', label: 'Directive', labelPlural: 'Directives', icon: 'symbol-keyword', description: 'Custom directives' },
  'pipe': { type: 'pipe', label: 'Pipe', labelPlural: 'Pipes', icon: 'arrow-right', description: 'Transform pipes' },
  'guard': { type: 'guard', label: 'Guard', labelPlural: 'Guards', icon: 'shield', description: 'Route guards' },
  'module': { type: 'module', label: 'Module', labelPlural: 'Modules', icon: 'symbol-namespace', description: 'Feature modules' },
  'provider': { type: 'provider', label: 'Provider', labelPlural: 'Providers', icon: 'symbol-interface', description: 'Context providers' },
  'layout': { type: 'layout', label: 'Layout', labelPlural: 'Layouts', icon: 'layout', description: 'Layout components' },
  'api-route': { type: 'api-route', label: 'API Route', labelPlural: 'API Routes', icon: 'link', description: 'Server API routes' },
};

/**
 * Status of framework analysis
 */
export type FrameworkAnalysisStatus = 'none' | 'analyzing' | 'ready' | 'error' | 'no-framework';
