/**
 * Flow View Component
 * Main React Flow canvas
 */

import React, { useCallback } from 'react';
import ReactFlow, {
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';

import { PlanNode } from './PlanNode';
import { StatusOverlay } from './StatusOverlay';
import { FlowNode, FlowEdge } from '../types';

const nodeTypes = {
    planNode: PlanNode
};

interface FlowViewProps {
    initialNodes: FlowNode[];
    initialEdges: FlowEdge[];
    stats: {
        total: number;
        completed: number;
        failed: number;
        running: number;
        pending: number;
    };
}

export const FlowView: React.FC<FlowViewProps> = ({
    initialNodes,
    initialEdges,
    stats
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Update nodes when initialNodes changes
    React.useEffect(() => {
        setNodes(initialNodes);
    }, [initialNodes, setNodes]);

    // Update edges when initialEdges changes
    React.useEffect(() => {
        setEdges(initialEdges);
    }, [initialEdges, setEdges]);

    if (nodes.length === 0) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--timestamp-color)'
            }}>
                <p>No hay plan para visualizar. Ejecuta una tarea para ver el flujo de decisiones.</p>
            </div>
        );
    }

    return (
        <div className="flow-container">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={2}
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                <Controls />
                <MiniMap
                    nodeColor={(node) => {
                        const status = node.data.status;
                        switch (status) {
                            case 'success':
                                return '#22cc44';
                            case 'error':
                                return '#f14c4c';
                            case 'running':
                                return '#0e639c';
                            default:
                                return '#7d7d7d';
                        }
                    }}
                    maskColor="rgba(0, 0, 0, 0.1)"
                />
            </ReactFlow>

            <StatusOverlay stats={stats} />
        </div>
    );
};

