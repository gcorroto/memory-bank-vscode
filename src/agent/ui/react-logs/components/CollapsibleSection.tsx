/**
 * Collapsible Section Component
 * Reusable collapsible/expandable section
 */

import React, { useState } from 'react';

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    children,
    defaultExpanded = false,
    className = ''
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div className={`model-info ${expanded ? 'expanded' : ''} ${className}`}>
            <div 
                className="model-section-header"
                onClick={() => setExpanded(!expanded)}
            >
                <span>{expanded ? '▼' : '▶'}</span>
                <span style={{ marginLeft: '8px' }}>{title}</span>
            </div>
            {expanded && (
                <div className="model-content">
                    {children}
                </div>
            )}
        </div>
    );
};

