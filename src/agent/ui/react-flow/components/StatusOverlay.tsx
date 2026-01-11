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
            
            <div className="stats-badges">
                <div className="badge badge-total">
                    <span className="badge-label">Total</span>
                    <span className="badge-value">{stats.total}</span>
                </div>
                
                {stats.completed > 0 && (
                    <div className="badge badge-success">
                        <span className="badge-label">✓ Completados</span>
                        <span className="badge-value">{stats.completed}</span>
                    </div>
                )}
                
                {stats.running > 0 && (
                    <div className="badge badge-running">
                        <span className="badge-label">▶ Ejecutando</span>
                        <span className="badge-value">{stats.running}</span>
                    </div>
                )}
                
                {stats.failed > 0 && (
                    <div className="badge badge-error">
                        <span className="badge-label">✗ Fallidos</span>
                        <span className="badge-value">{stats.failed}</span>
                    </div>
                )}
                
                {stats.pending > 0 && (
                    <div className="badge badge-pending">
                        <span className="badge-label">⋯ Pendientes</span>
                        <span className="badge-value">{stats.pending}</span>
                    </div>
                )}
            </div>

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

