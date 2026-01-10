/**
 * Hook for managing execution updates in real-time
 */

import { useEffect } from 'react';
import { ExecutionUpdate, Plan } from '../types';

export const useExecutionUpdates = (
    onPlanUpdate: (plan: Plan) => void,
    onExecutionUpdate: (update: ExecutionUpdate) => void
) => {
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            switch (message.command) {
                case 'updatePlan':
                    if (message.plan) {
                        onPlanUpdate(message.plan);
                    }
                    break;

                case 'executionUpdate':
                    if (message.executionUpdate) {
                        onExecutionUpdate(message.executionUpdate);
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onPlanUpdate, onExecutionUpdate]);
};

