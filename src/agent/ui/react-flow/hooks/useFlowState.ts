/**
 * Hook for managing flow state and layout
 */

import { useState, useCallback, useMemo } from 'react';
import dagre from 'dagre';
import { Plan, PlanStep, FlowNode, FlowEdge, ExecutionUpdate } from '../types';

const NODE_WIDTH = 250;
const NODE_HEIGHT = 150;

export const useFlowState = (initialPlan: Plan | null, initialUpdates: ExecutionUpdate[]) => {
    const [plan, setPlan] = useState<Plan | null>(initialPlan);
    const [executionUpdates, setExecutionUpdates] = useState<ExecutionUpdate[]>(initialUpdates);

    // Convert plan to nodes and edges with dagre layout
    const { nodes, edges } = useMemo(() => {
        if (!plan) {
            return { nodes: [], edges: [] };
        }

        // Create dagre graph
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });

        // Create nodes
        const flowNodes: FlowNode[] = plan.steps.map((step, index) => {
            const updateForStep = executionUpdates.find(u => u.stepIndex === index);
            const status = updateForStep ? updateForStep.status : 'pending';

            const node: FlowNode = {
                id: `step-${index}`,
                type: 'planNode',
                data: {
                    step,
                    index,
                    status
                },
                position: { x: 0, y: 0 } // Will be calculated by dagre
            };

            dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
            return node;
        });

        // Create edges based on dependencies
        const flowEdges: FlowEdge[] = [];
        plan.steps.forEach((step, index) => {
            // Detect references to previous steps in params
            const refs = detectStepReferences(step, index);
            
            refs.forEach(refIndex => {
                const edge: FlowEdge = {
                    id: `e${refIndex}-${index}`,
                    source: `step-${refIndex}`,
                    target: `step-${index}`,
                    animated: false,
                    style: { stroke: 'var(--border-color)' }
                };
                flowEdges.push(edge);
                dagreGraph.setEdge(edge.source, edge.target);
            });

            // If no dependencies, connect to previous step
            if (refs.length === 0 && index > 0) {
                const edge: FlowEdge = {
                    id: `e${index - 1}-${index}`,
                    source: `step-${index - 1}`,
                    target: `step-${index}`,
                    animated: false,
                    style: { stroke: 'var(--border-color)', strokeDasharray: '5 5' }
                };
                flowEdges.push(edge);
                dagreGraph.setEdge(edge.source, edge.target);
            }
        });

        // Calculate layout
        dagre.layout(dagreGraph);

        // Apply positions from dagre
        flowNodes.forEach(node => {
            const nodeWithPosition = dagreGraph.node(node.id);
            node.position = {
                x: nodeWithPosition.x - NODE_WIDTH / 2,
                y: nodeWithPosition.y - NODE_HEIGHT / 2
            };
        });

        return { nodes: flowNodes, edges: flowEdges };
    }, [plan, executionUpdates]);

    const updatePlan = useCallback((newPlan: Plan) => {
        setPlan(newPlan);
        setExecutionUpdates([]); // Reset execution updates when new plan arrives
    }, []);

    const addExecutionUpdate = useCallback((update: ExecutionUpdate) => {
        setExecutionUpdates(prev => {
            // Replace update if it exists for the same step
            const existingIndex = prev.findIndex(u => u.stepIndex === update.stepIndex);
            if (existingIndex >= 0) {
                const newUpdates = [...prev];
                newUpdates[existingIndex] = update;
                return newUpdates;
            }
            return [...prev, update];
        });
    }, []);

    const stats = useMemo(() => {
        const total = plan?.steps.length || 0;
        const completed = executionUpdates.filter(u => u.status === 'success').length;
        const failed = executionUpdates.filter(u => u.status === 'error').length;
        const running = executionUpdates.filter(u => u.status === 'running').length;
        const pending = total - completed - failed - running;

        return { total, completed, failed, running, pending };
    }, [plan, executionUpdates]);

    return {
        plan,
        nodes,
        edges,
        stats,
        updatePlan,
        addExecutionUpdate
    };
};

/**
 * Detect references to previous steps in params
 */
function detectStepReferences(step: PlanStep, currentIndex: number): number[] {
    const refs: number[] = [];
    const paramsStr = JSON.stringify(step.params || {});
    
    // Look for patterns like $STEP[0], $STEP[1].result, etc.
    const regex = /\$STEP\[(\d+)\]/g;
    let match;
    
    while ((match = regex.exec(paramsStr)) !== null) {
        const refIndex = parseInt(match[1], 10);
        if (refIndex < currentIndex && !refs.includes(refIndex)) {
            refs.push(refIndex);
        }
    }

    // Also check dependsOn if available
    if (step.dependsOn && Array.isArray(step.dependsOn)) {
        step.dependsOn.forEach(depIndex => {
            if (depIndex < currentIndex && !refs.includes(depIndex)) {
                refs.push(depIndex);
            }
        });
    }

    return refs;
}

