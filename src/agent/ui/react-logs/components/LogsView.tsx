/**
 * Logs View Component
 * Main container for displaying logs
 */

import React from 'react';
import { LogEntry as LogEntryType } from '../types';
import { LogEntry } from './LogEntry';

interface LogsViewProps {
    entries: LogEntryType[];
}

export const LogsView: React.FC<LogsViewProps> = ({ entries }) => {
    if (entries.length === 0) {
        return (
            <div style={{ padding: '20px', color: 'var(--timestamp-color)' }}>
                <p>No hay logs para mostrar. Click en "Cargar Logs Históricos" para cargar eventos pasados.</p>
            </div>
        );
    }

    return (
        <div style={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '20px'
        }}>
            {entries.map((entry, index) => (
                <LogEntry key={`${entry.type}-${index}-${entry.timestamp}`} entry={entry} />
            ))}
        </div>
    );
};

