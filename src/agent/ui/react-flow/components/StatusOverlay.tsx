/**
 * Status Overlay Component
 * Displays real-time execution statistics
 */

import React from 'react';

interface StatusOverlayProps {
    stats: {
        total: number;
        completed: number;
        failed: number;
        running: number;
        pending: number;
    };
    modelInfo?: {
        name: string;
        tokenCount?: number;
    };
}

export const StatusOverlay: React.FC<StatusOverlayProps> = ({ stats, modelInfo }) => {
    return (
        <div className="status-overlay">
            <h3>📊 Estado de Ejecución</h3>
            
            <p>
                <span className="stat-label">Total pasos:</span>
                <span className="stat-value">{stats.total}</span>
            </p>

            <p>
                <span className="stat-label">Completados:</span>
                <span className="stat-value success">{stats.completed}</span>
            </p>

            <p>
                <span className="stat-label">Fallidos:</span>
                <span className="stat-value error">{stats.failed}</span>
            </p>

            <p>
                <span className="stat-label">En ejecución:</span>
                <span className="stat-value pending">{stats.running}</span>
            </p>

            <p>
                <span className="stat-label">Pendientes:</span>
                <span className="stat-value pending">{stats.pending}</span>
            </p>

            {modelInfo && (
                <>
                    <hr style={{ margin: '10px 0', borderColor: 'rgba(255,255,255,0.2)' }} />
                    <p>
                        <span className="stat-label">Modelo:</span>
                        <span className="stat-value">{modelInfo.name}</span>
                    </p>
                    {modelInfo.tokenCount && (
                        <p>
                            <span className="stat-label">Tokens:</span>
                            <span className="stat-value">{modelInfo.tokenCount}</span>
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

