/**
 * Session Tabs Component
 * Tab navigation for different log sessions
 */

import React from 'react';
import { LogSession } from '../types';

interface SessionTabsProps {
    sessions: LogSession[];
    activeSessionId: string;
    onSwitchSession: (sessionId: string) => void;
}

export const SessionTabs: React.FC<SessionTabsProps> = ({
    sessions,
    activeSessionId,
    onSwitchSession
}) => {
    return (
        <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto',
            padding: '0 20px'
        }}>
            {sessions.map(session => (
                <button
                    key={session.id}
                    onClick={() => onSwitchSession(session.id)}
                    style={{
                        padding: '10px 15px',
                        cursor: 'pointer',
                        backgroundColor: session.id === activeSessionId 
                            ? 'var(--tab-active-bg)' 
                            : 'var(--tab-bg)',
                        border: 'none',
                        outline: 'none',
                        marginRight: '2px',
                        color: 'var(--text-color)',
                        borderTopLeftRadius: '4px',
                        borderTopRightRadius: '4px',
                        borderBottom: session.id === activeSessionId 
                            ? '2px solid var(--accent-color)' 
                            : 'none',
                        fontWeight: session.id === activeSessionId ? 'bold' : 'normal'
                    }}
                >
                    {session.name}
                </button>
            ))}
        </div>
    );
};

