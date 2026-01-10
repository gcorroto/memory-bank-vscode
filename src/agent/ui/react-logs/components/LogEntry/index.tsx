/**
 * Log Entry Wrapper
 * Routes to appropriate log component based on type
 */

import React from 'react';
import { LogEntry as LogEntryType } from '../../types';
import { StepLog } from './StepLog';
import { PlanLog } from './PlanLog';
import { ReflectionLog } from './ReflectionLog';
import { BuildRulesLog } from './BuildRulesLog';

interface LogEntryProps {
    entry: LogEntryType;
}

export const LogEntry: React.FC<LogEntryProps> = ({ entry }) => {
    switch (entry.type) {
        case 'step':
            return <StepLog entry={entry} />;
        case 'plan':
            return <PlanLog entry={entry} />;
        case 'reflection':
            return <ReflectionLog entry={entry} />;
        case 'build_rules':
            return <BuildRulesLog entry={entry} />;
        default:
            return (
                <div className="log-entry">
                    <div className="log-header">
                        <span className="log-timestamp">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="log-title">Unknown log type: {entry.type}</span>
                    </div>
                </div>
            );
    }
};

