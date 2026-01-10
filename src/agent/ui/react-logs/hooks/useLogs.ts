/**
 * Hook for managing logs state
 */

import { useState, useCallback } from 'react';
import { LogSession, LogEntry } from '../types';

export const useLogs = (initialSessions: LogSession[], initialActiveId: string) => {
    const [sessions, setSessions] = useState<LogSession[]>(initialSessions);
    const [activeSessionId, setActiveSessionId] = useState<string>(initialActiveId);

    const getActiveSession = useCallback(() => {
        return sessions.find(s => s.id === activeSessionId) || sessions[0];
    }, [sessions, activeSessionId]);

    const addLogEntry = useCallback((entry: LogEntry, sessionId?: string) => {
        setSessions(prev => {
            const targetId = sessionId || activeSessionId;
            return prev.map(session => {
                if (session.id === targetId) {
                    return {
                        ...session,
                        entries: [...session.entries, {
                            ...entry,
                            timestamp: entry.timestamp || new Date()
                        }]
                    };
                }
                return session;
            });
        });
    }, [activeSessionId]);

    const clearLogs = useCallback((sessionId?: string) => {
        setSessions(prev => {
            const targetId = sessionId || activeSessionId;
            return prev.map(session => {
                if (session.id === targetId) {
                    return {
                        ...session,
                        entries: []
                    };
                }
                return session;
            });
        });
    }, [activeSessionId]);

    const createSession = useCallback((name: string) => {
        const newSession: LogSession = {
            id: `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name,
            entries: [],
            createdAt: new Date()
        };
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
        return newSession.id;
    }, []);

    const switchSession = useCallback((sessionId: string) => {
        if (sessions.find(s => s.id === sessionId)) {
            setActiveSessionId(sessionId);
        }
    }, [sessions]);

    const updateSessions = useCallback((newSessions: LogSession[]) => {
        setSessions(newSessions);
    }, []);

    return {
        sessions,
        activeSessionId,
        activeSession: getActiveSession(),
        addLogEntry,
        clearLogs,
        createSession,
        switchSession,
        updateSessions
    };
};

