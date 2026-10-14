import { useEffect, useState } from 'react';

/**
 * Reactively tracks `prefers-reduced-motion: reduce`. Returns true when
 * the user has asked the OS to reduce motion, and updates if they change
 * the setting while the app is running.
 *
 * Used by every animated surface in Design polish Phase 1 to swap springs
 * for short opacity cross-fades. The Apple Design reference is emphatic
 * about this: reduced motion means a *gentler* equivalent, not no feedback.
 * See decisions.md — Design direction (2026-10-14).
 */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
        // Modern API
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return reduced;
}