/**
 * Types for Memory Bank Agent Dashboard
 */

// ============================================================================
// MCP Types
// ============================================================================

export interface MCPConnection {
  name: string;
  status: 'connected' | 'failed' | 'idle' | 'connecting';
  error?: string;
  latency?: number;
  tools: MCPTool[];
  lastChecked?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
}

export interface MCPsState {
  connections: MCPConnection[];
  tools: MCPTool[];
  latency: Record<string, number>;
  initialized: boolean;
  totalTools?: number;
  lastRefresh?: number;
}

// ============================================================================
// Message/History Types
// ============================================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens?: number;
  metadata?: {
    contextDocs?: string[];
    model?: string;
    reasoning?: string;
  };
}

export interface HistoricoState {
  messages: Message[];
  totalTokens: number;
  sessionStartTime?: number;
  startTime?: number;
  sessionId: string;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutingTool {
  id: string;
  toolName: string;
  params: Record<string, any>;
  status: 'running' | 'success' | 'error' | 'pending';
  progress?: number; // 0-100
  result?: any;
  error?: string;
  startTime: number;
  endTime?: number;
  duration?: number; // ms
  parentStepId?: string;
}

export interface ExecutionState {
  executing: ExecutingTool[];
  completed: ExecutingTool[];
  failed: ExecutingTool[];
  totalExecuted: number;
  currentParallelCount: number;
  currentStep?: number;
}

// ============================================================================
// Validator Types
// ============================================================================

export interface ValidationCheck {
  name: string;
  description: string;
  expected?: any;
  actual?: any;
  passed: boolean;
  details?: string;
}

export interface Validation {
  id: string;
  rule: string;
  description: string;
  checks: ValidationCheck[];
  passed: boolean;
  overallPassed?: boolean;
  recommendation?: string;
  timestamp: number;
}

export interface ValidatorState {
  checks: Validation[];
  passedCount: number;
  failedCount: number;
  averagePassRate: number;
  currentValidation?: Validation;
  validationHistory?: Validation[];
  passRate?: number;
}

// ============================================================================
// Planner Types
// ============================================================================

export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  tool?: string;
  params?: Record<string, any>;
  result?: any;
  error?: string;
  progress?: number;
  dependencies?: string[];
  startTime?: number;
  endTime?: number;
}

export type PlannerPhase = 'planning' | 'executing' | 'validating' | 'replanning' | 'done';

export interface Plan {
  id: string;
  version: number;
  steps: PlanStep[];
  replanningCount: number;
  replanningReasons: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PlannerState {
  steps: PlanStep[];
  replanningHistory: Array<{timestamp: number; reason: string; previousSteps: number; newSteps: number; changes?: string[]}>;
  currentPhase: PlannerPhase;
  currentPlan?: Plan;
  planHistory?: Plan[];
  autoReplanningEnabled?: boolean;
}

// ============================================================================
// Testing Types
// ============================================================================

export interface TestResult {
  name: string;
  passed: boolean;
  status?: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  assertions?: number;
}

export interface TestFile {
  filePath: string;
  framework: 'jest' | 'mocha' | 'jasmine';
  status: 'passed' | 'failed' | 'running' | 'not-run';
  results: TestResult[];
  coverage: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  totalTests: number;
  passedTests: number;
  duration: number;
  createdAt: number;
}

export interface TestingState {
  testResults: TestResult[];
  tests?: Record<string, TestFile>;
  totalTests?: number;
  passedCount: number;
  failedCount: number;
  coverage: number;
  currentTest?: string;
  overallCoverage?: number;
  artifacts?: string[];
}

// ============================================================================
// Dashboard State (Main)
// ============================================================================

export interface DashboardState {
  mcps: MCPsState;
  historico: HistoricoState;
  execution: ExecutionState;
  validator: ValidatorState;
  planner: PlannerState;
  testing: TestingState;
  delegation: DelegationState;
  
  // Global
  isLoading: boolean;
  activeTab: TabType;
  theme: 'light' | 'dark' | 'high-contrast';
}

// ============================================================================
// VSCode Message Types
// ============================================================================

export interface VSCodeMessage {
  command: string;
  payload?: any;
  [key: string]: any;
}

export interface UpdateDashboardMessage extends VSCodeMessage {
  command: 'updateDashboard';
  payload: {
    mcps?: MCPsState;
    historico?: HistoricoState;
    execution?: ExecutionState;
    validator?: ValidatorState;
    planner?: PlannerState;
    testing?: TestingState;
  };
}

// ============================================================================
// Action Types (Reducer)
// ============================================================================

export type DashboardAction =
  | { type: 'UPDATE_DASHBOARD'; payload: Partial<DashboardState> }
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'high-contrast' }
  | { type: 'UPDATE_MCPS'; payload: MCPsState }
  | { type: 'UPDATE_MCPS_CONNECTIONS'; payload: MCPConnection[] }
  | { type: 'UPDATE_MCPS_TOOLS'; payload: MCPTool[] }
  | { type: 'UPDATE_MCPS_LATENCY'; payload: Record<string, number> }
  | { type: 'UPDATE_HISTORICO'; payload: HistoricoState }
  | { type: 'ADD_HISTORICO_MESSAGE'; payload: Message }
  | { type: 'UPDATE_HISTORICO_TOKENS'; payload: number }
  | { type: 'UPDATE_EXECUTION'; payload: ExecutionState }
  | { type: 'ADD_EXECUTION_TOOL'; payload: ExecutingTool }
  | { type: 'COMPLETE_EXECUTION_TOOL'; payload: ExecutingTool }
  | { type: 'FAIL_EXECUTION_TOOL'; payload: ExecutingTool }
  | { type: 'UPDATE_VALIDATOR'; payload: ValidatorState }
  | { type: 'ADD_VALIDATOR_CHECK'; payload: Validation }
  | { type: 'UPDATE_PLANNER'; payload: PlannerState }
  | { type: 'UPDATE_PLANNER_STEPS'; payload: PlanStep[] }
  | { type: 'ADD_REPLANNING_HISTORY'; payload: {timestamp: number; reason: string; previousSteps: number; newSteps: number; changes?: string[]} }
  | { type: 'SET_PLANNER_PHASE'; payload: string }
  | { type: 'UPDATE_TESTING'; payload: TestingState }
  | { type: 'ADD_TEST_RESULT'; payload: TestResult }
  | { type: 'UPDATE_TEST_COVERAGE'; payload: number }
  | { type: 'SET_CURRENT_TEST'; payload: string }
  | { type: 'UPDATE_DELEGATION_REQUESTS'; payload: ExternalRequest[]; pendingTasks: any[] }
  | { type: 'SET_LAUNCHER_DATA'; payload: { task: string; configuredMCPs?: Record<string, any> } }
  | { type: 'RESET_STATE' }
  | { type: 'RESET' };

