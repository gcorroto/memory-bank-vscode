/**
 * Hook to detect and track VSCode theme
 */

import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'high-contrast';

export const useTheme = (): Theme => {
    const [theme, setTheme] = useState<Theme>(() => {
        // Detect initial theme from body class
        if (document.body.classList.contains('vscode-dark')) {
            return 'dark';
        } else if (document.body.classList.contains('vscode-high-contrast')) {
            return 'high-contrast';
        }
        return 'light';
    });

    useEffect(() => {
        // Watch for theme changes via MutationObserver
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (document.body.classList.contains('vscode-dark')) {
                        setTheme('dark');
                    } else if (document.body.classList.contains('vscode-high-contrast')) {
                        setTheme('high-contrast');
                    } else {
                        setTheme('light');
                    }
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

        return () => observer.disconnect();
    }, []);

    return theme;
};

