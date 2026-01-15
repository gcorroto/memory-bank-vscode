/**
 * useDashboard Hook
 * Manages dashboard state with reducer pattern
 * Connects to both VSCode API and dashboard state management
 */

import { useReducer, useCallback, useEffect } from 'react';
import { DashboardState, DashboardAction, PlannerPhase } from '../types';

const initialState: DashboardState = {
  mcps: {
    connections: [],
    tools: [],
    latency: {},
    initialized: false,
  },
  historico: {
    messages: [],
    totalTokens: 0,
    sessionId: '',
    startTime: Date.now(),
  },
  execution: {
    executing: [],
    completed: [],
    failed: [],
    totalExecuted: 0,
    currentParallelCount: 0,
    currentStep: 0,
  },
  validator: {
    checks: [],
    passedCount: 0,
    failedCount: 0,
    averagePassRate: 0,
  },
  planner: {
    steps: [],
    replanningHistory: [],
    currentPhase: 'planning',
  },
  testing: {
    testResults: [],
    passedCount: 0,
    failedCount: 0,
    coverage: 0,
    currentTest: '',
  },
  delegation: {
    externalRequests: [],
    pendingTasks: [],
  },
  isLoading: true,
  activeTab: 'mcps',
  theme: 'light',
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_THEME':
      return { ...state, theme: action.payload };

    case 'UPDATE_MCPS_CONNECTIONS':
      return {
        ...state,
        mcps: { ...state.mcps, connections: action.payload },
      };

    case 'UPDATE_MCPS_TOOLS':
      return {
        ...state,
        mcps: { ...state.mcps, tools: action.payload },
      };

    case 'UPDATE_MCPS_LATENCY':
      return {
        ...state,
        mcps: { ...state.mcps, latency: action.payload },
      };

    case 'ADD_HISTORICO_MESSAGE':
      return {
        ...state,
        historico: {
          ...state.historico,
          messages: [...state.historico.messages, action.payload],
        },
      };

    case 'UPDATE_HISTORICO_TOKENS':
      return {
        ...state,
        historico: {
          ...state.historico,
          totalTokens: action.payload,
        },
      };

    case 'ADD_EXECUTION_TOOL':
      return {
        ...state,
        execution: {
          ...state.execution,
          executing: [...state.execution.executing, action.payload],
        },
      };

    case 'COMPLETE_EXECUTION_TOOL':
      return {
        ...state,
        execution: {
          ...state.execution,
          executing: state.execution.executing.filter(t => t.id !== action.payload.id),
          completed: [...state.execution.completed, action.payload],
        },
      };

    case 'FAIL_EXECUTION_TOOL':
      return {
        ...state,
        execution: {
          ...state.execution,
          executing: state.execution.executing.filter(t => t.id !== action.payload.id),
          failed: [...state.execution.failed, action.payload],
        },
      };

    case 'ADD_VALIDATOR_CHECK':
      return {
        ...state,
        validator: {
          ...state.validator,
          checks: [...state.validator.checks, action.payload],
          passedCount: state.validator.passedCount + (action.payload.passed ? 1 : 0),
          failedCount: state.validator.failedCount + (action.payload.passed ? 0 : 1),
        },
      };

    case 'UPDATE_PLANNER_STEPS':
      return {
        ...state,
        planner: {
          ...state.planner,
          steps: action.payload,
        },
      };

    case 'ADD_REPLANNING_HISTORY':
      return {
        ...state,
        planner: {
          ...state.planner,
          replanningHistory: [...state.planner.replanningHistory, action.payload],
        },
      };

    case 'SET_PLANNER_PHASE':
      return {
        ...state,
        planner: {
          ...state.planner,
          currentPhase: action.payload as PlannerPhase,
        },
      };

    case 'ADD_TEST_RESULT':
      return {
        ...state,
        testing: {
          ...state.testing,
          testResults: [...state.testing.testResults, action.payload],
          passedCount: state.testing.passedCount + (action.payload.passed ? 1 : 0),
          failedCount: state.testing.failedCount + (action.payload.passed ? 0 : 1),
        },
      };

    case 'UPDATE_TEST_COVERAGE':
      return {
        ...state,
        testing: {
          ...state.testing,
          coverage: action.payload,
        },
      };

    case 'SET_CURRENT_TEST':
      return {
        ...state,
        testing: {
          ...state.testing,
          currentTest: action.payload,
        },
      };

    case 'UPDATE_DELEGATION_REQUESTS':
      return {
        ...state,
        delegation: {
            ...state.delegation,
            externalRequests: action.payload,
        }
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

export const useDashboard = () => {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  const updateMCPsConnections = useCallback((connections: any[]) => {
    dispatch({ type: 'UPDATE_MCPS_CONNECTIONS', payload: connections });
  }, []);

  const updateMCPsTools = useCallback((tools: any[]) => {
    dispatch({ type: 'UPDATE_MCPS_TOOLS', payload: tools });
  }, []);

  const updateMCPsLatency = useCallback((latency: Record<string, number>) => {
    dispatch({ type: 'UPDATE_MCPS_LATENCY', payload: latency });
  }, []);

  const addHistoricoMessage = useCallback((message: any) => {
    dispatch({ type: 'ADD_HISTORICO_MESSAGE', payload: message });
  }, []);

  const updateHistoricoTokens = useCallback((tokens: number) => {
    dispatch({ type: 'UPDATE_HISTORICO_TOKENS', payload: tokens });
  }, []);

  const addExecutionTool = useCallback((tool: any) => {
    dispatch({ type: 'ADD_EXECUTION_TOOL', payload: tool });
  }, []);

  const completeExecutionTool = useCallback((tool: any) => {
    dispatch({ type: 'COMPLETE_EXECUTION_TOOL', payload: tool });
  }, []);

  const failExecutionTool = useCallback((tool: any) => {
    dispatch({ type: 'FAIL_EXECUTION_TOOL', payload: tool });
  }, []);

  const addValidatorCheck = useCallback((check: any) => {
    dispatch({ type: 'ADD_VALIDATOR_CHECK', payload: check });
  }, []);

  const updatePlannerSteps = useCallback((steps: any[]) => {
    dispatch({ type: 'UPDATE_PLANNER_STEPS', payload: steps });
  }, []);

  const addReplanningHistory = useCallback((entry: any) => {
    dispatch({ type: 'ADD_REPLANNING_HISTORY', payload: entry });
  }, []);

  const setPlannerPhase = useCallback((phase: string) => {
    dispatch({ type: 'SET_PLANNER_PHASE', payload: phase });
  }, []);

  const addTestResult = useCallback((result: any) => {
    dispatch({ type: 'ADD_TEST_RESULT', payload: result });
  }, []);

  const updateTestCoverage = useCallback((coverage: number) => {
    dispatch({ type: 'UPDATE_TEST_COVERAGE', payload: coverage });
  }, []);

  const setCurrentTest = useCallback((testName: string) => {
    dispatch({ type: 'SET_CURRENT_TEST', payload: testName });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setActiveTab = useCallback((tab: any) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'high-contrast') => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const updateDelegationRequests = useCallback((requests: any[]) => {
    dispatch({ type: 'UPDATE_DELEGATION_REQUESTS', payload: requests });
  }, []);

  return {
    state,
    updateMCPsConnections,
    updateMCPsTools,
    updateMCPsLatency,
    addHistoricoMessage,
    updateHistoricoTokens,
    addExecutionTool,
    completeExecutionTool,
    failExecutionTool,
    addValidatorCheck,
    updatePlannerSteps,
    addReplanningHistory,
    setPlannerPhase,
    addTestResult,
    updateTestCoverage,
    setCurrentTest,
    setLoading,
    setActiveTab,
    setTheme,
    resetState,
    updateDelegationRequests,
  };
};