// ============================================================================
// Window Extension Types
// ============================================================================

export interface VSCodeAPI {
  postMessage(message: VSCodeMessage): void;
}

// Note: Window interface extended in react-flow/types/index.ts
// with vscode and __INITIAL_STATE__ as any (avoids type conflicts between webviews)

// ============================================================================
// Delegation Types
// ============================================================================

export interface ExternalRequest {
  id: string;
  projectId?: string;
  title: string;
  fromProject: string;
  context: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'IN_PROGRESS';
  receivedAt: string;
}

export interface PendingTask {
  id: string;
  projectId?: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
}

export interface DelegationState {
  externalRequests: ExternalRequest[];
  pendingTasks: PendingTask[]; 
}

export type TabType = 'mcps' | 'historico' | 'execution' | 'validator' | 'planner' | 'testing' | 'delegation' | 'launcher';

export interface DashboardState {
  mcps: MCPsState;
  historico: HistoricoState;
  execution: ExecutionState;
  validator: ValidatorState;
  planner: PlannerState;
  testing: TestingState;
  delegation: DelegationState;
  launcherData?: { 
    task: string;
    configuredMCPs?: Record<string, any>; 
  };
  launcherState?: {
    task?: string;
    executionMode: 'ide' | 'cli';
    agentType: string;
    selectedInternalTasks: string[];
    selectedExternalRequests: string[];
    selectedMCPs: string[];
    expandedMCPs: string[];
    model: string;
  };
  projectId?: string; // Global project ID
  activeTab: TabType;
  theme: 'light' | 'dark' | 'high-contrast';
  isLoading: boolean;
}

export type DashboardAction =
  | { type: 'UPDATE_DASHBOARD'; payload: Partial<DashboardState> }
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'high-contrast' }
  | { type: 'UPDATE_MCPS'; payload: MCPsState }
  | { type: 'UPDATE_MCPS_CONNECTIONS'; payload: MCPConnection[] }
  | { type: 'UPDATE_MCPS_TOOLS'; payload: MCPTool[] }
  | { type: 'UPDATE_MCPS_LATENCY'; payload: Record<string, number> }
  | { type: 'UPDATE_HISTORICO'; payload: HistoricoState }
  | { type: 'ADD_HISTORICO_MESSAGE'; payload: Message }
  | { type: 'UPDATE_HISTORICO_TOKENS'; payload: number }
  | { type: 'UPDATE_EXECUTION'; payload: ExecutionState }
  | { type: 'ADD_EXECUTION_TOOL'; payload: ExecutingTool }
  | { type: 'COMPLETE_EXECUTION_TOOL'; payload: ExecutingTool }
  | { type: 'FAIL_EXECUTION_TOOL'; payload: ExecutingTool }
  | { type: 'UPDATE_VALIDATOR'; payload: ValidatorState }
  | { type: 'ADD_VALIDATOR_CHECK'; payload: Validation }
  | { type: 'UPDATE_PLANNER'; payload: PlannerState }
  | { type: 'UPDATE_PLANNER_STEPS'; payload: PlanStep[] }
  | { type: 'ADD_REPLANNING_HISTORY'; payload: {timestamp: number; reason: string; previousSteps: number; newSteps: number; changes?: string[]} }
  | { type: 'SET_PLANNER_PHASE'; payload: string }
  | { type: 'UPDATE_TESTING'; payload: TestingState }
  | { type: 'ADD_TEST_RESULT'; payload: TestResult }
  | { type: 'UPDATE_TEST_COVERAGE'; payload: number }
  | { type: 'SET_CURRENT_TEST'; payload: string }
  | { type: 'UPDATE_DELEGATION_REQUESTS'; payload: ExternalRequest[]; pendingTasks: any[] }
  | { type: 'SET_LAUNCHER_DATA'; payload: { task: string; configuredMCPs?: Record<string, any> } }
  | { type: 'UPDATE_LAUNCHER_STATE'; payload: any }
  | { type: 'SET_PROJECT_ID'; payload: string }
  | { type: 'RESET_STATE' }
  | { type: 'RESET' };
